/**
 * Sync Fitness1 catalog and upload to Cloudflare KV.
 * Requires: FITNESS1_API_KEY, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { groupRawProducts, buildCatalogMeta, DEFAULT_SETTINGS } from './portfolio-api.js';

const KV_NS = process.env.CLOUDFLARE_KV_NAMESPACE_ID || 'd220db696e414b7cb3da2b19abd53d0f';
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const API_KEY = process.env.FITNESS1_API_KEY;
const CHUNK_SIZE = 150;

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

async function fetchProducts() {
  const url = `https://fitness1.bg/b2b/api/products_v3?key=${encodeURIComponent(API_KEY)}&format=json`;
  console.log('Fetching products from Fitness1...');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fitness1 API: ${res.status}`);
  const data = await res.json();
  return data.products;
}

async function main() {
  if (!API_KEY) throw new Error('FITNESS1_API_KEY required');
  const uploadKv = TOKEN && ACCOUNT;

  const products = await fetchProducts();
  console.log(`Got ${products.length} SKUs`);

  const settings = { ...DEFAULT_SETTINGS, global_markup_percent: 30 };
  const groups = groupRawProducts(products, settings);
  const meta = buildCatalogMeta(groups);
  meta.synced_at = new Date().toISOString();
  settings.last_sync = meta.synced_at;
  settings.last_sync_count = groups.length;

  if (!uploadKv) {
    console.log('No Cloudflare credentials – skipping KV upload.');
    console.log(`Catalog ready: ${groups.length} groups, ${meta.chunk_count} chunks`);
    return;
  }

  console.log('Uploading fitness1_api_key...');
  await kvPut('fitness1_api_key', API_KEY, 'text/plain');

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
