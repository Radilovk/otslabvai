/**
 * Пълен поток: резултат от протокол → количка → checkout поръчка →
 * запис на lifeMyProtocol → life-my-protocol.html → динамични CTA на life.html.
 */
import express from 'express';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync } from 'fs';

const PORT = 8080;
const BASE = `http://localhost:${PORT}`;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lifeContent = JSON.parse(readFileSync(path.join(ROOT, 'backend/life_page_content.json'), 'utf8'));

const issues = [];
const passes = [];
const check = (cond, msg) => { (cond ? passes : issues).push(msg); console.log(`  ${cond ? '✓' : '✗'} ${msg}`); };

// Мок протоколен резултат (както идва от /life-protocol-submit)
const mockResult = {
  sessionId: 'test-session-001',
  email: 'test@test.bg',
  analysis: 'Вашият профил показва нужда от митохондриална подкрепа и когнитивна оптимизация.',
  recommended_tier: 'optimal',
  tiers: {
    basic: { name: 'Базов протокол', tagline: 'Основите', products: [
      { product_id: 'prod-pf-27301', name: 'Apigenin 50 mg', brand: 'Double Wood', price_eur: 35.9, dose: '1 капсула', timing: 'вечер', why_for_you: 'За сън и стрес', image_url: 'https://fitness1.bg/products/v3/p31946/test.jpg' }
    ], monthly_total_eur: 35.9 },
    optimal: { name: 'Оптимален протокол', tagline: 'Балансиран стак', products: [
      { product_id: 'prod-pf-27301', name: 'Apigenin 50 mg', brand: 'Double Wood', price_eur: 35.9, dose: '1 капсула', timing: 'вечер', why_for_you: 'За сън', image_url: '' },
      { product_id: 'prod-pf-40676', name: '5-HTP 100 mg', brand: 'Osavi', price_eur: 23.9, dose: '1 капсула', timing: 'сутрин', why_for_you: 'Настроение', image_url: '' }
    ], monthly_total_eur: 59.8 },
    premium: { name: 'Премиум протокол', tagline: 'Максимална подкрепа', products: [], monthly_total_eur: 99 }
  },
  protocol_schedule: { morning: ['5-HTP — 1 капсула'], midday: [], evening: ['Apigenin — 1 капсула'], weekly_notes: 'Пийте достатъчно вода.' },
  lifestyle_tips: ['Спете 7-8 часа', 'Движете се ежедневно'],
  disclaimer: 'Не замества лекарска консултация.'
};

const capturedOrders = [];
const app = express();
app.use(express.json());
app.get('/backend/life_page_content.json', (req, res) => res.json(lifeContent));
app.post('/backend/orders', (req, res) => { capturedOrders.push(req.body); res.json({ success: true, id: 'order-777' }); });
app.post('/backend/validate-promo', (req, res) => res.json({ valid: false }));
app.use(express.static(ROOT));
const server = await new Promise((r) => { const s = app.listen(PORT, () => r(s)); });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (err) => check(false, `JS грешка: ${err.message}`));

console.log('\n=== Протоколен поток E2E ===\n');

