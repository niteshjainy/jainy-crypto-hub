import axios from "axios";

const API = axios.create({
  baseURL: "https://jainy-crypto-backend.onrender.com/api",
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

// ✅ PRICE (same as local working)
export const getPrice = (interval = "4h") =>
  fetchWithCache(`price-${interval}`, "/futures/price/history", {
    exchange: "Binance",
    symbol: "BTCUSDT",
    interval,
  });

// ✅ OPEN INTEREST (V4 style)
export const getOI = (interval = "4h") =>
  fetchWithCache(`oi-${interval}`, "/futures/open-interest/aggregated-history", {
    symbol: "BTC",
    interval,
  });

// ✅ FUNDING RATE (V4 style)
export const getFunding = (interval = "4h") =>
  fetchWithCache(`fr-${interval}`, "/futures/funding-rate/history", {
    exchange: "Binance",
    symbol: "BTCUSDT",
    interval,
  });

// ✅ LIQUIDATION (V4 style)
export const getLiquidation = (interval = "4h") =>
  fetchWithCache(`liq-${interval}`, "/futures/liquidation/aggregated-history", {
    symbol: "BTC",
    interval,
    exchange_list: "Binance,OKX,Bybit",
  });