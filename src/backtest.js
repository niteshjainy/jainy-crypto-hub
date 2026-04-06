import { getLiquidation, getOI, getFunding, getPrice } from "./services/api";

// ===== TRADE =====
function buildTrade(price, direction, capital) {
    const riskPercent = 0.02;

    const slBuffer = price * 0.004; // 🔥 tighter SL
    const sl = direction === "LONG" ? price - slBuffer : price + slBuffer;

    const risk = Math.abs(price - sl);
    const size = (capital * riskPercent) / risk;

    const rr = 1.0; // 🔥 1:1 RR
    const tp = direction === "LONG" ? price + risk * rr : price - risk * rr;

    return {
        type: direction,
        entry: price,
        sl,
        tp,
        size,
        risk,
    };
}

// ===== SIGNAL =====
function getFastSignal({ liq, oi, fr, priceData }) {
    const latest = liq.at(-1);

    const longLiq = Number(latest?.aggregated_long_liquidation_usd || 0);
    const shortLiq = Number(latest?.aggregated_short_liquidation_usd || 0);

    const frValue = Number(fr.at(-1)?.close || 0);

    const last = priceData.at(-1);
    const prev = priceData.at(-2);

    const priceUp = last.close > prev.close;

    let longScore = 0;
    let shortScore = 0;

    // 🔥 fast signals
    if (shortLiq > longLiq) longScore += 1;
    if (longLiq > shortLiq) shortScore += 1;

    if (frValue < 0) longScore += 1;
    if (frValue > 0) shortScore += 1;

    if (priceUp) longScore += 1;
    else shortScore += 1;

    if (longScore >= 2) return { signal: "LONG" };
    if (shortScore >= 2) return { signal: "SHORT" };

    return { signal: null };
}

async function simulate() {
    const priceData = await getPrice("4h"); // 🔥 later 1h/15m karenge
    const liq = await getLiquidation("4h");
    const oi = await getOI("4h");
    const fr = await getFunding("4h");

    const prices = priceData?.data?.data || [];
    const liqs = liq?.data?.data || [];
    const ois = oi?.data?.data || [];
    const frs = fr?.data?.data || [];

    let capital = 1000;
    let trades = [];

    const feeRate = 0.0008;
    const slippage = 0.0003;

    let activeTrade = null;
    let lastTradeIndex = -10;

    for (let i = 50; i < prices.length; i++) {

        if (i - lastTradeIndex < 2) continue; // 🔥 fast entries

        const price = Number(prices[i].close);

        // ENTRY
        if (!activeTrade) {
            const signal = getFastSignal({
                liq: liqs.slice(0, i),
                oi: ois.slice(0, i),
                fr: frs.slice(0, i),
                priceData: prices.slice(0, i),
            });

            if (!signal.signal) continue;

            activeTrade = buildTrade(price, signal.signal, capital);
            lastTradeIndex = i;
        }

        // EXIT
        if (activeTrade) {
            let futurePrice = price;

            if (activeTrade.type === "LONG") {
                futurePrice *= (1 - slippage);
            } else {
                futurePrice *= (1 + slippage);
            }

            let result = null;

            if (activeTrade.type === "LONG") {
                if (futurePrice >= activeTrade.tp) result = "win";
                if (futurePrice <= activeTrade.sl) result = "loss";
            } else {
                if (futurePrice <= activeTrade.tp) result = "win";
                if (futurePrice >= activeTrade.sl) result = "loss";
            }

            if (result) {
                let pnl =
                    result === "win"
                        ? activeTrade.risk * activeTrade.size
                        : -activeTrade.risk * activeTrade.size;

                const fee = activeTrade.entry * activeTrade.size * feeRate;
                pnl -= fee;

                capital += pnl;

                trades.push({ result, pnl });

                activeTrade = null;
            }
        }
    }

    const total = trades.length;
    const wins = trades.filter(t => t.result === "win").length;
    const winRate = total ? (wins / total) * 100 : 0;

    console.log("Total Trades:", total);
    console.log("Win Rate:", winRate.toFixed(2) + "%");
    console.log("Final Capital:", capital.toFixed(2));
}

simulate();