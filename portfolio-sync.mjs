/**
 * Sync Fitness1 + Sila BG catalogs to local JSON chunks (for upload to KV).
 * Usage:
 *   FITNESS1_API_KEY=xxx node portfolio-sync.mjs
 *   SILA_API_TOKEN=xxx node portfolio-sync.mjs
 *   node portfolio-sync.mjs --upload  (requires CLOUDFLARE_API_TOKEN)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import {
  groupRawProducts,
  buildCatalogMeta,
  DEFAULT_SETTINGS,
  fetchDescriptionMap,
  fetchFitness1Products,
  mergeCatalogProducts,
} from './portfolio-api.js';
import { fetchSilaProductsWithFallback } from './sila-api.js';

const F1_KEY = process.env.FITNESS1_API_KEY;
const SILA_TOKEN = process.env.SILA_API_TOKEN;
const OUT_DIR = 'backend/portfolio';
const CHUNK_SIZE = 150;

async function fetchAllProducts() {
  if (!F1_KEY && !SILA_TOKEN) {
    console.error('Set FITNESS1_API_KEY and/or SILA_API_TOKEN.');
    process.exit(1);
  }

  let f1Products = [];
  let silaProducts = [];

  if (F1_KEY) {
    console.log('Fetching catalog from Fitness1...');
    f1Products = await fetchFitness1Products(F1_KEY);
    console.log(`  Fitness1: ${f1Products.length} SKUs`);
  }

  if (SILA_TOKEN) {
    console.log('Fetching catalog from Sila BG...');
    const { products, error } = await fetchSilaProductsWithFallback([SILA_TOKEN]);
    silaProducts = products;
    if (error) {
      console.warn(`  Sila BG: skipped — ${error.message}`);
    } else {
      console.log(`  Sila BG: ${silaProducts.length} SKUs`);
    }
  }

  return mergeCatalogProducts(f1Products, silaProducts);
}

async function main() {
  const products = await fetchAllProducts();
  console.log(`Total merged SKUs: ${products.length}`);

  let descriptionMap = null;
  if (F1_KEY) {
    console.log('Fetching descriptions from Fitness1...');
    descriptionMap = await fetchDescriptionMap(F1_KEY);
  }

  const settings = { ...DEFAULT_SETTINGS, global_markup_percent: 30 };
  const groups = groupRawProducts(products, settings, descriptionMap);
  const meta = buildCatalogMeta(groups);
  meta.synced_at = new Date().toISOString();
  meta.distributors = {
    fitness1_skus: products.filter((p) => p.distributor !== 'sila').length,
    sila_skus: products.filter((p) => p.distributor === 'sila').length,
  };

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
