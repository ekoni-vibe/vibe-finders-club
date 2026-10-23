// investor-matcher.js
const DEFAULT_TARGET_ZIPS = ['38118', '44105', '63116', '64130'];
const INVESTOR_TYPES = ['cash', 'seller_finance'];
const INVESTOR_STORAGE_KEY = 'investorDatabase';
const DEFAULT_INVESTORS = [
  { id: 1, name: 'Investor A', zip: '38118', budgetMin: 50000, budgetMax: 200000, preferredOfferType: 'cash' },
  { id: 2, name: 'Investor B', zip: '44105', budgetMin: 100000, budgetMax: 500000, preferredOfferType: 'seller_finance' },
  { id: 3, name: 'Investor C', zip: '63116', budgetMin: 75000, budgetMax: 300000, preferredOfferType: 'both' },
  { id: 4, name: 'Investor D', zip: '64130', budgetMin: 150000, budgetMax: 600000, preferredOfferType: 'cash' }
];

function resolveStorage(storage) {
  try {
    return storage === undefined ? globalThis.localStorage : storage;
  } catch (error) {
    console.error('[INVESTOR STORAGE] localStorage is unavailable:', error.message);
    return null;
  }
}

function readInvestorDatabase(storage) {
  const store = resolveStorage(storage);
  if (!store || typeof store.getItem !== 'function') return null;

  try {
    const saved = store.getItem(INVESTOR_STORAGE_KEY);
    if (saved === null) return null;
    const investors = JSON.parse(saved);
    if (!Array.isArray(investors)) {
      throw new TypeError('investorDatabase must contain a JSON array.');
    }
    return investors;
  } catch (error) {
    console.error('[INVESTOR STORAGE] Unable to read investor database:', error.message);
    return null;
  }
}

function writeInvestorDatabase(investors, storage) {
  const store = resolveStorage(storage);
  if (!store || typeof store.setItem !== 'function') {
    console.error('[INVESTOR STORAGE] localStorage.setItem is unavailable.');
    return false;
  }

  try {
    store.setItem(INVESTOR_STORAGE_KEY, JSON.stringify(investors));
    return true;
  } catch (error) {
    console.error('[INVESTOR STORAGE] Unable to save investor database:', error.message);
    return false;
  }
}

function initializeInvestorDatabase(options = {}) {
  const existing = readInvestorDatabase(options.storage);
  if (existing !== null) return existing;

  const defaults = DEFAULT_INVESTORS.map((investor) => ({ ...investor }));
  writeInvestorDatabase(defaults, options.storage);
  return defaults;
}

function saveInvestorToLocalStorage(investor, options = {}) {
  if (!investor || typeof investor !== 'object' || Array.isArray(investor)) {
    throw new TypeError('investor must be an object.');
  }

  const investors = initializeInvestorDatabase(options);
  const nextId = investors.reduce((maximum, entry) => {
    const numericId = Number(entry.id);
    return Number.isFinite(numericId) ? Math.max(maximum, numericId) : maximum;
  }, 0) + 1;
  const savedInvestor = {
    ...investor,
    id: investor.id ?? nextId,
    zip: String(investor.zip ?? '').trim()
  };
  const existingIndex = investors.findIndex((entry) => String(entry.id) === String(savedInvestor.id));

  if (existingIndex === -1) investors.push(savedInvestor);
  else investors[existingIndex] = savedInvestor;

  writeInvestorDatabase(investors, options.storage);
  return savedInvestor;
}

function getInvestorsByZIP(zip, options = {}) {
  const normalizedZip = String(zip ?? '').trim();
  if (!normalizedZip) return [];
  return initializeInvestorDatabase(options)
    .filter((investor) => String(investor.zip ?? '').trim() === normalizedZip);
}

