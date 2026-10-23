const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const rootDir = path.resolve(__dirname, '..');
const requiredEnv = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'RESEND_API_KEY',
  'GOOGLE_AI_STUDIO_KEY',
  'MAKE_COM_WEBHOOK_URL'
];
const jsFilesToScan = [
  'pipeline-agent.js',
  'outreach-workflow.js',
  'remittance-generator.js',
  'remittance-approval.js'
];
const blockedPatterns = [
  /\b(?:routing|account|wire|swift|iban|bank)\w*\s*(?:number|code|details|instructions)\s*[:=]/i,
  /\b(?:routingNumber|accountNumber|wireInstructions|swiftCode|iban|bankName|bankDetails)\b/i,
  /\b(?:routing|account|wire|swift|iban)\b.*\b(?:number|code|details|instructions)\b/i
];
const htmlPatterns = [
  /name\s*=\s*["'](?:routing|account|swift|iban|bank)[^"']*["']/i,
  /id\s*=\s*["'](?:routing|account|swift|iban|bank)[^"']*["']/i
];
const placeholderPattern = /(your_|placeholder|replace_me|changeme|example\.|example\b)/i;

const failures = [];

for (const key of requiredEnv) {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    failures.push(`Missing required env key: ${key}`);
    continue;
  }
  if (placeholderPattern.test(value)) {
    failures.push(`Placeholder detected in ${key}: ${value}`);
  }
}

const envFile = path.join(rootDir, '.env');
if (fs.existsSync(envFile)) {
  const envText = fs.readFileSync(envFile, 'utf8');
  if (placeholderPattern.test(envText)) {
    failures.push('Placeholder values detected in .env');
  }
}

for (const relativePath of jsFilesToScan) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    continue;
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const pattern of blockedPatterns) {
    if (pattern.test(content)) {
      failures.push(`Blocked banking pattern detected in ${relativePath}: ${pattern}`);
      break;
    }
  }
}

const indexPath = path.join(rootDir, 'index.html');
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  for (const pattern of htmlPatterns) {
    if (pattern.test(indexContent)) {
      failures.push('Banking input field detected in index.html');
      break;
    }
  }
}

if (failures.length > 0) {
  console.error('Final security check failed.');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Final security check passed.');
