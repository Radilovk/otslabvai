/**
 * Verifies checkout pages render cart items with thumbnails and product links.
 */
import { spawn } from 'child_process';
import { chromium } from 'playwright';
import { setTimeout as sleep } from 'timers/promises';
import { mkdirSync } from 'fs';
import { join } from 'path';

const PORT = Number(process.env.CHECKOUT_TEST_PORT || 8793);
const BASE = `http://127.0.0.1:${PORT}`;
const ARTIFACTS = '/opt/cursor/artifacts';

async function waitForServer(maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/checkout.html`);
      if (res.ok) return true;
    } catch { /* retry */ }
    await sleep(300);
  }
  return false;
}

async function assertCheckout(page, { cartKey, cartItems, path, productLinkPattern, label }) {
  await page.goto(`${BASE}/${path}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ cartKey, cartItems }) => {
    localStorage.setItem(cartKey, JSON.stringify(cartItems));
  }, { cartKey, cartItems });
  await page.reload({ waitUntil: 'networkidle' });

  const items = page.locator('#product-list .pf-summary-item, #product-list .product-item');
  await items.first().waitFor({ timeout: 10000 });
  const count = await items.count();
  if (count !== cartItems.length) {
    throw new Error(`${label}: expected ${cartItems.length} cart rows, got ${count}`);
  }

  const subtotal = await page.locator('#summary-subtotal').textContent();
  if (!subtotal || subtotal.includes('0.00')) {
    throw new Error(`${label}: subtotal not updated (${subtotal})`);
  }

  const thumb = page.locator('#product-list .pf-summary-img, #product-list .cart-item-thumb').first();
  await thumb.waitFor({ timeout: 5000 });

  const link = page.locator(`#product-list a[href*="${productLinkPattern}"]`).first();
  await link.waitFor({ timeout: 5000 });
  const href = await link.getAttribute('href');
  if (!href) throw new Error(`${label}: missing product link`);

  await page.screenshot({ path: join(ARTIFACTS, `checkout-${label}.png`), fullPage: true });
  console.log(`OK ${label}: ${count} items, subtotal ${subtotal}, link ${href}`);
}

async function run() {
  mkdirSync(ARTIFACTS, { recursive: true });
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  if (!(await waitForServer())) {
    server.kill();
    throw new Error('Static server did not start');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  try {
    await assertCheckout(page, {
      label: 'portfolio',
      path: 'portfolio-checkout.html',
      cartKey: 'portfolioCart',
      productLinkPattern: 'portfolio-product.html',
      cartItems: [{
        sku_id: '101',
        group_id: '1001',
        id: '101',
        name: 'Whey Protein 80 – 1kg',
        price: 29.9,
        quantity: 2,
        image: 'https://via.placeholder.com/80'
      }]
    });

    await assertCheckout(page, {
      label: 'life',
      path: 'life-checkout.html',
      cartKey: 'lifeCart',
      productLinkPattern: 'life-product.html',
      cartItems: [{
        id: 'prod-1',
        name: 'Omega 3 Test',
        price: 18.5,
        quantity: 1,
        image: 'https://via.placeholder.com/80'
      }]
    });

    await assertCheckout(page, {
      label: 'daotslabna',
      path: 'checkout.html',
      cartKey: 'cart',
      productLinkPattern: 'product.html',
      cartItems: [{
        id: 'prod-main-1',
        name: 'Fat Burner Test',
        price: 24.9,
        quantity: 3,
        image: 'https://via.placeholder.com/80'
      }]
    });

    console.log('All checkout cart render checks passed.');
  } finally {
    await browser.close();
    server.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
