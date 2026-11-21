# Vibe Finders Club

> One repo. Four pipelines. 100% Free & Open Source.

A privacy-first, real estate deal sourcing, underwriting, and CRM matching engine. Run it locally, self-host on Vercel, or deploy to your own stack. All features are free for personal, commercial, and enterprise use under the AGPL-3.0 license.

## The 4 Pipelines
| Pipeline | Target User | Stages |
|---|---|---|
| **Finder / NCND** | Bird dogs, restricted regions | Lead → NCND Signed → Verified → Referral Payout |
| **US Wholesaler** | Domestic wholesalers | Lead → Analysis → Contract → Assignment → Closing |
| **Licensed Agent** | Real estate agents | Lead → Pre-Listing → Active → Under Contract → Closed |
| **Intl Investor** | Remote US LLC holders | Lead → Underwriting → LLC → PM Handoff → Cash Flow |

## Architecture: Bring Your Own Key (BYOK)
You supply your own API keys. Provider costs are billed to your own accounts; this project does not operate a hosted data service.
- **Supabase**: `SUPABASE_URL` / `SUPABASE_ANON_KEY`
- **AI Triage**: `OPENROUTER_API_KEY` / `GOOGLE_AI_STUDIO_KEY`
- **Email**: `RESEND_API_KEY`

## Support This Project
This project is completely free. If it helps your workflow, consider supporting ongoing development via direct money transfer. All donations are deeply appreciated!

**Western Union / MoneyGram**
- **Receiver Legal Name**: `[YOUR_LEGAL_NAME]`
- **Phone**: `[YOUR_PHONE]`
- *Note: Please contact me via GitHub Issues or Discussions for the exact city/country branch details before sending.*

## Quick Start
```bash
git clone https://github.com/ekoni-vibe/vibe-finders-club.git
cd vibe-finders-club && npm install
cp .env.example .env   # add your keys
node pipeline-agent.js --scrape && npm run dev
```

## License
This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. It is 100% free for personal, open-source, and commercial use, subject to the license terms.
