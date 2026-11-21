const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../payout-config.example.json');
const { initializeChapaTransaction, displayPaymentInstructions } = require('../scripts/payment-checkout');

const transaction = {
  amount: 25,
  currency: 'ETB',
  email: 'customer@example.test',
  firstName: 'Test',
  lastName: 'Customer',
  txRef: 'test-reference',
  callbackUrl: 'https://example.test/callback',
  returnUrl: 'https://example.test/return',
};

test('prepares a mock Chapa request from a server environment key without returning it', () => {
  const originalKey = process.env.CHAPA_SECRET_KEY;
  try {
    delete process.env.CHAPA_SECRET_KEY;
    assert.throws(() => initializeChapaTransaction(transaction), /CHAPA_SECRET_KEY/);

    process.env.CHAPA_SECRET_KEY = 'test-only-value';
    const result = initializeChapaTransaction(transaction);

    assert.equal(result.status, 'mock-ready');
    assert.equal(result.credentialConfigured, true);
    assert.deepEqual(result.payload, {
      amount: '25',
      currency: 'ETB',
      email: 'customer@example.test',
      first_name: 'Test',
      last_name: 'Customer',
      tx_ref: 'test-reference',
      callback_url: 'https://example.test/callback',
      return_url: 'https://example.test/return',
    });
    assert.equal(JSON.stringify(result).includes('test-only-value'), false);
  } finally {
    if (originalKey === undefined) delete process.env.CHAPA_SECRET_KEY;
    else process.env.CHAPA_SECRET_KEY = originalKey;
  }
});

test('displays the configured Payoneer and USDT instruction placeholders', () => {
  const originalLog = console.log;
  const output = [];
  console.log = (message) => output.push(message);
  try {
    assert.equal(
      displayPaymentInstructions('payoneer', config),
      'Payoneer (Global B2B)\nRequest invoice details via email. Withdrawals supported to Ethiopian banks.',
    );
    assert.match(displayPaymentInstructions('crypto-usdt', config), /YOUR_PUBLIC_USDT_TRC20_ADDRESS/);
    assert.equal(output.length, 2);
  } finally {
    console.log = originalLog;
  }
});

test('rejects invalid Chapa transactions and unsupported instruction methods', () => {
  const originalKey = process.env.CHAPA_SECRET_KEY;
  process.env.CHAPA_SECRET_KEY = 'test-only-value';
  try {
    assert.throws(() => initializeChapaTransaction({ ...transaction, amount: 0 }), /positive number/);
    assert.throws(() => displayPaymentInstructions('lemon-squeezy', config), /Unsupported/);
  } finally {
    if (originalKey === undefined) delete process.env.CHAPA_SECRET_KEY;
    else process.env.CHAPA_SECRET_KEY = originalKey;
  }
});
