# Global Payment Setup Guide

This guide covers provider setup for license payments, international transfers, community support, and donations. Provider availability, fees, payout timing, and legal requirements depend on your location, business status, and the sender's destination. Confirm current requirements directly with each provider before accepting funds.

## Security before setup

- Never commit real API keys, wallet addresses, bank details, beneficiary names, or personal contact information to this public repository.
- Keep provider API keys and other server-side credentials in an untracked `.env` file or your deployment platform's encrypted environment-variable store. `.env.example` is for placeholders only.
- `payout-config.example.json` is a tracked template, not a secure secret store. It is copied into the static build and the browser can read it. Keep its values as placeholders; anything placed there is public.
- Do not put secret keys in browser code or in any `NEXT_PUBLIC_*`, `VITE_*`, or similar client-exposed variable.
- The current static checkout UI reads the example config. It does not securely load a private payout configuration. Leave the placeholders in place for public deployments; add a server-side, access-controlled configuration path before showing real receiving details or credentials.
- Use unique passwords and multi-factor authentication (MFA) on payment, email, wallet, and source-control accounts. Restrict account access and review payout destinations before going live.
- Check applicable consumer-protection, tax, sanctions, money-transmission, and virtual-asset rules with qualified local professionals. Do not promise availability in regions a provider does not support.

## 1. Hosted commercial checkout

Choose a provider that supports your business and customers. The project includes example slots for Stripe Payment Links and a Merchant of Record (MoR) checkout such as Lemon Squeezy or Paddle; these are examples, not active integrations.

### Stripe Payment Links

1. Create and verify an eligible Stripe account for your business and location.
2. In the Stripe Dashboard, create the product and price for each license tier (for example, Pro and Commercial).
3. Create a Payment Link for each tier. Configure the product, currency, tax settings, and confirmation/return behavior.
4. Test the links in Stripe test mode, then activate the account and create/use live links only after completing Stripe's onboarding and compliance checks.
5. In a private deployment configuration, set the Pro and Commercial checkout destinations corresponding to `YOUR_STRIPE_PRO_PAYMENT_LINK_URL` and `YOUR_STRIPE_COMMERCIAL_PAYMENT_LINK_URL`. Do not replace the placeholders in the tracked example with private account data.

