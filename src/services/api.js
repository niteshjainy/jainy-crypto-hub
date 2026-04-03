import axios from "axios";

const API = axios.create({
  baseURL: "/api",
  headers: {
    "CG-API-KEY": process.env.REACT_APP_COINGLASS_API_KEY,
  },
});

const DEFAULT = {
  exchange: "Binance",
  symbol: "BTCUSDT",
  interval: "4h",
  limit: 200,
};

export const getPrice = (interval = "4h") =>
  API.get("/futures/price/history", {
    params: { ...DEFAULT, interval },
  });

export const getOI = (interval = "4h") =>
  API.get("/futures/open-interest/aggregated-history", {
    params: { symbol: "BTC", interval },
  });

export const getFunding = (interval = "4h") =>
  API.get("/futures/funding-rate/history", {
    params: { ...DEFAULT, interval },
  });

export const getLiquidation = (interval = "4h") =>
  API.get("/futures/liquidation/aggregated-history", {
    params: {
      symbol: "BTC",
      interval,
      exchange_list: "Binance,OKX,Bybit",
    },
  });