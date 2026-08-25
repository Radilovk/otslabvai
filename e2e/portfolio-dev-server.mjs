/**
 * Local Portfolio dev + test server with in-memory KV seeded from backend/portfolio/.
 * Usage: node e2e/portfolio-dev-server.mjs
 */
import express from 'express';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { handlePortfolioRoute, buildCatalogMeta } from '../portfolio-api.js';
import {
  preparePortfolioAdvisorSubmission,
  finalizePortfolioAdvisorResponse,
  getPortfolioComposeOptions,
  composePortfolioAdvisorStacks,
} from '../portfolio-advisor-engine.js';
import { getDefaultPortfolioAdvisorSettings } from '../portfolio-advisor-settings.js';
import {
  assembleProtocolFromComposition,
  buildMockNarration,
} from '../protocol-stack-composer.js';
import { buildPortfolioAdvisorNarration } from '../portfolio-advisor-narration.js';
import { buildMockProtocolResponse } from '../protocol-quiz-engine.js';
import {
  routeRequiresAdmin,
  assertAdminAuthorized,
  handleAdminLogin,
  handleAdminSession
} from '../admin-auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = Number(process.env.PORT || 8790);
const DATA_DIR = join(ROOT, 'backend', 'portfolio');

const kvStore = new Map();

function seedMinimalCatalog() {
  const groups = [
    {
      group_id: '1001', product_id: 'p1', name: 'Whey Protein 80', brand: 'TestBrand', brand_id: '1',
      category: 'Протеини > Whey', category_path: ['Протеини', 'Whey'], image: 'https://picsum.photos/seed/pf-1001/400/400',
      variants: [{ sku_id: '101', pack: '1kg', option: 'Vanilla', b2b_price: 20, retail_price: 29.9, available: true, image: 'https://picsum.photos/seed/pf-1001/400/400' }],
    },
    {
      group_id: '1002', product_id: 'p2', name: 'Creatine Monohydrate', brand: 'TestBrand', brand_id: '1',
      category: 'Протеини > Whey', category_path: ['Протеини', 'Whey'], image: 'https://picsum.photos/seed/pf-1002/400/400',
      variants: [{ sku_id: '102', pack: '300g', option: '', b2b_price: 8, retail_price: 14.5, available: true, image: 'https://picsum.photos/seed/pf-1002/400/400' }],
    },
    {
      group_id: '1003', product_id: 'p3', name: 'Multivitamin Complex', brand: 'TestBrand', brand_id: '1',
      category: 'Витамини и минерали', category_path: ['Витамини и минерали'], image: 'https://picsum.photos/seed/pf-1003/400/400',
      variants: [{ sku_id: '103', pack: '60 caps', option: '', b2b_price: 10, retail_price: 18.0, available: true, image: 'https://picsum.photos/seed/pf-1003/400/400' }],
    },
    {
      group_id: '1004', product_id: 'p4', name: 'Omega 3 Fish Oil', brand: 'TestBrand', brand_id: '1',
      category: 'Омега мастни киселини', category_path: ['Омега мастни киселини'], image: 'https://picsum.photos/seed/pf-1004/400/400',
      variants: [{ sku_id: '104', pack: '90 caps', option: '', b2b_price: 12, retail_price: 22.0, available: true, image: 'https://picsum.photos/seed/pf-1004/400/400' }],
    },
    {
      group_id: '1005', product_id: 'p5', name: 'Budget Whey', brand: 'TestBrand', brand_id: '1',
      category: 'Протеини > Whey', category_path: ['Протеини', 'Whey'], image: 'https://picsum.photos/seed/pf-1005/400/400',
      variants: [{ sku_id: '105', pack: '900g', option: '', b2b_price: 6, retail_price: 9.9, available: true, image: 'https://picsum.photos/seed/pf-1005/400/400' }],
    },
    {
      group_id: '1006', product_id: 'p6', name: 'Premium Isolate', brand: 'TestBrand', brand_id: '1',
      category: 'Протеини > Whey', category_path: ['Протеини', 'Whey'], image: 'https://picsum.photos/seed/pf-1006/400/400',
      variants: [{ sku_id: '106', pack: '1kg', option: '', b2b_price: 35, retail_price: 59.9, available: true, image: 'https://picsum.photos/seed/pf-1006/400/400' }],
    },
    {
      group_id: '1007', product_id: 'p7', name: 'Ashwagandha Root', brand: 'TestBrand', brand_id: '1',
      category: 'Хербални добавки', category_path: ['Хербални добавки'], image: 'https://picsum.photos/seed/pf-1007/400/400',
      variants: [{ sku_id: '107', pack: '60 caps', option: '', b2b_price: 7, retail_price: 12.5, available: true, image: 'https://picsum.photos/seed/pf-1007/400/400' }],
    },
  ];
  const settings = { product_overrides: {}, global_markup_percent: 30 };
  const meta = buildCatalogMeta(groups, settings);
  meta.synced_at = new Date().toISOString();
  kvStore.set('portfolio_meta', JSON.stringify(meta));
  kvStore.set('portfolio_chunk_0', JSON.stringify(groups));
  kvStore.set('portfolio_settings', JSON.stringify(settings));
  console.log('Seeded minimal catalog for dev/E2E (7 groups)');
}

