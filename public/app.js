const tradeForm = document.querySelector("#tradeForm");
const refreshButton = document.querySelector("#refreshButton");
const formMessage = document.querySelector("#formMessage");
const tradesTable = document.querySelector("#tradesTable");
const tradeCount = document.querySelector("#tradeCount");

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
  await Promise.all([loadReport(), loadTrades()]);
}

tradeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Submitting trade...");

  const formData = new FormData(tradeForm);
  const payload = {
    tradeId: formData.get("tradeId").trim(),
    instrument: formData.get("instrument").trim().toUpperCase(),
    tradeType: formData.get("tradeType"),
    quantity: Number(formData.get("quantity")),
    tradePrice: Number(formData.get("tradePrice")),
    marketPrice: Number(formData.get("marketPrice")),
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

    setMessage(`${result.status}: ${result.message}`, result.status === "VALID" ? "success" : "error");
    tradeForm.reset();
    document.querySelector("#tradeDate").valueAsDate = new Date();
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

refreshDashboard().catch((error) => {
  setMessage(error.message, "error");
});
