/**
 * Реален тест: life.html с истинското backend/life_page_content.json.
 * Проверява рендиране на hero, категории, hex карти, футър, бутони.
 * Run: CHROMIUM_PATH=<path> node e2e/life-real-content-test.mjs
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
const logPass = (msg) => { passes.push(msg); console.log(`  ✓ ${msg}`); };
const logIssue = (msg) => { issues.push(msg); console.log(`  ✗ ${msg}`); };
const check = (cond, msg) => (cond ? logPass(msg) : logIssue(msg));

function startServer() {
  const app = express();
  app.use(express.json());
  app.get('/backend/life_page_content.json', (req, res) => res.json(lifeContent));
  app.use(express.static(ROOT));
  return new Promise((resolve) => {
    const server = app.listen(PORT, () => resolve(server));
  });
}

async function run() {
  console.log('\n=== Life: реално съдържание ===\n');
  const server = await startServer();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', (err) => logIssue(`JS грешка: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`  [console.error] ${msg.text().slice(0, 200)}`);
  });

  try {
    await page.goto(`${BASE}/life.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Hero
    const heroH1 = await page.$eval('.hero-content h1', el => el.textContent).catch(() => null);
    check(!!heroH1, `Hero заглавие: "${(heroH1 || 'ЛИПСВА').slice(0, 50)}"`);

    const heroCta = await page.$eval('.btn-hero-primary', el => el.textContent.trim()).catch(() => null);
    check(!!heroCta, `Hero CTA: "${heroCta || 'ЛИПСВА'}"`);

    // Hex cards
    const hexCards = await page.$$eval('.hex-feature-card', els => els.map(e => ({
      title: e.querySelector('h3')?.textContent,
      href: e.getAttribute('href') || e.querySelector('a')?.getAttribute('href')
    }))).catch(() => []);
    check(hexCards.length === 3, `Hex карти: ${hexCards.length}/3`);
    hexCards.forEach(c => console.log(`    → ${c.title}: ${c.href}`));

    // Categories
    const categories = await page.$$eval('.category-section', els => els.map(e => ({
      id: e.id,
      title: e.querySelector('.category-title')?.textContent?.trim(),
      products: e.querySelectorAll('.product-card').length
    }))).catch(() => []);
    console.log(`  Категории на страницата: ${categories.length}`);
    categories.forEach(c => console.log(`    → #${c.id} "${c.title}": ${c.products} продукта`));
    check(categories.length >= 3, `Категориите се извеждат (${categories.length})`);

    // Every hex card target exists
    for (const c of hexCards) {
      if (c.href?.startsWith('#')) {
        const exists = await page.$(`${c.href.replace('#', '#')}`) !== null;
        check(exists, `Hex link ${c.href} сочи към съществуваща секция`);
      }
    }

    const productCards = await page.$$('.product-card');
    check(productCards.length > 0, `Продуктови карти общо: ${productCards.length}`);

    // Footer
    const footerLogo = await page.$eval('.footer-logo-container img', el => el.src).catch(() => null);
    check(!!footerLogo, `Футър лого: ${footerLogo ? 'да' : 'ЛИПСВА'}`);

    const footerLinks = await page.$$eval('.footer-column ul a', els => els.map(e => e.getAttribute('href'))).catch(() => []);
    console.log(`  Футър линкове: ${footerLinks.join(', ')}`);

    // btn-premium
    const btnPremium = await page.$eval('.btn-premium', el => ({ text: el.textContent.trim(), href: el.getAttribute('href') })).catch(() => null);
    check(!!btnPremium, `btn-premium: ${btnPremium ? `"${btnPremium.text}" → ${btnPremium.href}` : 'ЛИПСВА'}`);

    // Screenshot
    await page.screenshot({ path: '/tmp/life-real-full.png', fullPage: true });
    console.log('  Screenshot: /tmp/life-real-full.png');

    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: '/tmp/life-real-mobile.png', fullPage: false });
    const hasHorizScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    check(!hasHorizScroll, 'Мобилен: няма хоризонтален скрол');

  } catch (e) {
    logIssue(`Тестът гръмна: ${e.message}`);
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n=== Резултат: ${passes.length} ✓ / ${issues.length} ✗ ===\n`);
  if (issues.length) process.exitCode = 1;
}

run();
