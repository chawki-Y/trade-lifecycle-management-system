const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const tradeRoutes = require("./routes/tradeRoutes");
const instrumentRoutes = require("./routes/instrumentRoutes");
const marketDataRoutes = require("./routes/marketDataRoutes");
const marketOverviewRoutes = require("./routes/marketOverviewRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Serve the dashboard and keep API routes under /api.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({ message: "Trade Processing System API is running" });
});

app.use("/api/trades", tradeRoutes);
app.use("/api/instruments", instrumentRoutes);
app.use("/api/market-price", marketDataRoutes);
app.use("/api/market-overview", marketOverviewRoutes);
app.use("/api/audit-logs", auditLogRoutes);

app.listen(PORT, () => {
  console.log(`Trade Processing System API listening on port ${PORT}`);
});
