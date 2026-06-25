const { pool } = require("../config/db");

const STALE_MARKET_DATA_MINUTES = Number(process.env.MARKET_DATA_STALE_THRESHOLD_MINUTES) || 15;

function formatTimeAgo(timestamp) {
  if (!timestamp) {
    return "never";
  }

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes === 1) {
    return "1 minute ago";
  }

  return `${diffMinutes} minutes ago`;
}

function buildAlerts({
  bookedTradesToday,
  rejectedTradesToday,
  totalPnLToday,
  staleMarketDataCount,
  unavailableMarketDataCount,
  failedMarketDataRefreshCount,
  lastMarketOverviewRefreshAt
}) {
  const alerts = [
    {
      level: "info",
      message: `${bookedTradesToday} trades booked today`
    },
    {
      level: rejectedTradesToday > 0 ? "danger" : "info",
      message: `${rejectedTradesToday} trades rejected today`
    },
    {
      level: "info",
      message: `Total P&L today: ${Number(totalPnLToday).toFixed(2)}`
    }
  ];

  if (staleMarketDataCount > 0) {
    alerts.push({
      level: "warning",
      message: `${staleMarketDataCount} instruments have stale market prices`
    });
  }

  if (unavailableMarketDataCount > 0) {
    alerts.push({
      level: "danger",
      message: `${unavailableMarketDataCount} instruments have unavailable market data`
    });
  }

  if (failedMarketDataRefreshCount > 0) {
    alerts.push({
      level: "warning",
      message: `${failedMarketDataRefreshCount} market data refreshes failed recently`
    });
  }

  alerts.push({
    level: "info",
    message: `Last market overview refresh: ${formatTimeAgo(lastMarketOverviewRefreshAt)}`
  });

  return alerts;
}

async function getOperationalSummary(req, res) {
  try {
    const [
      dailyResult,
      staleResult,
      unavailableResult,
      latestAuditResult,
      latestRejectedResult,
      latestOverviewResult,
      failedRefreshResult
    ] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'BOOKED' THEN 1 ELSE 0 END), 0)::INT AS "bookedTradesToday",
          COALESCE(SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END), 0)::INT AS "rejectedTradesToday",
          COALESCE(SUM(CASE WHEN status = 'BOOKED' THEN pnl ELSE 0 END), 0)::NUMERIC(18,4) AS "totalPnLToday"
        FROM trades
        WHERE trade_date = CURRENT_DATE
      `),
      pool.query(
        `
          SELECT COUNT(*)::INT AS "staleMarketDataCount"
          FROM instruments i
          JOIN market_prices mp ON mp.symbol = i.symbol
          WHERE i.is_active = TRUE
            AND (
              mp.stale = TRUE
              OR COALESCE(mp.provider_timestamp, mp.last_checked_at) < NOW() - ($1::TEXT)::INTERVAL
            )
        `,
        [`${STALE_MARKET_DATA_MINUTES} minutes`]
      ),
      pool.query(`
        SELECT COUNT(*)::INT AS "unavailableMarketDataCount"
        FROM instruments i
        LEFT JOIN market_prices mp ON mp.symbol = i.symbol
        WHERE i.is_active = TRUE
          AND (
            mp.symbol IS NULL
            OR mp.source IS NULL
            OR mp.source = 'Unavailable'
          )
      `),
      pool.query(`
        SELECT MAX(created_at) AS "lastAuditEventAt"
        FROM audit_logs
      `),
      pool.query(`
        SELECT
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
        WHERE status = 'REJECTED'
          AND trade_date = CURRENT_DATE
        ORDER BY created_at DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT created_at AS "lastMarketOverviewRefreshAt"
        FROM audit_logs
        WHERE event_type = 'MARKET_OVERVIEW_REFRESHED'
        ORDER BY created_at DESC
        LIMIT 1
      `),
      pool.query(`
        SELECT COUNT(*)::INT AS "failedMarketDataRefreshCount"
        FROM audit_logs
        WHERE event_type IN ('MARKET_PRICE_REFRESH_FAILED', 'MARKET_OVERVIEW_REFRESH_FAILED')
          AND created_at >= NOW() - INTERVAL '24 hours'
      `)
    ]);

    const daily = dailyResult.rows[0];
    const staleMarketDataCount = staleResult.rows[0].staleMarketDataCount;
    const unavailableMarketDataCount = unavailableResult.rows[0].unavailableMarketDataCount;
    const failedMarketDataRefreshCount = failedRefreshResult.rows[0].failedMarketDataRefreshCount;
    const lastAuditEventAt = latestAuditResult.rows[0].lastAuditEventAt;
    const lastMarketOverviewRefreshAt = latestOverviewResult.rows[0]?.lastMarketOverviewRefreshAt || null;
    const totalPnLToday = Number(daily.totalPnLToday || 0);

    const summary = {
      bookedTradesToday: daily.bookedTradesToday,
      rejectedTradesToday: daily.rejectedTradesToday,
      totalPnLToday,
      staleMarketDataCount,
      unavailableMarketDataCount,
      failedMarketDataRefreshCount,
      lastAuditEventAt,
      latestRejectedTrades: latestRejectedResult.rows,
      alerts: buildAlerts({
        bookedTradesToday: daily.bookedTradesToday,
        rejectedTradesToday: daily.rejectedTradesToday,
        totalPnLToday,
        staleMarketDataCount,
        unavailableMarketDataCount,
        failedMarketDataRefreshCount,
        lastMarketOverviewRefreshAt
      })
    };

    return res.json(summary);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retrieve operational summary",
      error: error.message
    });
  }
}

function buildInvestigationSummary(trade) {
  if (trade.Status === "REJECTED") {
    return `Trade ${trade.TradeId} was rejected because ${trade.RejectionReason || "it failed validation"}.`;
  }

  if (trade.Status === "BOOKED") {
    return `Trade ${trade.TradeId} is booked for ${trade.Instrument} with latest P&L ${Number(trade.PnL || 0).toFixed(4)}.`;
  }

  return `Trade ${trade.TradeId} is currently in ${trade.Status} status.`;
}

async function investigateTrade(req, res) {
  try {
    const tradeResult = await pool.query(
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

    if (tradeResult.rowCount === 0) {
      return res.status(404).json({
        message: "Trade not found"
      });
    }

    const trade = tradeResult.rows[0];
    const auditResult = await pool.query(
      `
        SELECT
          id,
          event_type AS "eventType",
          entity_type AS "entityType",
          entity_id AS "entityId",
          description,
          created_at AS "createdAt"
        FROM audit_logs
        WHERE entity_id = $1
        ORDER BY created_at DESC
      `,
      [trade.TradeId]
    );

    return res.json({
      trade,
      auditLogs: auditResult.rows,
      summary: buildInvestigationSummary(trade)
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to investigate trade",
      error: error.message
    });
  }
}

module.exports = {
  getOperationalSummary,
  investigateTrade
};
