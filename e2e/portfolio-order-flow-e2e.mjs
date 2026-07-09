/**
 * End-to-end: client submit → admin list/detail → status update → approve (mock F1).
 * MOCK_FITNESS1 is enabled by portfolio-dev-server by default — no real B2B requests.
 */
import { spawn } from 'child_process';
import { chromium } from 'playwright';
import { setTimeout as sleep } from 'timers/promises';
import { seedPortfolioFixture } from './seed-portfolio-fixture.mjs';

const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;

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

async function clickSubmit(page) {
  const mobileBtn = page.locator('#submit-btn-mobile');
  if (await mobileBtn.isVisible()) await mobileBtn.click();
  else await page.click('#submit-btn');
}

async function fillCheckout(page) {
  await page.fill('#first-name', 'E2E');
  await page.fill('#last-name', 'Order Flow');
  await page.fill('#phone', '+359888123456');
  await page.fill('#email', 'orderflow@example.com');
  await page.check('#policy-consent');
  await page.check('#terms');
  await page.evaluate(() => {
    document.getElementById('final-speedy-id').value = '99999';
    document.getElementById('speedy-selected-name').textContent = 'E2E офис';
    document.getElementById('speedy-selected-addr').textContent = 'София, ул. Тест 1';
    document.getElementById('speedy-selected-info').style.display = 'block';
  });
}

async function getOrderFromList(request, orderId) {
  const orders = await (await request.get(`${BASE}/portfolio/orders`)).json();
  return orders.find((o) => o.id === orderId);
}

async function run() {
  seedPortfolioFixture();

  const server = spawn('node', ['e2e/portfolio-dev-server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), MOCK_FITNESS1: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  if (!(await waitForServer())) {
    server.kill();
    throw new Error('Dev server did not start');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let orderId = '';

  try {
    await page.goto(`${BASE}/portfolio.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.pf-card-link', { timeout: 20000 });
    await page.locator('.pf-card-link').first().click();
    await page.waitForSelector('#add-to-cart, #add-to-cart-sticky', { timeout: 15000 });
    const addBtn = page.locator('#add-to-cart-sticky, #add-to-cart').first();
    if (await addBtn.isVisible()) await addBtn.click();
    else await page.locator('#add-to-cart').click();
    await page.waitForSelector('.pf-toast.success', { timeout: 5000 });
    await sleep(300);
    await page.goto(`${BASE}/portfolio-checkout.html`, { waitUntil: 'networkidle' });
    await fillCheckout(page);

    const [orderRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/portfolio/orders') && r.request().method() === 'POST'),
      clickSubmit(page),
    ]);

    await page.waitForURL(/portfolio-order-success/, { timeout: 15000 });
    orderId = new URL(page.url()).searchParams.get('id') || '';
    if (!orderId) throw new Error('Missing order id in success URL');
    if (!orderRes.ok() && orderRes.status() !== 201) {
      throw new Error(`Order POST failed: HTTP ${orderRes.status()}`);
    }

    const found = await getOrderFromList(page.request, orderId);
    if (!found) throw new Error(`Order ${orderId} not in GET /portfolio/orders`);
    if (found.customer?.firstName !== 'E2E' || found.customer?.lastName !== 'Order Flow') {
      throw new Error('Order customer mismatch');
    }
    if (!found.products?.length) throw new Error('Order has no products');

    await page.addInitScript(() => {
      localStorage.setItem('adminProject', 'portfolio');
      localStorage.setItem('adminActiveTab', 'tab-portfolio-orders');
    });
    await page.goto(`${BASE}/admin.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#project-selector', { timeout: 10000 });
    await page.waitForSelector('[data-tab="tab-portfolio-orders"]', { state: 'visible', timeout: 10000 });
    await page.click('[data-tab="tab-portfolio-orders"]');
    await page.waitForSelector('#tab-portfolio-orders.active', { timeout: 5000 });
    await page.waitForSelector(`#portfolio-orders-table-body tr[data-order-id="${orderId}"]`, { timeout: 10000 });

    await page.click(`#portfolio-orders-table-body tr[data-order-id="${orderId}"]`);
    await page.waitForSelector('#modal-container.show', { timeout: 5000 });

    const modalText = await page.locator('#modal-body').innerText();
    if (!modalText.includes('E2E Order Flow')) throw new Error('Detail modal missing customer');
    if (!modalText.includes('orderflow@example.com')) throw new Error('Detail modal missing email');

    await page.fill('#portfolio-order-admin-note', 'E2E admin note');
    await page.click('#portfolio-save-note-btn');
    await sleep(600);

    const withNote = await getOrderFromList(page.request, orderId);
    if (withNote?.admin_note !== 'E2E admin note') throw new Error('Admin note not saved');

    await page.click('#close-modal-btn');
    await page.waitForSelector('#modal-container.show', { state: 'hidden', timeout: 3000 });

    await page.selectOption(`select.portfolio-order-status[data-id="${orderId}"]`, 'Обработва се');
    await sleep(600);

    const processing = await getOrderFromList(page.request, orderId);
    if (processing?.status !== 'Обработва се') throw new Error('Status not updated to Обработва се');

    page.once('dialog', (d) => d.accept());
    await page.click(`button.portfolio-approve-btn[data-id="${orderId}"]`);
    await sleep(1200);

    const final = await getOrderFromList(page.request, orderId);
    if (final?.status !== 'Изпратена към Fitness1') {
      throw new Error(`Expected Изпратена към Fitness1, got ${final?.status}`);
    }
    if (!final?.fitness1_order?.id) throw new Error('Expected mock Fitness1 order id');

    console.log('Portfolio order flow E2E: all checks passed (order', orderId, ', F1 #', final.fitness1_order.id, ')');
  } finally {
    await browser.close();
    server.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
