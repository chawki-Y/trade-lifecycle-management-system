const tradeForm = document.querySelector("#tradeForm");
const refreshButton = document.querySelector("#refreshButton");
const refreshMarketPriceButton = document.querySelector("#refreshMarketPriceButton");
const refreshMarketOverviewButton = document.querySelector("#refreshMarketOverviewButton");
const refreshAuditButton = document.querySelector("#refreshAuditButton");
const formMessage = document.querySelector("#formMessage");
const tradesTable = document.querySelector("#tradesTable");
const tradeCount = document.querySelector("#tradeCount");
const marketOverviewTable = document.querySelector("#marketOverviewTable");
const marketOverviewStatus = document.querySelector("#marketOverviewStatus");
const auditTable = document.querySelector("#auditTable");
const auditStatus = document.querySelector("#auditStatus");
const tradeDetailModal = document.querySelector("#tradeDetailModal");
const tradeDetailContent = document.querySelector("#tradeDetailContent");
const closeTradeDetailButton = document.querySelector("#closeTradeDetailButton");
const instrumentSelect = document.querySelector("#instrument");
const submitButton = tradeForm.querySelector("button[type='submit']");
const selectedInstrumentLabel = document.querySelector("#selectedInstrumentLabel");
const marketPriceValue = document.querySelector("#marketPriceValue");
const marketPriceUpdatedAt = document.querySelector("#marketPriceUpdatedAt");
const marketPriceCheckedAt = document.querySelector("#marketPriceCheckedAt");
const marketPriceStatus = document.querySelector("#marketPriceStatus");
let instrumentsLoaded = false;
let latestMarketPrice = null;

const metricEls = {
  totalTrades: document.querySelector("#totalTrades"),
  validTrades: document.querySelector("#validTrades"),
  rejectedTrades: document.querySelector("#rejectedTrades"),
  totalPnl: document.querySelector("#totalPnl")
};

document.querySelector("#tradeDate").valueAsDate = new Date();

function formatNumber(value) {
  const number = Number(value);
  if (Number.isNaN(number)) {
    return value ?? "";
  }

  return number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  });
}

function setMessage(message, type = "") {
  formMessage.textContent = message;
  formMessage.className = type;
}

function formatMarketPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  });
}

function formatTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleTimeString();
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function formatSource(source) {
  if (!source || source === "Unavailable") {
    return source || "-";
  }

  if (source === "twelvedata") {
    return "Twelve Data";
  }

  return source;
}

function formatCacheAge(ageSeconds) {
  const age = Number(ageSeconds);

  if (!Number.isFinite(age)) {
    return "";
  }

  return ` Age: ${age}s`;
}

function setMarketPriceState({ symbol = "-", price = null, timestamp = null, checkedAt = null, status = "" }) {
  selectedInstrumentLabel.textContent = symbol;
  marketPriceValue.textContent = price === null ? "-" : formatMarketPrice(price);
  marketPriceUpdatedAt.textContent = formatTime(timestamp);
  marketPriceCheckedAt.textContent = formatTime(checkedAt);
  marketPriceStatus.textContent = status;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload;
}

async function loadReport() {
  const report = await fetchJson("/api/trades/report");
  metricEls.totalTrades.textContent = report.TotalTrades ?? 0;
  metricEls.validTrades.textContent = report.BookedTrades ?? report.ValidTrades ?? 0;
  metricEls.rejectedTrades.textContent = report.RejectedTrades ?? 0;
  metricEls.totalPnl.textContent = formatNumber(report.TotalPnL ?? 0);
}

async function loadMarketOverview() {
  marketOverviewStatus.textContent = "Loading market prices...";
  refreshMarketOverviewButton.disabled = true;

  try {
    const overview = await fetchJson("/api/market-overview");

    if (!overview.length) {
      marketOverviewTable.innerHTML = `<tr><td class="empty-row" colspan="7">No active instruments available.</td></tr>`;
      marketOverviewStatus.textContent = "No active instruments";
      return;
    }

    marketOverviewTable.innerHTML = overview.map((instrument) => {
      const sourceLabel = instrument.marketPrice === null ? "Unavailable" : instrument.fromCache ? "Cache" : "API";
      const sourceClass = instrument.marketPrice === null ? "unavailable" : instrument.fromCache ? "cache" : "api";
      const cacheAge = instrument.fromCache ? formatCacheAge(instrument.cacheAgeSeconds) : "";
      const price = instrument.marketPrice === null ? "Unavailable" : formatMarketPrice(instrument.marketPrice);
      const updatedAt = formatTime(instrument.lastUpdated);

      return `
        <tr>
          <td><strong>${instrument.symbol}</strong></td>
          <td>${instrument.name}</td>
          <td>${instrument.assetClass}</td>
          <td>${instrument.currency || "-"}</td>
          <td>${price}</td>
          <td>${updatedAt}</td>
          <td>
            <span>${formatSource(instrument.source)}</span>
            <span class="source-pill ${sourceClass}">Source: ${sourceLabel}${cacheAge}</span>
          </td>
        </tr>
      `;
    }).join("");

    marketOverviewStatus.textContent = `Updated ${overview.length} instruments`;
  } catch (error) {
    marketOverviewStatus.textContent = "Market overview unavailable";
    marketOverviewTable.innerHTML = `<tr><td class="empty-row" colspan="7">${error.message}</td></tr>`;
  } finally {
    refreshMarketOverviewButton.disabled = false;
  }
}

