const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../payout-config.example.json');
const checkout = require('../commercial-checkout.example');

test('exposes global methods when enabled and the manual fallback when disabled', () => {
  assert.deepEqual(
    checkout.getAvailablePaymentMethods(config).map((method) => method.id),
    ['stripe', 'merchant-of-record', 'wise', 'cryptocurrency', 'manual-swift-iban'],
  );
  assert.deepEqual(
    checkout.getAvailablePaymentMethods({ ...config, USE_GLOBAL_CHECKOUT: false }).map((method) => method.id),
    ['manual-swift-iban'],
  );
});

test('does not redirect to an unconfigured hosted checkout placeholder', () => {
  let redirectedTo = null;
  const result = checkout.initiateCommercialLicenseCheckout('Pro', 'stripe', config, {
    redirectTo: (url) => { redirectedTo = url; },
  });

  assert.equal(result.status, 'placeholder');
  assert.equal(result.checkoutUrl, '[YOUR_STRIPE_PRO_PAYMENT_LINK_URL]');
  assert.equal(redirectedTo, null);
});

test('prevents hosted checkout from being selected when global checkout is disabled', () => {
  const restrictedConfig = { ...config, USE_GLOBAL_CHECKOUT: false };
  assert.throws(
    () => checkout.initiateCommercialLicenseCheckout('Pro', 'stripe', restrictedConfig),
    RangeError,
  );
});

test('redirects a configured Pro or Commercial checkout to HTTPS', () => {
  const configured = {
    ...config,
    paymentMethods: config.paymentMethods.map((method) => (
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
  assert.throws(() => checkout.initiateCommercialLicenseCheckout('Enterprise', 'stripe', config), RangeError);
  assert.throws(() => checkout.initiateCommercialLicenseCheckout('Pro', 'wise', config), RangeError);

  const insecure = {
    ...config,
    paymentMethods: config.paymentMethods.map((method) => (
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
