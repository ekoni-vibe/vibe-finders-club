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

The example config includes Chapa for local Ethiopian payments and Lemon Squeezy as a global merchant-of-record option. These are configuration examples, not active integrations; verify provider eligibility and business requirements for your location.

### Chapa

1. Create and verify a Chapa merchant account and confirm that the payment methods you need (such as Telebirr, CBE, or Dashen Bank) are supported for your account.
2. Set `CHAPA_SECRET_KEY` in the server environment or deployment platform's encrypted environment-variable store. Never expose this key in browser code or a public config file.
3. Configure the checkout link in a private, access-controlled runtime configuration. Do not replace the placeholder in the tracked example with private account data.
4. Test in the provider's supported test environment and complete its onboarding and compliance checks before accepting live payments.

Official documentation: [Chapa documentation](https://developer.chapa.co/).

### Lemon Squeezy

1. Confirm that your business is eligible; a foreign entity may be required.
2. Create and verify the merchant account, products, taxes, and customer-facing license terms.
3. Set `LEMON_SQUEEZY_API_KEY` only in the server environment. Configure the hosted checkout link through a private runtime configuration and test it before publishing.
4. Review the merchant-of-record responsibilities, refund process, chargeback handling, and payout schedule.

Official documentation: [Lemon Squeezy getting started](https://docs.lemonsqueezy.com/guides/getting-started).

## 2. Payoneer international transfers

1. Check Payoneer's current country, business, and payment eligibility requirements and verify the appropriate account.
2. Review the virtual USD/EUR receiving details, supported currencies, fees, limits, and expected settlement time in your account.
3. Verify a test transfer before sharing instructions. Request or provide invoice details privately; do not put account or beneficiary details in the tracked example.

Official information: [Payoneer](https://www.payoneer.com/).

## 3. Cryptocurrency (USDT TRC20)

1. Decide whether to use a self-custody wallet or a supported exchange account. Verify provider availability, identity requirements, custody terms, and local rules.
2. Create a dedicated receiving wallet/account. Secure the recovery phrase offline; never send it to a payer, support agent, or website.
3. In the wallet, select **Receive** and confirm that both parties support USDT on **TRON (TRC20)**.
4. Verify the full address and network through a separate trusted channel. Never assume that similar token names use compatible networks. Consider a small test transfer first; crypto transfers are generally irreversible.
5. Keep wallet addresses out of the public repository as requested. Store only approved public receiving instructions in an access-controlled runtime configuration, and never store a private key or recovery phrase in `.env`, source code, or a browser app.
6. Maintain records of transaction IDs, amounts, timestamps, and fair-market-value accounting as required by local law.

Provider help: [Coinbase crypto receiving](https://help.coinbase.com/en/coinbase/trading-and-funding/sending-or-receiving-cryptocurrency/receive-crypto), [Binance Academy](https://academy.binance.com/), and [Trust Wallet Support](https://support.trustwallet.com/).

## 4. Community sponsorships and donations

### GitHub Sponsors

1. Visit [GitHub Sponsors](https://github.com/sponsors) and apply or enable sponsorship for an eligible account/organization.
2. Complete the platform's payout and tax onboarding, then configure one-time and/or monthly sponsorship tiers.
3. Share your public sponsor page URL only where you intend it to be discoverable.

### Ko-fi

1. Create an account at [Ko-fi](https://ko-fi.com/) and connect a supported payment provider from its dashboard.
2. Configure one-time tips, memberships, or other support options, and test the public page and payout route.
3. Share your public Ko-fi page URL only where you intend it to be discoverable.

Review the platforms' eligibility, fees, payout availability, tax treatment, and terms. Sponsorships should not be represented as purchases of a license unless the corresponding license terms and checkout are clearly presented.

## 5. Example configuration fields

The tracked `payout-config.example.json` provides placeholders for:

- Chapa (Ethiopia) checkout link and server-side `CHAPA_SECRET_KEY` environment-variable name.
- Payoneer invoice-request instructions for international transfers.
- USDT TRC20 receiving-address placeholder.
- Lemon Squeezy checkout link and server-side `LEMON_SQUEEZY_API_KEY` environment-variable name.

Set `use_global_checkout` to `true` to display checkout and transfer instruction methods, or `false` to hide hosted checkout methods while retaining transfer instructions. The example uses placeholders and does not create provider accounts, payment links, or receiving addresses.

For production, keep this checked-in example unchanged. Put secrets in server-side environment variables and provide any real public checkout links or recipient instructions only through a secure production configuration mechanism. Remember that a public checkout URL, wallet address, or transfer instruction may not be a credential, but it can still expose business or personal information and must not be added to the open repository without an intentional disclosure review.
