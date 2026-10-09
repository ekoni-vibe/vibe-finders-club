require('dotenv').config();

// pipeline-agent.js
/**
 * Unified DealRoom_New Execution Engine (100% Free Stack)
 */

const fs = require('fs');
const path = require('path');

const { calculateSellerFinancingOffer } = require('./seller-financing-calculator');
const { matchPropertyToBuyer } = require('./investor-matcher');
const { analyzeDealWithFreeAI } = require('./ai-triage-helper');
const { generateDualOfferCampaign, sendSellerOutreachEmail } = require('./outreach-workflow');
const { stageRemittancePayment } = require('./remittance-generator');

const sampleDeals = [
  {
    id: "DEAL-101",
    address: "1044 Market Street, San Francisco, CA",
    listingPrice: 450000,
    purchasePrice: 450000,
    arv: 600000,
    repairCost: 40000,
    zipCode: "94102",
    profitMargin: 0.25,
    sellerName: "Alex Morgan",
    sellerEmail: "alex.morgan@example.com"
  }
];

async function executeDealPipeline() {
  console.log("==================================================================");
  console.log("Starting DealRoom_New Automated Real Estate Triage & Payout Engine");
  console.log("==================================================================\n");

  const executionLogs = [];

  for (const deal of sampleDeals) {
    console.log(`[TRIAGE] Processing Property: ${deal.address}`);

    // 1. Free OpenRouter AI Analysis
    const aiAnalysis = await analyzeDealWithFreeAI(deal);
    console.log(`  [AI Score]: ${aiAnalysis.aiScore}`);
    console.log(`  [AI Summary]: ${aiAnalysis.investmentSummary}`);

    // 2. Investor Matching
    const investorMatch = matchPropertyToBuyer(deal);
    console.log(`  [Matched Category]: ${investorMatch.matchedCategory}`);

    // 3. Dual Offer Package (Cash vs Seller Financing with Balloon Payment)
    const sellerFinanceTerms = calculateSellerFinancingOffer(deal.listingPrice || deal.purchasePrice, {
      offerMarkupPercent: 0.10,
      downPaymentPercent: 0.10,
      interestRate: 0.045,
      balloonTermYears: 7
    });
    const offerPackage = generateDualOfferCampaign(deal, sellerFinanceTerms);
    console.log(`  [Offer A - Cash]: $${offerPackage.offers.offerA_Cash.offerPrice.toLocaleString()}`);
    console.log(`  [Offer B - Seller Finance]: $${offerPackage.offers.offerB_SellerFinance.offerPrice.toLocaleString()}`);
    console.log(`  [Balloon Lump Sum]: $${offerPackage.offers.offerB_SellerFinance.balloonLumpSum.toLocaleString()} due in ${offerPackage.offers.offerB_SellerFinance.balloonDeadline}`);

    // 4. Send Email Outreach via Resend
    await sendSellerOutreachEmail(offerPackage);

    // 5. Stage Remittance Payment for Ebisa Wakjira (Ethiopia)
    const remittancePayload = stageRemittancePayment(deal, 0.02);

    executionLogs.push({
      timestamp: new Date().toISOString(),
      deal,
      aiAnalysis,
      investorMatch,
      offerPackage,
      remittancePayload
    });
  }

  // Save log file
  const logFilePath = path.join(__dirname, 'triage-execution-log.json');
  fs.writeFileSync(logFilePath, JSON.stringify(executionLogs, null, 2));
  console.log(`\n[SUCCESS] Pipeline execution complete. Output saved to triage-execution-log.json`);
}

executeDealPipeline();