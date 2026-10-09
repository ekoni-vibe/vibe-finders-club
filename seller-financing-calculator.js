// seller-financing-calculator.js
/**
 * Seller Financing & Balloon Payment Calculator
 * Calculates creative finance offers above asking price with 30-year amortization
 * and a mandatory balloon payment deadline between 6 and 10 years.
 */

function calculateSellerFinancingOffer(listingPrice, options = {}) {
  const offerMarkupPercent = options.offerMarkupPercent || 0.10; // 10% above listing price
  const downPaymentPercent = options.downPaymentPercent || 0.10; // 10% down payment
  const interestRate = options.interestRate || 0.045;           // 4.5% annual interest
  const amortizationYears = options.amortizationYears || 30;   // 30-year amortization schedule
  const balloonTermYears = options.balloonTermYears || 7;       // Default 7-year balloon deadline

  // Enforce balloon deadline constraints (Must be 6 to 10 years max)
  const clampedBalloonYears = Math.min(Math.max(balloonTermYears, 6), 10);

  // 1. Calculate Offer Price (Above Asking Price)
  const offerPrice = Math.round(listingPrice * (1 + offerMarkupPercent));
  const downPayment = Math.round(offerPrice * downPaymentPercent);
  const loanPrincipal = offerPrice - downPayment;

  // 2. Amortization Mechanics
  const monthlyRate = interestRate / 12;
  const totalAmortizationMonths = amortizationYears * 12;
  const balloonMonth = clampedBalloonYears * 12;

  // 3. Calculate Monthly Principal & Interest Payment (M = P * [r(1+r)^n] / [(1+r)^n - 1])
  const monthlyPayment = loanPrincipal * 
    (monthlyRate * Math.pow(1 + monthlyRate, totalAmortizationMonths)) / 
    (Math.pow(1 + monthlyRate, totalAmortizationMonths) - 1);

  // 4. Calculate Balloon Payment Due at Deadline (Month k)
  // Formula: B_k = P * [(1+r)^n - (1+r)^k] / [(1+r)^n - 1]
  const balloonPaymentAmount = loanPrincipal * 
    (Math.pow(1 + monthlyRate, totalAmortizationMonths) - Math.pow(1 + monthlyRate, balloonMonth)) / 
    (Math.pow(1 + monthlyRate, totalAmortizationMonths) - 1);

  const totalInterestBeforeBalloon = (monthlyPayment * balloonMonth) - (loanPrincipal - balloonPaymentAmount);
  const totalSellerProceeds = downPayment + (monthlyPayment * balloonMonth) + balloonPaymentAmount;

  return {
    listingPrice,
    offerPrice,
    markupPercentage: `${(offerMarkupPercent * 100).toFixed(1)}%`,
    downPayment,
    loanPrincipal,
    interestRate: `${(interestRate * 100).toFixed(2)}%`,
    amortizationYears,
    balloonTermYears: clampedBalloonYears,
    balloonDeadlineMonths: balloonMonth,
    monthlyPayment: parseFloat(monthlyPayment.toFixed(2)),
    balloonPaymentAmount: parseFloat(balloonPaymentAmount.toFixed(2)),
    totalInterestPaidToSellerBeforeBalloon: parseFloat(totalInterestBeforeBalloon.toFixed(2)),
    totalSellerProceedsAtBalloon: parseFloat(totalSellerProceeds.toFixed(2))
  };
}

module.exports = { calculateSellerFinancingOffer };