const express = require("express");
const {
  createTrade,
  getTrades,
  getTradeReport
} = require("../controllers/tradeController");

const router = express.Router();

router.post("/", createTrade);
router.get("/", getTrades);
router.get("/report", getTradeReport);

module.exports = router;
