require('dotenv').config();

// pipeline-agent.js
/**
 * Unified Vibe Finders Club Execution Engine (100% Free Stack)
 */

const fs = require('fs');
const http = require('node:http');
const path = require('path');
const cheerio = require('cheerio');

const { calculateSellerFinancingOffer } = require('./seller-financing-calculator');
const { matchPropertyToBuyer } = require('./investor-matcher');
const { analyzeDealWithFreeAI } = require('./ai-triage-helper');
const { generateDualOfferCampaign, sendSellerOutreachEmail } = require('./outreach-workflow');
const { stageRemittancePayment } = require('./remittance-generator');

function parsePropertyTable(html, source) {
  const listings = [];
  const $ = cheerio.load(html);

  $('table').each((_tableIndex, table) => {
    const rows = $(table).find('tr').toArray();
    if (rows.length < 2) return;

    const headers = $(rows[0]).find('th, td').toArray()
      .map((cell) => $(cell).text().trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    const columns = {
      address: headers.findIndex((header) => /^(property)?address$|^streetaddress$/.test(header)),
      city: headers.findIndex((header) => header === 'city'),
      zip: headers.findIndex((header) => /^(zip|zipcode|postalcode|zip5)$/.test(header)),
      price: headers.findIndex((header) => /price|amount|bid/.test(header))
    };
    if (columns.address < 0) return;

    for (const row of rows.slice(1)) {
      const cells = $(row).find('th, td').toArray().map((cell) => $(cell).text().replace(/\s+/g, ' ').trim());
      const address = cells[columns.address] || '';
      if (!address) continue;

      const rawPrice = columns.price >= 0 ? cells[columns.price] : '';
      const priceValue = rawPrice.replace(/[^0-9.-]/g, '');
      listings.push({
        address,
        city: columns.city >= 0 ? cells[columns.city] || '' : '',
        zip: columns.zip >= 0 ? cells[columns.zip] || '' : '',
        price: priceValue && Number.isFinite(Number(priceValue)) ? Number(priceValue) : null,
        source
      });
    }
  });

  return listings;
}

function normalizeApiListings(payload, source) {
  const records = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? [payload, ...(Array.isArray(payload.results) ? payload.results : []), ...(Array.isArray(payload.properties) ? payload.properties : []), ...(Array.isArray(payload.data) ? payload.data : [])]
      : [];

  return records
    .filter((record) => record && typeof record === 'object')
    .map((record) => {
      const rawPrice = record.price ?? record.listPrice ?? record.salePrice ?? record.amount ?? null;
      const price = rawPrice == null ? null : Number(String(rawPrice).replace(/[$,\s]/g, ''));
      return {
        address: record.address ?? record.streetAddress ?? record.propertyAddress ?? '',
        city: record.city ?? '',
        zip: String(record.zip ?? record.zipCode ?? record.postalCode ?? ''),
        price: Number.isFinite(price) ? price : null,
        source
      };
    })
    .filter((listing) => listing.address);
}

async function fetchPropertyListings(url, source, { allowJson = false } = {}) {
  if (!url || url.includes('example.invalid')) {
    console.log(`[SCRAPE] ${source} endpoint is not configured; placeholder was not fetched.`);
    return [];
  }

  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Source URL must use HTTP or HTTPS.');
    }

    const response = await fetch(parsedUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const body = await response.text();
    if (allowJson) {
      try {
        return normalizeApiListings(JSON.parse(body), source);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return parsePropertyTable(body, source);
        }
        throw error;
      }
    }
    return parsePropertyTable(body, source);
  } catch (error) {
    console.error(`[SCRAPE ERROR] ${source}: ${error.message}`);
    return [];
  }
}

async function scrapeHUDProperties() {
  return fetchPropertyListings(
    process.env.HUD_SEIZED_PROPERTIES_URL || 'https://example.invalid/hud-reo-listings',
    'HUD'
  );
}

async function scrapeFannieMaeProperties() {
  return fetchPropertyListings(
    process.env.FANNIE_MAE_REO_URL || 'https://example.invalid/fannie-mae-reo-api',
    'FannieMae',
    { allowJson: true }
  );
}

