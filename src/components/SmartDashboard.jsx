import { useEffect, useState, useRef } from "react";
import { getLiquidation, getOI, getFunding, getPrice } from "../services/api";

const API = "https://jainy-crypto-backend.onrender.com";

// ================= SIGNAL =================
function calculateSignal(liq, oi, fr) {
  const latest = liq.at(-1);
  const prev = liq.at(-2) || {};

  const longLiq = Number(latest?.aggregated_long_liquidation_usd || 0);
  const shortLiq = Number(latest?.aggregated_short_liquidation_usd || 0);

  const prevLong = Number(prev?.aggregated_long_liquidation_usd || 0);
  const prevShort = Number(prev?.aggregated_short_liquidation_usd || 0);

  const frValue = Number(fr.at(-1)?.close || 0);

  let score = 50;

  if (longLiq > prevLong * 2) score += 25;
  if (shortLiq > prevShort * 2) score -= 25;

  if (shortLiq > longLiq) score += 15;
  else score -= 15;

  if (frValue < 0) score += 10;
  else score -= 10;

  return { score };
}

// ================= TRADE =================
function buildTrade(price, direction, capital, rr) {
  const riskPercent = 0.02;
  const vol = price * 0.01;

  const sl = direction === "LONG" ? price - vol * 1.2 : price + vol * 1.2;
  const risk = Math.abs(price - sl);
  if (!risk) return null;

  const size = (capital * riskPercent) / risk;

  const final = direction === "LONG" ? price + risk * rr : price - risk * rr;

  return {
    id: Date.now(),
    type: direction,
    entry: price,
    sl,
    final,
    size,
    risk,
    rr,
    startTime: Date.now(),
  };
}

export default function SmartDashboard() {
  const defaultSystems = {
    LONG_STRICT: { capital: 1000, history: [], trade: null },
    SHORT_STRICT: { capital: 1000, history: [], trade: null },
    LONG_LOOSE: { capital: 1000, history: [], trade: null },
    SHORT_LOOSE: { capital: 1000, history: [], trade: null },
  };

  const [systems, setSystems] = useState(defaultSystems);
  const [version, setVersion] = useState(0);
  const [openHistory, setOpenHistory] = useState({});
  const [tfData, setTfData] = useState({});
  const systemsRef = useRef(defaultSystems);

  // ===== LOAD =====
  useEffect(() => {
    Notification.requestPermission();

    fetch(`${API}/get-state`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.systems) {
          setSystems(data.systems);
          setVersion(data.version || 0);
        }
      });
  }, []);

  // ===== SAVE FUNCTION =====
  const saveState = async (newSystems) => {
    const newVersion = version + 1;

    try {
      const res = await fetch(`${API}/save-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systems: newSystems, version: newVersion }),
      });

      const data = await res.json();

      if (!data.success && data.latest) {
        setSystems(data.latest.systems);
        setVersion(data.latest.version);
        return;
      }

      setVersion(newVersion);
    } catch (e) {
      console.log("Save error", e);
    }
  };

  // ===== KEEP REF UPDATED =====
  useEffect(() => {
    systemsRef.current = systems;
  }, [systems]);

  // ===== MAIN ENGINE =====
  useEffect(() => {
    const run = async () => {
      try {
        const [liq, oi, fr] = await Promise.all([
          getLiquidation("4h"),
          getOI("4h"),
          getFunding("4h"),
        ]);

        const signal = calculateSignal(
          liq?.data?.data || [],
          oi?.data?.data || [],
          fr?.data?.data || [],
        );

        setTfData({
          "4H": signal.score > 50 ? "Bullish" : "Bearish",
          "1D": signal.score > 55 ? "Bullish" : "Bearish",
          "1W": signal.score > 60 ? "Bullish" : "Bearish",
        });

        const priceRes = await getPrice("4h");
        const price = Number(priceRes?.data?.data?.at(-1)?.close);
        if (!price) return;

        const newSystems = { ...systemsRef.current };

        let changed = false;

        // ===== ENTRY =====
        Object.entries(newSystems).forEach(([key, sys]) => {
          if (sys.trade) return;

          let direction = null;

          if (key === "LONG_STRICT" && signal.score >= 60) direction = "LONG";
          if (key === "SHORT_STRICT" && signal.score <= 40) direction = "SHORT";
          if (key === "LONG_LOOSE" && signal.score >= 55) direction = "LONG";
          if (key === "SHORT_LOOSE" && signal.score <= 45) direction = "SHORT";

          if (!direction) return;

          const rr = key.includes("STRICT") ? 2 : 1.2;
          const trade = buildTrade(price, direction, sys.capital, rr);
          if (!trade) return;

          sys.trade = trade;
          changed = true;

          if (Notification.permission === "granted") {
            new Notification(`${key} ENTRY ${direction}`);
          }
        });

        // ===== EXIT =====
        Object.entries(newSystems).forEach(([key, sys]) => {
          const t = sys.trade;
          if (!t) return;

          let result = null;

          if (t.type === "LONG") {
            if (price >= t.final) result = "win";
            if (price <= t.sl) result = "loss";
          } else {
            if (price <= t.final) result = "win";
            if (price >= t.sl) result = "loss";
          }

          if (!result) return;

          const pnl =
            result === "win" ? t.risk * t.size * t.rr : -t.risk * t.size;

          sys.capital += pnl;

          sys.history.unshift({
            ...t,
            exit: price,
            pnl,
            result,
            endTime: Date.now(),
            duration: ((Date.now() - t.startTime) / 1000).toFixed(0),
          });

          sys.trade = null;
          changed = true;

          if (Notification.permission === "granted") {
            new Notification(`${key} ${result.toUpperCase()}`);
          }
        });

        if (changed) {
          setSystems(newSystems);
          saveState(newSystems);
        }
      } catch (e) {
        console.log(e);
      }
    };

    const interval = setInterval(run, 10000);
    return () => clearInterval(interval);
  }, []);

  // ===== UI =====
  return (
    <div className="p-4">
      <div className="mb-4">
        <h3>Market Bias</h3>
        {Object.entries(tfData).map(([k, v]) => (
          <p key={k}>
            {k}: {v}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(systems).map(([key, sys]) => (
          <div key={key} className="p-3 bg-black/30 rounded">
            <h2>{key}</h2>
            <p>Capital: ${sys.capital.toFixed(2)}</p>

            {sys.trade ? (
              <div className="bg-green-700 p-2 mt-2 text-sm">
                <p>Type: {sys.trade.type}</p>
                <p>Entry: {sys.trade.entry.toFixed(0)}</p>
                <p className="text-red-300">SL: {sys.trade.sl.toFixed(0)}</p>
                <p className="text-green-300">
                  TP: {sys.trade.final.toFixed(0)}
                </p>
              </div>
            ) : (
              <p>No Trade</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
