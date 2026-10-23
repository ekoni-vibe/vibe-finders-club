const path = require('node:path');
const fs = require('node:fs');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const LOCAL_STORAGE_KEY = 'deals';
const LOCAL_DEALS_FILE = path.resolve(__dirname, 'deals.local.json');
const SENSITIVE_KEY_PATTERN = /routing|account|iban|swift|bank|wire|ssn|social/i;

function filterSensitiveKeys(value) {
  if (Array.isArray(value)) {
    return value.map(filterSensitiveKeys);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
      .map(([key, entry]) => [key, filterSensitiveKeys(entry)])
  );
}

function maskStreetNumber(address) {
  return String(address || '').replace(/^(\s*)\d+\b/, '$1***');
}

function sanitizeDealForCloud(deal) {
  try {
    if (!deal || typeof deal !== 'object' || Array.isArray(deal)) {
      throw new TypeError('deal must be an object.');
    }

    const copiedDeal = { ...deal };
    for (const key of Object.keys(copiedDeal)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        delete copiedDeal[key];
      }
    }

    const safeDeal = filterSensitiveKeys(copiedDeal);
    return {
      id: safeDeal.id ?? null,
      masked_address: maskStreetNumber(safeDeal.masked_address || safeDeal.address || ''),
      city: safeDeal.city ?? '',
      state: safeDeal.state ?? '',
      zip: safeDeal.zip ?? safeDeal.zipCode ?? '',
      price: safeDeal.price ?? safeDeal.listPrice ?? safeDeal.purchasePrice ?? null,
      arv: safeDeal.arv ?? null,
      rehab: safeDeal.rehab ?? safeDeal.rehabEstimate ?? null,
      offerType: safeDeal.offerType ?? safeDeal.offer_type ?? null,
      viabilityScore: safeDeal.viabilityScore ?? safeDeal.viability_score ?? null,
      stage: safeDeal.stage ?? null,
      createdAt: safeDeal.createdAt ?? safeDeal.created_at ?? null,
      updatedAt: safeDeal.updatedAt ?? safeDeal.updated_at ?? null
    };
  } catch (error) {
    throw new Error(`Could not sanitize deal for Supabase: ${error.message}`, { cause: error });
  }
}

async function syncDealToCloud(deal) {
  try {
    const sanitizedDeal = sanitizeDealForCloud(deal);
    if (JSON.stringify(sanitizedDeal).length > 1024) {
      throw new Error('Deal payload exceeds 1KB limit. Potential data exfiltration blocked.');
    }

    const { data, error } = await supabase
      .from('deals')
      .upsert(sanitizedDeal, { onConflict: 'id' });

    if (error) {
      throw new Error(`Supabase deal upsert failed: ${error.message}`);
    }

    console.log(`Synced deal ${sanitizedDeal.id} to Supabase`);
    return data;
  } catch (error) {
    console.error('Supabase deal sync failed:', error.message);
    throw error;
  }
}

function readLocalDeals() {
  try {
    if (globalThis.localStorage && typeof globalThis.localStorage.getItem === 'function') {
      const savedDeals = globalThis.localStorage.getItem(LOCAL_STORAGE_KEY);
      return savedDeals ? JSON.parse(savedDeals) : [];
    }
    if (!fs.existsSync(LOCAL_DEALS_FILE)) return [];
    return JSON.parse(fs.readFileSync(LOCAL_DEALS_FILE, 'utf8'));
  } catch (error) {
    console.error('Error reading local deals:', error.message);
    return [];
  }
}

function writeLocalDeals(deals) {
  try {
    const serializedDeals = JSON.stringify(deals);
    if (globalThis.localStorage && typeof globalThis.localStorage.setItem === 'function') {
      globalThis.localStorage.setItem(LOCAL_STORAGE_KEY, serializedDeals);
      return;
    }
    fs.writeFileSync(LOCAL_DEALS_FILE, serializedDeals, 'utf8');
  } catch (error) {
    console.error('Error saving local deals:', error.message);
  }
}

async function pullDealsFromCloud() {
  try {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .order('updatedAt', { ascending: false });

    if (error) {
      console.error('Error pulling deals:', error.message);
      return [];
    }

    const localDealsValue = readLocalDeals();
    const localDeals = Array.isArray(localDealsValue) ? localDealsValue : [];
    const mergedDeals = new Map();

    for (const localDeal of localDeals) {
      const sanitizedLocalDeal = sanitizeDealForCloud(localDeal);
      if (sanitizedLocalDeal.id !== null) {
        mergedDeals.set(String(sanitizedLocalDeal.id), sanitizedLocalDeal);
      }
    }

    for (const cloudDeal of data || []) {
      const sanitizedCloudDeal = sanitizeDealForCloud(cloudDeal);
      if (sanitizedCloudDeal.id === null) continue;

      const dealId = String(sanitizedCloudDeal.id);
      const existingDeal = mergedDeals.get(dealId);
      const cloudUpdatedAt = Date.parse(sanitizedCloudDeal.updatedAt || '') || 0;
      const localUpdatedAt = Date.parse(existingDeal?.updatedAt || '') || 0;
      if (!existingDeal || cloudUpdatedAt > localUpdatedAt) {
        mergedDeals.set(dealId, sanitizedCloudDeal);
      }
    }

    const result = [...mergedDeals.values()];
    writeLocalDeals(result);
    return result;
  } catch (error) {
    console.error('Error pulling deals:', error.message);
    return [];
  }
}

async function testSupabaseConnection() {
  try {
    const { error } = await supabase
      .from('deals')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Supabase connection test failed:', error.message);
      return false;
    }

    console.log('Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Supabase connection test failed:', error.message);
    return false;
  }
}

module.exports = {
  sanitizeDealForCloud,
  syncDealToCloud,
  pullDealsFromCloud,
  testSupabaseConnection
};
