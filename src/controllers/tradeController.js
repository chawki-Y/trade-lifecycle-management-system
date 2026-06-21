const { pool } = require("../config/db");
const { calculatePnL } = require("../services/pnlService");
const { validateTrade } = require("../services/validationService");

function formatDateForTradeId(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10).replace(/-/g, "");
  }

  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

async function generateTradeId(tradeDate) {
  const result = await pool.query("SELECT nextval('trade_id_sequence') AS sequence_value");
  const sequenceValue = String(result.rows[0].sequence_value).padStart(6, "0");

  return `TRD-${formatDateForTradeId(tradeDate)}-${sequenceValue}`;
}

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

async function createTrade(req, res) {
  const {
    instrument,
    tradeType,
    quantity,
    tradePrice,
    marketPrice,
    tradeDate
  } = req.body;

  const normalizedInstrument = String(instrument || "").trim().toUpperCase();
  const normalizedTradeType = String(tradeType || "").toUpperCase();
  const trade = {
    instrument: normalizedInstrument,
    tradeType: normalizedTradeType,
    quantity,
    tradePrice,
    marketPrice,
    tradeDate
  };

  let rejectionReason = validateTrade(trade);
  // Rejected trades are still stored so operations/reporting can see failed captures.
  const storedInstrument = normalizedInstrument || "UNKNOWN";
  const storedTradeType = normalizedTradeType || "INVALID";
  const storedTradeDate = tradeDate || new Date();
  let storedTradeId = null;

  try {
    storedTradeId = await generateTradeId(storedTradeDate);

    if (!rejectionReason) {
      // Instrument symbols are reference data; validate them server-side as well as in the UI.
      const instrumentExists = await isActiveInstrument(normalizedInstrument);
      rejectionReason = instrumentExists ? null : "Invalid or inactive instrument";
    }

    const status = rejectionReason ? "REJECTED" : "VALID";
    const pnl = rejectionReason
      ? 0
      : calculatePnL(normalizedTradeType, quantity, tradePrice, marketPrice);

    // PostgreSQL placeholders keep user input separate from SQL text.
    await pool.query(
      `
        INSERT INTO trades (
          trade_id,
          instrument,
          trade_type,
          quantity,
          trade_price,
          market_price,
          pnl,
          trade_date,
          status,
          rejection_reason
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10
        )
      `,
      [
        storedTradeId,
        storedInstrument,
        storedTradeType,
        Number(quantity) || 0,
        Number(tradePrice) || 0,
        Number(marketPrice) || 0,
        pnl,
        storedTradeDate,
        status,
        rejectionReason
      ]
    );

    return res.status(201).json({
      message: rejectionReason ? "Trade rejected and stored" : "Trade captured successfully",
      tradeId: storedTradeId,
      status,
      pnl,
      rejectionReason
    });
  } catch (error) {
    // 23505 is PostgreSQL's unique constraint violation code.
    if (error.code === "23505") {
      return res.status(409).json({
        message: "TradeId already exists",
        tradeId: storedTradeId,
        status: "REJECTED",
        pnl: 0,
        rejectionReason: "Duplicate tradeId"
      });
    }

    return res.status(500).json({
      message: "Failed to create trade",
      error: error.message
    });
  }
}

async function getTrades(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        id AS "Id",
        trade_id AS "TradeId",
        instrument AS "Instrument",
        trade_type AS "TradeType",
        quantity AS "Quantity",
        trade_price AS "TradePrice",
        market_price AS "MarketPrice",
        pnl AS "PnL",
        trade_date AS "TradeDate",
        status AS "Status",
        rejection_reason AS "RejectionReason",
        created_at AS "CreatedAt"
      FROM trades
      ORDER BY created_at DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retrieve trades",
      error: error.message
    });
  }
}

async function getTradeReport(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::INT AS "TotalTrades",
        COALESCE(SUM(CASE WHEN status = 'VALID' THEN 1 ELSE 0 END), 0)::INT AS "ValidTrades",
        COALESCE(SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END), 0)::INT AS "RejectedTrades",
        -- P&L reporting excludes rejected trades because their economics were not accepted.
        COALESCE(SUM(CASE WHEN status = 'VALID' THEN pnl ELSE 0 END), 0)::NUMERIC(18,4) AS "TotalPnL"
      FROM trades
    `);

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to generate trade report",
      error: error.message
    });
  }
}

module.exports = {
  createTrade,
  getTrades,
  getTradeReport
};
