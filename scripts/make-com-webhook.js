const crypto = require('node:crypto');
const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const express = require('express');
const { underwriteDeal } = require('../pipeline-agent');

const app = express();
const PORT = process.env.PORT || 3000;
const SENSITIVE_KEY_PATTERN = /routing|account|iban|swift|bank|wire/i;
const SENSITIVE_VALUE_PATTERNS = [
  /\b(?:routing|account)\s*(?:number|no\.?|#)\s*[:=#-]?\s*[A-Z0-9][A-Z0-9 -]{3,}/i,
  /\bIBAN\s*[:= -]?\s*[A-Z]{2}\d{2}[A-Z0-9 ]{8,}/i,
  /\b(?:SWIFT|BIC)\s*(?:code)?\s*[:= -]\s*[A-Z0-9]{8,11}\b/i
];

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb', strict: true }));

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

function containsBankingPii(value) {
  if (Array.isArray(value)) {
    return value.some(containsBankingPii);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, child]) =>
      SENSITIVE_KEY_PATTERN.test(key) || containsBankingPii(child)
    );
  }
  return typeof value === 'string' && SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function isAuthorized(request) {
  const configuredSecret = process.env.MAKE_COM_WEBHOOK_SECRET;
  const authorization = request.get('authorization') || '';
  if (!configuredSecret || !authorization.startsWith('Bearer ')) return false;

  const providedSecret = authorization.slice('Bearer '.length);
  const expectedBuffer = Buffer.from(configuredSecret);
  const providedBuffer = Buffer.from(providedSecret);
  return expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function getDeal(payload) {
  const deal = payload.deal || payload.record?.fields || payload.fields || payload;
  if (!deal || typeof deal !== 'object' || Array.isArray(deal)) {
    throw new TypeError('Payload must contain a deal object.');
  }
  return deal;
}

app.post('/webhook/airtable', async (request, response) => {
  if (!isAuthorized(request)) {
    return response.status(401).json({ error: 'Unauthorized webhook request.' });
  }
  if (containsBankingPii(request.body)) {
    return response.status(400).json({ error: 'Payload contains prohibited banking information.' });
  }

  let deal;
  try {
    deal = getDeal(request.body);
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }

  try {
    const underwriting = await underwriteDeal(deal);
    return response.status(200).json({ ok: true, underwriting });
  } catch (error) {
    const clientError = error instanceof TypeError;
    return response.status(clientError ? 400 : 500).json({
      error: clientError ? error.message : 'Underwriting failed.'
    });
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return response.status(400).json({ error: 'Request body must be valid JSON.' });
  }
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ error: 'Request body exceeds the 64kb limit.' });
  }
  return response.status(400).json({ error: 'Unable to process request.' });
});

if (require.main === module) {
  const port = Number(PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }
  app.listen(port, () => {
    console.log(`Make.com Airtable webhook listening on port ${port}.`);
  });
}

module.exports = { app, containsBankingPii, isAuthorized };
