/**
 * Sync Fitness1 + Sila BG catalog and upload to Cloudflare KV.
 * Requires: FITNESS1_API_KEY and/or SILA_API_TOKEN, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 */
import { groupRawProducts, buildCatalogMeta, DEFAULT_SETTINGS, fetchDescriptionMap, fetchFitness1Products, mergeCatalogProducts } from './portfolio-api.js';
import { fetchSilaProductsWithFallback, normalizeSilaApiToken, KV_SILA_TOKEN } from './sila-api.js';
import { mergeSettingsForCatalogSync, persistSettingsAfterCatalogSync } from './catalog-settings-kv.mjs';
import { refreshSiteProjectsFromCatalog } from './catalog-site-refresh.mjs';
import { kvGet, kvPut } from './catalog-kv-client.mjs';

const F1_KEY = process.env.FITNESS1_API_KEY;
const SILA_TOKEN = process.env.SILA_API_TOKEN;
const CHUNK_SIZE = 150;

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
  const uploadKv = process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID;

  const products = await fetchAllProducts();
  console.log(`Got ${products.length} merged SKUs`);

  let descriptionMap = null;
  if (F1_KEY) {
    console.log('Fetching descriptions from Fitness1...');
    descriptionMap = await fetchDescriptionMap(F1_KEY);
  }

  const existing = uploadKv ? (await kvGet('portfolio_settings') || {}) : {};
  const settings = mergeSettingsForCatalogSync(DEFAULT_SETTINGS, existing);
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

  console.log('Uploading portfolio_settings (preserving admin/branding from KV)...');
  const freshKv = await kvGet('portfolio_settings') || {};
  await kvPut(
    'portfolio_settings',
    JSON.stringify(
      persistSettingsAfterCatalogSync(freshKv, {
        last_sync: meta.synced_at,
        last_sync_count: groups.length,
      }),
      null,
      2
    ),
    'application/json'
  );

  console.log('Uploading portfolio_meta...');
  await kvPut('portfolio_meta', JSON.stringify(meta), 'application/json');

  for (let i = 0; i < meta.chunk_count; i++) {
    const slice = groups.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    console.log(`Uploading portfolio_chunk_${i} (${slice.length} groups)...`);
    await kvPut(`portfolio_chunk_${i}`, JSON.stringify(slice), 'application/json');
  }

  const refreshResults = await refreshSiteProjectsFromCatalog(groups);
  console.log('Site project refresh:', JSON.stringify(refreshResults));

  console.log('✅ Portfolio catalog uploaded to KV');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
