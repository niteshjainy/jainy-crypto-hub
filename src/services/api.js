import axios from "axios";

const API = axios.create({
  baseURL: "https://open-api.coinglass.com/api/pro/v1",
  headers: {
    "CG-API-KEY": process.env.REACT_APP_COINGLASS_API_KEY,
  },
});

// 🔥 CACHE STORE
const cache = {};
const CACHE_TIME = 60000; // 1 min

function getCached(key) {
  const now = Date.now();

  if (cache[key] && now - cache[key].time < CACHE_TIME) {
    return cache[key].data;
  }

  return null;
}

function setCache(key, data) {
  cache[key] = {
    data,
    time: Date.now(),
  };
}

// 🔥 GENERIC FETCH
async function fetchWithCache(key, url, params) {
  const cached = getCached(key);
  if (cached) return cached;

  const res = await API.get(url, { params });
  setCache(key, res);
  return res;
}

// ✅ PRICE
export const getPrice = (interval = "4h") =>
  fetchWithCache(`price-${interval}`, "/futures/price/history", {
    exchange: "Binance",
    symbol: "BTCUSDT",
    interval,
  });

// ✅ OI
export const getOI = (interval = "4h") =>
  fetchWithCache(`oi-${interval}`, "/futures/open-interest/aggregated-history", {
    symbol: "BTC",
    interval,
  });

// ✅ FUNDING
export const getFunding = (interval = "4h") =>
  fetchWithCache(`fr-${interval}`, "/futures/funding-rate/history", {
    exchange: "Binance",
    symbol: "BTCUSDT",
    interval,
  });

// ✅ LIQUIDATION
export const getLiquidation = (interval = "4h") =>
  fetchWithCache(`liq-${interval}`, "/futures/liquidation/aggregated-history", {
    symbol: "BTC",
    interval,
    exchange_list: "Binance,OKX,Bybit",
  });