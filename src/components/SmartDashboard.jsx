import { useEffect, useState, useRef } from "react";
import { getLiquidation, getOI, getFunding, getPrice } from "../services/api";

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

  const longSweep = longLiq > prevLong * 2 && longLiq > 500000;
  const shortSweep = shortLiq > prevShort * 2 && shortLiq > 500000;

  if (longSweep) score += 25;
  if (shortSweep) score -= 25;

  if (shortLiq > longLiq) score += 15;
  else score -= 15;

  if (frValue < 0) score += 10;
  else score -= 10;

  return { score, longSweep, shortSweep };
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
  };
}

export default function SmartDashboard() {
  const [systems, setSystems] = useState(() => {
    const saved = localStorage.getItem("systems_final_v2");
    return (
      JSON.parse(saved) || {
        LONG_STRICT: { capital: 1000, history: [], trade: null },
        SHORT_STRICT: { capital: 1000, history: [], trade: null },
        LONG_LOOSE: { capital: 1000, history: [], trade: null },
        SHORT_LOOSE: { capital: 1000, history: [], trade: null },
      }
    );
  });

  const [openHistory, setOpenHistory] = useState({});

  const systemsRef = useRef(systems);

  // ================= LOAD =================
  useEffect(() => {
    Notification.requestPermission();
  }, []);

  // ================= SAVE =================
  useEffect(() => {
    systemsRef.current = systems;
    localStorage.setItem("systems_final_v2", JSON.stringify(systems));
  }, [systems]);

  useEffect(() => {
    let interval;

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

        const priceRes = await getPrice("4h");
        const price = Number(priceRes?.data?.data?.at(-1)?.close);
        if (!price) return;

        const newSystems = { ...systemsRef.current };

        Object.entries(newSystems).forEach(([key, sys]) => {
          // ENTRY
          if (!sys.trade) {
            let direction = null;

            if (key === "LONG_STRICT" && signal.score >= 60) direction = "LONG";
            if (key === "SHORT_STRICT" && signal.score <= 40)
              direction = "SHORT";

            if (key === "LONG_LOOSE" && signal.score >= 55) direction = "LONG";
            if (key === "SHORT_LOOSE" && signal.score <= 45)
              direction = "SHORT";

            if (!direction) return;

            const rr = key.includes("STRICT") ? 2 : 1.2;

            const trade = buildTrade(price, direction, sys.capital, rr);
            if (!trade) return;

            sys.trade = trade;

            // 🔔 ENTRY NOTIFICATION
            new Notification(`${key} ENTRY ${direction}`, {
              body: `Entry: ${price.toFixed(0)} | RR: ${rr}`,
            });
          }

          // EXIT
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

          if (result) {
            const pnl =
              result === "win" ? t.risk * t.size * t.rr : -t.risk * t.size;

            sys.capital += pnl;

            sys.history.unshift({
              ...t,
              exit: price,
              pnl,
              result,
              date: new Date().toLocaleString(),
            });

            // 🔔 EXIT NOTIFICATION
            new Notification(`${key} ${result.toUpperCase()}`, {
              body: `PnL: ${pnl.toFixed(2)}`,
            });

            sys.trade = null;
          }
        });

        setSystems(newSystems);
      } catch (e) {
        console.log(e);
      }
    };

    run();
    interval = setInterval(run, 10000);
    return () => clearInterval(interval);
  }, []);

  // ================= DELETE =================
  const deleteTrade = (id, key) => {
    setSystems((prev) => {
      const copy = { ...prev };
      copy[key].history = copy[key].history.filter((t) => t.id !== id);
      return copy;
    });
  };

  // ================= STATS =================
  const getStats = (history) => {
    const wins = history.filter((t) => t.result === "win").length;
    const total = history.length;
    return {
      wins,
      losses: total - wins,
      total,
      rate: total ? ((wins / total) * 100).toFixed(1) : 0,
    };
  };

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {Object.entries(systems).map(([key, sys]) => {
        const stats = getStats(sys.history);

        return (
          <div key={key} className="p-3 bg-black/30 rounded">
            <h2>{key}</h2>
            <p>Capital: ${sys.capital.toFixed(2)}</p>

            {/* ACTIVE TRADE */}
            {sys.trade ? (
              <div className="bg-green-700 p-2 mt-2 text-sm">
                <p>
                  <b>Type:</b> {sys.trade.type}
                </p>
                <p>
                  <b>Entry:</b> {sys.trade.entry.toFixed(0)}
                </p>
                <p className="text-red-300">
                  <b>SL:</b> {sys.trade.sl.toFixed(0)}
                </p>
                <p className="text-green-300">
                  <b>TP:</b> {sys.trade.final.toFixed(0)}
                </p>
                <p>
                  <b>RR:</b> {sys.trade.rr}
                </p>
              </div>
            ) : (
              <p>No Trade</p>
            )}

            {/* STATS */}
            <div className="mt-2 text-sm">
              <p>Trades: {stats.total}</p>
              <p>
                Win: {stats.wins} | Loss: {stats.losses}
              </p>
              <p>Win Rate: {stats.rate}%</p>
            </div>

            {/* HISTORY HEADER */}
            <button
              className="mt-2 text-blue-400"
              onClick={() =>
                setOpenHistory((prev) => ({
                  ...prev,
                  [key]: !prev[key],
                }))
              }
            >
              {openHistory[key] ? "Hide History ▲" : "Show History ▼"}
            </button>

            {/* HISTORY LIST */}
            {openHistory[key] &&
              sys.history.map((t) => (
                <div
                  key={t.id}
                  className={`p-2 my-2 text-sm ${
                    t.result === "win" ? "bg-green-600" : "bg-red-600"
                  }`}
                >
                  <p>
                    {t.type} | {t.result}
                  </p>
                  <p>Entry: {t.entry.toFixed(0)}</p>
                  <p>Exit: {t.exit.toFixed(0)}</p>
                  <p className="text-red-200">SL: {t.sl.toFixed(0)}</p>
                  <p className="text-green-200">TP: {t.final.toFixed(0)}</p>
                  <p>PnL: ${t.pnl.toFixed(2)}</p>

                  <button
                    onClick={() => deleteTrade(t.id, key)}
                    className="text-xs mt-1"
                  >
                    ❌ Delete
                  </button>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}
