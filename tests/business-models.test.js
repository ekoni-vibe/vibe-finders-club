const test = require('node:test');
const assert = require('node:assert/strict');
const businessModels = require('../business-models');

test('exposes all four models and their distinct pipelines', () => {
  assert.deepEqual(Object.keys(businessModels.models), [
    'finder',
    'wholesaler',
    'agent',
    'international',
  ]);
  assert.deepEqual(businessModels.getModel('finder').stages, [
    'Lead',
    'NCND Signed',
    'Verified',
    'Referral Payout',
  ]);
  assert.deepEqual(businessModels.getModel('wholesaler').stages, [
    'Lead',
    'Analysis',
    'Contract',
    'Assignment/Double Close',
    'Closing',
  ]);
  assert.deepEqual(businessModels.getModel('agent').stages, [
    'Lead',
    'Pre-Listing',
    'Active Listing',
    'Under Contract',
    'Closed',
  ]);
  assert.deepEqual(businessModels.getModel('international').stages, [
    'Lead',
    'Underwriting',
    'LLC Acquisition',
    'Property Management Handoff',
    'Cash Flow',
  ]);
});

test('calculates flat and assignment-percentage finder fees', () => {
  assert.equal(
    businessModels.calculateUnderwriting('finder', { fee: 5000 }).referralFee,
    5000,
  );
  assert.equal(
    businessModels.calculateUnderwriting('finder', {
      finderFeeType: 'assignment-percent',
      assignmentAmount: 20000,
      finderFeePercent: 10,
    }).referralFee,
    2000,
  );
});

test('calculates wholesaler MAO and assignment spread', () => {
  assert.deepEqual(
    businessModels.calculateUnderwriting('wholesaler', {
      arv: 200000,
      rehab: 30000,
      listPrice: 100000,
      assignmentBuyerPrice: 120000,
    }),
    {
      maximumAllowableOffer: 110000,
      contractPrice: 100000,
      assignmentBuyerPrice: 120000,
      assignmentFee: 20000,
    },
  );
});

test('calculates agent commission and the agent/broker split', () => {
  assert.deepEqual(
    businessModels.calculateUnderwriting('agent', {
      salePrice: 500000,
      commissionRatePercent: 6,
      agentSplitPercent: 70,
    }),
    {
      salePrice: 500000,
      commissionRatePercent: 6,
      agentSplitPercent: 70,
      grossCommission: 30000,
      agentCommission: 21000,
      brokerageCommission: 9000,
    },
  );
});

test('calculates remote investor management costs and returns', () => {
  assert.deepEqual(
    businessModels.calculateUnderwriting('international', {
      listPrice: 200000,
      monthlyRent: 2000,
      annualTaxes: 3000,
      annualOperatingExpenses: 2000,
      debtService: 6000,
      cashInvested: 50000,
      propertyManagementPercent: 10,
    }),
    {
      annualGrossRent: 24000,
      estimatedManagementFees: 2400,
      noi: 16600,
      capRate: 8.3,
      annualCashFlow: 10600,
      cashOnCash: 21.2,
      propertyManagementPercent: 10,
    },
  );
});

test('rejects unknown models and invalid underwriting inputs', () => {
  assert.throws(() => businessModels.getModel('unknown'), RangeError);
  assert.throws(
    () => businessModels.calculateUnderwriting('agent', { commissionRatePercent: 101 }),
    RangeError,
  );
  assert.throws(
    () => businessModels.calculateUnderwriting('wholesaler', { arv: -1 }),
    RangeError,
  );
});
