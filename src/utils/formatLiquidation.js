export const formatLiquidation = (data) => {
    return data.map((item) => ({
        time: new Date(item.time).toLocaleString(),
        long: Number(item.aggregated_long_liquidation_usd),
        short: Number(item.aggregated_short_liquidation_usd),
    }));
};