async function loadAuditLogs() {
  auditStatus.textContent = "Loading audit logs...";
  refreshAuditButton.disabled = true;

  try {
    const logs = await fetchJson("/api/audit-logs");

    if (!logs.length) {
      auditTable.innerHTML = `<tr><td class="empty-row" colspan="4">No audit events yet.</td></tr>`;
      auditStatus.textContent = "No audit events";
      return;
    }

    auditTable.innerHTML = logs.map((log) => `
      <tr>
        <td>${formatDateTime(log.createdAt)}</td>
        <td>${log.eventType}</td>
        <td>${log.entityType}${log.entityId ? ` / ${log.entityId}` : ""}</td>
        <td>${log.description}</td>
      </tr>
    `).join("");

    auditStatus.textContent = `Showing latest ${logs.length} event${logs.length === 1 ? "" : "s"}`;
  } catch (error) {
    auditStatus.textContent = "Audit trail unavailable";
    auditTable.innerHTML = `<tr><td class="empty-row" colspan="4">${error.message}</td></tr>`;
  } finally {
    refreshAuditButton.disabled = false;
  }
}

async function loadInstruments() {
  try {
    const instruments = await fetchJson("/api/instruments");

    instrumentSelect.innerHTML = `<option value="">Select instrument</option>`;

    instruments.forEach((instrument) => {
      const option = document.createElement("option");
      option.value = instrument.symbol;
      option.textContent = `${instrument.symbol} - ${instrument.name} (${instrument.asset_class})`;
      instrumentSelect.appendChild(option);
    });

    instrumentsLoaded = instruments.length > 0;
    instrumentSelect.disabled = !instrumentsLoaded;
    submitButton.disabled = true;

    if (!instrumentsLoaded) {
      setMessage("No active instruments are available.", "error");
    }
  } catch (error) {
    instrumentsLoaded = false;
    instrumentSelect.disabled = true;
    submitButton.disabled = true;
    setMessage("Could not load instruments. Please refresh the page.", "error");
  }
}

async function loadMarketPrice(symbol) {
  refreshMarketPriceButton.disabled = true;
  setMarketPriceState({
    symbol,
    price: latestMarketPrice,
    timestamp: null,
    checkedAt: new Date().toISOString(),
    status: "Loading..."
  });

  try {
    const marketData = await fetchJson(`/api/market-price/${encodeURIComponent(symbol)}`);
    latestMarketPrice = marketData.marketPrice;

    setMarketPriceState({
      symbol: marketData.symbol,
      price: marketData.marketPrice,
      timestamp: marketData.timestamp,
      checkedAt: marketData.checkedAt,
      status: marketData.fromCache
        ? `Price source: Cache${formatCacheAge(marketData.cacheAgeSeconds)}`
        : "Price source: API"
    });

    submitButton.disabled = false;
    refreshMarketPriceButton.disabled = false;
    setMessage("");
  } catch (error) {
    latestMarketPrice = null;
    submitButton.disabled = true;
    refreshMarketPriceButton.disabled = !instrumentSelect.value;
    setMarketPriceState({
      symbol,
      checkedAt: new Date().toISOString(),
      status: "Market price unavailable"
    });
    setMessage("Market price is unavailable. Please try again later.", "error");
  }
}

async function loadTrades() {
  const trades = await fetchJson("/api/trades");
  tradeCount.textContent = `${trades.length} ${trades.length === 1 ? "row" : "rows"}`;

  if (!trades.length) {
    tradesTable.innerHTML = `<tr><td class="empty-row" colspan="9">No trades captured yet.</td></tr>`;
    return;
  }

  tradesTable.innerHTML = trades.map((trade) => {
    const status = String(trade.Status || "").toLowerCase();

    return `
      <tr>
        <td>${trade.TradeId}</td>
        <td>${trade.Instrument}</td>
        <td>${trade.TradeType}</td>
        <td>${formatNumber(trade.Quantity)}</td>
        <td>${formatNumber(trade.TradePrice)}</td>
        <td>${formatNumber(trade.MarketPrice)}</td>
        <td>${formatNumber(trade.PnL)}</td>
        <td><span class="status ${status}">${trade.Status}</span></td>
        <td><button class="table-button" type="button" data-trade-id="${trade.TradeId}">View</button></td>
      </tr>
    `;
  }).join("");
}

