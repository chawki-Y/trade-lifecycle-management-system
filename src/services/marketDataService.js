require("dotenv").config();

const { pool } = require("../config/db");
const { createAuditLog } = require("./auditLogService");

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

function getPriceAgeSeconds(timestamp) {
  if (!timestamp) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
}

function formatFreshnessLabel(ageSeconds) {
  const age = Number(ageSeconds);

  if (!Number.isFinite(age)) {
    return "Never updated";
  }

  if (age < 60) {
    return `Updated ${age}s ago`;
  }

  if (age < 3600) {
    return `Updated ${Math.floor(age / 60)}m ago`;
  }

  if (age < 86400) {
    return `Updated ${Math.floor(age / 3600)}h ago`;
  }

  return `Updated ${Math.floor(age / 86400)}d ago`;
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
    lastCheckedAt: cached.lastCheckedAt,
    priceAgeSeconds: getPriceAgeSeconds(cached.timestamp || cached.lastCheckedAt),
    freshnessLabel: formatFreshnessLabel(getPriceAgeSeconds(cached.timestamp || cached.lastCheckedAt)),
    cacheAgeSeconds: Math.max(0, Math.floor((Date.now() - cached.cachedAt) / 1000)),
    fromCache: true,
    fromDatabase: false,
    stale: isExpired
  };
}

function setCachedPrice(cacheKey, symbol, data) {
  const now = new Date().toISOString();

  priceCache[cacheKey] = {
    symbol,
    price: data.marketPrice,
    source: data.source,
    timestamp: data.timestamp,
    lastCheckedAt: data.lastCheckedAt || now,
    cachedAt: Date.now(),
    expiresAt: Date.now() + getCacheTtl(symbol)
  };
}

async function upsertMarketPrice(data) {
  await pool.query(
    `
      INSERT INTO market_prices (
        symbol,
        market_price,
        source,
        provider_timestamp,
        last_checked_at,
        stale,
        updated_at
      )
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (symbol)
      DO UPDATE SET
        market_price = EXCLUDED.market_price,
        source = EXCLUDED.source,
        provider_timestamp = EXCLUDED.provider_timestamp,
        last_checked_at = EXCLUDED.last_checked_at,
        stale = EXCLUDED.stale,
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      data.symbol,
      data.marketPrice,
      data.source,
      data.stale || false
    ]
  );
}

async function getLatestPersistedPrice(symbol) {
  const result = await pool.query(
    `
      SELECT
        symbol,
        market_price,
        source,
        provider_timestamp,
        last_checked_at,
        stale
      FROM market_prices
      WHERE symbol = $1
      LIMIT 1
    `,
    [symbol]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  const timestamp = row.provider_timestamp ? row.provider_timestamp.toISOString() : null;
  const lastCheckedAt = row.last_checked_at ? row.last_checked_at.toISOString() : null;
  const priceAgeSeconds = getPriceAgeSeconds(timestamp || lastCheckedAt);

  return {
    symbol: row.symbol,
    marketPrice: Number(row.market_price),
    source: row.source || "database",
    timestamp,
    lastCheckedAt,
    priceAgeSeconds,
    freshnessLabel: formatFreshnessLabel(priceAgeSeconds),
    cacheAgeSeconds: null,
    fromCache: false,
    fromDatabase: true,
    stale: true
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
    timestamp: new Date().toISOString(),
    lastCheckedAt: new Date().toISOString()
  };
}

async function getLatestMarketPrice(symbol) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const provider = normalizeProviderName(getProvider());
  const apiKey = getApiKey();

  if (!normalizedSymbol) {
    throw new Error("Instrument symbol is required for market data");
  }

  const cacheKey = `${provider}:${normalizedSymbol}`;
  const cached = getCachedPrice(cacheKey);

  if (cached) {
    return cached;
  }

  let data;

  try {
    if (!apiKey) {
      throw new Error("Market data API key is not configured");
    }

    if (provider === "twelvedata") {
      data = await fetchFromTwelveData(normalizedSymbol, apiKey);
    } else {
      throw new Error(`Unsupported market data provider: ${provider}`);
    }
  } catch (error) {
    const staleCached = getCachedPrice(cacheKey, true);

    if (staleCached) {
      await createAuditLog(
        "MARKET_PRICE_STALE_FALLBACK_USED",
        "INSTRUMENT",
        normalizedSymbol,
        `Stale in-memory market price used for ${normalizedSymbol}: ${error.message}.`
      );

      return staleCached;
    }

    const persisted = await getLatestPersistedPrice(normalizedSymbol);

    if (persisted) {
      await createAuditLog(
        "MARKET_PRICE_DATABASE_FALLBACK_USED",
        "INSTRUMENT",
        normalizedSymbol,
        `Latest persisted market price used for ${normalizedSymbol}: ${error.message}.`
      );

      return persisted;
    }

    await createAuditLog(
      "MARKET_PRICE_UNAVAILABLE",
      "INSTRUMENT",
      normalizedSymbol,
      `No market price available for ${normalizedSymbol}: ${error.message}.`
    );

    throw error;
  }

  setCachedPrice(cacheKey, normalizedSymbol, data);
  await upsertMarketPrice({
    ...data,
    symbol: normalizedSymbol,
    stale: false
  });
  await createAuditLog(
    "MARKET_PRICE_REFRESHED",
    "INSTRUMENT",
    normalizedSymbol,
    `Fresh market price stored for ${normalizedSymbol} using ${data.source}.`
  );

  const priceAgeSeconds = getPriceAgeSeconds(data.timestamp || data.lastCheckedAt);
  return {
    ...data,
    priceAgeSeconds,
    freshnessLabel: formatFreshnessLabel(priceAgeSeconds),
    cacheAgeSeconds: 0,
    fromCache: false,
    fromDatabase: false,
    stale: false
  };
}

module.exports = {
  getLatestMarketPrice,
  formatFreshnessLabel
};
