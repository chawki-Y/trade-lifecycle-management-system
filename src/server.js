const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const tradeRoutes = require("./routes/tradeRoutes");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({ message: "Trade Processing System API is running" });
});

app.use("/api/trades", tradeRoutes);

app.listen(PORT, () => {
  console.log(`Trade Processing System API listening on port ${PORT}`);
});