async function scrapeTaxDeedProperties() {
  const countyUrls = (process.env.COUNTY_TAX_DEED_URLS || process.env.TAX_DEED_SOURCE_URL || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  const urls = countyUrls.length ? countyUrls : ['https://example.invalid/county-tax-deed-portals'];
  const results = await Promise.all(urls.map((url) => fetchPropertyListings(url, 'TaxDeed')));
  return results.flat();
}

async function scrapePropertySources() {
  const results = await Promise.all([
    scrapeHUDProperties(),
    scrapeFannieMaeProperties(),
    scrapeTaxDeedProperties()
  ]);
  return results.flat();
}

async function runDailyScrape(logFilePath = path.join(__dirname, 'triage-execution-log.json')) {
  const listings = await scrapePropertySources();
  let executionLogs = [];

  try {
    const existingLog = await fs.promises.readFile(logFilePath, 'utf8');
    executionLogs = JSON.parse(existingLog);
    if (!Array.isArray(executionLogs)) {
      throw new Error('triage-execution-log.json must contain a JSON array.');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const listingKey = (entry) => {
    const deal = entry.deal || entry;
    const address = deal.address;
    const zip = deal.zip || deal.zipCode;
    return address && zip ? `${address.trim().toLowerCase()}|${String(zip).trim().toLowerCase()}` : null;
  };
  const knownListings = new Set(executionLogs.map(listingKey).filter(Boolean));
  const newListings = listings.filter((listing) => {
    const key = listingKey(listing);
    if (!key || knownListings.has(key)) return false;
    knownListings.add(key);
    return true;
  });

  if (newListings.length) {
    executionLogs.push(...newListings);
    await fs.promises.writeFile(logFilePath, JSON.stringify(executionLogs, null, 2));
  }

  const sourceCounts = {
    HUD: newListings.filter((listing) => listing.source === 'HUD').length,
    FannieMae: newListings.filter((listing) => listing.source === 'FannieMae').length,
    TaxDeed: newListings.filter((listing) => listing.source === 'TaxDeed').length
  };
  console.log(`[SCRAPE] Scraped ${sourceCounts.HUD} new properties from HUD, ${sourceCounts.FannieMae} from Fannie Mae, ${sourceCounts.TaxDeed} from Tax Deeds.`);
  return newListings;
}

async function underwriteDeal(deal) {
  if (!deal || typeof deal !== 'object' || Array.isArray(deal)) {
    throw new TypeError('deal must be an object.');
  }

  const listingPrice = Number(deal.listingPrice ?? deal.purchasePrice);
  const arv = Number(deal.arv);
  const repairCost = Number(deal.repairCost || 0);
  if (![listingPrice, arv, repairCost].every(Number.isFinite) || listingPrice <= 0 || arv <= 0 || repairCost < 0) {
    throw new TypeError('deal must include positive listingPrice/purchasePrice and arv, with a non-negative repairCost.');
  }

  const normalizedDeal = {
    ...deal,
    listingPrice,
    purchasePrice: Number(deal.purchasePrice ?? listingPrice),
    arv,
    repairCost,
    zipCode: deal.zipCode || deal.zip || ''
  };
  const [aiAnalysis] = await Promise.all([analyzeDealWithFreeAI(normalizedDeal)]);
  const investorMatch = matchPropertyToBuyer(normalizedDeal);
  const sellerFinanceTerms = calculateSellerFinancingOffer(listingPrice, {
    offerMarkupPercent: 0.10,
    downPaymentPercent: 0.10,
    interestRate: 0.045,
    balloonTermYears: 7
  });

  return {
    dealId: normalizedDeal.id || null,
    aiAnalysis,
    investorMatch,
    offers: {
      cash: {
        offerPrice: Math.round((arv * 0.70) - repairCost)
      },
      sellerFinance: {
        offerPrice: sellerFinanceTerms.offerPrice,
        downPayment: sellerFinanceTerms.downPayment,
        monthlyPayment: sellerFinanceTerms.monthlyPayment,
        balloonTermYears: sellerFinanceTerms.balloonTermYears,
        balloonPaymentAmount: sellerFinanceTerms.balloonPaymentAmount
      }
    }
  };
}

const sampleDeals = [
  {
    id: "DEAL-101",
    address: "1044 Market Street, San Francisco, CA",
    listingPrice: 450000,
    purchasePrice: 450000,
    arv: 600000,
    repairCost: 40000,
    zipCode: "94102",
    profitMargin: 0.25,
    sellerName: "Alex Morgan",
    sellerEmail: "user@example.com"
  }
];

async function executeDealPipeline() {
  console.log("==================================================================");
  console.log("Starting Vibe Finders Club Automated Real Estate Triage & Payout Engine");
  console.log("==================================================================\n");

  const executionLogs = [];

  for (const deal of sampleDeals) {
    console.log(`[TRIAGE] Processing Property: ${deal.address}`);

    // 1. Free OpenRouter AI Analysis
    const aiAnalysis = await analyzeDealWithFreeAI(deal);
    console.log(`  [AI Score]: ${aiAnalysis.aiScore}`);
    console.log(`  [AI Summary]: ${aiAnalysis.investmentSummary}`);

    // 2. Investor Matching
    const investorMatch = matchPropertyToBuyer(deal);
    console.log(`  [Matched Category]: ${investorMatch.matchedCategory}`);

    // 3. Dual Offer Package (Cash vs Seller Financing with Balloon Payment)
    const sellerFinanceTerms = calculateSellerFinancingOffer(deal.listingPrice || deal.purchasePrice, {
      offerMarkupPercent: 0.10,
      downPaymentPercent: 0.10,
      interestRate: 0.045,
      balloonTermYears: 7
    });
    const offerPackage = generateDualOfferCampaign(deal, sellerFinanceTerms);
    console.log(`  [Offer A - Cash]: $${offerPackage.offers.offerA_Cash.offerPrice.toLocaleString()}`);
    console.log(`  [Offer B - Seller Finance]: $${offerPackage.offers.offerB_SellerFinance.offerPrice.toLocaleString()}`);
    console.log(`  [Balloon Lump Sum]: $${offerPackage.offers.offerB_SellerFinance.balloonLumpSum.toLocaleString()} due in ${offerPackage.offers.offerB_SellerFinance.balloonDeadline}`);

    // 4. Send Email Outreach via Resend
    await sendSellerOutreachEmail(offerPackage);

    // 5. Stage Remittance Payment for Your Name (Ethiopia)
    const remittancePayload = stageRemittancePayment(deal, 0.02);

    executionLogs.push({
      timestamp: new Date().toISOString(),
      deal,
      aiAnalysis,
      investorMatch,
      offerPackage,
      remittancePayload
    });
  }

  // Save log file
  const logFilePath = path.join(__dirname, 'triage-execution-log.json');
  fs.writeFileSync(logFilePath, JSON.stringify(executionLogs, null, 2));
  console.log(`\n[SUCCESS] Pipeline execution complete. Output saved to triage-execution-log.json`);
}

function startDevelopmentServer(port = Number(process.env.PORT) || 3000) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (!['GET', 'HEAD'].includes(request.method) || !['/', '/index.html'].includes(url.pathname)) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : fs.readFileSync(path.join(__dirname, 'index.html')));
  });

  server.listen(port, () => {
    console.log(`Vibe Finders Club static development server listening on http://localhost:${port}`);
  });
  return server;
}

if (require.main === module) {
  if (process.argv.includes('--dev')) {
    startDevelopmentServer();
  } else if (process.argv.includes('--scrape')) {
    runDailyScrape().catch((error) => {
      console.error('[SCRAPE ERROR]', error.message);
      process.exitCode = 1;
    });
  } else {
    executeDealPipeline();
  }
}

module.exports = {
  parsePropertyTable,
  scrapeHUDProperties,
  scrapeFannieMaeProperties,
  scrapeTaxDeedProperties,
  scrapePropertySources,
  runDailyScrape,
  underwriteDeal,
  startDevelopmentServer
};