import axios from "axios";

const API = axios.create({
  baseURL: "/api",
  headers: {
    "CG-API-KEY": process.env.REACT_APP_COINGLASS_API_KEY,
  },
});

// 🔥 COMMON CONFIG
const DEFAULT = {
  exchange: "Binance",
  symbol: "BTCUSDT",
  interval: "4h",
  limit: 200,
};

// ✅ PRICE
export const getPrice = (interval = "4h") =>
  API.get("/futures/price/history", {
    params: {
      ...DEFAULT,
      interval,
    },
  });

// ✅ OI
export const getOI = (interval = "4h") =>
  API.get("/futures/open-interest/aggregated-history", {
    params: {
      symbol: "BTC",
      interval,
    },
  });

// ✅ FUNDING
export const getFunding = (interval = "4h") =>
  API.get("/futures/funding-rate/history", {
    params: {
      ...DEFAULT,
      interval,
    },
  });

// ✅ CVD
export const getCVD = (interval = "4h") =>
  API.get("/futures/aggregated-cvd/history", {
    params: {
      symbol: "BTC",
      interval,
      exchange_list: "Binance,OKX,Bybit",
    },
  });

export const getLiquidation = (interval = "4h") =>
  API.get("/futures/liquidation/aggregated-history", {
    params: {
      symbol: "BTC",
      interval,
      exchange_list: "Binance,OKX,Bybit",
    },
  });