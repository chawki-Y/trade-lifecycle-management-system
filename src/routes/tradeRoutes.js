const express = require("express");
const {
  createTrade,
  getTrades,
  getTradeReport
} = require("../controllers/tradeController");

const router = express.Router();

// Mounted in server.js at /api/trades.
router.post("/", createTrade);
router.get("/", getTrades);
router.get("/report", getTradeReport);

module.exports = router;
