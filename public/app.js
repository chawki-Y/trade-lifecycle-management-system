const tradeForm = document.querySelector("#tradeForm");
const refreshButton = document.querySelector("#refreshButton");
const formMessage = document.querySelector("#formMessage");
const tradesTable = document.querySelector("#tradesTable");
const tradeCount = document.querySelector("#tradeCount");
const instrumentSelect = document.querySelector("#instrument");
const submitButton = tradeForm.querySelector("button[type='submit']");
const selectedInstrumentLabel = document.querySelector("#selectedInstrumentLabel");
const marketPriceValue = document.querySelector("#marketPriceValue");
const marketPriceUpdatedAt = document.querySelector("#marketPriceUpdatedAt");
const marketPriceCheckedAt = document.querySelector("#marketPriceCheckedAt");
const marketPriceStatus = document.querySelector("#marketPriceStatus");
let instrumentsLoaded = false;
let latestMarketPrice = null;
let marketPriceTimer = null;

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
  metricEls.validTrades.textContent = report.ValidTrades ?? 0;
  metricEls.rejectedTrades.textContent = report.RejectedTrades ?? 0;
  metricEls.totalPnl.textContent = formatNumber(report.TotalPnL ?? 0);
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
  setMarketPriceState({
    symbol,
    price: latestMarketPrice,
    timestamp: null,
    checkedAt: new Date().toISOString(),
    status: "Loading..."
  });

  const marketData = await fetchJson(`/api/market-price/${encodeURIComponent(symbol)}`);
  latestMarketPrice = marketData.marketPrice;

  setMarketPriceState({
    symbol: marketData.symbol,
    price: marketData.marketPrice,
    timestamp: marketData.timestamp,
    checkedAt: marketData.checkedAt,
    status: marketData.fromCache ? "Price source: Cache" : "Price source: API"
  });
}

function stopMarketPriceRefresh() {
  if (marketPriceTimer) {
    clearInterval(marketPriceTimer);
    marketPriceTimer = null;
  }
}

async function startMarketPriceRefresh(symbol) {
  stopMarketPriceRefresh();
  latestMarketPrice = null;
  submitButton.disabled = true;

  try {
    await loadMarketPrice(symbol);
    submitButton.disabled = false;
    setMessage("");
  } catch (error) {
    latestMarketPrice = null;
    submitButton.disabled = true;
    setMarketPriceState({
      symbol,
      checkedAt: new Date().toISOString(),
      status: "Market price unavailable"
    });
    setMessage("Market price is unavailable. Please try again later.", "error");
    return;
  }

  marketPriceTimer = setInterval(async () => {
    try {
      await loadMarketPrice(symbol);
    } catch (error) {
      setMarketPriceState({
        symbol,
        price: latestMarketPrice,
        checkedAt: new Date().toISOString(),
        status: "Using last available price"
      });
    }
  }, 5000);
}

async function loadTrades() {
  const trades = await fetchJson("/api/trades");
  tradeCount.textContent = `${trades.length} ${trades.length === 1 ? "row" : "rows"}`;

  if (!trades.length) {
    tradesTable.innerHTML = `<tr><td class="empty-row" colspan="8">No trades captured yet.</td></tr>`;
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
      </tr>
    `;
  }).join("");
}

async function refreshDashboard() {
  await loadTrades();
  await loadReport();
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

    const resultMessage = result.status === "VALID"
      ? `Trade ${result.tradeId} processed successfully.`
      : `Trade rejected: ${result.rejectionReason || result.message}`;

    setMessage(resultMessage, result.status === "VALID" ? "success" : "error");
    tradeForm.reset();
    document.querySelector("#tradeDate").valueAsDate = new Date();
    stopMarketPriceRefresh();
    latestMarketPrice = null;
    submitButton.disabled = true;
    setMarketPriceState({ status: "Select an instrument" });
    await refreshDashboard();
  } catch (error) {
    setMessage(error.message, "error");
  }
});

refreshButton.addEventListener("click", async () => {
  setMessage("Refreshing...");
  try {
    await refreshDashboard();
    setMessage("Dashboard refreshed.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

instrumentSelect.addEventListener("change", async () => {
  const symbol = instrumentSelect.value;

  stopMarketPriceRefresh();
  latestMarketPrice = null;

  if (!symbol) {
    submitButton.disabled = true;
    setMarketPriceState({ status: "Select an instrument" });
    return;
  }

  await startMarketPriceRefresh(symbol);
});

refreshDashboard().catch((error) => {
  setMessage(error.message, "error");
});

loadInstruments().catch((error) => {
  setMessage(error.message, "error");
});
