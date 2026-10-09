// investor-matcher.js
const fs = require('fs');

function matchPropertyToBuyer(deal) {
  const { arv, purchasePrice, repairCost, zipCode, profitMargin } = deal;
  const mao = (arv * 0.70) - repairCost; // Maximum Allowable Offer rule

  let recommendation = {
    dealId: deal.id,
    matchedCategory: 'UNMATCHED',
    targetBuyerGroup: [],
    outreachStrategy: ''
  };

  if (purchasePrice <= mao && profitMargin >= 0.20) {
    recommendation.matchedCategory = 'FLIPPER_HIGH_MARGIN';
    recommendation.targetBuyerGroup = ['Fix & Flip Investors', 'Institutional Buyers'];
    recommendation.outreachStrategy = 'Highlight ARV spread and fast closing timeline.';
  } else if (purchasePrice < (arv * 0.65) && repairCost > 30000) {
    recommendation.matchedCategory = 'WHOLESALE_ASSIGNMENT';
    recommendation.targetBuyerGroup = ['Wholesalers', 'Contract Buyers'];
    recommendation.outreachStrategy = 'Pitch assignment contract with quick finder fee setup.';
  } else if (profitMargin >= 0.12) {
    recommendation.matchedCategory = 'BUY_AND_HOLD';
    recommendation.targetBuyerGroup = ['Rental Cash Flow Investors'];
    recommendation.outreachStrategy = 'Emphasize cap rate and long-term rental yield.';
  }

  return recommendation;
}

module.exports = { matchPropertyToBuyer };