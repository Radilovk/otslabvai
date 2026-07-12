/**
 * E2E симулация на Life Protocol Quiz:
 * - engine + mock AI през локален stub сървър
 * - Playwright поток: въпросник → резултат → количка → checkout email prefill
 *
 * Run: node e2e/life-protocol-e2e.mjs
 */
import express from 'express';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import {
  prepareProtocolSubmission,
  buildMockProtocolResponse,
  filterEligibleProducts,
  extractProductsFromContent,
} from '../protocol-quiz-engine.js';
import { getDefaultLifeProtocolSettings } from '../protocol-quiz-settings.js';

const PORT = 8081;
const BASE = `http://localhost:${PORT}`;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const issues = [];
const passes = [];
const logPass = (msg) => { passes.push(msg); console.log(`  ✓ ${msg}`); };
const logIssue = (msg) => { issues.push(msg); console.log(`  ✗ ${msg}`); };
const check = (cond, msg) => (cond ? logPass(msg) : logIssue(msg));

const lifeContentPath = path.join(ROOT, 'backend/life_page_content.json');
const lifeContent = JSON.parse(fs.readFileSync(lifeContentPath, 'utf8'));

const mockEnv = {
  PAGE_CONTENT: {
    async get(key) {
      if (key === 'life_protocol_settings') return null;
      if (key === 'life_page_content') return JSON.stringify(lifeContent);
      if (key === 'static_backend_life_page_content.json') return JSON.stringify(lifeContent);
      if (key === 'life_protocol_leads') return '[]';
      if (key === 'life_protocol_results') return '[]';
      return null;
    },
    async put() {},
  },
};

const deps = {
  loadProjectContent: async () => lifeContent,
  loadGroupsByIds: async () => new Map(),
};

const SAMPLE_ANSWERS = {
  sex: 'female',
  age_band: '45-54',
  height_cm: 168,
  weight_kg: 65,
  priority: 'skin',
  conditions: ['none'],
  medications: ['none'],
  activity: 'rare',
  diet: 'omnivore',
  symptoms: ['fatigue'],
  allergies: ['none'],
  pregnancy: 'no',
  sun_exposure: 'moderate',
  email: 'e2e-test@life-protocol.local',
  name: 'E2E Тест',
};

