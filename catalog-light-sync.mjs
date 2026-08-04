/**
 * GHA light catalog sync – fetch Fitness1, diff, write versioned KV artifacts.
 * Also updates legacy portfolio_* keys for validate-cart / admin.
 */
import { buildCatalogArtifacts } from './catalog-build.js';
import { CATALOG_KV } from './catalog-kv-keys.js';
import { CATALOG_SYNC_POLICY } from './catalog-sync-policy.js';
import { DEFAULT_SETTINGS } from './portfolio-api.js';
import {
  refreshImportedProductsInContent,
  collectImportedGroupIds
} from './portfolio-import.js';
import { SITE_CONTENT_KEYS } from './portfolio-site-products.js';

const KV_NS = process.env.CLOUDFLARE_KV_NAMESPACE_ID || 'd220db696e414b7cb3da2b19abd53d0f';
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const API_KEY = process.env.FITNESS1_API_KEY;

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

async function kvDelete(key) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/storage/kv/namespaces/${KV_NS}/values/${encodeURIComponent(key)}`;
  await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } });
}

async function fetchProducts() {
  const url = `https://fitness1.bg/b2b/api/products_v3?key=${encodeURIComponent(API_KEY)}`;
  console.log('Fetching products from Fitness1 (light, no descriptions)...');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fitness1 API: ${res.status}`);
  const data = await res.json();
  return data.products;
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
  if (!API_KEY) throw new Error('FITNESS1_API_KEY required');
  if (!TOKEN || !ACCOUNT) throw new Error('Cloudflare credentials required');

  const settings = { ...DEFAULT_SETTINGS, global_markup_percent: 30 };
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
    console.log(`Writing index ${built.indexVersion}`);
    await kvPut(CATALOG_KV.index(built.indexVersion), gzipJson(built.indexPayload));
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
  console.log('Updating legacy portfolio_* keys...');
  await kvPut('fitness1_api_key', API_KEY, 'text/plain');
  await kvPut('portfolio_settings', JSON.stringify(built.legacySettings, null, 2));
  await kvPut('portfolio_meta', JSON.stringify(built.legacyMeta));
  for (let i = 0; i < built.chunks.length; i += 1) {
    await kvPut(`portfolio_chunk_${i}`, JSON.stringify(built.chunks[i]));
  }

  console.log(JSON.stringify({
    ok: true,
    indexChanged,
    stockChanged,
    pointer: { i: pointer.i, s: pointer.s, t: pointer.t },
    groups: built.groups.length
  }));

  await refreshSiteProjectsFromCatalog(built.groups);
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
