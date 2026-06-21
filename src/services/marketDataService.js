require("dotenv").config();

const DEFAULT_CACHE_TTL_MS = 60 * 1000;
const EXTENDED_CACHE_TTL_MS = 120 * 1000;
const priceCache = {};

const EXTENDED_TTL_SYMBOLS = new Set([
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "XAU/USD"
]);

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

function getCacheTtl(symbol) {
  return EXTENDED_TTL_SYMBOLS.has(symbol) ? EXTENDED_CACHE_TTL_MS : DEFAULT_CACHE_TTL_MS;
}

function getCachedPrice(cacheKey, allowStale = false) {
  const cached = priceCache[cacheKey];

  if (!cached) {
    return null;
  }

  const isExpired = Date.now() > cached.expiresAt;

  if (isExpired && !allowStale) {
    return null;
  }

  return {
    symbol: cached.symbol,
    marketPrice: cached.price,
    source: cached.source,
    timestamp: cached.timestamp,
    fromCache: true,
    stale: isExpired
  };
}

function setCachedPrice(cacheKey, symbol, data) {
  priceCache[cacheKey] = {
    symbol,
    price: data.marketPrice,
    source: data.source,
    timestamp: data.timestamp,
    expiresAt: Date.now() + getCacheTtl(symbol)
  };
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
  const cached = getCachedPrice(cacheKey);

  if (cached) {
    return cached;
  }

  let data;

  try {
    if (provider === "twelvedata") {
      data = await fetchFromTwelveData(normalizedSymbol, apiKey);
    } else {
      throw new Error(`Unsupported market data provider: ${provider}`);
    }
  } catch (error) {
    const staleCached = getCachedPrice(cacheKey, true);

    if (staleCached) {
      return staleCached;
    }

    throw error;
  }

  setCachedPrice(cacheKey, normalizedSymbol, data);

  return {
    ...data,
    fromCache: false,
    stale: false
  };
}

module.exports = {
  getLatestMarketPrice
};
