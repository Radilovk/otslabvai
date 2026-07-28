/**
 * Local Portfolio dev + test server with in-memory KV seeded from backend/portfolio/.
 * Usage: node e2e/portfolio-dev-server.mjs
 */
import express from 'express';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { handlePortfolioRoute } from '../portfolio-api.js';
import {
  preparePortfolioAdvisorSubmission,
  finalizePortfolioAdvisorResponse,
  getPortfolioComposeOptions,
} from '../portfolio-advisor-engine.js';
import { getDefaultPortfolioAdvisorSettings } from '../portfolio-advisor-settings.js';
import {
  composeProtocolStacks,
  assembleProtocolFromComposition,
  buildMockNarration,
} from '../protocol-stack-composer.js';
import { buildMockProtocolResponse } from '../protocol-quiz-engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = Number(process.env.PORT || 8790);
const DATA_DIR = join(ROOT, 'backend', 'portfolio');

const kvStore = new Map();

function seedMinimalCatalog() {
  const groups = [
    {
      group_id: '1001', product_id: 'p1', name: 'Whey Protein 80', brand: 'TestBrand', brand_id: '1',
      category: 'Протеини > Whey', category_path: ['Протеини', 'Whey'], image: '',
      variants: [{ sku_id: '101', pack: '1kg', option: 'Vanilla', b2b_price: 20, retail_price: 29.9, available: true, image: '' }],
    },
    {
      group_id: '1002', product_id: 'p2', name: 'Creatine Monohydrate', brand: 'TestBrand', brand_id: '1',
      category: 'Креатин', category_path: ['Креатин'], image: '',
      variants: [{ sku_id: '102', pack: '300g', option: '', b2b_price: 8, retail_price: 14.5, available: true, image: '' }],
    },
    {
      group_id: '1003', product_id: 'p3', name: 'Multivitamin Complex', brand: 'TestBrand', brand_id: '1',
      category: 'Витамини', category_path: ['Витамини'], image: '',
      variants: [{ sku_id: '103', pack: '60 caps', option: '', b2b_price: 10, retail_price: 18.0, available: true, image: '' }],
    },
    {
      group_id: '1004', product_id: 'p4', name: 'Omega 3 Fish Oil', brand: 'TestBrand', brand_id: '1',
      category: 'Омега', category_path: ['Омега'], image: '',
      variants: [{ sku_id: '104', pack: '90 caps', option: '', b2b_price: 12, retail_price: 22.0, available: true, image: '' }],
    },
  ];
  const meta = {
    version: 1, chunk_size: 150, chunk_count: 1, total_groups: groups.length,
    lookup: Object.fromEntries(groups.map((g) => [g.group_id, 0])),
    index: groups.map((g) => ({ group_id: g.group_id, name: g.name, available: true })),
  };
  kvStore.set('portfolio_meta', JSON.stringify(meta));
  kvStore.set('portfolio_chunk_0', JSON.stringify(groups));
  kvStore.set('portfolio_settings', JSON.stringify({ product_overrides: {}, global_markup_percent: 30 }));
  console.log('Seeded minimal catalog for dev/E2E (4 groups)');
}

function loadKvFromDisk() {
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
  const composed = composeProtocolStacks(profile, ranked, getPortfolioComposeOptions(profile));
  const productMap = new Map(eligible.map((p) => [p.product_id, p]));
  const narration = buildMockNarration(composed, profile);
  const { response } = assembleProtocolFromComposition(composed, narration, productMap, excludedIds);
  const recommendation = finalizePortfolioAdvisorResponse(response, eligible, excludedIds);
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
      muscle_focus: 'protein',
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

app.use(async (req, res, next) => {
  if (!req.path.startsWith('/portfolio/')) return next();
  try {
    const env = createEnv();
    const request = await toWebRequest(req);
    const url = new URL(request.url);
    const response = await handlePortfolioRoute(request, env, url);
    await sendWebResponse(response, res);
  } catch (e) {
    console.error('Portfolio route error:', e);
    res.status(500).json({ error: e.message });
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
