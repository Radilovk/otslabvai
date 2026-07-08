/**
 * Client-side catalog cache – one bootstrap request per session/day,
 * then zero backend calls for browse/filter/search.
 */
import { API_URL } from './config.js';
import { filterIndex, paginateIndex, computeFacets } from './portfolio-filter.js';

const BOOTSTRAP_KEY = 'portfolio_bootstrap_v1';
const TTL_MS = 24 * 60 * 60 * 1000;

const memory = {
  bootstrap: null,
  chunks: new Map()
};

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
  memory.bootstrap = cached;
  memory.chunks.clear();
  return cached;
}

async function revalidateBootstrapIfStale() {
  const current = memory.bootstrap;
  if (!current?.synced_at) return;
  try {
    const res = await fetch(`${API_URL}/portfolio/meta-version`);
    if (!res.ok) return;
    const version = await res.json();
    if (version.synced_at && version.synced_at !== current.synced_at) {
      await fetchBootstrap();
    }
  } catch { /* offline – keep cache */ }
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
      revalidateBootstrapIfStale();
      return stored;
    }
  }

  return fetchBootstrap();
}

export function getCachedSettings() {
  return memory.bootstrap?.settings || null;
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

/** Invalidate client cache after admin sync (call from admin). */
export function invalidatePortfolioCache() {
  memory.bootstrap = null;
  memory.chunks.clear();
  try {
    localStorage.removeItem(BOOTSTRAP_KEY);
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith('portfolio_')) keys.push(key);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}
