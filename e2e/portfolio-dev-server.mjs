/**
 * Local Portfolio dev + test server with in-memory KV seeded from backend/portfolio/.
 * Usage: node e2e/portfolio-dev-server.mjs
 */
import express from 'express';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { handlePortfolioRoute } from '../portfolio-api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = Number(process.env.PORT || 8790);
const DATA_DIR = join(ROOT, 'backend', 'portfolio');

const kvStore = new Map();

function loadKvFromDisk() {
  if (!existsSync(DATA_DIR)) {
    console.warn('No backend/portfolio/ – run: node portfolio-sync.mjs');
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
