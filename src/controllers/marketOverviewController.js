const { pool } = require("../config/db");
const { getLatestMarketPrice } = require("../services/marketDataService");
const { createAuditLog } = require("../services/auditLogService");

async function getActiveInstruments() {
  const result = await pool.query(`
    SELECT symbol, name, asset_class, currency
    FROM instruments
    WHERE is_active = TRUE
    ORDER BY asset_class, symbol
  `);

  return result.rows;
}

async function buildMarketOverviewRow(instrument) {
  try {
    const marketData = await getLatestMarketPrice(instrument.symbol);

    return {
      symbol: instrument.symbol,
      name: instrument.name,
      assetClass: instrument.asset_class,
      currency: instrument.currency,
      marketPrice: marketData.marketPrice,
      lastUpdated: marketData.timestamp,
      lastCheckedAt: marketData.lastCheckedAt,
      source: marketData.source,
      fromCache: marketData.fromCache,
      fromDatabase: marketData.fromDatabase,
      cacheAgeSeconds: marketData.cacheAgeSeconds,
      stale: marketData.stale || false,
      priceAgeSeconds: marketData.priceAgeSeconds,
      freshnessLabel: marketData.freshnessLabel
    };
  } catch (error) {
    await createAuditLog(
      "MARKET_PRICE_REFRESH_FAILED",
      "INSTRUMENT",
      instrument.symbol,
      `Market price refresh failed for ${instrument.symbol}: ${error.message}.`
    );

    return {
      symbol: instrument.symbol,
      name: instrument.name,
      assetClass: instrument.asset_class,
      currency: instrument.currency,
      marketPrice: null,
      lastUpdated: null,
      lastCheckedAt: null,
      source: "Unavailable",
      fromCache: false,
      fromDatabase: false,
      stale: false,
      priceAgeSeconds: null,
      freshnessLabel: "Never updated",
      error: error.message
    };
  }
}

async function getMarketOverview(req, res) {
  try {
    const instruments = await getActiveInstruments();
    const overview = await Promise.all(instruments.map(buildMarketOverviewRow));

    await createAuditLog(
      "MARKET_OVERVIEW_REFRESHED",
      "MARKET_OVERVIEW",
      null,
      `Market overview refreshed for ${overview.length} active instrument(s).`
    );

    return res.json(overview);
  } catch (error) {
    await createAuditLog(
      "MARKET_OVERVIEW_REFRESH_FAILED",
      "MARKET_OVERVIEW",
      null,
      `Market overview refresh failed: ${error.message}.`
    );

    return res.status(500).json({
      message: "Unable to load market overview",
      error: error.message
    });
  }
}

module.exports = {
  getMarketOverview
};
