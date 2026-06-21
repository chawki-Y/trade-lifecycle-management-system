function validateTrade(trade) {
  // Return the first failed rule so the trade can be stored with a clear rejection reason.
  if (!trade.tradeId) {
    return "tradeId is required";
  }

  if (!trade.instrument) {
    return "instrument is required";
  }

  if (!["BUY", "SELL"].includes(String(trade.tradeType || "").toUpperCase())) {
    return "tradeType must be BUY or SELL";
  }

  if (Number(trade.quantity) <= 0 || Number.isNaN(Number(trade.quantity))) {
    return "quantity must be greater than 0";
  }

  if (Number(trade.tradePrice) <= 0 || Number.isNaN(Number(trade.tradePrice))) {
    return "tradePrice must be greater than 0";
  }

  if (Number(trade.marketPrice) <= 0 || Number.isNaN(Number(trade.marketPrice))) {
    return "marketPrice must be greater than 0";
  }

  if (!trade.tradeDate) {
    return "tradeDate is required";
  }

  return null;
}

module.exports = {
  validateTrade
};
