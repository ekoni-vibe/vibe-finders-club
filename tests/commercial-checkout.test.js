const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../payout-config.example.json');
const checkout = require('../commercial-checkout.example');
const legacyConfig = {
  USE_GLOBAL_CHECKOUT: true,
  methods: [
    { id: 'stripe', kind: 'checkout', enabled: true, checkoutUrls: { Pro: '[YOUR_PRO_URL]', Commercial: '[YOUR_COMMERCIAL_URL]' } },
    { id: 'merchant-of-record', kind: 'checkout', enabled: true, checkoutUrls: { Pro: '[YOUR_MOR_PRO_URL]', Commercial: '[YOUR_MOR_COMMERCIAL_URL]' } },
    { id: 'wise', kind: 'instructions', enabled: true },
    { id: 'cryptocurrency', kind: 'instructions', enabled: true },
    { id: 'western-union', kind: 'instructions', enabled: true },
    { id: 'moneygram', kind: 'instructions', enabled: true },
    { id: 'manual-swift-iban', kind: 'instructions', enabled: true },
    { id: 'github-sponsors', kind: 'support', enabled: true },
    { id: 'ko-fi', kind: 'support', enabled: true },
  ],
};

test('exposes global methods when enabled and transfer/support methods when disabled', () => {
  assert.deepEqual(
    checkout.getAvailablePaymentMethods(legacyConfig).map((method) => method.id),
    [
      'stripe',
      'merchant-of-record',
      'wise',
      'cryptocurrency',
      'western-union',
      'moneygram',
      'manual-swift-iban',
      'github-sponsors',
      'ko-fi',
    ],
  );
  assert.deepEqual(
    checkout.getAvailablePaymentMethods({ ...legacyConfig, USE_GLOBAL_CHECKOUT: false }).map((method) => method.id),
    ['wise', 'cryptocurrency', 'western-union', 'moneygram', 'manual-swift-iban', 'github-sponsors', 'ko-fi'],
  );
});

test('continues to accept the legacy paymentMethods property', () => {
  const { methods, ...legacyConfigWithoutMethods } = legacyConfig;

  assert.deepEqual(
    checkout.getAvailablePaymentMethods({ ...legacyConfigWithoutMethods, paymentMethods: methods }).map((method) => method.id),
    methods.map((method) => method.id),
  );
});

test('supports the Ethiopia-friendly config schema and its checkout placeholders', () => {
  assert.deepEqual(
    checkout.getAvailablePaymentMethods(config).map(({ id, kind }) => [id, kind]),
    [
      ['chapa', 'checkout'],
      ['payoneer', 'instructions'],
      ['crypto-usdt', 'instructions'],
      ['lemon-squeezy', 'checkout'],
    ],
  );
  assert.deepEqual(
    checkout.getAvailablePaymentMethods({ ...config, use_global_checkout: false }).map(({ id }) => id),
    ['payoneer', 'crypto-usdt'],
  );

  const result = checkout.initiateCommercialLicenseCheckout('Pro', 'chapa', config);
  assert.equal(result.status, 'placeholder');
  assert.equal(result.checkoutUrl, '[YOUR_CHAPA_CHECKOUT_LINK]');
});

test('does not redirect to an unconfigured hosted checkout placeholder', () => {
  let redirectedTo = null;
  const result = checkout.initiateCommercialLicenseCheckout('Pro', 'stripe', legacyConfig, {
    redirectTo: (url) => { redirectedTo = url; },
  });

  assert.equal(result.status, 'placeholder');
  assert.equal(result.checkoutUrl, '[YOUR_PRO_URL]');
  assert.equal(redirectedTo, null);
});

test('prevents hosted checkout from being selected when global checkout is disabled', () => {
  const restrictedConfig = { ...legacyConfig, USE_GLOBAL_CHECKOUT: false };
  assert.throws(
    () => checkout.initiateCommercialLicenseCheckout('Pro', 'stripe', restrictedConfig),
    RangeError,
  );
});

test('redirects a configured Pro or Commercial checkout to HTTPS', () => {
  const configured = {
    ...legacyConfig,
    methods: legacyConfig.methods.map((method) => (
      method.id === 'stripe'
        ? {
          ...method,
          checkoutUrls: {
            Pro: '[YOUR_STRIPE_PRO_PAYMENT_LINK_URL]',
            Commercial: 'https://buy.stripe.com/commercial-example-link',
          },
        }
        : method
    )),
  };
  const destinations = [];

  const result = checkout.initiateCommercialLicenseCheckout('Commercial', 'stripe', configured, {
    redirectTo: (url) => destinations.push(url),
  });

  assert.equal(result.status, 'redirecting');
  assert.deepEqual(destinations, ['https://buy.stripe.com/commercial-example-link']);
});

test('rejects invalid tiers, non-hosted methods, and insecure checkout URLs', () => {
  assert.throws(() => checkout.initiateCommercialLicenseCheckout('Enterprise', 'stripe', legacyConfig), RangeError);
  assert.throws(() => checkout.initiateCommercialLicenseCheckout('Pro', 'wise', legacyConfig), RangeError);

  const insecure = {
    ...legacyConfig,
    methods: legacyConfig.methods.map((method) => (
      method.id === 'stripe'
        ? {
          ...method,
          checkoutUrls: {
            Pro: 'http://example.test/checkout',
            Commercial: 'https://buy.stripe.com/commercial-example-link',
          },
        }
        : method
    )),
  };
  assert.throws(
    () => checkout.initiateCommercialLicenseCheckout('Pro', 'stripe', insecure, { redirect: false }),
    /HTTPS/,
  );
});