Official documentation: [Stripe Payment Links](https://docs.stripe.com/payment-links).

### Lemon Squeezy or Paddle

1. Create a merchant account and complete identity, business, and payout verification.
2. Create the products/prices for the relevant license tiers, configure taxes and customer-facing license terms, and verify that the provider supports your business and destination.
3. Generate a hosted checkout URL for each tier and run test purchases before publishing.
4. Use the private runtime configuration for the Pro and Commercial URLs. The example uses `YOUR_MOR_PRO_CHECKOUT_URL` and `YOUR_MOR_COMMERCIAL_CHECKOUT_URL` as placeholders.
5. Review the provider's merchant-of-record responsibilities, refund process, chargeback handling, and payout schedule; those terms vary by provider and country.

Official documentation: [Lemon Squeezy getting started](https://docs.lemonsqueezy.com/guides/getting-started) and [Paddle documentation](https://developer.paddle.com/).

## 2. Wise international transfers

1. Check Wise's current country and business eligibility requirements; open and verify the appropriate personal or business account.
2. Enable the currency balances and receiving methods available to your account. Wise may provide local account details for some currencies and international transfer details for others.
3. Review the receiving details, supported currencies, fees, limits, and expected settlement time shown in your account.
4. Send a small test transfer from a trusted sender and reconcile it before sharing instructions with customers.
5. Put only a generic placeholder in the tracked example's Wise instructions field. Share verified receiving instructions privately or through a secure, access-controlled production configuration.

Official information: [Wise](https://wise.com/) and [Wise Help Centre](https://wise.com/help/).

## 3. Cryptocurrency (USDT TRC20 or BTC)

1. Decide whether to use a self-custody wallet or a supported exchange account. Verify provider availability, identity requirements, custody terms, and local rules.
2. Create a dedicated receiving wallet/account. Secure the recovery phrase offline; never send it to a payer, support agent, or website.
3. In the wallet, select **Receive** and the exact asset/network. For USDT, confirm that both parties support **TRON (TRC20)**. For BTC, use a Bitcoin address and Bitcoin network.
4. Verify the full address and network through a separate trusted channel. Never assume that similar token names use compatible networks. Consider a small test transfer first; crypto transfers are generally irreversible.
5. Keep wallet addresses out of the public repository as requested. Store only approved public receiving instructions in an access-controlled runtime configuration, and never store a private key or recovery phrase in `.env`, source code, or a browser app.
6. Maintain records of transaction IDs, amounts, timestamps, and fair-market-value accounting as required by local law.

Provider help: [Coinbase crypto receiving](https://help.coinbase.com/en/coinbase/trading-and-funding/sending-or-receiving-cryptocurrency/receive-crypto), [Binance Academy](https://academy.binance.com/), and [Trust Wallet Support](https://support.trustwallet.com/).

## 4. Western Union and MoneyGram

1. Check whether the provider permits the intended business/commercial payment and supports receiving in your country. Cash pickup, bank deposit, limits, and fees vary by corridor.
2. Create or verify the appropriate receiver account and follow the provider's instructions for the exact transfer type.
3. Give the sender only the required recipient details through a private channel. Depending on the route, this may include your legal receiver name, city, and country. Do not publish identity documents, transfer-control numbers, or private details in the repository.
4. Agree on the payment purpose, currency, fees, and proof-of-payment process before sending. Verify funds through the provider directly; do not rely solely on screenshots or emailed receipts.
5. Use the Western Union and MoneyGram placeholders in `payout-config.example.json` as a schema reminder only. Do not put real receiver details in the tracked example.

Official information: [Western Union](https://www.westernunion.com/) and [MoneyGram](https://www.moneygram.com/).

## 5. Community sponsorships and donations

### GitHub Sponsors

1. Visit [GitHub Sponsors](https://github.com/sponsors) and apply or enable sponsorship for an eligible account/organization.
2. Complete the platform's payout and tax onboarding, then configure one-time and/or monthly sponsorship tiers.
3. Add a public sponsor URL to a private deployment configuration. The example uses `[YOUR_GITHUB_SPONSORS_URL]`.

### Ko-fi

1. Create an account at [Ko-fi](https://ko-fi.com/) and connect a supported payment provider from its dashboard.
2. Configure one-time tips, memberships, or other support options, and test the public page and payout route.
3. Add the public page URL to a private deployment configuration. The example uses `[YOUR_KOFI_URL]`.

Review the platforms' eligibility, fees, payout availability, tax treatment, and terms. Sponsorships should not be represented as purchases of a license unless the corresponding license terms and checkout are clearly presented.

## 6. Example configuration fields

The tracked `payout-config.example.json` provides placeholders for:

- Hosted checkout: Stripe Payment Link and Lemon Squeezy/Paddle URLs for Pro and Commercial.
- Transfer instructions: Wise, Western Union, MoneyGram, and manual SWIFT/IBAN.
- Crypto: separate USDT TRC20 and BTC placeholders.
- Community support: GitHub Sponsors and Ko-fi URLs.

Set `USE_GLOBAL_CHECKOUT` to `true` to display hosted checkout and configured transfer/support options, or `false` to hide hosted checkout while retaining enabled transfer and support methods. The example uses placeholders and does not create provider accounts, payment links, or receiving addresses.

For production, keep this checked-in example unchanged. Put secrets in server-side environment variables and provide any real public checkout links or recipient instructions only through a secure production configuration mechanism. Remember that a public checkout URL, wallet address, or transfer instruction may not be a credential, but it can still expose business or personal information and must not be added to the open repository without an intentional disclosure review.
