(function (root, factory) {
  const checkout = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = checkout;
  }
  root.VibeCommercialCheckout = checkout;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  const commercialTiers = Object.freeze(['Pro', 'Commercial']);

  function getAvailablePaymentMethods(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new TypeError('Payout configuration must be an object.');
    }
    const globalCheckout = config.use_global_checkout ?? config.USE_GLOBAL_CHECKOUT;
    if (typeof globalCheckout !== 'boolean') {
      throw new TypeError('use_global_checkout must be a boolean.');
    }
    const methods = config.methods ?? config.paymentMethods;
    if (!Array.isArray(methods)) {
      throw new TypeError('Payout configuration must include a methods array.');
    }

    const ids = new Set();
    const legacyMethods = methods.some((method) => method && typeof method.kind === 'string');
    for (const method of methods) {
      if (!method || typeof method.id !== 'string' || ids.has(method.id)) {
        throw new TypeError('Payment methods must have unique string IDs.');
      }
      ids.add(method.id);
    }

    const hasManualFallback = methods.some(
      (method) => method.id === 'manual-swift-iban' && method.enabled === true,
    );
    if (legacyMethods && !hasManualFallback) {
      throw new RangeError('An enabled Manual SWIFT/IBAN fallback is required.');
    }

    const normalizedMethods = methods.map((method) => ({
      ...method,
      enabled: method.enabled !== false,
      kind: method.kind || (method.checkoutUrls || method.checkout_link ? 'checkout' : 'instructions'),
    }));

    if (!globalCheckout) {
      return normalizedMethods.filter(
        (method) => method.enabled && ['instructions', 'support'].includes(method.kind),
      );
    }
    return normalizedMethods.filter((method) => method.enabled);
  }

  function initiateCommercialLicenseCheckout(tier, methodId, config, options = {}) {
    if (!commercialTiers.includes(tier)) {
      throw new RangeError('Commercial checkout tier must be Pro or Commercial.');
    }

    const method = getAvailablePaymentMethods(config).find((candidate) => candidate.id === methodId);
    if (!method || method.kind !== 'checkout') {
      throw new RangeError(`No hosted checkout is configured for payment method: ${methodId}`);
    }
    const checkoutUrlForTier = method.checkoutUrls?.[tier] ?? method.checkout_link;
    if (typeof checkoutUrlForTier !== 'string' || checkoutUrlForTier.trim() === '') {
      throw new TypeError(`The selected checkout method must include a ${tier} checkout URL.`);
    }

    const checkoutUrl = checkoutUrlForTier.trim();
    if (/\[YOUR_[^\]]+\]/i.test(checkoutUrl)) {
      return { status: 'placeholder', checkoutUrl, tier, methodId };
    }

    const destination = new URL(checkoutUrl);
    if (destination.protocol !== 'https:') {
      throw new TypeError('Checkout URLs must use HTTPS.');
    }

    if (options.redirect !== false) {
      const redirect = options.redirectTo || root.location?.assign?.bind(root.location);
      if (typeof redirect !== 'function') {
        throw new Error('No browser redirect function is available for checkout.');
      }
      redirect(destination.href);
    }

    return { status: options.redirect === false ? 'ready' : 'redirecting', checkoutUrl: destination.href, tier, methodId };
  }

  return Object.freeze({
    commercialTiers,
    getAvailablePaymentMethods,
    initiateCommercialLicenseCheckout,
  });
});