function loadKvFromDisk() {
  if (process.env.PORTFOLIO_E2E_MINIMAL === '1') {
    seedMinimalCatalog();
    return false;
  }
  if (!existsSync(DATA_DIR)) {
    console.warn('No backend/portfolio/ – using minimal seed catalog');
    seedMinimalCatalog();
    return false;
  }
  const settings = readFileSync(join(DATA_DIR, 'portfolio_settings.json'), 'utf8');
  const meta = readFileSync(join(DATA_DIR, 'portfolio_meta.json'), 'utf8');
  kvStore.set('portfolio_settings', settings);
  kvStore.set('portfolio_meta', meta);
  for (const file of readdirSync(DATA_DIR)) {
    const m = file.match(/^portfolio_chunk_(\d+)\.json$/);
    if (m) {
      kvStore.set(`portfolio_chunk_${m[1]}`, readFileSync(join(DATA_DIR, file), 'utf8'));
    }
  }
  const parsed = JSON.parse(meta);
  console.log(`Loaded catalog: ${parsed.total_groups} groups, ${parsed.chunk_count} chunks`);
  return true;
}

function createEnv() {
  return {
    FITNESS1_API_KEY: process.env.FITNESS1_API_KEY || 'mock-dev-key',
    MOCK_FITNESS1: process.env.MOCK_FITNESS1 !== '0' ? '1' : null,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'kakadu1234',
    PAGE_CONTENT: {
      get: async (key) => kvStore.get(key) ?? null,
      put: async (key, val) => { kvStore.set(key, val); },
      delete: async (key) => { kvStore.delete(key); }
    }
  };
}

async function toWebRequest(req) {
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const init = { method: req.method, headers: req.headers };
  if (!['GET', 'HEAD'].includes(req.method) && req.body && Object.keys(req.body).length) {
    init.body = JSON.stringify(req.body);
    init.headers = { ...req.headers, 'content-type': 'application/json' };
  }
  return new Request(url, init);
}

async function sendWebResponse(webRes, res) {
  res.status(webRes.status);
  webRes.headers.forEach((v, k) => {
    if (k.toLowerCase() !== 'content-encoding') res.setHeader(k, v);
  });
  res.send(Buffer.from(await webRes.arrayBuffer()));
}

const app = express();
app.use(express.json({ limit: '2mb' }));

