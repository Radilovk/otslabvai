/**
 * Client-side catalog cache – one bootstrap request per session/day,
 * then zero backend calls for browse/filter/search.
 */
import { API_URL } from './config.js';
import { filterIndex, paginateIndex, computeFacets } from './portfolio-filter.js';

const BOOTSTRAP_KEY = 'portfolio_bootstrap_v1';
const SETTINGS_KEY = 'portfolio_settings_v1';
const TTL_MS = 24 * 60 * 60 * 1000;
const SETTINGS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** After this age, re-check meta-version when tab becomes visible. */
const SOFT_STALE_MS = 30 * 60 * 1000;
/** Avoid hammering meta-version on every navigation within a session. */
const REVALIDATE_COOLDOWN_MS = 10 * 60 * 1000;

const memory = {
  bootstrap: null,
  settings: null,
  chunks: new Map()
};

let bootstrapPromise = null;
let settingsPromise = null;
let revalidatePromise = null;
let lastRevalidateAt = 0;
const catalogUpdatedListeners = new Set();

function notifyCatalogUpdated() {
  for (const listener of catalogUpdatedListeners) {
    try { listener(); } catch { /* ignore */ }
  }
}

/** Subscribe to bootstrap refresh (e.g. catalog page re-render). Returns unsubscribe. */
export function onCatalogUpdated(listener) {
  catalogUpdatedListeners.add(listener);
  return () => catalogUpdatedListeners.delete(listener);
}

function readBootstrapStorage() {
  try {
    const raw = localStorage.getItem(BOOTSTRAP_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.meta?.index || !data.fetchedAt) return null;
    if (Date.now() - data.fetchedAt > TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeBootstrapStorage(data) {
  try {
    localStorage.setItem(BOOTSTRAP_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function readSettingsStorage() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.settings || !data.fetchedAt) return null;
    if (Date.now() - data.fetchedAt > SETTINGS_TTL_MS) return null;
    return data.settings;
  } catch {
    return null;
  }
}

function writeSettingsStorage(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ fetchedAt: Date.now(), settings }));
    memory.settings = settings;
    return true;
  } catch {
    return false;
  }
}

function chunkStorageKey(syncedAt, index) {
  return `portfolio_chunk_${syncedAt}_${index}`;
}

function productStorageKey(groupId) {
  return `portfolio_product_${groupId}`;
}

function descriptionStorageKey(groupId) {
  return `portfolio_desc_${groupId}`;
}

async function fetchBootstrap() {
  const prevSynced = memory.bootstrap?.synced_at;
  const res = await fetch(`${API_URL}/portfolio/bootstrap`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Грешка при зареждане на каталога');
  const cached = {
    fetchedAt: Date.now(),
    synced_at: data.meta.synced_at,
    settings: data.settings,
    meta: data.meta
  };
  writeBootstrapStorage(cached);
  writeSettingsStorage(data.settings);
  memory.bootstrap = cached;
  memory.chunks.clear();
  if (prevSynced && cached.synced_at !== prevSynced) {
    notifyCatalogUpdated();
  }
  return cached;
}

async function fetchSettings() {
  const res = await fetch(`${API_URL}/portfolio/settings`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Грешка при зареждане на настройки');
  writeSettingsStorage(data);
  return data;
}

async function revalidateBootstrapIfStale({ force = false } = {}) {
  const current = memory.bootstrap;
  if (!current?.synced_at) return;

  const now = Date.now();
  if (!force && now - lastRevalidateAt < REVALIDATE_COOLDOWN_MS) return;
  if (revalidatePromise) return revalidatePromise;

  revalidatePromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/portfolio/meta-version`);
      if (!res.ok) return;
      const version = await res.json();
      lastRevalidateAt = Date.now();
      if (version.synced_at && version.synced_at !== current.synced_at) {
        bootstrapPromise = null;
        await fetchBootstrap();
      }
    } catch { /* offline – keep cache */ }
    finally {
      revalidatePromise = null;
    }
  })();

  return revalidatePromise;
}

/** Revalidate when cache is soft-stale (e.g. tab focus) without full reload. */
export async function ensureFreshCatalog() {
  const bootstrap = memory.bootstrap || readBootstrapStorage();
  if (!bootstrap?.fetchedAt) return;
  if (Date.now() - bootstrap.fetchedAt < SOFT_STALE_MS) return;
  await revalidateBootstrapIfStale({ force: true });
}

/** Lightweight settings load – no full catalog index (checkout, legal pages). */
export async function ensureSettings({ force = false } = {}) {
  if (!force && memory.settings) return memory.settings;

  if (!force) {
    const stored = readSettingsStorage();
    if (stored) {
      memory.settings = stored;
      return stored;
    }
    const bootstrapStored = readBootstrapStorage();
    if (bootstrapStored?.settings) {
      memory.settings = bootstrapStored.settings;
      writeSettingsStorage(bootstrapStored.settings);
      return bootstrapStored.settings;
    }
  }

  if (settingsPromise && !force) return settingsPromise;

  settingsPromise = fetchSettings().finally(() => {
    settingsPromise = null;
  });
  return settingsPromise;
}

/** Load settings + catalog index (1 API call, then cached 24h). */
export async function ensureBootstrap({ force = false } = {}) {
  if (!force && memory.bootstrap) {
    revalidateBootstrapIfStale();
    return memory.bootstrap;
  }

  if (!force) {
    const stored = readBootstrapStorage();
    if (stored) {
      memory.bootstrap = stored;
      memory.settings = stored.settings;
      revalidateBootstrapIfStale();
      return stored;
    }
  }

  if (bootstrapPromise && !force) return bootstrapPromise;

  bootstrapPromise = fetchBootstrap().finally(() => {
    bootstrapPromise = null;
  });
  return bootstrapPromise;
}

export function getCachedSettings() {
  return memory.bootstrap?.settings || memory.settings || null;
}

export function getCachedMeta() {
  return memory.bootstrap?.meta || null;
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
  const filtered = filterIndex(meta.index, params, meta);
  return {
    ...paginateIndex(filtered, page, limit),
    synced_at: meta.synced_at
  };
}

/** Category/brand option lists scoped to the currently active filters (0 backend calls). */
export function getFacetsFromCache(params) {
  const meta = getCachedMeta();
  if (!meta?.index) return null;
  return computeFacets(meta.index, params, meta);
}

async function loadChunk(chunkIndex) {
  const meta = getCachedMeta();
  if (!meta) return null;

  if (memory.chunks.has(chunkIndex)) {
    return memory.chunks.get(chunkIndex);
  }

  const storageKey = chunkStorageKey(meta.synced_at, chunkIndex);
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      const groups = JSON.parse(stored);
      memory.chunks.set(chunkIndex, groups);
      return groups;
    }
  } catch { /* quota */ }

  const res = await fetch(`${API_URL}/portfolio/chunk?index=${chunkIndex}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Грешка при зареждане на продукт');

  memory.chunks.set(chunkIndex, data.groups);
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(data.groups));
  } catch { /* quota */ }

  return data.groups;
}

