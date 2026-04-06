import { useEffect, useState, useCallback } from "react";
import { getLiquidation, getOI, getFunding, getPrice } from "./services/api";

const BACKEND = "https://jainy-crypto-backend.onrender.com";

// ===== SIGNAL =====
function getSmartSignal({ liq, oi, fr, priceData }) {
  const latest = liq.at(-1);

  const longLiq = Number(latest?.aggregated_long_liquidation_usd || 0);
  const shortLiq = Number(latest?.aggregated_short_liquidation_usd || 0);

  const frValue = Number(fr.at(-1)?.close || 0);

  const oiNow = Number(oi.at(-1)?.open_interest || 0);
  const oiPrev = Number(oi.at(-2)?.open_interest || 0);
  const oiUp = oiNow > oiPrev;

  const last = priceData.at(-1);
  const prev = priceData.at(-2);

  const priceUp = last?.close > prev?.close;

  const cvd = priceData.map((p) => p.close - p.open);
  const cvdUp = cvd.at(-1) > cvd.at(-2);

  let longScore = 0;
  let shortScore = 0;

  if (shortLiq > longLiq) longScore += 2;
  if (longLiq > shortLiq) shortScore += 2;

  if (frValue < 0 && oiUp) longScore += 2;
  if (frValue > 0 && oiUp) shortScore += 2;

  if (priceUp && cvdUp) longScore += 1;
  if (!priceUp && !cvdUp) shortScore += 1;

  const diff = Math.abs(longScore - shortScore);
  if (diff < 2) return { signal: null };

  if (longScore > shortScore) return { signal: "LONG" };
  if (shortScore > longScore) return { signal: "SHORT" };

  return { signal: null };
}

export default function SmartDashboard() {
  const [signal, setSignal] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTrade, setActiveTrade] = useState(null);

  // ===== LOAD STATE =====
  useEffect(() => {
    async function loadState() {
      try {
        const res = await fetch(`${BACKEND}/get-state`);
        const data = await res.json();

        if (data.systems) {
          setHistory(data.systems.history || []);
          setActiveTrade(data.systems.activeTrade || null);
        }
      } catch (err) {
        console.error("Load failed", err);
      }
    }

    loadState();
  }, []);

  // ===== SAVE STATE =====
  const saveState = useCallback(async (historyData, tradeData) => {
    try {
      await fetch(`${BACKEND}/save-state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systems: {
            history: historyData,
            activeTrade: tradeData,
          },
          version: Date.now(),
        }),
      });
    } catch (err) {
      console.error("Save failed", err);
    }
  }, []);

  // ===== MAIN LOOP =====
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [priceRes, liqRes, oiRes, frRes] = await Promise.all([
          getPrice("4h"),
          getLiquidation("4h"),
          getOI("4h"),
          getFunding("4h"),
        ]);

        const prices = priceRes?.data?.data || [];
        const liq = liqRes?.data?.data || [];
        const oi = oiRes?.data?.data || [];
        const fr = frRes?.data?.data || [];

        const result = getSmartSignal({
          liq,
          oi,
          fr,
          priceData: prices,
        });

        setSignal(result.signal);

        const price = Number(prices.at(-1)?.close);

        // ===== ENTRY =====
        if (!activeTrade && result.signal) {
          const trade = {
            type: result.signal,
            entry: price,
            time: Date.now(),
            sl: price * (result.signal === "LONG" ? 0.995 : 1.005),
            tp: price * (result.signal === "LONG" ? 1.01 : 0.99),
          };

          setActiveTrade(trade);
          saveState(history, trade);

          new Audio("/alert.mp3").play().catch(() => {});
        }

        // ===== EXIT =====
        if (activeTrade) {
          let exit = false;
          let resultType = null;

          if (activeTrade.type === "LONG") {
            if (price >= activeTrade.tp) {
              exit = true;
              resultType = "TP";
            }
            if (price <= activeTrade.sl) {
              exit = true;
              resultType = "SL";
            }
          } else {
            if (price <= activeTrade.tp) {
              exit = true;
              resultType = "TP";
            }
            if (price >= activeTrade.sl) {
              exit = true;
              resultType = "SL";
            }
          }

          if (exit) {
            const tradeData = {
              ...activeTrade,
              exitPrice: price,
              exitTime: Date.now(),
              result: resultType,
            };

            const updatedHistory = [tradeData, ...history];

            setHistory(updatedHistory);
            setActiveTrade(null);

            saveState(updatedHistory, null);
          }
        }
      } catch (err) {
        console.error("Loop error", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [activeTrade, history, saveState]);

  return (
    <div>
      <h2>Signal: {signal}</h2>

      <h3>History ({history.length})</h3>

      {history.map((t, i) => (
        <div
          key={i}
          style={{ border: "1px solid gray", margin: 5, padding: 5 }}
        >
          <p>
            {t.type} - {t.result}
          </p>
          <p>Entry: {t.entry}</p>
          <p>Exit: {t.exitPrice}</p>
          <p>{new Date(t.time).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