async function runAdvisorMockGeneration(env, rawAnswers) {
  const prepared = await preparePortfolioAdvisorSubmission(env, rawAnswers);
  const { profile, payload, ranked, eligible, excluded_product_ids: excludedIds } = prepared;
  const composed = composePortfolioAdvisorStacks(profile, ranked, getPortfolioComposeOptions(profile));
  const productMap = new Map(eligible.map((p) => [p.product_id, p]));
  const narration = buildPortfolioAdvisorNarration(composed, profile, productMap);
  const { response } = assembleProtocolFromComposition(composed, narration, productMap, excludedIds);
  const recommendation = finalizePortfolioAdvisorResponse(response, eligible, excludedIds, {
    selection_mode: profile.selection_mode,
    independent_tiers: true,
  });
  return { profile, payload, recommendation };
}

app.get('/portfolio-advisor/settings', (req, res) => {
  res.json(getDefaultPortfolioAdvisorSettings());
});

app.post('/portfolio-advisor/settings', (req, res) => {
  kvStore.set('portfolio_advisor_settings', JSON.stringify(req.body, null, 2));
  res.json({ success: true, settings: req.body });
});

app.post('/portfolio-advisor-submit', async (req, res) => {
  try {
    const env = createEnv();
    const { profile, recommendation } = await runAdvisorMockGeneration(env, req.body);
    res.json({
      sessionId: `dev-advisor-${Date.now()}`,
      email: profile.email,
      selection_mode: profile.selection_mode,
      ...recommendation,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/portfolio-advisor/simulate', async (req, res) => {
  try {
    const env = createEnv();
    const sample = req.body?.profile || {
      selection_mode: 'package',
      sex: 'male',
      age_band: '25-34',
      height_cm: 180,
      weight_kg: 82,
      priority: 'muscle',
      product_categories: ['all'],
      conditions: ['none'],
      medications: ['none'],
      activity: 'regular',
      diet: 'omnivore',
      symptoms: ['none'],
      allergies: ['none'],
      pregnancy: 'no',
      email: 'test@portfolio-advisor.local',
    };
    const { payload, recommendation } = await runAdvisorMockGeneration(env, sample);
    res.json({
      success: true,
      mock: true,
      recommendation,
      catalog_stats: payload.catalog_stats,
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/admin/login', async (req, res) => {
  const response = await handleAdminLogin(await toWebRequest(req), createEnv());
  await sendWebResponse(response, res);
});

app.get('/admin/session', async (req, res) => {
  const response = await handleAdminSession(await toWebRequest(req), createEnv());
  await sendWebResponse(response, res);
});

app.use(async (req, res, next) => {
  if (!req.path.startsWith('/portfolio/')) return next();
  try {
    if (routeRequiresAdmin(req.path, req.method)) {
      await assertAdminAuthorized(await toWebRequest(req), createEnv());
    }
    const env = createEnv();
    const request = await toWebRequest(req);
    const url = new URL(request.url);
    const response = await handlePortfolioRoute(request, env, url);
    await sendWebResponse(response, res);
  } catch (e) {
    const status = e?.status || 500;
    res.status(status).json({ error: e.message || 'Portfolio route error' });
  }
});

app.use(express.static(ROOT));

app.listen(PORT, '0.0.0.0', () => {
  loadKvFromDisk();
  if (!kvStore.has('portfolio_orders')) {
    kvStore.set('portfolio_orders', '[]');
  }
  kvStore.set('portfolio_promo_codes', JSON.stringify([
    {
      id: 'pf-promo-test',
      code: 'PORTFOLIO10',
      discount: 10,
      discountType: 'percentage',
      description: 'E2E тест промо',
      validFrom: new Date(Date.now() - 86400000).toISOString(),
      validUntil: null,
      maxUses: 100,
      usedCount: 0,
      active: true,
      createdAt: new Date().toISOString()
    }
  ]));
  console.log(`Portfolio dev server: http://127.0.0.1:${PORT}/portfolio.html`);
});

export { PORT, kvStore, loadKvFromDisk };
