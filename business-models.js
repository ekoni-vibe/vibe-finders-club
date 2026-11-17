(function (root, factory) {
  const businessModels = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = businessModels;
  }
  root.VibeBusinessModels = businessModels;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const models = {
    finder: {
      id: 'finder',
      name: 'Finder / Bird Dog (Existing)',
      description: 'Introduction-only referrals with an NCND checkpoint and a flat or assignment-based referral fee.',
      stages: ['Lead', 'NCND Signed', 'Verified', 'Referral Payout'],
    },
    wholesaler: {
      id: 'wholesaler',
      name: 'US Wholesaler',
      description: 'Estimate a 70% ARV maximum allowable offer and a potential assignment spread.',
      stages: ['Lead', 'Analysis', 'Contract', 'Assignment/Double Close', 'Closing'],
    },
    agent: {
      id: 'agent',
      name: 'Licensed Agent',
      description: 'Track licensed representation and estimate gross commission and agent split.',
      stages: ['Lead', 'Pre-Listing', 'Active Listing', 'Under Contract', 'Closed'],
    },
    international: {
      id: 'international',
      name: 'International Investor (Remote US LLC)',
      description: 'Estimate rental returns, management fees, cap rate, and cash-on-cash return.',
      stages: ['Lead', 'Underwriting', 'LLC Acquisition', 'Property Management Handoff', 'Cash Flow'],
    },
  };

  function hasModel(id) {
    return Object.prototype.hasOwnProperty.call(models, id);
  }

  function getModel(id) {
    if (!hasModel(id)) {
      throw new RangeError(`Unknown business model: ${id}`);
    }
    return models[id];
  }

  function amount(input, key) {
    const raw = input[key];
    const value = raw === undefined || raw === null || raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${key} must be a non-negative finite number.`);
    }
    return value;
  }

  function percentage(input, key, fallback) {
    const raw = input[key];
    const value = raw === undefined || raw === null || raw === '' ? fallback : Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new RangeError(`${key} must be between 0 and 100.`);
    }
    return value;
  }

  function calculateUnderwriting(modelId, input = {}) {
    const model = getModel(modelId);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('Underwriting inputs must be an object.');
    }

    switch (model.id) {
      case 'finder': {
        const feeType = input.finderFeeType || 'flat';
        if (!['flat', 'assignment-percent'].includes(feeType)) {
          throw new RangeError('finderFeeType must be flat or assignment-percent.');
        }
        const flatFee = amount(input, 'fee');
        const assignmentAmount = amount(input, 'assignmentAmount');
        const feePercent = percentage(input, 'finderFeePercent', 10);
        const referralFee = feeType === 'flat' ? flatFee : assignmentAmount * feePercent / 100;
        return { feeType, assignmentAmount, feePercent, referralFee };
      }

      case 'wholesaler': {
        const arv = amount(input, 'arv');
        const rehab = amount(input, 'rehab');
        const contractPrice = amount(input, 'listPrice');
        const buyerPrice = amount(input, 'assignmentBuyerPrice');
        const maximumAllowableOffer = arv * 0.7 - rehab;
        return {
          maximumAllowableOffer,
          contractPrice,
          assignmentBuyerPrice: buyerPrice,
          assignmentFee: Math.max(0, buyerPrice - contractPrice),
        };
      }

      case 'agent': {
        const salePrice = amount(input, 'salePrice');
        const commissionRatePercent = percentage(input, 'commissionRatePercent', 3);
        const agentSplitPercent = percentage(input, 'agentSplitPercent', 80);
        const grossCommission = salePrice * commissionRatePercent / 100;
        const agentCommission = grossCommission * agentSplitPercent / 100;
        return {
          salePrice,
          commissionRatePercent,
          agentSplitPercent,
          grossCommission,
          agentCommission,
          brokerageCommission: grossCommission - agentCommission,
        };
      }

      case 'international': {
        const purchasePrice = amount(input, 'listPrice');
        const annualGrossRent = amount(input, 'monthlyRent') * 12;
        const annualTaxes = amount(input, 'annualTaxes');
        const annualOperatingExpenses = amount(input, 'annualOperatingExpenses');
        const annualDebtService = amount(input, 'debtService');
        const cashInvested = amount(input, 'cashInvested');
        const propertyManagementPercent = percentage(input, 'propertyManagementPercent', 10);
        const estimatedManagementFees = annualGrossRent * propertyManagementPercent / 100;
        const noi = annualGrossRent - annualTaxes - annualOperatingExpenses - estimatedManagementFees;
        return {
          annualGrossRent,
          estimatedManagementFees,
          noi,
          capRate: purchasePrice > 0 ? (noi / purchasePrice) * 100 : null,
          annualCashFlow: noi - annualDebtService,
          cashOnCash: cashInvested > 0 ? ((noi - annualDebtService) / cashInvested) * 100 : null,
          propertyManagementPercent,
        };
      }

      default:
        throw new RangeError(`Underwriting is not defined for business model: ${modelId}`);
    }
  }

  return Object.freeze({
    models: Object.freeze(models),
    hasModel,
    getModel,
    calculateUnderwriting,
  });
});
