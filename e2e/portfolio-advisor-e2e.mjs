/**
 * E2E: Portfolio AI Advisor — quiz → result → cart
 * Run: node e2e/portfolio-advisor-e2e.mjs
 * Requires: backend/portfolio/ catalog data
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;

const issues = [];
const passes = [];
const logPass = (m) => { passes.push(m); console.log(`  ✓ ${m}`); };
const logIssue = (m) => { issues.push(m); console.log(`  ✗ ${m}`); };
const check = (c, m) => (c ? logPass(m) : logIssue(m));

function waitForServer(ms = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(`${BASE}/portfolio-advisor/settings`);
        if (res.ok) return resolve();
      } catch { /* retry */ }
      if (Date.now() - start > ms) return reject(new Error('Server timeout'));
      setTimeout(tick, 300);
    };
    tick();
  });
}

async function selectRadio(page, name, value) {
  const label = page.locator(`label.lpq-option:has(input[name="${name}"][value="${value}"])`);
  await label.waitFor({ state: 'visible', timeout: 5000 });
  await label.click();
}

async function selectCheckbox(page, name, value) {
  const label = page.locator(`label.lpq-option:has(input[name="${name}"][value="${value}"])`);
  await label.waitFor({ state: 'visible', timeout: 5000 });
  await label.click();
}

async function selectExclusiveNone(page, name) {
  await selectRadio(page, name, 'none');
}

async function pickCategoryOptions(page, { singleCategory = false, categories = [] } = {}) {
  const field = singleCategory ? 'product_category' : 'product_categories';
  const stepId = singleCategory ? 'product_category' : 'product_categories';
  check(await page.locator(`#step-${stepId}`).isVisible(), `${singleCategory ? 'Single' : 'Multi'} category step shown after priority`);

  if (singleCategory) {
    const selector = categories[0]
      ? `input[name="product_category"][value="${categories[0]}"]`
      : 'input[name="product_category"]';
    await page.waitForSelector(selector, { timeout: 15000 });
    const value = categories[0] || await page.locator(selector).first().getAttribute('value');
    await selectRadio(page, 'product_category', value);
    return;
  }

  if (!categories.length) {
    const checked = await page.locator('input[name="product_categories"]:checked').count();
    check(checked > 0, 'At least one relevant category is pre-selected');
    return;
  }

  for (const cat of categories) {
    await page.waitForSelector(`input[name="product_categories"][value="${cat}"]`, { timeout: 15000 });
    await selectCheckbox(page, 'product_categories', cat);
  }
}

async function completeCommonSteps(page, { priority = 'muscle', categories = [], singleCategory = false } = {}) {
  const next = () => page.click('#lpq-next');

  await selectRadio(page, 'sex', 'male');
  await next();
  await selectRadio(page, 'age_band', '25-34');
  await next();
  await selectRadio(page, 'priority', priority);
  await next();

  if (priority === 'muscle' || priority === 'otshalvane') {
    await page.locator('#height_cm').fill('180');
    await page.locator('#weight_kg').fill('80');
    await next();
  }

  await pickCategoryOptions(page, { singleCategory, categories });
  await next();

  await selectRadio(page, 'activity', 'regular');
  await next();
  await selectRadio(page, 'diet', 'omnivore');
  await next();
  await selectExclusiveNone(page, 'conditions');
  await next();
  await selectExclusiveNone(page, 'medications');
  await next();
  await selectExclusiveNone(page, 'symptoms');
  await next();
  await selectExclusiveNone(page, 'allergies');
  await next();
  await page.locator('#lpq-email').fill(`e2e-${Date.now()}@test.local`);
  await next();
}

async function waitForQuizReady(page) {
  await page.waitForSelector('input[name="selection_mode"]', { timeout: 15000 });
}

async function runPackageFlow(page) {
  await page.goto(`${BASE}/portfolio-advisor-quiz.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => sessionStorage.removeItem('portfolioAdvisorDraft'));
  await waitForQuizReady(page);

  check(await page.locator('.pf-header').count() > 0, 'Portfolio header visible');
  check(await page.locator('#lpq-next').isVisible(), 'Quiz next button visible');

  await selectRadio(page, 'selection_mode', 'package');
  await page.click('#lpq-next');

  await completeCommonSteps(page, { priority: 'muscle' });

  await page.waitForURL(/portfolio-advisor-result/, { timeout: 45000 });
  check(page.url().includes('portfolio-advisor-result'), 'Package flow redirected to result page');
  check(await page.locator('.lpr-tier').count() >= 3, 'Three tier cards rendered');
  check(await page.locator('[data-action="add-tier"]').count() >= 3, 'Add-to-cart buttons on tiers');
}

async function getCategoryWithMinProducts(min = 3) {
  try {
    const res = await fetch(`${BASE}/portfolio/bootstrap`);
    const data = await res.json();
    const match = (data.meta?.categories || []).find((c) => (c.count || 0) >= min);
    if (match?.name) return match.name;
    const fallback = (data.meta?.categories || []).find((c) => (c.count || 0) > 0);
    return fallback?.name || null;
  } catch {
    return null;
  }
}

async function runSingleFlow(page) {
  const category = (await getCategoryWithMinProducts(3)) || 'Протеини';

  await page.goto(`${BASE}/portfolio-advisor-quiz.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => sessionStorage.removeItem('portfolioAdvisorDraft'));
  await waitForQuizReady(page);

  await selectRadio(page, 'selection_mode', 'single');
  await page.click('#lpq-next');

  await completeCommonSteps(page, {
    priority: 'muscle',
    singleCategory: true,
    categories: category ? [category] : [],
  });

  await page.waitForURL(/portfolio-advisor-result/, { timeout: 45000 });
  check(page.url().includes('portfolio-advisor-result'), 'Single flow redirected to result page');

  const tierProductIds = await page.evaluate(() => {
    const raw = sessionStorage.getItem('portfolioAdvisorResult')
      || localStorage.getItem('portfolioAdvisorResultPersistent');
    if (!raw) return [];
    const data = JSON.parse(raw);
    return ['basic', 'optimal', 'premium'].map((k) => data.tiers?.[k]?.products?.[0]?.product_id).filter(Boolean);
  });

  check(tierProductIds.length === 3, 'Single mode has 3 tier products');
  check(new Set(tierProductIds).size === 3, 'Single mode tiers use 3 different products');
}

async function main() {
  console.log('Portfolio AI Advisor E2E\n');

  const server = spawn('node', ['e2e/portfolio-dev-server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), PORTFOLIO_E2E_MINIMAL: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer();
    logPass('Dev server ready');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await runPackageFlow(page);
    await runSingleFlow(page);
    await browser.close();
  } finally {
    server.kill('SIGTERM');
  }

  console.log(`\n${passes.length} passed, ${issues.length} failed`);
  if (issues.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
