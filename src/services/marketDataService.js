require("dotenv").config();

const CACHE_TTL_MS = 60 * 1000;
const priceCache = new Map();

function getProvider() {
  return String(process.env.MARKET_DATA_PROVIDER || "twelvedata").toLowerCase();
}

function getApiKey() {
  return process.env.MARKET_DATA_API_KEY;
}

function normalizeProviderName(provider) {
  if (["twelve_data", "twelvedata", "twelve-data"].includes(provider)) {
    return "twelvedata";
  }

  return provider;
}

function buildTwelveDataUrl(symbol, apiKey) {
  const url = new URL("https://api.twelvedata.com/price");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);
  return url;
}

async function fetchFromTwelveData(symbol, apiKey) {
  const response = await fetch(buildTwelveDataUrl(symbol, apiKey));
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.status === "error") {
    throw new Error(payload.message || "Market data provider returned an error");
  }

  const marketPrice = Number(payload.price);

  if (!Number.isFinite(marketPrice) || marketPrice <= 0) {
    throw new Error(`No valid market price available for ${symbol}`);
  }

  return {
    symbol,
    marketPrice,
    source: "twelvedata",
    timestamp: new Date().toISOString()
  };
}

async function getLatestMarketPrice(symbol) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const provider = normalizeProviderName(getProvider());
  const apiKey = getApiKey();

  if (!normalizedSymbol) {
    throw new Error("Instrument symbol is required for market data");
  }

  if (!apiKey) {
    throw new Error("Market data API key is not configured");
  }

  const cacheKey = `${provider}:${normalizedSymbol}`;
  const cached = priceCache.get(cacheKey);

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return {
      ...cached.data,
      cached: true
    };
  }

  let data;

  if (provider === "twelvedata") {
    data = await fetchFromTwelveData(normalizedSymbol, apiKey);
  } else {
    throw new Error(`Unsupported market data provider: ${provider}`);
  }

  priceCache.set(cacheKey, {
    cachedAt: Date.now(),
    data
  });

  return {
    ...data,
    cached: false
  };
}

module.exports = {
  getLatestMarketPrice
};
