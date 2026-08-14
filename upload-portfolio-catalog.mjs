/**
 * Sync Fitness1 + Sila BG catalog and upload to Cloudflare KV.
 * Requires: FITNESS1_API_KEY and/or SILA_API_TOKEN, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 */
import { groupRawProducts, buildCatalogMeta, DEFAULT_SETTINGS, fetchDescriptionMap, fetchFitness1Products, mergeCatalogProducts } from './portfolio-api.js';
import { fetchSilaProductsWithFallback, normalizeSilaApiToken, KV_SILA_TOKEN } from './sila-api.js';

const KV_NS = process.env.CLOUDFLARE_KV_NAMESPACE_ID || 'd220db696e414b7cb3da2b19abd53d0f';
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const F1_KEY = process.env.FITNESS1_API_KEY;
const SILA_TOKEN = process.env.SILA_API_TOKEN;
const CHUNK_SIZE = 150;

async function kvGet(key) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/storage/kv/namespaces/${KV_NS}/values/${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KV get ${key}: ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function kvPut(key, body, contentType = 'application/json') {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/storage/kv/namespaces/${KV_NS}/values/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.success) throw new Error(`KV put ${key} failed: ${JSON.stringify(data.errors)}`);
}

async function fetchAllProducts() {
  let f1Products = [];
  let silaProducts = [];

  if (F1_KEY) {
    console.log('Fetching products from Fitness1...');
    f1Products = await fetchFitness1Products(F1_KEY);
    console.log(`  Fitness1: ${f1Products.length} SKUs`);
  }

  if (SILA_TOKEN) {
    console.log('Fetching products from Sila BG...');
    const { products, error } = await fetchSilaProductsWithFallback([SILA_TOKEN]);
    silaProducts = products;
    if (error) {
      console.warn(`  Sila BG: skipped — ${error.message}`);
      console.warn('  Check SILA_API_TOKEN in GitHub Secrets (B2B profile → API tab, 24–96 alphanumeric chars).');
    } else {
      console.log(`  Sila BG: ${silaProducts.length} SKUs`);
    }
  }

  if (!f1Products.length && !silaProducts.length) {
    throw new Error('No products fetched — configure FITNESS1_API_KEY and/or SILA_API_TOKEN');
  }

  return mergeCatalogProducts(f1Products, silaProducts);
}

async function main() {
  if (!F1_KEY && !SILA_TOKEN) throw new Error('FITNESS1_API_KEY and/or SILA_API_TOKEN required');
  const uploadKv = TOKEN && ACCOUNT;

  const products = await fetchAllProducts();
  console.log(`Got ${products.length} merged SKUs`);

  let descriptionMap = null;
  if (F1_KEY) {
    console.log('Fetching descriptions from Fitness1...');
    descriptionMap = await fetchDescriptionMap(F1_KEY);
  }

  const existingSettings = uploadKv ? await kvGet('portfolio_settings') : null;
  const settings = { ...DEFAULT_SETTINGS, ...(existingSettings || {}), global_markup_percent: 30 };
  const groups = groupRawProducts(products, settings, descriptionMap);
  const meta = buildCatalogMeta(groups);
  meta.synced_at = new Date().toISOString();
  meta.distributors = {
    fitness1_skus: products.filter((p) => p.distributor !== 'sila').length,
    sila_skus: products.filter((p) => p.distributor === 'sila').length,
  };
  settings.last_sync = meta.synced_at;
  settings.last_sync_count = groups.length;

  if (!uploadKv) {
    console.log('No Cloudflare credentials – skipping KV upload.');
    console.log(`Catalog ready: ${groups.length} groups, ${meta.chunk_count} chunks`);
    return;
  }

  if (F1_KEY) {
    console.log('Uploading fitness1_api_key...');
    await kvPut('fitness1_api_key', F1_KEY, 'text/plain');
  }
  if (SILA_TOKEN) {
    console.log('Uploading sila_api_token...');
    await kvPut(KV_SILA_TOKEN, normalizeSilaApiToken(SILA_TOKEN), 'text/plain');
  }

  console.log('Uploading portfolio_settings...');
  await kvPut('portfolio_settings', JSON.stringify(settings, null, 2), 'application/json');

  console.log('Uploading portfolio_meta...');
  await kvPut('portfolio_meta', JSON.stringify(meta), 'application/json');

  for (let i = 0; i < meta.chunk_count; i++) {
    const slice = groups.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    console.log(`Uploading portfolio_chunk_${i} (${slice.length} groups)...`);
    await kvPut(`portfolio_chunk_${i}`, JSON.stringify(slice), 'application/json');
  }

  console.log('✅ Portfolio catalog uploaded to KV');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
