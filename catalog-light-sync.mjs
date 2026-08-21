/**
 * GHA light catalog sync – fetch Fitness1, diff, write versioned KV artifacts.
 * Also updates legacy portfolio_* keys for validate-cart / admin.
 */
import { buildCatalogArtifacts } from './catalog-build.js';
import { CATALOG_KV } from './catalog-kv-keys.js';
import { CATALOG_SYNC_POLICY } from './catalog-sync-policy.js';
import {
  mergeSettingsForCatalogSync,
  persistSettingsAfterCatalogSync,
  mergeIndexEmbeddedSettings,
} from './catalog-settings-kv.mjs';
import { DEFAULT_SETTINGS, fetchFitness1Products, mergeCatalogProducts } from './portfolio-api.js';
import { fetchSilaProductsWithFallback, normalizeSilaApiToken, KV_SILA_TOKEN } from './sila-api.js';
import {
  refreshImportedProductsInContent,
  collectImportedGroupIds
} from './portfolio-import.js';
import { SITE_CONTENT_KEYS } from './portfolio-site-products.js';
import { kvGet, kvPut, kvDelete } from './catalog-kv-client.mjs';

const API_KEY = process.env.FITNESS1_API_KEY;
const SILA_TOKEN = process.env.SILA_API_TOKEN;
const SKIP_LEGACY = process.env.CATALOG_SKIP_LEGACY === '1';

async function fetchProducts() {
  let f1Products = [];
  let silaProducts = [];

  if (API_KEY) {
    console.log('Fetching products from Fitness1 (light, no descriptions)...');
    f1Products = await fetchFitness1Products(API_KEY);
    console.log(`  Fitness1: ${f1Products.length} SKUs`);
  }

  if (SILA_TOKEN) {
    console.log('Fetching products from Sila BG...');
    const { products, error } = await fetchSilaProductsWithFallback([SILA_TOKEN]);
    silaProducts = products;
    if (error) {
      console.warn(`  Sila BG: skipped — ${error.message}`);
    } else {
      console.log(`  Sila BG: ${silaProducts.length} SKUs`);
    }
  }

  if (!f1Products.length && !silaProducts.length) {
    throw new Error('No products fetched — configure FITNESS1_API_KEY and/or SILA_API_TOKEN');
  }

  return mergeCatalogProducts(f1Products, silaProducts);
}

function gzipJson(obj) {
  // KV stores JSON; Worker sets gzip header if pre-compressed later.
  return JSON.stringify(obj);
}

async function pruneOldVersions(pointer, keep = CATALOG_SYNC_POLICY.RETAIN_VERSIONS) {
  const history = pointer.history || { index: [], stock: [] };
  const trim = (list, prefix, suffix = '') => {
    while (list.length > keep) {
      const old = list.shift();
      if (old) kvDelete(`${prefix}${old}${suffix}`).catch(() => {});
    }
  };
  trim(history.index, 'catalog_index_');
  trim(history.stock, 'catalog_stock_');
  for (const entry of history.groups || []) {
    if (entry.v && entry.i != null) {
      kvDelete(CATALOG_KV.groups(entry.v, entry.i)).catch(() => {});
    }
  }
  pointer.history = history;
}