function matchInvestors(deal, options = {}) {
  if (!deal || typeof deal !== 'object' || Array.isArray(deal)) {
    throw new TypeError('deal must be an object.');
  }

  const investors = initializeInvestorDatabase(options);
  const dealZip = String(deal.zip ?? deal.zipCode ?? '').trim();
  const dealPrice = Number(deal.price ?? deal.listPrice ?? deal.purchasePrice);
  const offerType = String(deal.offerType ?? '').trim().toLowerCase();
  const compatibleTypes = offerType === 'premium cash' || offerType === 'cash'
    ? ['cash', 'both']
    : offerType === 'seller_finance' || offerType === 'seller finance'
      ? ['seller_finance', 'both']
      : null;

  if (!dealZip || !Number.isFinite(dealPrice)) return [];

  return investors
    .filter((investor) =>
      String(investor.zip ?? '').trim() === dealZip
      && dealPrice >= Number(investor.budgetMin)
      && dealPrice <= Number(investor.budgetMax)
      && (!compatibleTypes || compatibleTypes.includes(String(investor.preferredOfferType ?? '').toLowerCase()))
    )
    .map((investor) => ({
      ...investor,
      contactInfo: {
        email: investor.email || investor.contactEmail || '',
        phone: investor.phone || investor.contactPhone || ''
      }
    }));
}

function getTargetZips(storage) {
  const store = resolveStorage(storage);
  if (store && typeof store.getItem === 'function') {
    try {
      const savedState = store.getItem('dealroom_master_state');
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        if (Array.isArray(parsedState.targetZips)) {
          return parsedState.targetZips.map(String);
        }
      }
    } catch (error) {
      console.error('[INVESTOR STORAGE] Unable to read target ZIPs:', error.message);
    }
  }

  return DEFAULT_TARGET_ZIPS;
}

function matchPropertyToBuyer(deal, options = {}) {
  const { arv, purchasePrice, repairCost, zipCode, profitMargin } = deal;
  const mao = (arv * 0.70) - repairCost; // Maximum Allowable Offer rule
  const dealZip = String(deal.zip || zipCode || '').trim();
  const targetZips = getTargetZips(options.storage);
  const requestedInvestorType = String(options.investorType || deal.investorType || '')
    .trim()
    .toLowerCase();

  const recommendation = {
    dealId: deal.id,
    matchedCategory: 'UNMATCHED',
    targetBuyerGroup: [],
    outreachStrategy: '',
    zipCode: dealZip,
    matchedInvestorType: requestedInvestorType || null
  };

  if (requestedInvestorType && !INVESTOR_TYPES.includes(requestedInvestorType)) {
    throw new TypeError(`investorType must be one of: ${INVESTOR_TYPES.join(', ')}.`);
  }
  if (!dealZip || !targetZips.includes(dealZip)) {
    recommendation.outreachStrategy = 'No match: property ZIP is not in the configured investor target ZIPs.';
    return recommendation;
  }

  if ((!requestedInvestorType || requestedInvestorType === 'cash')
    && purchasePrice <= mao && profitMargin >= 0.20) {
    recommendation.matchedCategory = 'FLIPPER_HIGH_MARGIN';
    recommendation.targetBuyerGroup = ['Fix & Flip Investors', 'Institutional Buyers'];
    recommendation.matchedInvestorType = 'cash';
    recommendation.outreachStrategy = 'Highlight ARV spread and fast closing timeline.';
  } else if ((!requestedInvestorType || requestedInvestorType === 'cash')
    && purchasePrice < (arv * 0.65) && repairCost > 30000) {
    recommendation.matchedCategory = 'WHOLESALE_ASSIGNMENT';
    recommendation.targetBuyerGroup = ['Wholesalers', 'Contract Buyers'];
    recommendation.matchedInvestorType = 'cash';
    recommendation.outreachStrategy = 'Pitch assignment contract with quick finder fee setup.';
  } else if ((!requestedInvestorType || requestedInvestorType === 'seller_finance')
    && profitMargin >= 0.12) {
    recommendation.matchedCategory = 'BUY_AND_HOLD';
    recommendation.targetBuyerGroup = ['Rental Cash Flow Investors'];
    recommendation.matchedInvestorType = 'seller_finance';
    recommendation.outreachStrategy = 'Emphasize cap rate and long-term rental yield.';
  }

  if (recommendation.matchedCategory === 'UNMATCHED' && requestedInvestorType) {
    recommendation.outreachStrategy = `No ${requestedInvestorType} investor match for this deal's financial criteria.`;
  }

  return recommendation;
}

module.exports = {
  initializeInvestorDatabase,
  matchInvestors,
  saveInvestorToLocalStorage,
  getInvestorsByZIP,
  matchPropertyToBuyer
};