// outreach-workflow.js
/**
 * Dual Offer Campaign & Resend Email Dispatch Engine
 */

require('dotenv').config();
const { calculateSellerFinancingOffer } = require('./seller-financing-calculator');

function maskStreetAddress(fullAddress) {
  return String(fullAddress || '').replace(/^(\s*)\d+\b/, '$1***');
}

function parseAddressDetails(fullAddress, deal = {}) {
  const [street = '', ...locationParts] = String(fullAddress || '')
    .split(',')
    .map((part) => part.trim());
  const stateZip = locationParts.length ? locationParts[locationParts.length - 1].match(/^(.+?)\s+(\d{5}(?:-\d{4})?)$/) : null;

  return {
    maskedStreet: maskStreetAddress(street),
    city: deal.city || (locationParts.length > 1 ? locationParts[locationParts.length - 2] : ''),
    state: deal.state || (stateZip ? stateZip[1] : ''),
    zip: deal.zip || deal.zipCode || (stateZip ? stateZip[2] : '')
  };
}

function formatCapRate(capRate) {
  if (capRate !== null && capRate !== undefined && capRate !== '' && Number.isFinite(Number(capRate))) {
    return `${(Number(capRate) * (Number(capRate) <= 1 ? 100 : 1)).toFixed(2)}%`;
  }
  return 'Not provided';
}

function formatArv(arv) {
  return arv !== null && arv !== undefined && arv !== '' && Number.isFinite(Number(arv))
    ? `$${Number(arv).toLocaleString()}`
    : 'Not provided';
}

function generateDualOfferCampaign(deal, sellerFinanceTerms) {
  const listingPrice = deal.listingPrice || deal.purchasePrice;
  const arv = deal.arv;
  const repairCost = deal.repairCost || 0;
  const addressDetails = parseAddressDetails(deal.fullAddress || deal.address, deal);
  const propertyAddress = [addressDetails.maskedStreet, addressDetails.city, [addressDetails.state, addressDetails.zip].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  const city = addressDetails.city;
  const zip = addressDetails.zip;
  const capRate = formatCapRate(deal.capRate);

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
    propertyAddress,
    city,
    zip,
    arv,
    capRate,
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

We are pleased to present two flexible purchase options for your property at ${offerPackage.propertyAddress}.

City: ${offerPackage.city || 'Not provided'}
ZIP: ${offerPackage.zip || 'Not provided'}
ARV: ${formatArv(offerPackage.arv)}
Cap Rate: ${offerPackage.capRate || 'Not provided'}

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

async function sendTeaserEmail(deal) {
  if (!deal || typeof deal !== 'object') {
    throw new TypeError('deal must be an object.');
  }

  const addressDetails = parseAddressDetails(deal.fullAddress || deal.address, deal);
  const maskedAddress = [addressDetails.maskedStreet, addressDetails.city, [addressDetails.state, addressDetails.zip].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  const locality = [addressDetails.city, addressDetails.zip].filter(Boolean).join(' ');
  const offerTypeValue = String(deal.offerType || deal.offer_type || '').trim().toLowerCase();
  const offerType = /balloon|seller.?financ/.test(offerTypeValue)
    ? 'Balloon'
    : 'Premium Cash';
  const subject = `Deal Teaser - ${locality || 'Property Opportunity'}`;
  const emailBody = [
    `Property: ${maskedAddress || addressDetails.maskedStreet || 'Address withheld'}`,
    `City: ${addressDetails.city || 'Not provided'}`,
    `State: ${addressDetails.state || 'Not provided'}`,
    `ZIP: ${addressDetails.zip || 'Not provided'}`,
    `ARV: ${formatArv(deal.arv)}`,
    `Cap Rate: ${formatCapRate(deal.capRate)}`,
    `Offer Type: ${offerType}`
  ].join('\n');
  const to = deal.investorEmail || deal.to || 'investor@example.com';
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey.includes('your_resend_api_key')) {
    return { status: 'FALLBACK_MAILTO', mailto };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.SENDER_EMAIL || 'onboarding@resend.dev',
        to,
        subject,
        text: emailBody
      })
    });

    if (!response.ok) {
      console.error(`[TEASER EMAIL ERROR] Resend returned HTTP ${response.status}.`);
      return { status: 'FALLBACK_MAILTO', mailto };
    }

    return { ...(await response.json()), status: 'SENT' };
  } catch (error) {
    console.error('[TEASER EMAIL ERROR]:', error.message);
    return { status: 'FALLBACK_MAILTO', mailto };
  }
}

module.exports = {
  maskStreetAddress,
  generateDualOfferCampaign,
  sendSellerOutreachEmail,
  sendTeaserEmail
};