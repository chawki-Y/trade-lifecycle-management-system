const express = require("express");
const { getInstruments } = require("../controllers/instrumentController");

const router = express.Router();

router.get("/", getInstruments);

module.exports = router;
