const { pool } = require("../config/db");
const { getLatestMarketPrice } = require("../services/marketDataService");

async function isActiveInstrument(symbol) {
  const result = await pool.query(
    `
      SELECT 1
      FROM instruments
      WHERE symbol = $1
        AND is_active = TRUE
      LIMIT 1
    `,
    [symbol]
  );

  return result.rowCount > 0;
}

async function getMarketPrice(req, res) {
  const symbol = String(req.params.symbol || "").trim().toUpperCase();

  try {
    const instrumentExists = await isActiveInstrument(symbol);

    if (!instrumentExists) {
      return res.status(400).json({
        message: "Invalid or inactive instrument",
        symbol
      });
    }

    const marketData = await getLatestMarketPrice(symbol);

    return res.json({
      symbol: marketData.symbol,
      marketPrice: marketData.marketPrice,
      source: marketData.source,
      timestamp: marketData.timestamp,
      fromCache: marketData.fromCache,
      stale: marketData.stale
    });
  } catch (error) {
    return res.status(502).json({
      message: "Unable to retrieve market price",
      symbol,
      error: error.message
    });
  }
}

module.exports = {
  getMarketPrice
};
