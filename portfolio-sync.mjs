/**
 * Sync Fitness1 B2B catalog to local JSON chunks (for upload to KV).
 * Usage: FITNESS1_API_KEY=xxx node portfolio-sync.mjs
 *        node portfolio-sync.mjs --upload  (requires CLOUDFLARE_API_TOKEN)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { groupRawProducts, buildCatalogMeta, DEFAULT_SETTINGS } from './portfolio-api.js';

const API_KEY = process.env.FITNESS1_API_KEY;
const OUT_DIR = 'backend/portfolio';
const CHUNK_SIZE = 150;

async function fetchProducts() {
  if (!API_KEY) {
    console.error('Set FITNESS1_API_KEY environment variable.');
    process.exit(1);
  }
  const url = `https://fitness1.bg/b2b/api/products_v3?key=${encodeURIComponent(API_KEY)}&format=json`;
  console.log('Fetching catalog from Fitness1...');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error('Invalid API response');
  return data.products;
}

async function main() {
  const products = await fetchProducts();
  console.log(`Received ${products.length} SKUs`);

  const settings = { ...DEFAULT_SETTINGS, global_markup_percent: 30 };
  const groups = groupRawProducts(products, settings);
  const meta = buildCatalogMeta(groups);
  meta.synced_at = new Date().toISOString();

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  writeFileSync(`${OUT_DIR}/portfolio_meta.json`, JSON.stringify(meta));
  writeFileSync(`${OUT_DIR}/portfolio_settings.json`, JSON.stringify({
    ...settings,
    last_sync: meta.synced_at,
    last_sync_count: groups.length
  }, null, 2));

  for (let i = 0; i < meta.chunk_count; i++) {
    const slice = groups.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    writeFileSync(`${OUT_DIR}/portfolio_chunk_${i}.json`, JSON.stringify(slice));
  }

  console.log(`Wrote ${meta.chunk_count} chunks, ${groups.length} groups to ${OUT_DIR}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