function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/backend/life-protocol/settings', (req, res) => {
    res.json(getDefaultLifeProtocolSettings());
  });

  app.post('/backend/life-protocol/simulate', async (req, res) => {
    try {
      const profile = req.body?.profile || SAMPLE_ANSWERS;
      const prepared = await prepareProtocolSubmission(mockEnv, profile, deps);
      const recommendation = buildMockProtocolResponse(prepared.candidates, prepared.profile);
      res.json({
        success: true,
        mock: true,
        catalog_stats: prepared.payload.catalog_stats,
        candidates_count: prepared.candidates.length,
        recommendation,
      });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  });

  const submitHandler = async (req, res) => {
    try {
      const prepared = await prepareProtocolSubmission(mockEnv, req.body, deps);
      const recommendation = buildMockProtocolResponse(prepared.candidates, prepared.profile);
      res.json({
        sessionId: `e2e-${Date.now()}`,
        email: prepared.profile.email,
        ...recommendation,
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  };

  app.post('/life-protocol-submit', submitHandler);
  app.post('/backend/life-protocol-submit', submitHandler);

  app.use('/backend', express.static(ROOT));
  app.use(express.static(ROOT));

  return new Promise((resolve) => {
    const server = app.listen(PORT, () => resolve(server));
  });
}

async function runEngineChecks() {
  console.log('— Engine unit checks (реални продукти от life_page_content.json) —');
  const all = extractProductsFromContent(lifeContent);
  const eligible = filterEligibleProducts(all);
  check(all.length >= 10, `Каталог: ${all.length} продукта общо`);
  check(eligible.length >= 3, `Налични орални: ${eligible.length} (минимум 3 за протокол)`);

  const prepared = await prepareProtocolSubmission(mockEnv, SAMPLE_ANSWERS, deps);
  check(prepared.candidates.length >= 3, `Кандидат-пул: ${prepared.candidates.length} продукта`);
  check(prepared.payload.catalog_stats.eligible_available === eligible.length, 'catalog_stats съвпадат');

  const mock = buildMockProtocolResponse(prepared.candidates, prepared.profile);
  check(mock.tiers?.basic?.products?.length >= 1, 'Mock basic tier има продукти');
  check(mock.tiers?.optimal?.products?.length >= 1, 'Mock optimal tier има продукти');
  check(mock.tiers?.premium?.products?.length >= 1, 'Mock premium tier има продукти');
  check(mock.tiers.optimal.monthly_total_eur >= mock.tiers.basic.monthly_total_eur, 'Optimal >= Basic по цена (EUR)');
  check((mock.tiers.premium.benefits?.length || 0) >= (mock.tiers.basic.benefits?.length || 0), 'Premium има повече ползи от Basic');
}

async function runPlaywrightFlow(page) {
  console.log('— Playwright: пълен UI поток —');

  await page.addInitScript(() => {
    window.__API_OVERRIDE__ = 'http://localhost:8081/backend';
  });

  // Patch fetch in quiz to use local API
  await page.route('**/life-protocol-submit', async (route) => {
    const req = route.request();
    const body = req.postDataJSON();
    const res = await fetch(`${BASE}/backend/life-protocol-submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    await route.fulfill({ status: res.status, contentType: 'application/json', body: JSON.stringify(data) });
  });

  await page.goto(`${BASE}/life-protocol-quiz.html`, { waitUntil: 'networkidle' });

  const clickNext = async () => page.click('#lpq-next');
  const selectRadio = async (name, value) => {
    await page.click(`input[name="${name}"][value="${value}"]`);
  };
  const selectCheckbox = async (name, value) => {
    await page.click(`input[name="${name}"][value="${value}"]`);
  };

  await selectRadio('sex', 'female');
  await clickNext();
  await selectRadio('age_band', '45-54');
  await clickNext();
  await page.fill('#height_cm', '168');
  await page.fill('#weight_kg', '65');
  await clickNext();
  await selectRadio('priority', 'skin');
  await clickNext();
  await selectCheckbox('conditions', 'none');
  await clickNext();
  await selectCheckbox('medications', 'none');
  await clickNext();
  await selectRadio('activity', 'rare');
  await clickNext();
  await selectRadio('diet', 'omnivore');
  await clickNext();
  await selectCheckbox('symptoms', 'fatigue');
  await clickNext();
  await selectCheckbox('allergies', 'none');
  await clickNext();
  await selectRadio('sun_exposure', 'moderate');
  await clickNext();
  await selectRadio('pregnancy', 'no');
  await clickNext();
  await page.fill('#lpq-email', 'e2e-test@life-protocol.local');
  await page.fill('#lpq-name', 'E2E Тест');
  await clickNext();

  await page.waitForURL('**/life-protocol-result.html', { timeout: 15000 });
  check(page.url().includes('life-protocol-result.html'), 'Пренасочване към страница с резултат');

  await page.waitForSelector('.lpr-tier', { timeout: 5000 });
  const tiers = await page.$$('.lpr-tier');
  check(tiers.length === 3, `Резултатът показва 3 tier карти (${tiers.length})`);

  const analysis = await page.textContent('.lpr-analysis');
  check((analysis || '').length > 20, 'Персонален анализ се показва');

  await page.waitForSelector('.lpr-product-card', { timeout: 5000 });
  const productCards = await page.$$('.lpr-product-card');
  check(productCards.length >= 1, `Продуктовите карти се показват (${productCards.length})`);

  const firstCard = await page.$eval('.lpr-product-card', (el) => ({
    hasImg: !!el.querySelector('img'),
    hasPrice: el.textContent.includes('€'),
    hasLink: el.getAttribute('href')?.includes('life-product.html'),
  }));
  check(firstCard.hasImg, 'Продуктова карта има снимка');
  check(firstCard.hasPrice, 'Продуктова карта показва цена в EUR');
  check(firstCard.hasLink, 'Продуктова карта има линк към продукта');

  await page.click('[data-action="add-tier"][data-tier="optimal"]');
  await page.waitForURL('**/life-checkout.html', { timeout: 10000 });
  check(page.url().includes('life-checkout.html'), 'Поръчка → checkout');

  const emailVal = await page.inputValue('#email');
  check(emailVal === 'e2e-test@life-protocol.local', `Имейлът е prefilled (${emailVal})`);

  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('lifeCart') || '[]'));
  check(cart.length >= 1, `Количката съдържа ${cart.length} продукта от стака`);
}

async function main() {
  console.log('\n=== Life Protocol Quiz E2E ===\n');
  await runEngineChecks();

  const server = await startServer();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/local/bin/google-chrome',
  });
  const page = await browser.newPage();

  try {
    await runPlaywrightFlow(page);
  } catch (e) {
    logIssue(`Playwright поток: ${e.message}`);
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n--- Обобщение: ${passes.length} успешни, ${issues.length} проблеми ---`);
  if (issues.length) {
    issues.forEach((i) => console.log(`  • ${i}`));
    process.exit(1);
  }
  console.log('Всички проверки минаха.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
