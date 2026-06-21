const express = require("express");
const { getMarketOverview } = require("../controllers/marketOverviewController");

const router = express.Router();

router.get("/", getMarketOverview);

module.exports = router;