// 1. Резултатна страница с мок резултат
console.log('— 1. Резултат от въпросника —');
await page.goto(`${BASE}/life.html`);
await page.evaluate((data) => {
  sessionStorage.setItem('lifeProtocolResult', JSON.stringify(data));
}, mockResult);
await page.goto(`${BASE}/life-protocol-result.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const tiers = await page.$$('.lpr-tier');
check(tiers.length === 3, `Резултатът показва ${tiers.length}/3 стака`);

// 2. Поръчване на стак
console.log('— 2. Добавяне на стак в количката —');
await page.click('[data-action="add-tier"][data-tier="optimal"]');
await page.waitForTimeout(1200);
check(page.url().includes('life-checkout.html'), 'Пренасочен към checkout');

const pendingState = await page.evaluate(() => ({
  pending: JSON.parse(localStorage.getItem('lifeProtocolPending') || 'null'),
  persistent: !!localStorage.getItem('lifeProtocolResultPersistent'),
  cart: JSON.parse(localStorage.getItem('lifeCart') || '[]').length
}));
check(pendingState.pending?.tierKey === 'optimal', `lifeProtocolPending записан (tier: ${pendingState.pending?.tierKey})`);
check(pendingState.persistent, 'Резултатът е персистиран в localStorage');
check(pendingState.cart === 2, `Количката има ${pendingState.cart}/2 продукта`);

// 3. Checkout поръчка
console.log('— 3. Checkout —');
await page.waitForSelector('#checkout-form', { timeout: 5000 });
await page.fill('#first-name', 'Иван');
await page.fill('#last-name', 'Тестов');
await page.fill('#phone', '0888123456');
await page.fill('#email', 'ivan@test.bg');
await page.check('#policy-consent');
await page.check('#terms');
// доставка до адрес
await page.check('#delivery-address');
await page.waitForTimeout(300);
await page.fill('#address', 'ул. Тестова 1');
await page.fill('#city', 'София');
await page.fill('#postcode', '1000');

await page.click('.btn-submit');
await page.waitForSelector('#success-modal.active', { timeout: 10000 });
await page.waitForTimeout(500);

check(capturedOrders.length === 1, `Поръчката е изпратена (${capturedOrders.length})`);

const myProtocol = await page.evaluate(() => JSON.parse(localStorage.getItem('lifeMyProtocol') || 'null'));
check(!!myProtocol?.purchased, 'lifeMyProtocol е записан след поръчка');
check(myProtocol?.tierKey === 'optimal', `Правилният tier е записан (${myProtocol?.tierKey})`);
check(myProtocol?.orderId === 'order-777', `Order ID е записан (${myProtocol?.orderId})`);

// 4. Моят протокол страница
console.log('— 4. Страница „Моят протокол" —');
await page.goto(`${BASE}/life-my-protocol.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const mpState = await page.evaluate(() => ({
  title: document.getElementById('lmp-title')?.textContent,
  slots: [...document.querySelectorAll('.lmp-slot h3')].map(e => e.textContent),
  products: document.querySelectorAll('.lmp-product').length,
  tips: document.querySelectorAll('.lmp-tips li').length,
  chips: [...document.querySelectorAll('.lmp-meta-chip')].map(e => e.textContent)
}));
check(mpState.title === 'Оптимален протокол', `Заглавие: "${mpState.title}"`);
check(mpState.slots.length >= 2, `Графикът показва ${mpState.slots.length} времеви слота (${mpState.slots.join(', ')})`);
check(mpState.products === 2, `Продуктите в стака: ${mpState.products}/2`);
check(mpState.tips === 2, `Lifestyle съвети: ${mpState.tips}/2`);
console.log(`    Чипове: ${mpState.chips.join(' | ')}`);
await page.screenshot({ path: '/tmp/life-my-protocol.png', fullPage: true });

// 5. Динамичен hero CTA на life.html
console.log('— 5. Динамични CTA след покупка —');
await page.goto(`${BASE}/life.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const ctaState = await page.evaluate(() => ({
  heroCta: document.querySelector('.btn-hero-primary')?.textContent?.trim(),
  heroHref: document.querySelector('.btn-hero-primary')?.getAttribute('href'),
  premium: document.querySelector('.btn-premium')?.textContent?.trim(),
  premiumHref: document.querySelector('.btn-premium')?.getAttribute('href')
}));
check(ctaState.heroCta === 'Моят протокол', `Hero CTA: "${ctaState.heroCta}"`);
check(ctaState.heroHref === 'life-my-protocol.html', `Hero CTA href: ${ctaState.heroHref}`);
check(ctaState.premium === 'Създай нов протокол', `btn-premium: "${ctaState.premium}"`);
check((ctaState.premiumHref || '').includes('replace=1'), `btn-premium href: ${ctaState.premiumHref}`);

await browser.close();
server.close();

console.log(`\n=== Резултат: ${passes.length} ✓ / ${issues.length} ✗ ===\n`);
if (issues.length) { issues.forEach(i => console.log(` ✗ ${i}`)); process.exitCode = 1; }
