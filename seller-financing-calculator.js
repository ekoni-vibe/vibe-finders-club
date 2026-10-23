/**
 * Seller financing, premium cash, and balloon payment calculations.
 */

function validateListPrice(listPrice) {
  if (!Number.isFinite(listPrice) || listPrice <= 0) {
    throw new TypeError('listPrice must be a positive finite number.');
  }
}

function validateNonNegativeAmount(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative finite number.`);
  }
}

function validateRange(value, minimum, maximum, name) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be between ${minimum} and ${maximum}.`);
  }
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function boundedOption(value, fallback, minimum, maximum, name) {
  const candidate = value ?? fallback;
  if (!Number.isFinite(candidate)) {
    throw new TypeError(`${name} must be a finite number.`);
  }
  return clamp(candidate, minimum, maximum);
}

function calculatePremiumCash(listPrice) {
  validateListPrice(listPrice);

  return {
    listPrice,
    minimumOffer: Math.round(listPrice * 1.05),
    maximumOffer: Math.round(listPrice * 1.15),
    premiumRange: '5%-15%',
    flags: {
      proofOfFunds100Percent: true,
      closeWithin7To14Days: true,
      appraisalGapWaiver: true
    },
    closingDays: { minimum: 7, maximum: 14 }
  };
}

function calculatePremiumCashOffer(listPrice, arv, rehab, options = {}) {
  validateListPrice(listPrice);
  validateNonNegativeAmount(arv, 'arv');
  validateNonNegativeAmount(rehab, 'rehab');

  const multiplier = options.multiplier ?? 1.10;
  validateRange(multiplier, 1.05, 1.15, 'multiplier');

  const offerPrice = roundCurrency(listPrice * multiplier);
  const premium = roundCurrency(offerPrice - listPrice);

  return {
    offerPrice,
    premium,
    premiumPercent: roundCurrency((premium / listPrice) * 100),
    requirements: [
      '100% POF required',
      '7-14 day close',
      'Appraisal gap waiver'
    ],
    totalCashNeeded: roundCurrency(offerPrice + rehab + (arv * 0.05))
  };
}

function calculateBalloonPayment(listPrice, arv, rehab, options = {}) {
  validateListPrice(listPrice);
  validateNonNegativeAmount(arv, 'arv');
  validateNonNegativeAmount(rehab, 'rehab');

  const multiplier = options.multiplier ?? 1.15;
  const downPaymentPercent = options.downPaymentPercent ?? 0.10;
  const amortizationYears = options.amortizationYears ?? 30;
  const balloonMaturityYears = options.balloonMaturityYears ?? 7;
  validateRange(multiplier, 1.10, 1.20, 'multiplier');
  validateRange(downPaymentPercent, 0.05, 0.10, 'downPaymentPercent');
  validateRange(amortizationYears, 15, 30, 'amortizationYears');
  validateRange(balloonMaturityYears, 3, 7, 'balloonMaturityYears');
  if (!Number.isInteger(amortizationYears) || !Number.isInteger(balloonMaturityYears)) {
    throw new TypeError('amortizationYears and balloonMaturityYears must be integers.');
  }

  const offerPrice = roundCurrency(listPrice * multiplier);
  const downPayment = roundCurrency(offerPrice * downPaymentPercent);
  const principal = roundCurrency(offerPrice - downPayment);
  const amortizationMonths = amortizationYears * 12;
  const maturityMonths = balloonMaturityYears * 12;
  const monthlyPayment = roundCurrency(principal / amortizationMonths);
  const remainingBalance = roundCurrency(Math.max(0, principal - (monthlyPayment * maturityMonths)));
  const startDate = options.startDate === undefined ? new Date() : new Date(options.startDate);
  if (Number.isNaN(startDate.getTime())) {
    throw new TypeError('startDate must be a valid date.');
  }
  const balloonDate = new Date(startDate);
  balloonDate.setFullYear(balloonDate.getFullYear() + balloonMaturityYears);

  return {
    offerPrice,
    downPayment,
    monthlyPayment,
    balloonMaturityYears,
    balloonMaturityDate: balloonDate.toISOString(),
    remainingBalance
  };
}

function calculateBalloon(listingPrice, options = {}) {
  validateListPrice(listingPrice);

  const offerMarkupPercent = options.offerMarkupPercent ?? 0.10;
  const downPaymentPercent = boundedOption(options.downPaymentPercent, 0.10, 0.05, 0.10, 'downPaymentPercent');
  const interestRate = options.interestRate ?? 0.045;
  const amortizationYears = boundedOption(options.amortizationYears, 30, 15, 30, 'amortizationYears');
  const balloonTermYears = boundedOption(options.balloonTermYears, 7, 3, 7, 'balloonTermYears');

  if (!Number.isFinite(offerMarkupPercent) || offerMarkupPercent < 0) {
    throw new TypeError('offerMarkupPercent must be a non-negative finite number.');
  }
  if (!Number.isFinite(interestRate) || interestRate < 0) {
    throw new TypeError('interestRate must be a non-negative finite number.');
  }

  const offerPrice = Math.round(listingPrice * (1 + offerMarkupPercent));
  const downPayment = Math.round(offerPrice * downPaymentPercent);
  const loanPrincipal = offerPrice - downPayment;
  const monthlyRate = interestRate / 12;
  const totalAmortizationMonths = amortizationYears * 12;
  const balloonMonth = balloonTermYears * 12;
  const monthlyPayment = monthlyRate === 0
    ? loanPrincipal / totalAmortizationMonths
    : loanPrincipal * (
      monthlyRate * Math.pow(1 + monthlyRate, totalAmortizationMonths)
    ) / (Math.pow(1 + monthlyRate, totalAmortizationMonths) - 1);
  const balloonPaymentAmount = monthlyRate === 0
    ? loanPrincipal * (1 - balloonMonth / totalAmortizationMonths)
    : loanPrincipal * (
      Math.pow(1 + monthlyRate, totalAmortizationMonths) - Math.pow(1 + monthlyRate, balloonMonth)
    ) / (Math.pow(1 + monthlyRate, totalAmortizationMonths) - 1);

  const totalInterestBeforeBalloon = (monthlyPayment * balloonMonth) - (loanPrincipal - balloonPaymentAmount);
  const totalSellerProceeds = downPayment + (monthlyPayment * balloonMonth) + balloonPaymentAmount;

  return {
    listingPrice,
    offerPrice,
    markupPercentage: `${(offerMarkupPercent * 100).toFixed(1)}%`,
    downPayment,
    downPaymentPercent,
    loanPrincipal,
    interestRate: `${(interestRate * 100).toFixed(2)}%`,
    amortizationYears,
    balloonTermYears,
    balloonDeadlineMonths: balloonMonth,
    monthlyPayment: Number(monthlyPayment.toFixed(2)),
    balloonPaymentAmount: Number(balloonPaymentAmount.toFixed(2)),
    totalInterestPaidToSellerBeforeBalloon: Number(totalInterestBeforeBalloon.toFixed(2)),
    totalSellerProceedsAtBalloon: Number(totalSellerProceeds.toFixed(2))
  };
}

function calculateSellerFinancingOffer(listingPrice, options = {}) {
  return calculateBalloon(listingPrice, options);
}

module.exports = {
  calculatePremiumCash,
  calculatePremiumCashOffer,
  calculateBalloonPayment,
  calculateBalloon,
  calculateSellerFinancingOffer
};
