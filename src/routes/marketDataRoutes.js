const express = require("express");
const { getMarketPrice } = require("../controllers/marketDataController");

const router = express.Router();

router.get("/:symbol", getMarketPrice);

module.exports = router;