export async function getProductFromCache(groupId) {
  const meta = getCachedMeta();
  if (!meta?.lookup) return null;

  try {
    const stored = sessionStorage.getItem(productStorageKey(groupId));
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }

  const chunkIndex = meta.lookup[groupId];
  if (chunkIndex == null) return null;

  const chunk = await loadChunk(chunkIndex);
  const product = chunk?.find((g) => g.group_id === groupId) || null;
  if (product) {
    try {
      sessionStorage.setItem(productStorageKey(groupId), JSON.stringify(product));
    } catch { /* ignore */ }
  }
  return product;
}

export async function getDescriptionFromCache(groupId) {
  try {
    const stored = sessionStorage.getItem(descriptionStorageKey(groupId));
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }

  const product = await getProductFromCache(groupId);
  if (product?.description) {
    const payload = { description: product.description };
    try {
      sessionStorage.setItem(descriptionStorageKey(groupId), JSON.stringify(payload));
    } catch { /* ignore */ }
    return payload;
  }

  const res = await fetch(
    `${API_URL}/portfolio/product/description?group_id=${encodeURIComponent(groupId)}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Грешка при описание');

  try {
    sessionStorage.setItem(descriptionStorageKey(groupId), JSON.stringify(data));
  } catch { /* ignore */ }

  return data;
}

/** Намира group_id по SKU от кеширания каталог (sku_lookup или chunk scan). */
export function findGroupIdBySkuFromCache(skuId) {
  const sku = String(skuId || '').trim();
  if (!sku) return null;
  const meta = getCachedMeta();
  if (meta?.sku_lookup?.[sku]) return meta.sku_lookup[sku];
  return null;
}

/** Async fallback ако sku_lookup липсва (стари sync-ове). */
export async function resolveGroupIdBySku(skuId) {
  const fromLookup = findGroupIdBySkuFromCache(skuId);
  if (fromLookup) return fromLookup;

  const sku = String(skuId || '').trim();
  if (!sku) return null;
  const meta = getCachedMeta();
  if (!meta?.chunk_count) return null;

  for (let i = 0; i < meta.chunk_count; i += 1) {
    const chunk = await loadChunk(i);
    if (!chunk) continue;
    for (const group of chunk) {
      if (group.variants?.some((v) => String(v.sku_id) === sku)) {
        return group.group_id;
      }
    }
  }
  return null;
}

/** Fresh product from server (KV) – updates local cache. */
export async function fetchProductFromServer(groupId) {
  const res = await fetch(`${API_URL}/portfolio/product?group_id=${encodeURIComponent(groupId)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Грешка при зареждане на продукта');
  patchProductInCache(groupId, data);
  return data;
}

/** Merge server product into session/chunk/index caches. */
export function patchProductInCache(groupId, product) {
  const meta = getCachedMeta();
  if (!meta) return;

  try {
    sessionStorage.setItem(productStorageKey(groupId), JSON.stringify(product));
  } catch { /* quota */ }

  const chunkIndex = meta.lookup?.[groupId];
  if (chunkIndex != null && memory.chunks.has(chunkIndex)) {
    const chunk = memory.chunks.get(chunkIndex);
    const idx = chunk.findIndex((g) => g.group_id === groupId);
    if (idx >= 0) chunk[idx] = product;
  }

  const indexItem = meta.index?.find((item) => item.group_id === groupId);
  if (indexItem) {
    const hasAvailable = (product.variants || []).some((v) => v.available);
    indexItem.available = hasAvailable;
  }
}

/** Lightweight availability probe – KV only, no pricing validation. */
export async function checkSkusAvailability(skus) {
  const unique = [...new Set(
    (skus || []).map((s) => String(s).trim()).filter(Boolean)
  )];
  if (!unique.length) return { all_available: true, items: [] };

  const res = await fetch(`${API_URL}/portfolio/stock-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skus: unique })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Грешка при проверка на наличност');
  return data;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      ensureFreshCatalog();
    }
  });
}

/** Invalidate client cache after admin sync (call from admin). */
export function invalidatePortfolioCache() {
  memory.bootstrap = null;
  memory.settings = null;
  memory.chunks.clear();
  bootstrapPromise = null;
  settingsPromise = null;
  lastRevalidateAt = 0;
  try {
    localStorage.removeItem(BOOTSTRAP_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith('portfolio_')) keys.push(key);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}
