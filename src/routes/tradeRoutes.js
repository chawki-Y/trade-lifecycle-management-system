const express = require("express");
const {
  createTrade,
  getTradeByTradeId,
  getTrades,
  getTradeReport
} = require("../controllers/tradeController");

const router = express.Router();

// Mounted in server.js at /api/trades.
router.post("/", createTrade);
router.get("/", getTrades);
router.get("/report", getTradeReport);
router.get("/:tradeId", getTradeByTradeId);

module.exports = router;
