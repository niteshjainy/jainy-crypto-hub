export const formatPriceData = (data) => {
    return data
        .sort((a, b) => a.time - b.time)
        .map((item) => ({
            time: item.time / 1000, // ✅ IMPORTANT
            open: Number(item.open),
            high: Number(item.high),
            low: Number(item.low),
            close: Number(item.close),
            volume: Number(item.volume_usd),
        }));
};