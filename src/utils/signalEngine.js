export const getSignal = ({
    strongNegativeFR,
    strongPositiveFR,
    oiTrend,
    strongShortLiq,
    strongLongLiq,
    cvdTrend,
}) => {
    // 🟢 STRONG BUY
    if (strongNegativeFR && oiTrend && strongShortLiq && cvdTrend) {
        return "🟢 STRONG BUY (Confirmed)";
    }

    // 🔴 STRONG SELL
    if (strongPositiveFR && oiTrend && strongLongLiq && !cvdTrend) {
        return "🔴 STRONG SELL (Confirmed)";
    }

    // ⚠️ FAKE MOVE
    if (!cvdTrend && oiTrend) {
        return "⚠️ Fake Move Detected";
    }

    return "⚪ No Clear Signal";
};