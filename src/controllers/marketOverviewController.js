const { pool } = require("../config/db");
const { getLatestMarketPrice } = require("../services/marketDataService");

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
      source: marketData.source,
      fromCache: marketData.fromCache,
      stale: marketData.stale || false
    };
  } catch (error) {
    return {
      symbol: instrument.symbol,
      name: instrument.name,
      assetClass: instrument.asset_class,
      currency: instrument.currency,
      marketPrice: null,
      lastUpdated: null,
      source: "Unavailable",
      fromCache: false,
      stale: false,
      error: error.message
    };
  }
}

async function getMarketOverview(req, res) {
  try {
    const instruments = await getActiveInstruments();
    const overview = await Promise.all(instruments.map(buildMarketOverviewRow));

    return res.json(overview);
  } catch (error) {
    return res.status(500).json({
      message: "Unable to load market overview",
      error: error.message
    });
  }
}

module.exports = {
  getMarketOverview
};
