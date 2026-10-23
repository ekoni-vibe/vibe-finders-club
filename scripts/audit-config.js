const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function readFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return { exists: false, content: '' };
  }

  return { exists: true, content: fs.readFileSync(absolutePath, 'utf8') };
}

function parseEnv(content) {
  const values = new Map();

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    const value = match[2].replace(/^(['"])(.*)\1$/, '$2').trim();
    values.set(match[1], value);
  }

  return values;
}

function printList(items, emptyMessage) {
  if (items.length === 0) {
    console.log(`  - ${emptyMessage}`);
    return;
  }

  for (const item of items) {
    console.log(`  - ${item}`);
  }
}

function main() {
  const packageFile = readFile('package.json');
  const envFile = readFile('.env');
  const pipelineFile = readFile('pipeline-agent.js');
  const outreachFile = readFile('outreach-workflow.js');
  const workflowFile = readFile('.github/workflows/daily-agent.yml');

  let packageData = {};
  if (packageFile.exists) {
    try {
      packageData = JSON.parse(packageFile.content);
    } catch (error) {
      throw new Error(`Could not parse package.json: ${error.message}`);
    }
  }

  const dependencies = {
    ...(packageData.dependencies || {}),
    ...(packageData.devDependencies || {}),
    ...(packageData.optionalDependencies || {})
  };
  const dependencyNames = Object.keys(dependencies);
  const expectedDependencyGroups = [
    { label: 'express', names: ['express'] },
    { label: 'alpinejs', names: ['alpinejs'] },
    { label: 'Supabase client', names: ['@supabase/supabase-js', 'supabase-js'] }
  ];
  const declaredDependencies = expectedDependencyGroups
    .filter(({ names }) => names.some((name) => dependencies[name]))
    .map(({ label }) => label);
  const missingDependencies = expectedDependencyGroups
    .filter(({ names }) => !names.some((name) => dependencies[name]))
    .map(({ label }) => label);

  const envValues = parseEnv(envFile.content);
  const expectedEnvKeys = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'RESEND_API_KEY'];
  const envStatuses = expectedEnvKeys.map((name) => {
    const value = envValues.get(name);
    return { name, configured: Boolean(value && !/^(your_|placeholder|changeme)/i.test(value)) };
  });

  const sourceFiles = [pipelineFile.content, outreachFile.content].join('\n');
  const scrapingSignals = [
    ['browser automation', /\b(?:puppeteer|playwright|selenium)\b/i],
    ['HTML parsing/crawling', /\b(?:cheerio|jsdom|crawler|scraper|scraping|scrape|crawling|crawl)\b/i]
  ];
  const underwritingSignals = [
    ['underwriting', /\bunderwrit(?:e|er|ing|ten)?\b/i],
    ['deal valuation/offer analysis', /\b(?:arv|repairCost|cashOfferPrice|seller financing|seller-financing|profitMargin|mao)\b/i]
  ];
  const hasSignal = (signals) => signals.some(([, pattern]) => pattern.test(sourceFiles));
  const hasScrapingLogic = hasSignal(scrapingSignals);
  const hasUnderwritingLogic = hasSignal(underwritingSignals);

  const cronMatches = workflowFile.content.matchAll(/^\s*-\s*cron:\s*(?:'([^']+)'|"([^"]+)"|([^\s#]+))/gm);
  const cronSchedules = [...cronMatches].map((match) => match[1] || match[2] || match[3]);

  const existing = [];
  if (packageFile.exists) {
    existing.push(`package.json declares: ${dependencyNames.length ? dependencyNames.join(', ') : 'no dependencies'}`);
    existing.push(`Requested dependencies declared: ${declaredDependencies.length ? declaredDependencies.join(', ') : 'none'}`);
  } else {
    existing.push('package.json is missing');
  }

  existing.push(`.env: ${envFile.exists ? 'present' : 'missing'}`);
  for (const { name, configured } of envStatuses) {
    existing.push(`${name}: ${envFile.exists ? (configured ? 'set' : 'missing or empty') : 'unavailable (.env missing)'}`);
  }

  existing.push(`Scraping logic in pipeline-agent.js/outreach-workflow.js: ${pipelineFile.exists || outreachFile.exists ? (hasScrapingLogic ? 'detected' : 'not detected') : 'source files missing'}`);
  existing.push(`Underwriting/offer-analysis logic in pipeline-agent.js/outreach-workflow.js: ${pipelineFile.exists || outreachFile.exists ? (hasUnderwritingLogic ? 'detected' : 'not detected') : 'source files missing'}`);
  existing.push(`daily-agent.yml: ${workflowFile.exists ? (cronSchedules.length ? `cron schedule(s): ${cronSchedules.join(', ')}` : 'present, no cron schedule detected') : 'missing'}`);

  const updates = [];
  if (!packageFile.exists) {
    updates.push('Create package.json and declare the project dependencies.');
  } else if (missingDependencies.length) {
    updates.push(`Review whether these dependencies are needed and add them if so: ${missingDependencies.join(', ')}.`);
  }
  for (const { name, configured } of envStatuses) {
    if (!configured) updates.push(`Configure ${name} in .env or the deployment environment.`);
  }
  if (workflowFile.exists && cronSchedules.length === 0) {
    updates.push('Add a cron schedule to .github/workflows/daily-agent.yml if scheduled runs are intended.');
  }
  if (hasUnderwritingLogic) {
    updates.push('Review the existing underwriting/offer-analysis logic for the required business rules.');
  }

  const creations = [];
  if (!pipelineFile.exists) creations.push('Create pipeline-agent.js.');
  if (!outreachFile.exists) creations.push('Create outreach-workflow.js.');
  if (!hasScrapingLogic) creations.push('Create scraping/crawling logic if property-data collection is required.');
  if (!workflowFile.exists) creations.push('Create .github/workflows/daily-agent.yml if GitHub Actions scheduling is required.');
  if (!envFile.exists) creations.push('Create a local .env file (do not commit secrets).');

  console.log('Configuration Audit Report');
  console.log('==========================');
  console.log('\n(a) What exists');
  printList(existing, 'No project configuration detected.');
  console.log('\n(b) What needs updating');
  printList(updates, 'No identified configuration updates.');
  console.log('\n(c) What needs creation');
  printList(creations, 'No identified files or logic to create.');
}

main();
