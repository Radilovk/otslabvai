/**
 * E2E smoke test for Portfolio – browse, product, cart, promo, order.
 * Run: node e2e/portfolio-e2e.mjs
 */
import { spawn } from 'child_process';
import { chromium, devices } from 'playwright';
import { setTimeout as sleep } from 'timers/promises';

const PORT = 8790;
const BASE = `http://127.0.0.1:${PORT}`;
const issues = [];
const passes = [];

function logPass(msg) { passes.push(msg); console.log(`  ✓ ${msg}`); }
function logIssue(msg) { issues.push(msg); console.log(`  ✗ ${msg}`); }

async function waitForServer(maxMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/portfolio/bootstrap`);
      if (res.ok) return true;
    } catch { /* retry */ }
    await sleep(500);
  }
  return false;
}

async function clickSubmit(page) {
  const mobileBtn = page.locator('#submit-btn-mobile');
  if (await mobileBtn.isVisible()) await mobileBtn.click();
  else await page.click('#submit-btn');
}

async function runTests() {
  console.log('\n=== Portfolio E2E ===\n');

  const server = spawn('node', ['e2e/portfolio-dev-server.mjs'], {
    cwd: new URL('..', import.meta.url).pathname.replace(/\/$/, '') || process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  server.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  if (!(await waitForServer())) {
    server.kill();
    throw new Error('Dev server did not start');
  }

  // --- API tests ---
  console.log('API:');
  const bootstrap = await (await fetch(`${BASE}/portfolio/bootstrap`)).json();
  if (bootstrap.meta?.index?.length > 1000) logPass(`bootstrap: ${bootstrap.meta.total_groups} groups`);
  else logIssue(`bootstrap index too small: ${bootstrap.meta?.index?.length}`);

  const catalog = await (await fetch(`${BASE}/portfolio/catalog?q=protein&limit=5`)).json();
  if (catalog.items?.length > 0) logPass('catalog API search works');
  else logIssue('catalog API returned no items for protein');

  const promoRes = await fetch(`${BASE}/portfolio/validate-promo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'PORTFOLIO10' })
  });
  const promo = await promoRes.json();
  if (promo.valid) logPass('promo PORTFOLIO10 validates');
  else logIssue(`promo validation failed: ${promo.error}`);

  // --- Mobile browser ---
  console.log('\nMobile UI (iPhone 13):');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    locale: 'bg-BG'
  });
  const page = await context.newPage();

  const networkLog = [];
  page.on('request', (req) => {
    if (req.url().includes('/portfolio/')) networkLog.push(req.url());
  });

  await page.goto(`${BASE}/portfolio.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.pf-card-link', { timeout: 20000 });
  logPass('catalog page loads with product cards');

  const cardCount = await page.locator('.pf-card-link').count();
  if (cardCount >= 2) logPass(`${cardCount} products visible on first page`);
  else logIssue(`only ${cardCount} cards visible`);

  // Filter drawer
  await page.click('#filters-toggle');
  await sleep(300);
  const sidebarOpen = await page.locator('#sidebar.pf-sidebar--open').isVisible();
  if (sidebarOpen) logPass('filter drawer opens on mobile');
  else logIssue('filter drawer does not open');

  await page.selectOption('#filter-category', { index: 1 });
  await sleep(400);
  const afterFilter = await page.locator('.pf-card-link').count();
  if (afterFilter > 0) logPass('category filter works client-side');
  else logIssue('category filter shows no results');

  const apiAfterFilter = networkLog.filter((u) => u.includes('/portfolio/catalog')).length;
  if (apiAfterFilter === 0) logPass('zero catalog API calls after bootstrap (cache works)');
  else logIssue(`${apiAfterFilter} catalog API calls after filter – cache bypass?`);

  // Clear filters before search test
  if (!(await page.locator('#sidebar.pf-sidebar--open').isVisible())) {
    await page.click('#filters-toggle');
    await sleep(300);
  }
  await page.click('#clear-filters');
  await sleep(400);
  await page.click('#sidebar-close');
  await sleep(200);

  // Search – Bulgarian + English synonyms
  await page.fill('#search-input', 'протеин');
  await sleep(400);
  let searchCount = parseInt((await page.locator('#results-meta').textContent() || '').replace(/\D/g, ''), 10) || 0;
  if (searchCount > 100) logPass(`search протеин: ${searchCount} products`);
  else logIssue(`search протеин returned only ${searchCount} products`);

  await page.fill('#search-input', '');
  await sleep(200);
  await page.fill('#search-input', 'whey gold');
  await sleep(400);
  searchCount = parseInt((await page.locator('#results-meta').textContent() || '').replace(/\D/g, ''), 10) || 0;
  if (searchCount > 5) logPass(`multi-word search: ${searchCount} products`);
  else logIssue(`multi-word search returned only ${searchCount}`);

  // Product page
  await page.locator('.pf-card-link').first().click();
  await page.waitForSelector('#add-to-cart', { timeout: 15000 });
  const productTitle = await page.locator('.pf-product-info h1').textContent();
  if (productTitle?.length > 2) logPass(`product page: ${productTitle.slice(0, 40)}…`);
  else logIssue('product page missing title');

  const addBtn = page.locator('#add-to-cart');
  if (await addBtn.isEnabled()) {
    await addBtn.click();
    await page.waitForSelector('.pf-toast.success', { timeout: 5000 });
    logPass('add to cart shows success toast');
  } else {
    logIssue('add to cart disabled – no available variant');
  }

  const mobileBar = page.locator('.pf-mobile-cart-bar.pf-visible');
  if (await mobileBar.isVisible()) logPass('mobile cart bar visible after add');
  else logIssue('mobile cart bar not visible');

  // Checkout + promo
  await page.goto(`${BASE}/portfolio-checkout.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.pf-summary-item', { timeout: 10000 });
  logPass('checkout shows cart items');

  await page.fill('#promo-code-input-summary', 'PORTFOLIO10');
  await page.click('#apply-promo-btn-summary');
  await sleep(800);
  const discountVisible = await page.locator('#discount-row').isVisible();
  if (discountVisible) logPass('promo discount applied in checkout');
  else logIssue('promo discount row not visible');

  // Form validation
  await clickSubmit(page);
  await sleep(500);
  const invalidFields = await page.locator('.is-invalid').count();
  if (invalidFields >= 2) logPass('checkout validates required fields');
  else logIssue('checkout validation may be weak');

  await page.fill('#first-name', 'Тест');
  await page.fill('#last-name', 'Потребител');
  await page.fill('#phone', '+359888123456');
  await page.check('#policy-consent');
  await page.check('#terms');

  // Speedy office – mock hidden field for order test
  await page.evaluate(() => {
    document.getElementById('final-speedy-id').value = '12345';
    document.getElementById('speedy-selected-name').textContent = 'Тест офис';
    document.getElementById('speedy-selected-addr').textContent = 'София';
    document.getElementById('speedy-selected-info').style.display = 'block';
  });

  const [orderRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/portfolio/orders') && r.request().method() === 'POST'),
    clickSubmit(page)
  ]);
  let orderData = {};
  try {
    orderData = await orderRes.json();
  } catch {
    orderData = { error: `HTTP ${orderRes.status()}` };
  }
  if (orderRes.ok() || orderRes.status() === 201) {
    if (orderData.order?.id) {
      logPass(`order created: ${orderData.order.id}`);
      if (orderData.order.promo?.code === 'PORTFOLIO10') logPass('order includes promo code');
    } else {
      logPass(`order submitted (HTTP ${orderRes.status()})`);
    }
    await page.waitForURL(/portfolio-order-success/, { timeout: 10000 });
    if (page.url().includes('portfolio-order-success')) logPass('redirected to success page');
    else logIssue('no redirect to success page');
  } else {
    logIssue(`order failed: ${orderData.error || orderRes.status()}`);
  }

  // Desktop layout check
  console.log('\nDesktop UI:');
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dPage = await desktop.newPage();
  await dPage.goto(`${BASE}/portfolio.html`, { waitUntil: 'networkidle' });
  await dPage.waitForSelector('.pf-card-link', { timeout: 20000 });
  await sleep(1000);
  const filtersToggleHidden = !(await dPage.locator('#filters-toggle').isVisible());
  if (filtersToggleHidden) logPass('desktop shows sidebar (no filter toggle)');
  else logIssue('filter toggle still visible on desktop');

  const gridCols = await dPage.locator('.pf-card-link').count();
  if (gridCols >= 4) logPass(`desktop grid shows ${gridCols} cards`);
  else logIssue(`desktop grid sparse: ${gridCols} cards`);

  await dPage.screenshot({ path: '/opt/cursor/artifacts/portfolio-desktop.png', fullPage: false });
  await page.screenshot({ path: '/opt/cursor/artifacts/portfolio-mobile.png', fullPage: false });
  logPass('screenshots saved');

  await browser.close();
  server.kill();

  console.log(`\n=== Results: ${passes.length} passed, ${issues.length} issues ===\n`);
  if (issues.length) {
    issues.forEach((i) => console.log(`  - ${i}`));
    process.exitCode = 1;
  }
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
