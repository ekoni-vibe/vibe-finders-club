const test = require('node:test');
const assert = require('node:assert/strict');
const {
  initiateChapaCheckout,
  initiateLemonSqueezyCheckout,
  getTeleBirrDonationLink,
} = require('../scripts/payment-checkout');

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(
    Object.keys(values).map((name) => [name, process.env[name]]),
  );
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  try {
    return callback();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('builds a mock Chapa checkout URL using server environment values', () => {
  withEnvironment({
    CHAPA_SECRET_KEY: undefined,
    CHAPA_CHECKOUT_LINK: undefined,
  }, () => {
    assert.throws(() => initiateChapaCheckout(25, 'customer@example.test'), /CHAPA_SECRET_KEY/);
  });

  withEnvironment({
    CHAPA_SECRET_KEY: 'test-only-value',
    CHAPA_CHECKOUT_LINK: 'https://checkout.chapa.co/test-link',
  }, () => {
    const checkoutUrl = new URL(initiateChapaCheckout(25, 'customer@example.test'));
    assert.equal(checkoutUrl.origin, 'https://checkout.chapa.co');
    assert.equal(checkoutUrl.searchParams.get('amount'), '25');
    assert.equal(checkoutUrl.searchParams.has('email'), false);
    assert.equal(checkoutUrl.href.includes('test-only-value'), false);
  });
});

test('builds a mock Lemon Squeezy URL and requires its API key from the environment', () => {
  withEnvironment({
    LEMON_SQUEEZY_API_KEY: undefined,
    LEMON_SQUEEZY_CHECKOUT_URL: undefined,
  }, () => {
    assert.throws(() => initiateLemonSqueezyCheckout('variant-123'), /LEMON_SQUEEZY_API_KEY/);
  });

  withEnvironment({
    LEMON_SQUEEZY_API_KEY: 'test-only-value',
    LEMON_SQUEEZY_CHECKOUT_URL: 'https://store.example.test/checkout',
  }, () => {
    const checkoutUrl = new URL(initiateLemonSqueezyCheckout('variant-123'));
    assert.equal(checkoutUrl.origin, 'https://store.example.test');
    assert.equal(checkoutUrl.searchParams.get('variant'), 'variant-123');
  });
});

test('returns the configured TeleBirr donation link or its safe example URL', () => {
  withEnvironment({ TELEBIRR_DONATION_LINK: 'https://telebirr.et/pay/test-merchant' }, () => {
    assert.equal(getTeleBirrDonationLink(), 'https://telebirr.et/pay/test-merchant');
  });

  withEnvironment({ TELEBIRR_DONATION_LINK: undefined }, () => {
    assert.equal(
      getTeleBirrDonationLink(),
      'https://telebirr.et/pay/your-merchant-link',
    );
  });
});

test('rejects invalid checkout values and non-HTTPS environment links', () => {
  withEnvironment({
    CHAPA_SECRET_KEY: 'test-only-value',
    CHAPA_CHECKOUT_LINK: 'http://checkout.chapa.co/link',
  }, () => {
    assert.throws(() => initiateChapaCheckout(0, 'customer@example.test'), /positive number/);
    assert.throws(() => initiateChapaCheckout(1, ''), /email/);
    assert.throws(() => initiateChapaCheckout(1, 'customer@example.test'), /HTTPS/);
  });
});
