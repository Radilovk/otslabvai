/**
 * User journey test + visual QA for Portfolio redesign.
 * Run: node e2e/portfolio-user-test.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8790';
const OUT = '/opt/cursor/artifacts/portfolio-qa';
mkdirSync(OUT, { recursive: true });

const issues = [];
const passes = [];

function log(msg, ok = true) {
  (ok ? passes : issues).push(msg);
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
}

async function checkImageOverflow(page, selector, label) {
  const result = await page.evaluate((sel) => {
    const imgs = document.querySelectorAll(sel);
    const overflows = [];
    imgs.forEach((img, i) => {
      const rect = img.getBoundingClientRect();
      const parent = img.parentElement?.getBoundingClientRect();
      if (!parent) return;
      if (rect.width > parent.width + 2) {
        overflows.push({ i, imgW: Math.round(rect.width), parentW: Math.round(parent.width) });
      }
    });
    return { total: imgs.length, overflows };
  }, selector);
  if (result.overflows.length) {
    log(`${label}: ${result.overflows.length}/${result.total} images overflow container`, false);
    return false;
  }
  log(`${label}: ${result.total} images fit container`);
  return true;
}

async function checkNumberFont(page, selector, label) {
  const font = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return getComputedStyle(el).fontFamily;
  }, selector);
  if (!font) { log(`${label}: element not found`, false); return; }
  const ok = font.toLowerCase().includes('jakarta') || font.toLowerCase().includes('system-ui');
  log(`${label} font: ${font.split(',')[0].replace(/"/g, '')}`, ok);
}

async function runViewport(browser, name, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const dir = `${OUT}/${name}`;

  // 1. Catalog
  await page.goto(`${BASE}/portfolio.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.pf-product-card', { timeout: 15000 });
  await page.screenshot({ path: `${dir}-catalog.png`, fullPage: false });

  const cards = await page.locator('.pf-product-card').count();
  log(`[${name}] Catalog shows ${cards} product cards`, cards > 0);

  await checkImageOverflow(page, '.pf-card-image img', `[${name}] Card images`);
  await checkNumberFont(page, '.pf-card-price', `[${name}] Price font`);

  // 2. Search
  await page.fill('#search-input', 'protein');
  await page.waitForTimeout(600);
  const meta = await page.locator('#results-meta').textContent();
  log(`[${name}] Search works: "${meta?.trim()}"`, !!meta && !meta.includes('Зареждане'));

  // 3. Mobile filters
  if (width < 900) {
    await page.click('#filters-toggle');
    await page.waitForSelector('.pf-sidebar.pf-sidebar--open');
    const toggleHidden = await page.evaluate(() =>
      document.getElementById('filters-toggle')?.classList.contains('pf-filters-toggle--hidden')
    );
    log(`[${name}] Filter toggle hidden when open`, toggleHidden);
    await page.screenshot({ path: `${dir}-filters.png` });
    log(`[${name}] Filter drawer opens`, true);
    await page.click('#sidebar-close');
  }

  // 4. Product page
  await page.locator('.pf-card-link').first().click();
  await page.waitForSelector('.pf-product-info h1', { timeout: 10000 });
  await page.screenshot({ path: `${dir}-product.png`, fullPage: false });

  await checkImageOverflow(page, '#product-image', `[${name}] Product main image`);
  await checkNumberFont(page, '.pf-product-price', `[${name}] Product price font`);

  // 5. Add to cart
  const addBtn = page.locator('#add-to-cart-sticky, #add-to-cart').first();
  if (await addBtn.isEnabled()) {
    await addBtn.click();
    await page.waitForTimeout(500);
    const toast = await page.locator('.pf-toast').count();
    log(`[${name}] Add to cart shows toast`, toast > 0);
    const buyBar = await page.locator('#add-to-cart-sticky.pf-visible').isVisible();
    if (width < 900) log(`[${name}] Product floating add button visible`, buyBar);
  }

  // 6. Checkout
  await page.goto(`${BASE}/portfolio-checkout.html`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${dir}-checkout.png`, fullPage: false });

  const formVisible = await page.locator('#checkout-form').isVisible();
  log(`[${name}] Checkout form visible`, formVisible);

  if (width < 900) {
    const floatingSubmit = await page.locator('#submit-btn-mobile.pf-visible').isVisible();
    log(`[${name}] Floating checkout submit visible`, floatingSubmit);
  }

  await page.close();
}

const browser = await chromium.launch();
try {
  await runViewport(browser, 'mobile', 375, 812);
  await runViewport(browser, 'tablet', 768, 1024);
  await runViewport(browser, 'desktop', 1440, 900);

  console.log('\n=== QA Summary ===');
  console.log(`Passed: ${passes.length}`);
  console.log(`Issues: ${issues.length}`);
  if (issues.length) {
    issues.forEach((i) => console.log('  -', i));
    process.exit(1);
  }
} finally {
  await browser.close();
}
