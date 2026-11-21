const payoutConfig = require('../payout-config.example.json');

/*
 * NOTE: The 16-digit TeleBirr Virtual Visa is a spending instrument, not a merchant receiving account.
 * It cannot be used as a checkout endpoint. Use TeleBirr Merchant Pay Links or personal transfer
 * numbers for receiving funds.
 */

function requireEnvironmentValue(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be configured in the server environment.`);
  }
  return value.trim();
}

function getMethod(methodId) {
  const method = payoutConfig.methods.find((candidate) => candidate.id === methodId);
  if (!method) {
    throw new RangeError(`Payment method is not configured: ${methodId}`);
  }
  return method;
}

function getCheckoutUrl(methodId, environmentName) {
  const method = getMethod(methodId);
  const configuredUrl = process.env[environmentName]?.trim() || method.checkout_link;
  if (typeof configuredUrl !== 'string' || configuredUrl.trim() === '') {
    throw new Error(`A checkout link is not configured for ${methodId}.`);
  }

  const checkoutUrl = new URL(configuredUrl);
  if (checkoutUrl.protocol !== 'https:') {
    throw new TypeError('Checkout URLs must use HTTPS.');
  }
  return checkoutUrl;
}

function initiateChapaCheckout(amount, email) {
  requireEnvironmentValue('CHAPA_SECRET_KEY');
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw new TypeError('Transaction amount must be a positive number.');
  }
  if (typeof email !== 'string' || !email.trim()) {
    throw new TypeError('Customer email must be a non-empty string.');
  }

  const checkoutUrl = getCheckoutUrl('chapa', 'CHAPA_CHECKOUT_LINK');
  checkoutUrl.searchParams.set('amount', String(amount));
  // Keep customer email out of URLs; a real server integration should send it in the request body.
  return checkoutUrl.href;
}

function initiateLemonSqueezyCheckout(productId) {
  requireEnvironmentValue('LEMON_SQUEEZY_API_KEY');
  if (typeof productId !== 'string' || !productId.trim()) {
    throw new TypeError('Product ID must be a non-empty string.');
  }

  const checkoutUrl = getCheckoutUrl('lemon-squeezy', 'LEMON_SQUEEZY_CHECKOUT_URL');
  checkoutUrl.searchParams.set('variant', productId.trim());
  return checkoutUrl.href;
}

function getTeleBirrDonationLink() {
  const method = getMethod('telebirr-donation');
  const donationUrl = process.env.TELEBIRR_DONATION_LINK?.trim() || method.checkout_link;
  const checkoutUrl = new URL(donationUrl);
  if (checkoutUrl.protocol !== 'https:') {
    throw new TypeError('TeleBirr donation links must use HTTPS.');
  }
  return checkoutUrl.href;
}

module.exports = {
  initiateChapaCheckout,
  initiateLemonSqueezyCheckout,
  getTeleBirrDonationLink,
};
