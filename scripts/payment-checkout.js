const CHAPA_INITIALIZE_URL = 'https://api.chapa.co/v1/transaction/initialize';

function initializeChapaTransaction(transaction) {
  const secretKey = process.env.CHAPA_SECRET_KEY;
  if (!secretKey || !secretKey.trim()) {
    throw new Error('CHAPA_SECRET_KEY must be configured in the server environment.');
  }
  if (!transaction || typeof transaction !== 'object' || Array.isArray(transaction)) {
    throw new TypeError('Transaction details must be an object.');
  }

  const { amount, currency, email, firstName, lastName, txRef, callbackUrl, returnUrl } = transaction;
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw new TypeError('Transaction amount must be a positive number.');
  }
  for (const [field, value] of Object.entries({
    currency, email, firstName, lastName, txRef, callbackUrl, returnUrl,
  })) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new TypeError(`${field} must be a non-empty string.`);
    }
  }

  // This helper prepares a mock request only; it never sends credentials or transaction data.
  return {
    status: 'mock-ready',
    provider: 'chapa',
    method: 'POST',
    endpoint: CHAPA_INITIALIZE_URL,
    credentialConfigured: Boolean(secretKey),
    payload: {
      amount: String(amount),
      currency,
      email,
      first_name: firstName,
      last_name: lastName,
      tx_ref: txRef,
      callback_url: callbackUrl,
      return_url: returnUrl,
    },
  };
}

function displayPaymentInstructions(methodId, config) {
  if (!config || !Array.isArray(config.methods)) {
    throw new TypeError('Payout configuration must include a methods array.');
  }
  if (!['payoneer', 'crypto-usdt'].includes(methodId)) {
    throw new RangeError(`Unsupported manual payment method: ${methodId}`);
  }

  const method = config.methods.find((candidate) => candidate.id === methodId);
  if (!method || typeof method.instructions !== 'string' || !method.instructions.trim()) {
    throw new TypeError(`Instructions are not configured for payment method: ${methodId}`);
  }

  const output = `${method.name}\n${method.instructions}`;
  console.log(output);
  return output;
}

module.exports = { initializeChapaTransaction, displayPaymentInstructions };
