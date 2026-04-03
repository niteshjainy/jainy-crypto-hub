import axios from "axios";

const API = axios.create({
  baseURL: "/api",
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
    symbol: "BTC", // ✅ FIXED
    interval,
  });

// ✅ OI
export const getOI = (interval = "4h") =>
  fetchWithCache(`oi-${interval}`, "/futures/openInterest/history", {
    symbol: "BTC",
    interval,
  });

// ✅ FUNDING
export const getFunding = (interval = "4h") =>
  fetchWithCache(`fr-${interval}`, "/futures/fundingRate/history", {
    symbol: "BTC",
    interval,
  });

// ✅ LIQUIDATION
export const getLiquidation = (interval = "4h") =>
  fetchWithCache(`liq-${interval}`, "/futures/liquidation/history", {
    symbol: "BTC",
    interval,
  });