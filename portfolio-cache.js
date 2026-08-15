/**
 * Client catalog sync – pointer + immutable index/stock artifacts.
 * Replaces bootstrap / meta-version polling.
 */
import { API_URL } from './config.js';
import { filterIndex, paginateIndex, computeFacets } from './portfolio-filter.js';
import { CATALOG_SYNC_POLICY } from './catalog-sync-policy.js';

const IDB_NAME = 'portfolio_catalog_v2';
const IDB_STORE = 'blobs';
const IDB_VERSION = 1;

let inflight = null;
const memory = { groupChunks: new Map() };
const catalogUpdatedListeners = new Set();

export const catalogState = {
  index: null,
  indexV: null,
  stock: null,
  stockV: null,
  lastSync: 0,
  revision: 0,
  stale: false
};

function notifyCatalogUpdated() {
  catalogState.revision += 1;
  for (const listener of catalogUpdatedListeners) {
    try { listener(); } catch { /* ignore */ }
  }
}

export function onCatalogUpdated(listener) {
  catalogUpdatedListeners.add(listener);
  return () => catalogUpdatedListeners.delete(listener);
}

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function idbGet(key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result ?? null);
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).put(value, key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

function skuQty(skuId) {
  return catalogState.stock?.q?.[String(skuId)] ?? 0;
}

function productAvailable(product) {
  const skus = product.variant_skus || [];
  if (!skus.length) return !!product.available;
  return skus.some((sku) => skuQty(sku) > 0);
}

function enrichIndexProducts(products) {
  return (products || []).map((p) => ({
    ...p,
    available: productAvailable(p)
  }));
}

function buildMetaFromState() {
  if (!catalogState.index) return null;
  const index = enrichIndexProducts(catalogState.index.products);
  const inStock = index.filter((p) => p.available);
  return {
    version: 1,
    synced_at: new Date((catalogState.index.generatedAt || 0) * 1000).toISOString(),
    total_groups: inStock.length,
    chunk_size: catalogState.index.chunk_size,
    chunk_count: catalogState.index.chunk_count,
    brands: catalogState.index.brands,
    categories: catalogState.index.categories,
    goals: catalogState.index.goals || [],
    lookup: catalogState.index.lookup,
    sku_lookup: catalogState.index.sku_lookup,
    index: inStock
  };
}

async function hydrateFromIdb() {
  const cached = await idbGet('snapshot');
  if (!cached?.index) return false;
  catalogState.index = cached.index;
  catalogState.indexV = cached.indexV;
  catalogState.stock = cached.stock;
  catalogState.stockV = cached.stockV;
  catalogState.lastSync = cached.lastSync || 0;
  return true;
}

/** Load catalog snapshot from IndexedDB without network. */
export async function hydrateLocalCache() {
  if (catalogState.index) return true;
  return hydrateFromIdb();
}

function brandingFingerprint(settings) {
  return JSON.stringify({
    site_name: settings?.site_name,
    site_slogan: settings?.site_slogan,
    hero_image: settings?.hero_image,
    hero_title: settings?.hero_title,
    footer: settings?.footer
  });
}

function applyBrandingSettings(branding) {
  if (!branding || !catalogState.index) return false;
  const prev = catalogState.index.settings || {};
  const merged = { ...prev, ...branding };
  if (brandingFingerprint(prev) === brandingFingerprint(merged)) return false;
  catalogState.index = {
    ...catalogState.index,
    settings: merged
  };
  return true;
}

async function persistSnapshot() {
  await idbSet('snapshot', {
    index: catalogState.index,
    indexV: catalogState.indexV,
    stock: catalogState.stock,
    stockV: catalogState.stockV,
    lastSync: catalogState.lastSync
  });
}

async function fetchJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function legacyBootstrapFallback() {
  const res = await fetch(`${API_URL}/portfolio/bootstrap`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Грешка при зареждане на каталога');
  const meta = data.meta;
  catalogState.index = {
    generatedAt: Math.floor(Date.now() / 1000),
    chunk_size: meta.chunk_size,
    chunk_count: meta.chunk_count,
    brands: meta.brands,
    categories: meta.categories,
    goals: meta.goals,
    products: meta.index.map((p) => ({ ...p, variant_skus: p.default_sku_id ? [p.default_sku_id] : [] })),
    lookup: meta.lookup,
    sku_lookup: meta.sku_lookup,
    settings: data.settings
  };
  catalogState.indexV = meta.synced_at || 'legacy';
  catalogState.stock = { q: Object.fromEntries(meta.index.filter((p) => p.available).map((p) => [p.default_sku_id, 1]).filter(([k]) => k)) };
  catalogState.stockV = catalogState.indexV;
  catalogState.lastSync = Date.now();
  catalogState.stale = false;
  memory.groupChunks.clear();
  await persistSnapshot();
  notifyCatalogUpdated();
  return catalogState;
}

async function doSync() {
  try {
    const now = await fetchJson(`${API_URL}/c/now`);
    let catalogChanged = false;

    if (now.i !== catalogState.indexV) {
      catalogState.index = await fetchJson(`${API_URL}/c/index-${now.i}.json`);
      catalogState.indexV = now.i;
      memory.groupChunks.clear();
      catalogChanged = true;
    }
    if (now.s !== catalogState.stockV) {
      catalogState.stock = await fetchJson(`${API_URL}/c/stock-${now.s}.json`);
      catalogState.stockV = now.s;
      catalogChanged = true;
    }

    const brandingChanged = applyBrandingSettings(now.branding);

    catalogState.lastSync = Date.now();
    catalogState.stale = false;
    if (brandingChanged || catalogChanged) {
      await persistSnapshot();
    }
    if (catalogChanged) notifyCatalogUpdated();
  } catch (err) {
    if (!catalogState.index) {
      await legacyBootstrapFallback();
      return catalogState;
    }
    catalogState.stale = true;
    return catalogState;
  }
  return catalogState;
}

/** Always fetch live branding from KV (ignores catalog soft TTL). */
export async function refreshBranding() {
  if (typeof window !== 'undefined' && window.__pfBranding) {
    const branding = window.__pfBranding;
    delete window.__pfBranding;
    if (branding && catalogState.index) {
      const changed = applyBrandingSettings(branding);
      if (changed) await persistSnapshot();
    }
    return branding ? { ...(catalogState.index?.settings || {}), ...branding } : getCachedSettings();
  }
  try {
    const now = await fetchJson(`${API_URL}/c/now`);
    if (now.branding) {
      if (catalogState.index) {
        const changed = applyBrandingSettings(now.branding);
        if (changed) await persistSnapshot();
      }
      return { ...(catalogState.index?.settings || {}), ...now.branding };
    }
  } catch { /* offline – use cache */ }
  return getCachedSettings();
}

/** Main catalog sync – deduped, 60s soft TTL. */
export function sync({ force = false } = {}) {
  if (inflight) return inflight;
  if (!force && catalogState.index && Date.now() - catalogState.lastSync < CATALOG_SYNC_POLICY.SOFT_TTL_MS) {
    return Promise.resolve(catalogState);
  }
  inflight = doSync().finally(() => { inflight = null; });
  return inflight;
}

export async function ensureFreshCatalog(opts) {
  return sync(opts);
}

export async function ensureBootstrap(opts = {}) {
  if (!catalogState.index) await hydrateFromIdb();
  return sync(opts);
}

export async function ensureSettings({ force = false } = {}) {
  if (!force && catalogState.index?.settings) return catalogState.index.settings;
  await ensureBootstrap({ force });
  return catalogState.index?.settings || null;
}

export function getCachedSettings() {
  return catalogState.index?.settings || null;
}

export function getCachedMeta() {
  return buildMetaFromState();
}

export function getFiltersFromCache() {
  const meta = getCachedMeta();
  if (!meta) return null;
  return {
    brands: meta.brands,
    categories: meta.categories,
    goals: meta.goals || [],
    total_groups: meta.total_groups,
    synced_at: meta.synced_at
  };
}

export function queryCatalogFromCache(params, page = 1, limit = 24) {
  const meta = getCachedMeta();
  if (!meta?.index) return null;
  const fullIndex = enrichIndexProducts(catalogState.index?.products || meta.index);
  const filtered = filterIndex(fullIndex, params, meta);
  return {
    ...paginateIndex(filtered, page, limit),
    synced_at: meta.synced_at
  };
}

export function getFacetsFromCache(params) {
  const meta = getCachedMeta();
  if (!meta) return null;
  const fullIndex = enrichIndexProducts(catalogState.index?.products || []);
  return computeFacets(fullIndex, params, meta);
}

async function loadGroupChunk(chunkIndex) {
  const indexV = catalogState.indexV;
  if (!indexV) return null;
  const cacheKey = `${indexV}:${chunkIndex}`;
  if (memory.groupChunks.has(cacheKey)) return memory.groupChunks.get(cacheKey);

  try {
    const groups = await fetchJson(`${API_URL}/c/groups-${indexV}-${chunkIndex}.json`);
    memory.groupChunks.set(cacheKey, groups);
    return groups;
  } catch {
    const res = await fetch(`${API_URL}/portfolio/chunk?index=${chunkIndex}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Грешка при зареждане на продукт');
    memory.groupChunks.set(cacheKey, data.groups);
    return data.groups;
  }
}

function applyStockToGroup(group) {
  if (!group?.variants) return group;
  return {
    ...group,
    variants: group.variants.map((v) => ({
      ...v,
      available: skuQty(v.sku_id) > 0
    }))
  };
}

export async function getProductFromCache(groupId) {
  const meta = getCachedMeta();
  if (!meta?.lookup) return null;

  const chunkIndex = meta.lookup[groupId];
  if (chunkIndex == null) return null;

  const chunk = await loadGroupChunk(chunkIndex);
  const product = chunk?.find((g) => g.group_id === groupId) || null;
  return product ? applyStockToGroup(product) : null;
}

export async function getDescriptionFromCache(groupId) {
  const product = await getProductFromCache(groupId);
  if (product?.description) return { description: product.description };

  const res = await fetch(
    `${API_URL}/portfolio/product/description?group_id=${encodeURIComponent(groupId)}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Грешка при описание');
  return data;
}

export function findGroupIdBySkuFromCache(skuId) {
  const sku = String(skuId || '').trim();
  if (!sku) return null;
  const meta = getCachedMeta();
  if (meta?.sku_lookup?.[sku]) return meta.sku_lookup[sku];
  if (catalogState.index?.sku_lookup?.[sku]) return catalogState.index.sku_lookup[sku];
  return null;
}

export async function resolveGroupIdBySku(skuId) {
  const fromLookup = findGroupIdBySkuFromCache(skuId);
  if (fromLookup) return fromLookup;

  const sku = String(skuId || '').trim();
  if (!sku) return null;
  const meta = getCachedMeta();
  if (!meta?.chunk_count) return null;

  for (let i = 0; i < meta.chunk_count; i += 1) {
    const chunk = await loadGroupChunk(i);
    if (!chunk) continue;
    for (const group of chunk) {
      if (group.variants?.some((v) => String(v.sku_id) === sku)) {
        return group.group_id;
      }
    }
  }
  return null;
}

export function invalidatePortfolioCache() {
  catalogState.index = null;
  catalogState.indexV = null;
  catalogState.stock = null;
  catalogState.stockV = null;
  catalogState.lastSync = 0;
  catalogState.stale = false;
  memory.groupChunks.clear();
  inflight = null;
  if (typeof indexedDB !== 'undefined') {
    indexedDB.deleteDatabase(IDB_NAME);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sync();
  });
}

// Hydrate on module load for faster first paint
if (typeof window !== 'undefined') {
  hydrateFromIdb().catch(() => {});
}
