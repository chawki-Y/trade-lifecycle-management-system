const { pool } = require("../config/db");
const { calculatePnL } = require("../services/pnlService");
const { validateTrade } = require("../services/validationService");
const { getLatestMarketPrice } = require("../services/marketDataService");
const { createAuditLog } = require("../services/auditLogService");

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

async function refreshBookedTradesMarketPrices() {
  const result = await pool.query(`
    SELECT
      id,
      instrument,
      trade_type,
      quantity,
      trade_price,
      market_price,
      pnl
    FROM trades
    WHERE status = 'BOOKED'
  `);
  const pricesByInstrument = new Map();
  let recalculatedCount = 0;

  for (const trade of result.rows) {
    try {
      if (!pricesByInstrument.has(trade.instrument)) {
        pricesByInstrument.set(trade.instrument, await getLatestMarketPrice(trade.instrument));
      }

      const marketData = pricesByInstrument.get(trade.instrument);
      const pnl = calculatePnL(
        trade.trade_type,
        trade.quantity,
        trade.trade_price,
        marketData.marketPrice
      );

      await pool.query(
        `
          UPDATE trades
          SET
            market_price = $1,
            pnl = $2,
            last_price_updated_at = $3,
            market_data_source = $4
          WHERE id = $5
        `,
        [
          marketData.marketPrice,
          pnl,
          marketData.timestamp || marketData.lastCheckedAt,
          marketData.source,
          trade.id
        ]
      );
      recalculatedCount += 1;
    } catch (error) {
      console.warn(`Market price refresh skipped for ${trade.instrument}: ${error.message}`);
    }
  }

  if (recalculatedCount > 0) {
    await createAuditLog(
      "PNL_RECALCULATED",
      "TRADE",
      null,
      `Recalculated P&L for ${recalculatedCount} booked trade(s) across ${pricesByInstrument.size} instrument(s).`
    );
  }
}

async function createTrade(req, res) {
  const {
    instrument,
    tradeType,
    quantity,
    tradePrice,
    tradeDate
  } = req.body;

  const normalizedInstrument = String(instrument || "").trim().toUpperCase();
  const normalizedTradeType = String(tradeType || "").toUpperCase();
  const trade = {
    instrument: normalizedInstrument,
    tradeType: normalizedTradeType,
    quantity,
    tradePrice,
    tradeDate
  };

  let rejectionReason = validateTrade(trade);
  // Rejected trades are still stored so operations/reporting can see failed captures.
  const storedInstrument = normalizedInstrument || "UNKNOWN";
  const storedTradeType = normalizedTradeType || "INVALID";
  const storedTradeDate = tradeDate || new Date();
  let storedTradeId = null;

  try {
    // Invalid reference data is rejected before insert so bad symbols never enter trades.
    const instrumentExists = normalizedInstrument
      ? await isActiveInstrument(normalizedInstrument)
      : false;

    if (!instrumentExists) {
      await createAuditLog(
        "TRADE_REJECTED",
        "TRADE",
        null,
        `Trade rejected because ${normalizedInstrument || "UNKNOWN"} is not an active instrument.`
      );

      return res.status(400).json({
        message: "Trade rejected: Invalid or inactive instrument.",
        tradeId: null,
        status: "REJECTED",
        pnl: 0,
        rejectionReason: "Invalid or inactive instrument"
      });
    }

    let marketData = null;

    if (!rejectionReason) {
      try {
        marketData = await getLatestMarketPrice(normalizedInstrument);
      } catch (error) {
        return res.status(502).json({
          message: "Unable to retrieve market price",
          tradeId: null,
          status: "REJECTED",
          pnl: 0,
          rejectionReason: error.message
        });
      }
    }

    storedTradeId = await generateTradeId(storedTradeDate);

    const status = rejectionReason ? "REJECTED" : "BOOKED";
    const storedMarketPrice = marketData ? marketData.marketPrice : 0;
    const pnl = rejectionReason
      ? 0
      : calculatePnL(normalizedTradeType, quantity, tradePrice, storedMarketPrice);

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
          rejection_reason,
          last_price_updated_at,
          market_data_source
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
          $10,
          $11,
          $12
        )
      `,
      [
        storedTradeId,
        storedInstrument,
        storedTradeType,
        Number(quantity) || 0,
        Number(tradePrice) || 0,
        storedMarketPrice,
        pnl,
        storedTradeDate,
        status,
        rejectionReason,
        marketData ? marketData.timestamp || marketData.lastCheckedAt : null,
        marketData ? marketData.source : null
      ]
    );

    await createAuditLog(
      "TRADE_CREATED",
      "TRADE",
      storedTradeId,
      `Trade ${storedTradeId} was captured for ${storedInstrument}.`
    );

    if (status === "REJECTED") {
      await createAuditLog(
        "TRADE_REJECTED",
        "TRADE",
        storedTradeId,
        `Trade ${storedTradeId} was rejected: ${rejectionReason}.`
      );
    } else {
      await createAuditLog(
        "TRADE_VALIDATED",
        "TRADE",
        storedTradeId,
        `Trade ${storedTradeId} passed validation checks.`
      );

      await createAuditLog(
        "TRADE_BOOKED",
        "TRADE",
        storedTradeId,
        `Trade ${storedTradeId} passed validation and was booked.`
      );
    }

    return res.status(201).json({
      message: rejectionReason ? "Trade rejected and stored" : "Trade booked successfully",
      tradeId: storedTradeId,
      status,
      marketPrice: storedMarketPrice,
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
    await refreshBookedTradesMarketPrices();

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
        last_price_updated_at AS "LastPriceUpdatedAt",
        market_data_source AS "MarketDataSource",
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

async function getTradeByTradeId(req, res) {
  try {
    const result = await pool.query(
      `
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
          last_price_updated_at AS "LastPriceUpdatedAt",
          market_data_source AS "MarketDataSource",
          created_at AS "CreatedAt"
        FROM trades
        WHERE trade_id = $1
        LIMIT 1
      `,
      [req.params.tradeId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Trade not found"
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retrieve trade",
      error: error.message
    });
  }
}

async function getTradeReport(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::INT AS "TotalTrades",
        COALESCE(SUM(CASE WHEN status = 'BOOKED' THEN 1 ELSE 0 END), 0)::INT AS "BookedTrades",
        COALESCE(SUM(CASE WHEN status = 'BOOKED' THEN 1 ELSE 0 END), 0)::INT AS "ValidTrades",
        COALESCE(SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END), 0)::INT AS "RejectedTrades",
        -- P&L reporting excludes rejected trades because their economics were not accepted.
        COALESCE(SUM(CASE WHEN status = 'BOOKED' THEN pnl ELSE 0 END), 0)::NUMERIC(18,4) AS "TotalPnL"
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
  getTradeByTradeId,
  getTradeReport
};