async function main() {
  if (!API_KEY && !SILA_TOKEN) throw new Error('FITNESS1_API_KEY and/or SILA_API_TOKEN required');
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error('Cloudflare credentials required');
  }

  const settings = mergeSettingsForCatalogSync(DEFAULT_SETTINGS, await kvGet('portfolio_settings') || {});
  const products = await fetchProducts();
  console.log(`Got ${products.length} SKUs`);

  const built = buildCatalogArtifacts(products, settings);
  const prevPointer = await kvGet(CATALOG_KV.POINTER) || {};
  const prevHashes = await kvGet(CATALOG_KV.HASHES) || {};

  const indexChanged = built.hashes.indexContent !== prevHashes.indexContent
    || built.hashes.pricingVersion !== prevHashes.pricingVersion
    || built.hashes.transformVersion !== prevHashes.transformVersion;
  const stockChanged = built.hashes.stockContent !== prevHashes.stockContent
    || built.hashes.transformVersion !== prevHashes.transformVersion;

  const pointer = {
    i: prevPointer.i || built.indexVersion,
    s: prevPointer.s || built.stockVersion,
    t: built.pointer.t,
    dispatchedAt: prevPointer.dispatchedAt || 0,
    history: prevPointer.history || { index: [], stock: [], groups: [] }
  };

  if (indexChanged) {
    const freshKv = await kvGet('portfolio_settings') || {};
    const indexPayload = {
      ...built.indexPayload,
      settings: mergeIndexEmbeddedSettings(built.indexPayload.settings, freshKv),
    };
    console.log(`Writing index ${built.indexVersion}`);
    await kvPut(CATALOG_KV.index(built.indexVersion), gzipJson(indexPayload));
    pointer.i = built.indexVersion;
    pointer.history.index = [...new Set([...(pointer.history.index || []), built.indexVersion])];
    for (let i = 0; i < built.chunks.length; i += 1) {
      await kvPut(CATALOG_KV.groups(built.indexVersion, i), gzipJson(built.chunks[i]));
      pointer.history.groups = pointer.history.groups || [];
      pointer.history.groups.push({ v: built.indexVersion, i });
    }
  }

  if (stockChanged) {
    console.log(`Writing stock ${built.stockVersion}`);
    await kvPut(CATALOG_KV.stock(built.stockVersion), gzipJson(built.stockPayload));
    pointer.s = built.stockVersion;
    pointer.history.stock = [...new Set([...(pointer.history.stock || []), built.stockVersion])];
  }

  await kvPut(CATALOG_KV.HASHES, {
    indexContent: built.hashes.indexContent,
    stockContent: built.hashes.stockContent,
    pricingVersion: built.hashes.pricingVersion,
    transformVersion: built.hashes.transformVersion,
    perGroup: built.hashes.perGroup
  });

  await pruneOldVersions(pointer);
  pointer.t = built.pointer.t;
  await kvPut(CATALOG_KV.POINTER, pointer);

  // Legacy KV for validate-cart, admin, advisor engine
  if (SKIP_LEGACY) {
    console.log('Skipping legacy portfolio_* keys (CATALOG_SKIP_LEGACY=1)');
  } else {
    await updateLegacyPortfolioKeys(built, indexChanged);
  }

  console.log(JSON.stringify({
    ok: true,
    indexChanged,
    stockChanged,
    skipLegacy: SKIP_LEGACY,
    pointer: { i: pointer.i, s: pointer.s, t: pointer.t },
    groups: built.groups.length
  }));

  await refreshSiteProjectsFromCatalog(built.groups);
}

async function updateLegacyPortfolioKeys(built, indexChanged) {
  console.log('Updating legacy portfolio_* keys...');
  if (process.env.FITNESS1_API_KEY) {
    await kvPut('fitness1_api_key', process.env.FITNESS1_API_KEY, 'text/plain');
  }
  if (process.env.SILA_API_TOKEN) {
    await kvPut(KV_SILA_TOKEN, normalizeSilaApiToken(process.env.SILA_API_TOKEN), 'text/plain');
  }

  const freshKv = await kvGet('portfolio_settings') || {};
  await kvPut(
    'portfolio_settings',
    JSON.stringify(
      persistSettingsAfterCatalogSync(freshKv, {
        last_sync: built.legacyMeta.synced_at,
        last_sync_count: built.groups.length,
      }),
      null,
      2
    )
  );

  if (!indexChanged) {
    console.log('Legacy portfolio_meta/chunks unchanged — skipped');
    return;
  }

  await kvPut('portfolio_meta', JSON.stringify(built.legacyMeta));
  for (let i = 0; i < built.chunks.length; i += 1) {
    await kvPut(`portfolio_chunk_${i}`, JSON.stringify(built.chunks[i]));
    if ((i + 1) % 20 === 0 || i === built.chunks.length - 1) {
      console.log(`  legacy chunks ${i + 1}/${built.chunks.length}`);
    }
  }
}

async function refreshSiteProjectsFromCatalog(groups) {
  const groupsById = new Map(groups.map((g) => [String(g.group_id), g]));
  const results = {};

  for (const project of ['main', 'life']) {
    const keys = SITE_CONTENT_KEYS[project];
    let content = await kvGet(keys.kvKey);
    if (!content) content = await kvGet(keys.fallback);
    if (!content) {
      results[project] = { skipped: true, reason: 'no content' };
      continue;
    }

    const groupIds = collectImportedGroupIds(content);
    if (!groupIds.length) {
      results[project] = { skipped: true, reason: 'no imported products' };
      continue;
    }

    const stats = refreshImportedProductsInContent(content, groupsById);
    await kvPut(keys.kvKey, content);
    results[project] = stats;
  }

  console.log('Site project refresh:', JSON.stringify(results));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
