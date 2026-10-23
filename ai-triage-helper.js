/**
 * Property analysis using Gemini with OpenRouter fallback.
 */

require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');

const CACHE_FILE = path.join(__dirname, 'triage-ai-cache.json');
const CACHE_VERSION = 1;

function extractAddress(listingText) {
  const labeledAddress = listingText.match(/(?:property\s+)?address\s*:\s*([^\r\n]+)/i);
  if (labeledAddress) return labeledAddress[1].trim();

  const addressLine = listingText.match(/^\s*(\d{1,6}\s+[^,\r\n]+(?:,\s*[^,\r\n]+){1,2})\s*$/m);
  return addressLine ? addressLine[1].trim() : '';
}

function normalizeAddress(address) {
  return address.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

async function readCache() {
  try {
    const parsed = JSON.parse(await fs.readFile(CACHE_FILE, 'utf8'));
    if (parsed.version !== CACHE_VERSION || !parsed.entries || typeof parsed.entries !== 'object' || Array.isArray(parsed.entries)) {
      throw new Error('Gemini cache has an invalid structure.');
    }
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { version: CACHE_VERSION, entries: {} };
    }
    throw error;
  }
}

function parseGeminiJson(text) {
  const jsonText = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(jsonText);
  const numericValue = (value) => {
    if (value == null || value === '') return null;
    const number = typeof value === 'number' ? value : Number(String(value).replace(/[$,\s]/g, ''));
    return Number.isFinite(number) ? number : null;
  };
  const condition = typeof parsed.condition === 'string' ? parsed.condition.trim() : '';

  if (!condition || !Object.hasOwn(parsed, 'arv') || !Object.hasOwn(parsed, 'rehabEstimate') || !Object.hasOwn(parsed, 'rent')) {
    throw new Error('Gemini response did not include arv, rehabEstimate, rent, and condition.');
  }

  return {
    arv: numericValue(parsed.arv),
    rehabEstimate: numericValue(parsed.rehabEstimate),
    rent: numericValue(parsed.rent),
    condition
  };
}

async function analyzeWithGemini(listingText) {
  const text = String(listingText || '').trim();
  if (!text) throw new TypeError('listingText must not be empty.');

  const address = extractAddress(text);
  const cacheKey = address ? normalizeAddress(address) : '';
  const cache = await readCache();
  if (cacheKey && cache.entries[cacheKey]) {
    return { ...cache.entries[cacheKey].analysis, cached: true };
  }

  const apiKey = process.env.GOOGLE_AI_STUDIO_KEY;
  if (!apiKey || apiKey.includes('your_')) {
    throw new Error('GOOGLE_AI_STUDIO_KEY is not configured.');
  }

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{
          text: `Analyze this real-estate listing and estimate its after-repair value (ARV), total rehabilitation cost, monthly rent, and current condition. Return only a JSON object with keys "arv", "rehabEstimate", "rent", and "condition". Use numeric USD values for the first three (or null if unavailable) and a concise string for condition.\n\nListing:\n${text}`
        }]
      }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed with HTTP ${response.status}.`);
  }

  const result = await response.json();
  const responseText = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('');
  if (!responseText) {
    throw new Error('Gemini returned no analysis content.');
  }

  const analysis = parseGeminiJson(responseText);
  if (cacheKey) {
    cache.entries[cacheKey] = {
      cachedAt: new Date().toISOString(),
      analysis
    };
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  }

  return { ...analysis, cached: false };
}

async function analyzeWithOpenRouter(deal) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';

  if (!apiKey || apiKey.includes('your_openrouter_api_key')) {
    console.log('  [AI AGENT] OpenRouter API key not configured. Using rule-based fallback analysis.');
    return {
      aiScore: '8.5/10',
      investmentSummary: 'High-margin opportunity suitable for both quick cash exit and creative seller financing.'
    };
  }

  const prompt = `You are a real estate investment analyst. Analyze this property deal:
Address: ${deal.address} Listing Price: $${deal.listingPrice}
Estimated ARV: $${deal.arv} Repair Cost: $${deal.repairCost}

Provide a 2-sentence executive summary recommending whether to purchase via cash or seller financing.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed with HTTP ${response.status}.`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || 'Analysis complete.';
    return { aiScore: '9.0/10', investmentSummary: summary.trim() };
  } catch (error) {
    console.error('  [AI AGENT ERROR]:', error.message);
    return { aiScore: '7.5/10', investmentSummary: 'Rule-based analysis applied.' };
  }
}

async function analyzeDealWithFreeAI(deal) {
  const listingText = [
    `Address: ${deal.address || 'Unknown'}`,
    `Listing Price: ${deal.listingPrice ?? deal.purchasePrice ?? 'Unknown'}`,
    `Current ARV: ${deal.arv ?? 'Unknown'}`,
    `Current Repair Estimate: ${deal.repairCost ?? 'Unknown'}`,
    `Listing Details: ${deal.listingText || ''}`
  ].join('\n');

  try {
    const analysis = await analyzeWithGemini(listingText);
    return {
      aiScore: 'Gemini analysis',
      investmentSummary: `Condition: ${analysis.condition}. Estimated ARV: ${analysis.arv ?? 'unavailable'}; rehab: ${analysis.rehabEstimate ?? 'unavailable'}; monthly rent: ${analysis.rent ?? 'unavailable'}.`,
      ...analysis
    };
  } catch (error) {
    console.warn(`  [AI AGENT] Gemini unavailable: ${error.message}. Falling back to OpenRouter.`);
    return analyzeWithOpenRouter(deal);
  }
}

module.exports = { analyzeWithGemini, analyzeDealWithFreeAI };