async function refreshDashboard() {
  await loadMarketOverview();
  await loadTrades();
  await loadReport();
  await loadAuditLogs();
}

async function refreshTradePnl() {
  await loadTrades();
  await loadReport();
  await loadAuditLogs();
}

function openTradeDetail(trade) {
  const fields = [
    ["Trade ID", trade.TradeId],
    ["Instrument", trade.Instrument],
    ["Trade Type", trade.TradeType],
    ["Quantity", formatNumber(trade.Quantity)],
    ["Trade Price", formatNumber(trade.TradePrice)],
    ["Market Price", formatNumber(trade.MarketPrice)],
    ["P&L", formatNumber(trade.PnL)],
    ["Status", trade.Status],
    ["Rejection Reason", trade.RejectionReason || "-"],
    ["Market Data Source", formatSource(trade.MarketDataSource)],
    ["Last Price Updated At", formatDateTime(trade.LastPriceUpdatedAt)],
    ["Trade Date", formatDateTime(trade.TradeDate)],
    ["Created At", formatDateTime(trade.CreatedAt)]
  ];

  tradeDetailContent.innerHTML = fields.map(([label, value]) => `
    <div>
      <span>${label}</span>
      <strong>${value ?? "-"}</strong>
    </div>
  `).join("");
  tradeDetailModal.hidden = false;
}

function closeTradeDetail() {
  tradeDetailModal.hidden = true;
  tradeDetailContent.innerHTML = "";
}

async function loadTradeDetail(tradeId) {
  try {
    const trade = await fetchJson(`/api/trades/${encodeURIComponent(tradeId)}`);
    openTradeDetail(trade);
  } catch (error) {
    setMessage(error.message, "error");
  }
}

tradeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!instrumentsLoaded || !instrumentSelect.value) {
    setMessage("Please select a valid instrument.", "error");
    return;
  }

  if (latestMarketPrice === null) {
    setMessage("Please wait for the latest market price before submitting.", "error");
    return;
  }

  setMessage("Submitting trade...");

  const formData = new FormData(tradeForm);
  // Match the JSON shape expected by POST /api/trades.
  const payload = {
    instrument: formData.get("instrument"),
    tradeType: formData.get("tradeType"),
    quantity: Number(formData.get("quantity")),
    tradePrice: Number(formData.get("tradePrice")),
    tradeDate: formData.get("tradeDate")
  };

  try {
    const result = await fetchJson("/api/trades", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const resultMessage = result.status === "BOOKED"
        ? `Trade ${result.tradeId} booked successfully.`
        : `Trade rejected: ${result.rejectionReason || result.message}`;

    setMessage(resultMessage, result.status === "BOOKED" ? "success" : "error");
    tradeForm.reset();
    document.querySelector("#tradeDate").valueAsDate = new Date();
    latestMarketPrice = null;
    submitButton.disabled = true;
    refreshMarketPriceButton.disabled = true;
    setMarketPriceState({ status: "Select an instrument" });
    await refreshDashboard();
  } catch (error) {
    setMessage(error.message, "error");
  }
});

refreshButton.addEventListener("click", async () => {
  setMessage("Refreshing trade P&L...");
  try {
    await refreshTradePnl();
    setMessage("Trade P&L refreshed.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

refreshMarketPriceButton.addEventListener("click", async () => {
  if (!instrumentSelect.value) {
    setMessage("Please select an instrument first.", "error");
    return;
  }

  await loadMarketPrice(instrumentSelect.value);
  await loadAuditLogs();
});

refreshMarketOverviewButton.addEventListener("click", async () => {
  await loadMarketOverview();
  await loadAuditLogs();
});

refreshAuditButton.addEventListener("click", async () => {
  await loadAuditLogs();
});

tradesTable.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-trade-id]");

  if (!button) {
    return;
  }

  await loadTradeDetail(button.dataset.tradeId);
});

closeTradeDetailButton.addEventListener("click", closeTradeDetail);
tradeDetailModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) {
    closeTradeDetail();
  }
});

instrumentSelect.addEventListener("change", async () => {
  const symbol = instrumentSelect.value;

  latestMarketPrice = null;

  if (!symbol) {
    submitButton.disabled = true;
    refreshMarketPriceButton.disabled = true;
    setMarketPriceState({ status: "Select an instrument" });
    return;
  }

  refreshMarketPriceButton.disabled = false;
  await loadMarketPrice(symbol);
});

refreshDashboard().catch((error) => {
  setMessage(error.message, "error");
});

loadInstruments().catch((error) => {
  setMessage(error.message, "error");
});
