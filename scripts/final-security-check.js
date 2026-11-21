const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const extensions = new Set(['.html', '.js', '.json', '.md', '.py', '.sh', '.toml', '.ts', '.tsx', '.txt', '.yaml', '.yml']);
const ignoredDirectories = new Set(['.git', '.vercel', 'coverage', 'dist', 'node_modules']);
const secretPatterns = [
  /\b(?:sk_live_|rk_live_|pk_live_|whsec_)[A-Za-z0-9_-]{12,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /\+?251[\s()-]*9\d{2}[\s-]*\d{3}[\s-]*\d{3}\b/g,
];
const credentialAssignment = /\b(?:[A-Z][A-Z0-9]*_)*(?:API_KEY|SECRET_KEY|ACCESS_TOKEN|AUTH_TOKEN|PRIVATE_KEY|PASSWORD)\s*[:=]\s*(['"])([^'"\r\n]{8,})\1/g;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const urlPattern = /https?:\/\/[^\s"'<>]+/gi;
const allowedExampleDomains = new Set(['example.com', 'example.net', 'example.org', 'example.test', 'example.invalid']);
const placeholderPattern = /(?:\[YOUR_[^\]]+\]|your_|your-|placeholder|change.?me|replace.?me|example|test.only|dummy|fake|sample|redacted)/i;
const findings = [];
const files = [];

function collectFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectFiles(absolutePath);
      continue;
    }

    if (extensions.has(path.extname(entry.name).toLowerCase()) || /^\.env(?:\.|$)/.test(entry.name)) {
      files.push(absolutePath);
    }
  }
}

function addFinding(file, rule) {
  findings.push(`${path.relative(root, file)}: ${rule}`);
}

function scanFile(file) {
  const contents = fs.readFileSync(file, 'utf8');

  for (const [index, pattern] of secretPatterns.entries()) {
    if (pattern.test(contents)) addFinding(file, `secret-or-contact pattern ${index + 1}`);
    pattern.lastIndex = 0;
  }

  for (const match of contents.matchAll(credentialAssignment)) {
    if (!placeholderPattern.test(match[2])) addFinding(file, 'hardcoded credential assignment');
  }

  for (const match of contents.matchAll(emailPattern)) {
    const domain = match[0].split('@').pop().toLowerCase();
    if (!allowedExampleDomains.has(domain)) addFinding(file, 'non-placeholder email address');
  }

  for (const match of contents.matchAll(urlPattern)) {
    let url;
    try {
      url = new URL(match[0].replace(/[),.;]+$/, ''));
    } catch {
      continue;
    }

    const hasCredentials = Boolean(url.username || url.password);
    const hasSecretQuery = [...url.searchParams.entries()].some(([key, value]) => (
      /^(?:token|key|secret|signature|auth)$/i.test(key)
      && value.length >= 12
      && !placeholderPattern.test(value)
    ));
    if (hasCredentials || hasSecretQuery) addFinding(file, 'URL contains embedded credentials or token');
  }
}

collectFiles(root);
for (const file of files) scanFile(file);

if (findings.length) {
  console.error(`Final security check failed: ${findings.length} finding(s) across ${files.length} files.`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Final security check passed: ${files.length} project source/config/document files scanned.`);
}
