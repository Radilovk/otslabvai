#!/usr/bin/env node
/**
 * Playwright production smoke — real browser checks per storefront domain.
 * Does not submit orders or admin login (read-only user/admin surface checks).
 *
 * Usage: node e2e/platform-production-smoke.mjs
 */
import { chromium } from 'playwright';
import {
  PRODUCTION_PAGE_CASES,
  SITE_HOSTS,
} from '../hostname-routing-contract.js';

const TIMEOUT = 45000;
const fails = [];
const passes = [];

/** @param {string} msg */
function pass(msg) { passes.push(msg); console.log(`  ✓ ${msg}`); }
/** @param {string} msg */
function fail(msg) { fails.push(msg); console.error(`  ✗ ${msg}`); }

/** @type {Array<{ site: string, host: string, homeTitle: RegExp, cartHref: RegExp, css: RegExp, checkoutTitle: RegExp }>} */
const STOREFRONTS = [
  {
    site: 'main',
    host: SITE_HOSTS.main[0],
    homeTitle: /ДА ОТСЛАБНА/i,
    cartHref: /checkout\.html/,
    css: /index\.css/,
    checkoutTitle: /Поръчка.*ДА ОТСЛАБНА/i,
  },
  {
    site: 'life',
    host: SITE_HOSTS.life[0],
    homeTitle: /Life Protocols/i,
    cartHref: /life-checkout\.html/,
    css: /life\.css/,
    checkoutTitle: /Поръчка.*Life Protocols/i,
  },
  {
    site: 'portfolio',
    host: SITE_HOSTS.portfolio[0],
    homeTitle: /BIOCODE/i,
    cartHref: /portfolio-checkout\.html/,
    css: /portfolio\.css/,
    checkoutTitle: /Поръчка.*BIOCODE/i,
  },
];

async function main() {
  const browser = await chromium.launch({ headless: true });

  for (const store of STOREFRONTS) {
    console.log(`\n=== ${store.site} (${store.host}) ===`);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) PlatformProductionSmoke/1.0',
    });
    const page = await context.newPage();

    const homeUrl = `https://${store.host}/`;
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const homeTitle = await page.title();
    if (store.homeTitle.test(homeTitle)) pass(`home title: ${homeTitle}`);
    else fail(`home title mismatch: ${homeTitle}`);

    const cssHref = await page.locator(`link[rel="stylesheet"][href*=".css"]`).evaluateAll((els, pattern) => {
      const re = new RegExp(pattern);
      const hit = els.find((el) => re.test(el.getAttribute('href') || ''));
      return hit ? hit.getAttribute('href') : '';
    }, store.css.source).catch(() => '');
    if (store.css.test(cssHref || '')) pass(`home stylesheet: ${cssHref}`);
    else fail(`home stylesheet mismatch: ${cssHref}`);

    const cartLink = page.locator('a[href*="checkout"]').first();
    if (await cartLink.count()) {
      const href = await cartLink.getAttribute('href');
      if (store.cartHref.test(href || '')) pass(`cart link: ${href}`);
      else fail(`cart link mismatch: ${href}`);
    } else {
      fail('cart link not found on homepage');
    }

    const checkoutPath = store.site === 'life' ? '/life-checkout.html' : '/checkout.html';
    const checkoutUrl = `https://${store.host}${checkoutPath}`;
    await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForSelector('#checkout-form', { timeout: TIMEOUT });
    const checkoutTitle = await page.title();
    const checkoutHeading = (await page.locator('#checkout-form h1, #checkout-form h2').first().textContent().catch(() => ''))?.trim() || '';
    const checkoutOk = store.checkoutTitle.test(checkoutTitle)
      || /Данни|контакт|доставка/i.test(checkoutHeading);
    if (checkoutOk) pass(`checkout page: ${checkoutHeading || checkoutTitle}`);
    else fail(`checkout mismatch (title: ${checkoutTitle}, heading: ${checkoutHeading})`);

    await context.close();
  }

  console.log('\n=== Shared admin surface ===');
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  for (const site of ['main', 'life', 'portfolio']) {
    const host = SITE_HOSTS[site][0];
    await adminPage.goto(`https://${host}/admin.html`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const title = await adminPage.title();
    if (/Админ Панел/i.test(title)) pass(`${host}/admin.html loads admin shell`);
    else fail(`${host}/admin.html title: ${title}`);
    const loginVisible = await adminPage.locator('#login-section, #admin-password, input[type="password"]').first().isVisible().catch(() => false);
    if (loginVisible) pass(`${host}/admin.html shows login UI`);
    else fail(`${host}/admin.html login UI not visible`);
  }
  await adminContext.close();

  console.log('\n=== Cross-domain isolation (404 gaps) ===');
  const isoPage = await browser.newPage();
  const gapCases = PRODUCTION_PAGE_CASES.filter((c) => c.status === 404);
  for (const spec of gapCases) {
    const host = SITE_HOSTS[spec.site][0];
    const response = await isoPage.goto(`https://${host}${spec.path}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const status = response?.status() ?? 0;
    const title = await isoPage.title();
    const content = await isoPage.content();
    const leaked = (spec.titleExcludes || []).some((needle) => title.includes(needle) || content.includes(needle));
    if (status === 404 && !leaked) pass(`${host}${spec.path} → 404 without main leak`);
    else if (status === 404 && leaked) fail(`${host}${spec.path} → 404 but leaked main content`);
    else if (!leaked) pass(`${host}${spec.path} → HTTP ${status} without main leak`);
    else fail(`${host}${spec.path} → HTTP ${status} leaked: ${title}`);
  }
  await isoPage.close();

  await browser.close();

  console.log(`\nPassed: ${passes.length}, Failed: ${fails.length}`);
  if (fails.length) {
    process.exit(1);
  }
  console.log('Platform production browser smoke passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
