const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const businessModels = require('../business-models');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const expectedPipelines = {
  finder: {
    name: 'Finder / Bird Dog',
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
    name: 'International Investor',
    stages: ['Lead', 'Underwriting', 'LLC Acquisition', 'PM Handoff', 'Cash Flow'],
  },
};

test('all four pipeline models load with their rendered stages', () => {
  assert.deepEqual(Object.keys(businessModels.models), Object.keys(expectedPipelines));
  assert.match(html, /x-for="\(stage, index\) in pipelineStages"/);
  assert.match(html, /x-text="pipelineStages\[dealStage\]"/);

  for (const [id, expected] of Object.entries(expectedPipelines)) {
    const model = businessModels.getModel(id);
    assert.equal(model.name, expected.name);
    assert.deepEqual(model.stages, expected.stages);
    for (const stage of model.stages) assert.ok(stage.trim().length > 0);
  }
});

test('wholesaler and investor underwriting calculations produce the expected results', () => {
  const wholesale = businessModels.calculateUnderwriting('wholesaler', {
    arv: 300000,
    rehab: 45000,
    listPrice: 110000,
    assignmentBuyerPrice: 140000,
  });
  assert.equal(wholesale.maximumAllowableOffer, 165000);
  assert.equal(wholesale.assignmentFee, 30000);

  const investor = businessModels.calculateUnderwriting('international', {
    listPrice: 100000,
    monthlyRent: 2000,
    annualTaxes: 3000,
    annualOperatingExpenses: 5000,
    debtService: 6000,
    cashInvested: 40000,
    propertyManagementPercent: 10,
  });
  assert.equal(investor.estimatedManagementFees, 2400);
  assert.equal(investor.noi, 13600);
  assert.equal(Number(investor.capRate.toFixed(2)), 13.6);
  assert.equal(investor.annualCashFlow, 7600);
  assert.equal(Number(investor.cashOnCash.toFixed(2)), 19);
  assert.match(html, /maximumAllowableOffer/);
  assert.match(html, /capRate/);
  assert.match(html, /cashOnCash/);
});

test('the page has no upgrade controls or hosted checkout routes', () => {
  assert.doesNotMatch(html, /\bUpgrade\b/i);
  assert.doesNotMatch(html, /\bLicense tier\b/i);
  assert.doesNotMatch(html, /(?:href|src)\s*=\s*["'][^"']*(?:checkout|payment)/i);
  assert.match(html, /@click="supportProjectOpen = true"/);
});

test('the support dialog displays only the donation instructions and safe placeholders', () => {
  const modal = html.match(/<section id="support-project-modal"[\s\S]*?<\/section>/)?.[0];
  assert.ok(modal, 'Support This Project dialog should exist.');
  assert.match(modal, /Support This Project/);
  assert.match(modal, /Western Union \/ MoneyGram/);
  assert.match(modal, /Receiver Legal Name:<\/strong>\s*<span>\[YOUR_LEGAL_NAME\]<\/span>/);
  assert.match(modal, /Phone:<\/strong>\s*<span>\[YOUR_PHONE\]<\/span>/);
  assert.match(
    modal,
    /Please contact me via GitHub Issues or Discussions for the exact city\/country branch details before sending\./,
  );
});
