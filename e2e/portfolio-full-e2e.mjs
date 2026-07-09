/**
 * Full Portfolio E2E: design QA + order flow + admin visibility.
 * Run: node e2e/portfolio-full-e2e.mjs
 */
import { spawn } from 'child_process';
import { chromium, devices } from 'playwright';
import { setTimeout as sleep } from 'timers/promises';
import { mkdirSync } from 'fs';

const PORT = Number(process.env.PORT || 8790);
const BASE = process.env.PORTFOLIO_URL || `http://127.0.0.1:${PORT}`;
const OUT = '/opt/cursor/artifacts/portfolio-full-e2e';
const LOCAL = !process.env.PORTFOLIO_URL;
mkdirSync(OUT, { recursive: true });

const passes = [];
const issues = [];

function ok(msg) { passes.push(msg); console.log(`  ✓ ${msg}`); }
function fail(msg) { issues.push(msg); console.log(`  ✗ ${msg}`); }

async function clickSubmit(page) {
  const mobileBtn = page.locator('#submit-btn-mobile');
  if (await mobileBtn.isVisible()) await mobileBtn.click();
  else await page.click('#submit-btn');
}

async function waitForServer(maxMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/portfolio/bootstrap`);
      if (res.ok) return true;
    } catch { /* retry */ }
    await sleep(400);
  }
  return false;
}

async function checkLayout(page, label) {
  const m = await page.evaluate(() => ({
    vw: document.documentElement.clientWidth,
    sw: document.documentElement.scrollWidth,
    mainW: document.querySelector('main')?.getBoundingClientRect().width ?? 0,
  }));
  const noScroll = m.sw <= m.vw + 1;
  if (noScroll) ok(`${label}: no horizontal scroll (${m.sw}px)`);
  else fail(`${label}: horizontal scroll ${m.sw}px > ${m.vw}px`);
  return noScroll;
}

async function runFlow(browser, deviceName, viewport) {
  const ctxOpts = deviceName
    ? { ...devices[deviceName], locale: 'bg-BG' }
    : { viewport, locale: 'bg-BG' };
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const tag = deviceName || `${viewport.width}px`;

  await page.goto(`${BASE}/portfolio.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.pf-product-card', { timeout: 20000 });
  await checkLayout(page, `[${tag}] catalog`);

  const cards = await page.locator('.pf-product-card').count();
  if (cards >= 2) ok(`[${tag}] ${cards} product cards`);
  else fail(`[${tag}] only ${cards} cards`);

  await page.locator('.pf-card-link').first().click();
  await page.waitForSelector('#add-to-cart', { timeout: 15000 });
  await checkLayout(page, `[${tag}] product`);

  if (await page.locator('#add-to-cart').isEnabled()) {
    await page.locator('#add-to-cart').click();
    await page.waitForSelector('.pf-toast', { timeout: 5000 });
    ok(`[${tag}] add to cart`);
  } else {
    fail(`[${tag}] add to cart disabled`);
    await ctx.close();
    return null;
  }

  await page.goto(`${BASE}/portfolio-checkout.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.pf-summary-item', { timeout: 10000 });
  await checkLayout(page, `[${tag}] checkout`);

  await page.fill('#first-name', 'E2E');
  await page.fill('#last-name', 'Тест');
  await page.fill('#phone', '+359888000111');
  await page.check('#policy-consent');
  await page.check('#terms');
  await page.evaluate(() => {
    document.getElementById('final-speedy-id').value = '99999';
    document.getElementById('speedy-selected-name').textContent = 'E2E офис';
    document.getElementById('speedy-selected-addr').textContent = 'София';
    document.getElementById('speedy-selected-info').style.display = 'block';
  });

  const [orderRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/portfolio/orders') && r.request().method() === 'POST'),
    clickSubmit(page),
  ]);

  await page.waitForURL(/portfolio-order-success/, { timeout: 15000 }).catch(() => {});

  let orderId = null;
  if (page.url().includes('success')) {
    ok(`[${tag}] success page`);
    orderId = await page.evaluate(() => {
      const fromUrl = new URLSearchParams(location.search).get('id');
      if (fromUrl) return fromUrl;
      try {
        return JSON.parse(sessionStorage.getItem('pf_last_order') || 'null')?.id || null;
      } catch { return null; }
    });
    if (orderId && (orderRes.ok() || orderRes.status() === 201)) {
      ok(`[${tag}] order created: ${orderId}`);
    } else {
      fail(`[${tag}] order submitted but no order id (HTTP ${orderRes.status()})`);
    }
  } else {
    fail(`[${tag}] order failed: HTTP ${orderRes.status()}, no success redirect`);
  }

  await ctx.close();
  return orderId || null;
}

let server;
if (LOCAL) {
  server = spawn('node', ['e2e/portfolio-dev-server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  if (!(await waitForServer())) {
    server.kill();
    throw new Error('Dev server did not start');
  }
}

console.log('\n=== Portfolio Full E2E ===');
console.log(`Target: ${BASE}\n`);

// API smoke
const bootstrap = await (await fetch(`${BASE}/portfolio/bootstrap`)).json();
if (bootstrap.meta?.index?.length > 0) ok(`bootstrap: ${bootstrap.meta.index.length} products in index`);
else fail('bootstrap empty');

// Admin visibility – order must appear in GET /portfolio/orders
let orderId = null;
const browser = await chromium.launch();
try {
  // Mobile layout + flow
  orderId = await runFlow(browser, 'iPhone 13');
  // Desktop layout check only (no duplicate order)
  if (orderId) {
    const dCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'bg-BG' });
    const dPage = await dCtx.newPage();
    await dPage.goto(`${BASE}/portfolio.html`, { waitUntil: 'networkidle' });
    await dPage.waitForSelector('.pf-product-card', { timeout: 20000 });
    await checkLayout(dPage, '[1440px] catalog');
    const n = await dPage.locator('.pf-product-card').count();
    if (n >= 4) ok(`[1440px] ${n} product cards`);
  }
} finally {
  await browser.close();
}

// Admin visibility – order must appear in GET /portfolio/orders
if (orderId) {
  const ordersRes = await fetch(`${BASE}/portfolio/orders`);
  const orders = await ordersRes.json();
  const found = Array.isArray(orders) && orders.some((o) => o.id === orderId);
  if (found) ok(`admin API lists order ${orderId}`);
  else fail(`order ${orderId} NOT found in GET /portfolio/orders`);
} else {
  fail('no order id to verify in admin');
}

if (LOCAL && server) server.kill();

console.log(`\n=== Summary: ${passes.length} passed, ${issues.length} failed ===`);
if (issues.length) {
  issues.forEach((i) => console.log('  -', i));
  process.exit(1);
}
