function calculatePnL(tradeType, quantity, tradePrice, marketPrice) {
  const normalizedTradeType = String(tradeType || "").toUpperCase();
  const numericQuantity = Number(quantity);
  const numericTradePrice = Number(tradePrice);
  const numericMarketPrice = Number(marketPrice);
  // Keep API responses aligned with the NUMERIC(18,4) database scale.
  const roundToFourDecimals = (value) => Number(value.toFixed(4));

  if (normalizedTradeType === "BUY") {
    return roundToFourDecimals((numericMarketPrice - numericTradePrice) * numericQuantity);
  }

  if (normalizedTradeType === "SELL") {
    return roundToFourDecimals((numericTradePrice - numericMarketPrice) * numericQuantity);
  }

  return 0;
}

module.exports = {
  calculatePnL
};
