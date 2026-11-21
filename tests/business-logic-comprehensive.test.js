const test = require('node:test');
const assert = require('node:assert/strict');
const businessModels = require('../business-models');
const payoutConfig = require('../payout-config.example.json');
const commercialCheckout = require('../commercial-checkout.example');

const expectedModels = {
  finder: {
    name: 'Finder / Bird Dog (Existing)',
    stages: ['Lead', 'NCND Signed', 'Verified', 'Referral Payout'],
  },
  wholesaler: {
    name: 'US Wholesaler',
    stages: ['Lead', 'Analysis', 'Contract', 'Assignment/Double Close', 'Closing'],
  },
  agent: {
    name: 'Licensed Agent',
    stages: ['Lead', 'Pre-Listing', 'Active Listing', 'Under Contract', 'Closed'],
  },
  international: {
    name: 'International Investor (Remote US LLC)',
    stages: ['Lead', 'Underwriting', 'LLC Acquisition', 'Property Management Handoff', 'Cash Flow'],
  },
};

test('all four business models have their expected names and pipeline stages', () => {
  assert.deepEqual(Object.keys(businessModels.models), Object.keys(expectedModels));

  const distinctPipelines = new Set();
  for (const [id, expected] of Object.entries(expectedModels)) {
    const model = businessModels.getModel(id);
    assert.equal(model.id, id);
    assert.equal(model.name, expected.name);
    assert.deepEqual(model.stages, expected.stages);
    assert.ok(model.stages.length > 0);
    assert.ok(model.stages.every((stage) => typeof stage === 'string' && stage.trim().length > 0));
    assert.equal(new Set(model.stages).size, model.stages.length);
    distinctPipelines.add(JSON.stringify(model.stages));
  }
  assert.equal(distinctPipelines.size, Object.keys(expectedModels).length);
});

test('wholesaler and international stages include required transaction milestones', () => {
  const wholesalerStages = businessModels.getModel('wholesaler').stages;
  const internationalStages = businessModels.getModel('international').stages;

  assert.ok(wholesalerStages.includes('Contract'));
  assert.ok(wholesalerStages.some((stage) => stage.includes('Assignment')));
  assert.ok(internationalStages.includes('LLC Acquisition'));
  assert.ok(internationalStages.some((stage) => stage.includes('Property Management')));
});

test('Finder underwriting supports flat and assignment-percentage referral fees', () => {
  assert.equal(
    businessModels.calculateUnderwriting('finder', { fee: 5000 }).referralFee,
    5000,
  );
  assert.equal(
    businessModels.calculateUnderwriting('finder', {
      finderFeeType: 'assignment-percent',
      assignmentAmount: 20000,
      finderFeePercent: 15,
    }).referralFee,
    3000,
  );
});

test('wholesaler underwriting applies the 70% MAO rule and assignment spread', () => {
  const result = businessModels.calculateUnderwriting('wholesaler', {
    arv: 200000,
    rehab: 30000,
    listPrice: 100000,
    assignmentBuyerPrice: 120000,
  });

  assert.equal(result.maximumAllowableOffer, (200000 * 0.7) - 30000);
  assert.equal(result.assignmentFee, 20000);
  assert.equal(
    businessModels.calculateUnderwriting('wholesaler', {
      listPrice: 150000,
      assignmentBuyerPrice: 120000,
    }).assignmentFee,
    0,
  );
});

test('licensed agent underwriting calculates gross commission and agent/broker split', () => {
  const result = businessModels.calculateUnderwriting('agent', {
    salePrice: 450000,
    commissionRatePercent: 6,
    agentSplitPercent: 80,
  });

  assert.equal(result.grossCommission, 27000);
  assert.equal(result.agentCommission, 21600);
  assert.equal(result.brokerageCommission, 5400);
});

test('international investor underwriting calculates management fees, cap rate, and cash-on-cash', () => {
  const result = businessModels.calculateUnderwriting('international', {
    listPrice: 200000,
    monthlyRent: 2000,
    annualTaxes: 3000,
    annualOperatingExpenses: 2000,
    debtService: 6000,
    cashInvested: 50000,
    propertyManagementPercent: 10,
  });

  assert.equal(result.estimatedManagementFees, 2400);
  assert.equal(result.noi, 16600);
  assert.equal(result.capRate, 8.3);
  assert.equal(result.annualCashFlow, 10600);
  assert.equal(result.cashOnCash, 21.2);
});

test('global checkout includes all configured providers and disabled mode returns transfer and support methods', () => {
  const globalMethods = commercialCheckout.getAvailablePaymentMethods(payoutConfig);
  const globalMethodIds = globalMethods.map((method) => method.id);
  const expectedGlobalIds = ['chapa', 'payoneer', 'crypto-usdt', 'lemon-squeezy'];

  assert.deepEqual(globalMethodIds, expectedGlobalIds);

  const manualMethods = commercialCheckout.getAvailablePaymentMethods({
    ...payoutConfig,
    use_global_checkout: false,
  });
  assert.deepEqual(
    manualMethods.map((method) => method.id),
    ['payoneer', 'crypto-usdt'],
  );
  assert.ok(manualMethods.every((method) => ['instructions', 'support'].includes(method.kind)));
  assert.ok(manualMethods.every((method) => !['chapa', 'lemon-squeezy'].includes(method.id)));
});
