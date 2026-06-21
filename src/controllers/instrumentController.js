const { pool } = require("../config/db");

async function getInstruments(req, res) {
  try {
    // Instruments are reference data; only active symbols can be selected for new trades.
    const result = await pool.query(`
      SELECT
        id,
        symbol,
        name,
        asset_class,
        currency
      FROM instruments
      WHERE is_active = TRUE
      ORDER BY asset_class, symbol
    `);

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retrieve instruments",
      error: error.message
    });
  }
}

module.exports = {
  getInstruments
};
