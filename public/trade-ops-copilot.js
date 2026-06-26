(function attachTradeOpsCopilot(global) {
  const DEFAULT_QUESTIONS = [
    "Give me an operations morning summary.",
    "Show me today's rejected trades.",
    "Is any market data stale?",
    "Summarize today's P&L.",
    "Highlight operational risks.",
  ];

  const STYLE_ID = "trade-ops-copilot-styles";
  const ROOT_ID = "trade-ops-copilot-root";

  const styles = `
    #trade-ops-copilot-root,
    #trade-ops-copilot-root * {
      box-sizing: border-box;
    }

    .tocopilot-button {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 9998;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-height: 48px;
      padding: 0 16px;
      border: 0;
      border-radius: 999px;
      background: #0f172a;
      color: #f8fafc;
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.28);
      cursor: pointer;
      font: 700 14px/1.1 Arial, Helvetica, sans-serif;
    }

    .tocopilot-button:hover {
      background: #111827;
    }

    .tocopilot-button-icon {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: #22c55e;
      color: #052e16;
      font-size: 16px;
    }

    .tocopilot-panel {
      position: fixed;
      top: 14px;
      right: 14px;
      z-index: 9999;
      display: none;
      grid-template-rows: auto 1fr auto;
      width: min(430px, calc(100vw - 28px));
      max-width: calc(100vw - 28px);
      height: min(760px, calc(100vh - 28px));
      min-width: 0;
      overflow: hidden;
      border: 1px solid #d8dde3;
      border-radius: 12px;
      background: #ffffff;
      color: #1f2933;
      box-shadow: 0 26px 70px rgba(16, 24, 40, 0.28);
      font-family: Arial, Helvetica, sans-serif;
    }

    .tocopilot-panel.open {
      display: grid;
    }

    .tocopilot-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-width: 0;
      padding: 16px;
      border-bottom: 1px solid #e5e7eb;
      background: #f8fafc;
    }

    .tocopilot-title {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      overflow-wrap: anywhere;
    }

    .tocopilot-subtitle {
      margin: 4px 0 0;
      color: #667085;
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .tocopilot-close {
      width: 34px;
      height: 34px;
      border: 1px solid #d8dde3;
      border-radius: 8px;
      background: #ffffff;
      color: #1f2933;
      cursor: pointer;
      font-size: 18px;
    }

    .tocopilot-body {
      display: grid;
      align-content: start;
      gap: 10px;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 14px;
      background: #f7f9fc;
    }

    .tocopilot-message {
      width: fit-content;
      max-width: 100%;
      min-width: 0;
      border: 1px solid #d8dde3;
      border-radius: 10px;
      padding: 11px 12px;
      background: #ffffff;
      font-size: 14px;
      line-height: 1.45;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .tocopilot-message-text {
      white-space: pre-wrap;
    }

    .tocopilot-message.user {
      justify-self: end;
      max-width: 84%;
      border-color: #14532d;
      border-radius: 14px 14px 4px 14px;
      background: #dcfce7;
      color: #052e16;
    }

    .tocopilot-message:not(.user) {
      justify-self: start;
      border-radius: 14px 14px 14px 4px;
    }

    .tocopilot-message.error {
      border-color: #fecdd3;
      background: #fff1f2;
      color: #9f1239;
    }

    .tocopilot-intent {
      display: inline-flex;
      width: fit-content;
      margin-top: 8px;
      border: 1px solid #d8dde3;
      border-radius: 999px;
      background: #f8fafc;
      color: #667085;
      padding: 3px 7px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .tocopilot-sql {
      max-width: 100%;
      margin-top: 10px;
      overflow-x: auto;
      border: 1px solid #d8dde3;
      border-radius: 8px;
      background: #0f172a;
      color: #bbf7d0;
      padding: 10px;
      font-size: 11px;
      line-height: 1.45;
      white-space: pre-wrap;
    }

    .tocopilot-samples {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      min-width: 0;
    }

    .tocopilot-sample {
      max-width: 100%;
      border: 1px solid #d8dde3;
      border-radius: 999px;
      background: #ffffff;
      color: #1f2933;
      cursor: pointer;
      padding: 7px 10px;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.25;
      overflow-wrap: anywhere;
      text-align: left;
      white-space: normal;
    }

    .tocopilot-table-wrap {
      width: 100%;
      max-width: 100%;
      margin-top: 10px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #ffffff;
    }

    .tocopilot-result-list {
      display: grid;
      font-size: 12px;
    }

    .tocopilot-result-card {
      display: grid;
      gap: 2px;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }

    .tocopilot-result-card:last-child {
      border-bottom: 0;
    }

    .tocopilot-result-field {
      display: grid;
      grid-template-columns: minmax(92px, 34%) minmax(0, 1fr);
      gap: 8px;
      padding: 8px;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .tocopilot-result-label {
      color: #667085;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }

    .tocopilot-result-value {
      min-width: 0;
      color: #1f2933;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .tocopilot-form {
      display: flex;
      gap: 8px;
      min-width: 0;
      padding: 12px;
      border-top: 1px solid #e5e7eb;
      background: #ffffff;
    }

    .tocopilot-input {
      flex: 1;
      min-width: 0;
      min-height: 42px;
      border: 1px solid #d8dde3;
      border-radius: 8px;
      padding: 0 11px;
      font: 14px Arial, Helvetica, sans-serif;
    }

    .tocopilot-send {
      min-width: 74px;
      min-height: 42px;
      border: 0;
      border-radius: 8px;
      background: #166534;
      color: #ffffff;
      cursor: pointer;
      font-weight: 800;
    }

    .tocopilot-send:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    @media (max-width: 560px) {
      .tocopilot-panel {
        inset: 8px;
        width: auto;
        height: auto;
        max-width: none;
        border-radius: 10px;
      }

      .tocopilot-button {
        right: 14px;
        bottom: 14px;
      }

      .tocopilot-header {
        padding: 14px;
      }

      .tocopilot-body {
        padding: 12px;
      }

      .tocopilot-message.user {
        max-width: 94%;
      }

      .tocopilot-result-field {
        grid-template-columns: minmax(86px, 34%) minmax(0, 1fr);
        padding: 5px 8px;
      }

      .tocopilot-form {
        grid-template-columns: minmax(0, 1fr);
        display: grid;
      }

      .tocopilot-send {
        width: 100%;
      }
    }
  `;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = styles;
    document.head.appendChild(style);
  }

  function normalizeRows(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (data && Array.isArray(data.latestRejectedTrades)) {
      return data.latestRejectedTrades;
    }

    if (data && Array.isArray(data.auditLogs)) {
      return data.auditLogs;
    }

    if (data && data.trade) {
      return [data.trade];
    }

    if (data && typeof data === "object") {
      return [data];
    }

    return [];
  }

  function renderTable(payload) {
    const rows = (payload?.rows?.length ? payload.rows : normalizeRows(payload?.data)).slice(0, 6);

    if (!rows.length || typeof rows[0] !== "object") {
      return "";
    }

    const columns = (payload?.columns?.length ? payload.columns : Object.keys(rows[0])).slice(0, 6);
    const body = rows
      .map((row) => {
        const fields = columns
          .map(
            (column) =>
              `<div class="tocopilot-result-field">
                <span class="tocopilot-result-label">${escapeHtml(column)}</span>
                <span class="tocopilot-result-value">${escapeHtml(formatValue(row[column]))}</span>
              </div>`
          )
          .join("");
        return `<div class="tocopilot-result-card">${fields}</div>`;
      })
      .join("");

    return `
      <div class="tocopilot-table-wrap">
        <div class="tocopilot-result-list">${body}</div>
      </div>
    `;
  }

  function formatValue(value) {
    if (value === null || value === undefined) {
      return "-";
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function createMessage({ role, text, type = "", payload = null }) {
    const wrapper = document.createElement("article");
    wrapper.className = `tocopilot-message ${role === "user" ? "user" : ""} ${type}`;
    const intentBadge =
      payload?.intent && role !== "user"
        ? `<div class="tocopilot-intent">${escapeHtml(payload.intent.replaceAll("_", " "))}</div>`
        : "";
    const sqlBlock = payload?.generatedSql
      ? `<pre class="tocopilot-sql"><code>${escapeHtml(payload.generatedSql)}</code></pre>`
      : "";
    wrapper.innerHTML = `<div class="tocopilot-message-text">${escapeHtml(text)}</div>${intentBadge}${sqlBlock}${renderTable(
      payload
    )}`;
    return wrapper;
  }

  function init(options = {}) {
    ensureStyles();

    const existing = document.getElementById(ROOT_ID);
    if (existing) {
      existing.remove();
    }

    const rawApiBaseUrl =
      options.apiBaseUrl === undefined ? "http://127.0.0.1:8000" : options.apiBaseUrl;
    const apiBaseUrl = rawApiBaseUrl.replace(/\/$/, "");
    const title = options.title || "Trade Ops Copilot";
    const subtitle = options.subtitle || "Operations assistant";
    const questions = options.sampleQuestions || DEFAULT_QUESTIONS;

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <button class="tocopilot-button" type="button" aria-expanded="false">
        <span class="tocopilot-button-icon">AI</span>
        <span>${escapeHtml(options.buttonLabel || "Ask Copilot")}</span>
      </button>
      <section class="tocopilot-panel" role="dialog" aria-label="${escapeHtml(title)}">
        <header class="tocopilot-header">
          <div>
            <p class="tocopilot-title">${escapeHtml(title)}</p>
            <p class="tocopilot-subtitle">${escapeHtml(subtitle)}</p>
          </div>
          <button class="tocopilot-close" type="button" aria-label="Close copilot">×</button>
        </header>
        <div class="tocopilot-body">
          <article class="tocopilot-message">
            Ask about rejected trades, P&L, audit logs, operational alerts, or market data freshness.
          </article>
          <div class="tocopilot-samples">
            ${questions.map((question) => `<button class="tocopilot-sample" type="button">${escapeHtml(question)}</button>`).join("")}
          </div>
        </div>
        <form class="tocopilot-form">
          <input class="tocopilot-input" type="text" placeholder="Ask a trade operations question..." />
          <button class="tocopilot-send" type="submit">Send</button>
        </form>
      </section>
    `;

    document.body.appendChild(root);

    const button = root.querySelector(".tocopilot-button");
    const panel = root.querySelector(".tocopilot-panel");
    const close = root.querySelector(".tocopilot-close");
    const body = root.querySelector(".tocopilot-body");
    const form = root.querySelector(".tocopilot-form");
    const input = root.querySelector(".tocopilot-input");
    const send = root.querySelector(".tocopilot-send");

    function setOpen(open) {
      panel.classList.toggle("open", open);
      button.setAttribute("aria-expanded", String(open));
    }

    function appendMessage(message) {
      body.appendChild(createMessage(message));
      body.scrollTop = body.scrollHeight;
    }

    async function ask(question) {
      const trimmed = question.trim();
      if (!trimmed) {
        return;
      }

      appendMessage({ role: "user", text: trimmed });
      input.value = "";
      input.disabled = true;
      send.disabled = true;
      const loading = createMessage({ role: "assistant", text: "Checking operations data..." });
      body.appendChild(loading);
      body.scrollTop = body.scrollHeight;

      try {
        const response = await fetch(`${apiBaseUrl}/agent/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.detail || payload.message || "Copilot request failed.");
        }

        loading.remove();
        appendMessage({
          role: "assistant",
          text: payload.answer,
          payload,
        });
      } catch (error) {
        loading.remove();
        appendMessage({
          role: "assistant",
          type: "error",
          text: error.message || "Copilot request failed.",
        });
      } finally {
        input.disabled = false;
        send.disabled = false;
        input.focus();
      }
    }

    button.addEventListener("click", () => setOpen(!panel.classList.contains("open")));
    close.addEventListener("click", () => setOpen(false));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      ask(input.value);
    });
    root.querySelectorAll(".tocopilot-sample").forEach((sample) => {
      sample.addEventListener("click", () => ask(sample.textContent || ""));
    });

    if (options.openOnLoad) {
      setOpen(true);
    }

    return {
      open: () => setOpen(true),
      close: () => setOpen(false),
      destroy: () => root.remove(),
      ask,
    };
  }

  global.TradeOpsCopilot = {
    init,
  };
})(window);
