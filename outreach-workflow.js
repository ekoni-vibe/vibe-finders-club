// outreach-workflow.js
/**
 * Dual Offer Campaign & Resend Email Dispatch Engine
 */

require('dotenv').config();
const { calculateSellerFinancingOffer } = require('./seller-financing-calculator');

function generateDualOfferCampaign(deal, sellerFinanceTerms) {
  const listingPrice = deal.listingPrice || deal.purchasePrice;
  const arv = deal.arv;
  const repairCost = deal.repairCost || 0;

  // Offer A: Cash MAO Offer (70% ARV - Repairs)
  const cashOfferPrice = Math.round((arv * 0.70) - repairCost);

  // Offer B: Creative Seller Financing (10% Above Listing Price with 7-Year Balloon)
  const financeTerms = sellerFinanceTerms || calculateSellerFinancingOffer(listingPrice, {
    offerMarkupPercent: 0.10,
    downPaymentPercent: 0.10,
    interestRate: 0.045,
    balloonTermYears: 7
  });

  const sellerOutreach = {
    sellerName: deal.sellerName || "Property Owner",
    sellerEmail: deal.sellerEmail,
    propertyAddress: deal.address,
    offers: {
      offerA_Cash: {
        type: "ALL_CASH_FAST_CLOSE",
        offerPrice: cashOfferPrice,
        closingDays: 14,
        description: "Fast, all-cash close in 14 days with zero contingencies."
      },
      offerB_SellerFinance: {
        type: "CREATIVE_SELLER_FINANCING",
        offerPrice: financeTerms.offerPrice,
        aboveAskingPremium: financeTerms.markupPercentage,
        downPayment: financeTerms.downPayment,
        monthlyPayment: financeTerms.monthlyPayment,
        interestRate: financeTerms.interestRate,
        balloonDeadline: `${financeTerms.balloonTermYears} Years (${financeTerms.balloonDeadlineMonths} Months)`,
        balloonLumpSum: financeTerms.balloonPaymentAmount,
        totalSellerProceeds: financeTerms.totalSellerProceedsAtBalloon,
        description: `Earn $${financeTerms.offerPrice.toLocaleString()} (${financeTerms.markupPercentage} above asking) via$${financeTerms.monthlyPayment.toLocaleString()}/mo income and a final balloon payout of$${financeTerms.balloonPaymentAmount.toLocaleString()} at Year${financeTerms.balloonTermYears}.`
      }
    }
  };

  return sellerOutreach;
}

async function sendSellerOutreachEmail(offerPackage) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || resendApiKey.includes('your_resend_api_key')) {
    console.log("  [EMAIL OUTREACH] Resend API key not configured. Email logged to console.");
    return { status: "SKIPPED_NO_KEY" };
  }

  const emailBody = `
Dear ${offerPackage.sellerName},

We are pleased to present two flexible purchase options for your property at ${offerPackage.propertyAddress}:

OPTION 1: All-Cash Fast Close
- Purchase Price: $${offerPackage.offers.offerA_Cash.offerPrice.toLocaleString()} - Close Date: 14 Days  OPTION 2: Premium Seller Financing (Above Asking Price) - Full Purchase Price: $${offerPackage.offers.offerB_SellerFinance.offerPrice.toLocaleString()} (${offerPackage.offers.offerB_SellerFinance.aboveAskingPremium} above asking) - Down Payment: $${offerPackage.offers.offerB_SellerFinance.downPayment.toLocaleString()}
- Monthly Income: $${offerPackage.offers.offerB_SellerFinance.monthlyPayment.toLocaleString()}/month - Balloon Cash Out: $${offerPackage.offers.offerB_SellerFinance.balloonLumpSum.toLocaleString()} due at Year 7

Please reply to this email to confirm which option fits your goals.

Best regards,
DealRoom Acquisitions Team
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.SENDER_EMAIL || "onboarding@resend.dev",
        to: offerPackage.sellerEmail || "seller@example.com",
        subject: `Purchase Offer for ${offerPackage.propertyAddress}`,
        text: emailBody
      })
    });

    const data = await response.json();
    console.log(`  [EMAIL SENT] Resend Email ID: ${data.id || 'Queued'}`);
    return data;
  } catch (error) {
    console.error("  [EMAIL ERROR]:", error.message);
    return { status: "FAILED" };
  }
}

module.exports = { generateDualOfferCampaign, sendSellerOutreachEmail };