/**
 * Sila.bg Distro API v1 – catalog fetch, normalization, order submission.
 * API docs: https://distro.silabg.com (B2B profile → API tab)
 */

import { FITNESS1_CATALOG_CATEGORIES } from './portfolio-fitness1-categories.js';

const SILA_BASE_URL = 'https://distro.silabg.com/api/v1';
const SILA_PUBLIC_ORIGIN = 'https://www.silabg.com';
const SILA_BRANDFEED_CONCURRENCY = 6;
export const KV_SILA_TOKEN = 'sila_api_token';
export const DISTRIBUTOR_SILA = 'sila';
export const DISTRIBUTOR_FITNESS1 = 'fitness1';

/** Numeric namespace for Sila-only catalog rows (avoids collisions with Fitness1 ids). */
export const SILA_GROUP_ID_OFFSET = 90000000;
export const SILA_BRAND_ID_OFFSET = 9000000;
export const SILA_SKU_ID_OFFSET = 9000000000;

function normalizeBrandKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[™®©]/g, '')
    .replace(/\s+/g, ' ');
}

/** Map Sila category strings into the same taxonomy as the main catalog (for filters/goals). */
export function mapSilaCategoryToCatalogTaxonomy(rawCategory) {
  const raw = String(rawCategory || '').trim();
  if (!raw || /^sila\b/i.test(raw)) return 'Други';

  const parts = raw.split('>').map((p) => p.trim()).filter(Boolean);
  const top = parts[0] || '';
  const lowerTop = top.toLowerCase();

  for (const cat of FITNESS1_CATALOG_CATEGORIES) {
    if (top === cat) {
      return parts.length > 1 ? parts.join(' > ') : cat;
    }
    if (lowerTop === cat.toLowerCase()) {
      parts[0] = cat;
      return parts.join(' > ');
    }
  }

  const lowerRaw = raw.toLowerCase();
  for (const cat of FITNESS1_CATALOG_CATEGORIES) {
    if (lowerRaw.includes(cat.toLowerCase())) {
      const idx = lowerRaw.indexOf(cat.toLowerCase());
      const tail = raw.slice(idx + cat.length).replace(/^[>\s/|-]+/, '').trim();
      return tail ? `${cat} > ${tail}` : cat;
    }
  }

  /** @type {[RegExp, string][]} */
  const SYNONYMS = [
    [/протеин|whey|casein|изолат/i, 'Протеини'],
    [/креатин/i, 'Креатин'],
    [/витамин/i, 'Витамини'],
    [/минерал|магнезий|цинк|калций/i, 'Минерали'],
    [/аминокиселин|bcaa|eaa|glutamine|глутамин/i, 'Аминокиселини'],
    [/мазнин|fat\s*burn|термо|липо/i, 'Изгаряне на мазнини'],
    [/предтрен|pre.?workout/i, 'Предтренировъчни добавки'],
    [/став|колаген|глюкозамин/i, 'Стави и сухожилия'],
    [/билк|herb/i, 'Билки'],
    [/анти.?ейдж|anti.?aging/i, 'Anti-Aging / Против стареене'],
    [/маса|gainer|bulk/i, 'Качване на маса и възстановяване'],
    [/аксесоар|шейкър|belt|колан/i, 'Спортни аксесоари и уреди'],
  ];
  for (const [pattern, cat] of SYNONYMS) {
    if (pattern.test(raw)) return cat;
  }

  return 'Други';
}

function silaGroupId(modelId) {
  const n = parseInt(String(modelId), 10) || 0;
  return String(SILA_GROUP_ID_OFFSET + n);
}

function silaBrandId(brandId) {
  const n = parseInt(String(brandId), 10) || 0;
  return String(SILA_BRAND_ID_OFFSET + n);
}

function silaSkuId(modelId, tasteId, sizeId) {
  const m = parseInt(String(modelId), 10) || 0;
  const t = parseInt(String(tasteId), 10) || 0;
  const s = parseInt(String(sizeId), 10) || 0;
  return String(SILA_SKU_ID_OFFSET + m * 100000 + t * 1000 + s);
}

export function normalizeSilaApiToken(raw) {
  if (!raw) return '';
  let token = String(raw).trim();
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(token)) {
    token = token.replace(/^bearer\s+/i, '').trim();
  }
  const apiTokenMatch = token.match(/(?:^|[?&])api_token=([^&\s#]+)/i);
  if (apiTokenMatch) {
    try {
      token = decodeURIComponent(apiTokenMatch[1]);
    } catch {
      token = apiTokenMatch[1];
    }
  }
  if (token.includes('\n')) {
    const line = token.split('\n').map((l) => l.trim()).find((l) => l.length >= 20);
    if (line) token = line;
  }
  return token.trim();
}

/** Sila distro API tokens are alphanumeric (often ~32 or ~80 chars from B2B profile → API tab). */
export function isValidSilaApiToken(token) {
  const normalized = normalizeSilaApiToken(token);
  return /^[A-Za-z0-9]{24,96}$/.test(normalized);
}

/**
 * All configured Sila tokens, preferring valid-format KV over invalid worker secret.
 * @param {object} env
 * @returns {Promise<string[]>}
 */
export async function listSilaApiTokenCandidates(env) {
  /** @type {{ source: string, token: string }[]} */
  const entries = [
    { source: 'worker_secret', token: normalizeSilaApiToken(env.SILA_API_TOKEN) },
    { source: 'kv', token: normalizeSilaApiToken(await env.PAGE_CONTENT?.get(KV_SILA_TOKEN)) },
  ].filter((entry) => entry.token);

  const seen = new Set();
  const unique = [];
  for (const entry of entries) {
    if (seen.has(entry.token)) continue;
    seen.add(entry.token);
    unique.push(entry);
  }

  unique.sort((a, b) => {
    const aValid = isValidSilaApiToken(a.token) ? 1 : 0;
    const bValid = isValidSilaApiToken(b.token) ? 1 : 0;
    if (bValid !== aValid) return bValid - aValid;
    const aKv = a.source === 'kv' ? 1 : 0;
    const bKv = b.source === 'kv' ? 1 : 0;
    return bKv - aKv;
  });

  return unique.map((entry) => entry.token);
}

/** Best Sila token for API calls (valid KV preferred over invalid worker secret). */
export async function getSilaApiToken(env) {
  const candidates = await listSilaApiTokenCandidates(env);
  return candidates[0] || null;
}

/**
 * Fetch Sila catalog, trying each token until one succeeds.
 * @param {string[]} tokens
 * @returns {Promise<{ products: object[], error: Error|null, token_used: string|null }>}
 */
export async function fetchSilaProductsWithFallback(tokens) {
  const list = [...new Set((tokens || []).map(normalizeSilaApiToken).filter(Boolean))];
  if (!list.length) return { products: [], error: null, token_used: null };

  /** @type {Error|null} */
  let lastError = null;
  for (const token of list) {
    try {
      const products = await fetchSilaProducts(token);
      return { products, error: null, token_used: token };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (e instanceof SilaError && (e.status === 401 || e.status === 403)) {
        continue;
      }
      throw e;
    }
  }
  return { products: [], error: lastError, token_used: null };
}

/** @param {object} env */
export async function fetchSilaProductsForEnv(env) {
  const tokens = await listSilaApiTokenCandidates(env);
  return fetchSilaProductsWithFallback(tokens);
}

export class SilaError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'SilaError';
    this.status = status;
  }
}

async function silaRequest(apiToken, path, { method = 'GET', body = null } = {}) {
  const url = `${SILA_BASE_URL}/${path.replace(/^\//, '')}?api_token=${encodeURIComponent(apiToken)}`;
  const options = {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; BiocodePortfolio/1.0; +https://daotslabna.com)',
    },
  };
  if (body != null) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const preview = text.replace(/\s+/g, ' ').slice(0, 120);
    throw new SilaError(
      `Sila API грешка: ${response.status} (невалиден JSON)${preview ? ` — ${preview}` : ''}`,
      502
    );
  }

  if (!response.ok || (data.status && data.status !== 200 && data.status !== '200')) {
    const detail = data?.message || data?.error || '';
    throw new SilaError(
      `Sila API грешка: ${response.status}${detail ? ` — ${detail}` : ''}`,
      response.status >= 400 && response.status < 600 ? response.status : 502
    );
  }

  return data;
}

function pickFirst(obj, keys, fallback = '') {
  for (const key of keys) {
    const val = obj?.[key];
    if (val != null && val !== '') return val;
  }
  return fallback;
}

const SILA_IMAGE_FIELD_KEYS = [
  'image', 'image_url', 'img', 'thumb', 'thumbnail',
  'product_image', 'model_image', 'photo', 'picture',
  'img_url', 'image_small', 'image_large', 'image_path',
  'small_image', 'large_image', 'product_thumb', 'model_thumb',
];

/** Normalize Sila image paths to absolute URLs (often /uf/product/... on silabg.com). */
export function resolveSilaImageUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `${SILA_PUBLIC_ORIGIN}${raw}`;
  return `${SILA_PUBLIC_ORIGIN}/${raw.replace(/^\//, '')}`;
}

/** Extract image URL from a Sila API row (product list, brandfeed, or barcode detail). */
export function extractSilaImageFromItem(item) {
  return resolveSilaImageUrl(pickFirst(item, SILA_IMAGE_FIELD_KEYS, ''));
}

function productRowNeedsImage(item) {
  return !extractSilaImageFromItem(item);
}

function collectSilaFeedRows(data) {
  /** @type {object[]} */
  const rows = [];
  const visit = (node) => {
    if (node == null) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== 'object') return;
    rows.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) visit(value);
    }
  };
  visit(data?.data ?? data);
  return rows;
}

/**
 * Build model_id / barcode → image lookup from brandfeed payload.
 * @param {object[]|object} feedPayload
 */
export function buildSilaImageLookup(feedPayload) {
  const byModel = new Map();
  const byBarcode = new Map();
  for (const item of collectSilaFeedRows(feedPayload)) {
    const image = extractSilaImageFromItem(item);
    if (!image) continue;
    const modelId = String(pickFirst(item, ['model_id', 'product_model_id', 'id'], '')).trim();
    const barcode = String(pickFirst(item, ['barcode_ean', 'ean', 'barcode'], '')).trim();
    if (modelId) byModel.set(modelId, image);
    if (barcode) byBarcode.set(barcode, image);
  }
  return { byModel, byBarcode };
}

/**
 * @param {object} item
 * @param {{ byModel: Map<string, string>, byBarcode: Map<string, string> }} lookup
 */
export function enrichSilaProductRow(item, lookup) {
  if (!item || typeof item !== 'object') return item;
  if (extractSilaImageFromItem(item)) return item;

  const modelId = String(pickFirst(item, ['model_id', 'product_model_id', 'id'], '')).trim();
  const barcode = String(pickFirst(item, ['barcode_ean', 'ean', 'barcode'], '')).trim();
  const image = (modelId && lookup.byModel.get(modelId))
    || (barcode && lookup.byBarcode.get(barcode))
    || '';
  return image ? { ...item, image } : item;
}

async function mapPool(items, limit, fn) {
  if (!items.length) return [];
  const results = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }));
  return results;
}

function extractSilaProductList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.data?.products)) return data.data.products;
  return [];
}

/** Product list – docs: GET /product; PHP client: POST with brand/model filters. */
async function fetchSilaProductListRaw(apiToken) {
  try {
    const getData = await silaRequest(apiToken, 'product', { method: 'GET' });
    const getItems = extractSilaProductList(getData);
    if (getItems.length) return getItems;
  } catch {
    // Fall through to POST list used by the official PHP consumer.
  }

  const postData = await silaRequest(apiToken, 'product', {
    method: 'POST',
    body: { brand_id: 0, model_id: 0, taste_id: 0, size_id: 0 },
  });
  return extractSilaProductList(postData);
}

/**
 * Brand feed – POST with brand_id (official PHP client); images + model metadata.
 * @param {string} apiToken
 * @param {string|number} brandId
 */
export async function fetchSilaBrandFeed(apiToken, brandId) {
  return silaRequest(apiToken, 'brandfeed', {
    method: 'POST',
    body: { brand_id: String(brandId) },
  });
}

/** Product detail by EAN – docs: GET /product/{barcode}. */
export async function fetchSilaProductByBarcode(apiToken, barcode) {
  const ean = String(barcode || '').trim();
  if (!ean) throw new SilaError('Липсва баркод за Sila product detail.', 400);
  return silaRequest(apiToken, `product/${encodeURIComponent(ean)}`, { method: 'GET' });
}

async function loadSilaImageLookup(apiToken, rawItems) {
  const lookup = { byModel: new Map(), byBarcode: new Map() };
  if (!rawItems.some(productRowNeedsImage)) return lookup;

  const brandIds = new Set();
  for (const item of rawItems) {
    const brandId = String(pickFirst(item, ['brand_id'], '')).trim();
    if (brandId && brandId !== '0') brandIds.add(brandId);
  }

  if (!brandIds.size) {
    const brands = await fetchSilaBrands(apiToken);
    for (const brand of brands) {
      const brandId = String(pickFirst(brand, ['brand_id', 'id'], '')).trim();
      if (brandId && brandId !== '0') brandIds.add(brandId);
    }
  }

  const feeds = await mapPool([...brandIds], SILA_BRANDFEED_CONCURRENCY, async (brandId) => {
    try {
      return await fetchSilaBrandFeed(apiToken, brandId);
    } catch (e) {
      console.warn(`Sila brandfeed ${brandId}: ${e?.message || e}`);
      return null;
    }
  });

  for (const feed of feeds) {
    if (!feed) continue;
    const partial = buildSilaImageLookup(feed);
    for (const [key, value] of partial.byModel) lookup.byModel.set(key, value);
    for (const [key, value] of partial.byBarcode) lookup.byBarcode.set(key, value);
  }

  return lookup;
}

function parsePrice(value) {
  if (value == null || value === '') return 0;
  const n = parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function isSilaProductAvailable(item) {
  const qty = pickFirst(item, ['qty', 'quantity', 'stock', 'available_qty'], null);
  if (qty != null && qty !== '') {
    const n = parseInt(String(qty), 10);
    if (!Number.isNaN(n)) return n > 0;
  }
  const flag = pickFirst(item, ['available', 'in_stock', 'is_available'], null);
  if (flag === true || flag === 1 || flag === '1') return true;
  if (flag === false || flag === 0 || flag === '0') return false;
  const status = String(pickFirst(item, ['status', 'availability'], '')).toLowerCase();
  if (status.includes('налич') || status === 'available' || status === 'in_stock') return true;
  if (status.includes('неналич') || status === 'out_of_stock' || status === 'unavailable') return false;
  return true;
}

/**
 * Normalize one Sila product row to Fitness1-compatible raw SKU for groupRawProducts().
 * @param {object} item
 * @returns {object|null}
 */
export function normalizeSilaProduct(item) {
  if (!item || typeof item !== 'object') return null;

  const modelId = String(pickFirst(item, ['model_id', 'product_model_id', 'id'], '')).trim();
  const tasteId = String(pickFirst(item, ['taste_id', 'flavor_id'], '0')).trim() || '0';
  const sizeId = String(pickFirst(item, ['size_id', 'pack_id'], '0')).trim() || '0';
  if (!modelId) return null;

  const brandId = String(pickFirst(item, ['brand_id'], '0')).trim() || '0';
  const barcode = String(pickFirst(item, ['barcode_ean', 'ean', 'barcode'], '')).trim();
  const skuId = barcode || silaSkuId(modelId, tasteId, sizeId);

  const b2b = parsePrice(pickFirst(item, ['price', 'b2b_price', 'dealer_price', 'wholesale_price'], ''));
  const regular = parsePrice(pickFirst(item, ['price_retail', 'regular_price', 'retail_price', 'rrp'], '')) || b2b;
  const sale = parsePrice(pickFirst(item, ['price_promo', 'sale_price', 'promo_price'], ''));

  const productName = pickFirst(item, ['product_name', 'model_name', 'name', 'title'], 'Без име');
  const brandName = pickFirst(item, ['brand_name', 'brand'], '');
  const tasteName = pickFirst(item, ['taste_name', 'taste', 'flavor_name', 'flavor'], '');
  const sizeName = pickFirst(item, ['size_name', 'size', 'pack', 'packaging'], '');
  const rawCategory = pickFirst(item, ['category', 'category_name', 'group'], '');
  const category = mapSilaCategoryToCatalogTaxonomy(rawCategory);

  return {
    id: skuId,
    group_id: silaGroupId(modelId),
    product_id: modelId,
    product_name: productName,
    brand_id: silaBrandId(brandId),
    brand_name: brandName,
    pack: sizeName,
    option: tasteName,
    category,
    image: extractSilaImageFromItem(item),
    label: resolveSilaImageUrl(pickFirst(item, ['label', 'label_url'], '')),
    barcode,
    b2b_price: b2b > 0 ? b2b.toFixed(2) : '0.00',
    regular_price: regular > 0 ? regular.toFixed(2) : (b2b > 0 ? b2b.toFixed(2) : '0.00'),
    sale_price: sale > 0 ? sale.toFixed(2) : '0.00',
    available: isSilaProductAvailable(item),
    description: pickFirst(item, ['description', 'desc'], ''),
    distributor: DISTRIBUTOR_SILA,
    distributor_ids: {
      model_id: modelId,
      taste_id: tasteId,
      size_id: sizeId,
    },
  };
}

/**
 * @param {object[]} items - raw Sila API product rows
 * @returns {object[]}
 */
export function normalizeSilaProducts(items) {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeSilaProduct).filter(Boolean);
}

/** Fetch all products from Sila Distro API (product list + brandfeed images). */
export async function fetchSilaProducts(apiToken) {
  const rawItems = await fetchSilaProductListRaw(apiToken);
  if (!rawItems.length) return [];

  const imageLookup = await loadSilaImageLookup(apiToken, rawItems);
  const enriched = rawItems.map((item) => enrichSilaProductRow(item, imageLookup));
  return normalizeSilaProducts(enriched);
}

/** Fetch brand list (optional, for diagnostics). */
export async function fetchSilaBrands(apiToken) {
  const data = await silaRequest(apiToken, 'brand');
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

function productsToSilaOrderData(products) {
  return products.map((p) => {
    const ids = p.distributor_ids || {};
    if (ids.model_id && ids.taste_id) {
      return {
        model_id: String(ids.model_id),
        taste_id: String(ids.taste_id),
        qtty: Number(p.quantity) || 1,
      };
    }
    if (p.barcode) {
      return { ean: String(p.barcode), qtty: Number(p.quantity) || 1 };
    }
    throw new SilaError(`Липсват Sila идентификатори за „${p.name || p.sku_id}".`, 400);
  });
}

/**
 * Submit order to Sila Distro API.
 * @param {string} apiToken
 * @param {object[]} products - normalized order lines with distributor_ids or barcode
 * @param {object} [options]
 */
export async function submitSilaOrder(apiToken, products, options = {}) {
  const payload = {
    delivery_type: options.delivery_type ?? null,
    office: options.office ?? null,
    address_id: options.address_id ?? null,
    invoice: options.invoice ?? null,
    data: productsToSilaOrderData(products),
  };

  const data = await silaRequest(apiToken, 'order', { method: 'POST', body: payload });
  return data;
}

/** Merge catalogs: Fitness1 first, then Sila-only rows (deduped by barcode, brands unified by name). */
export function mergeCatalogProducts(fitness1Products = [], silaProducts = []) {
  const f1 = (fitness1Products || []).map((p) => ({ ...p, distributor: DISTRIBUTOR_FITNESS1 }));

  const seenBarcodes = new Set();
  const brandByName = new Map();
  for (const p of f1) {
    const bc = String(p.barcode || '').trim();
    if (bc) seenBarcodes.add(bc);
    const bk = normalizeBrandKey(p.brand_name);
    if (bk && p.brand_id) brandByName.set(bk, String(p.brand_id));
  }

  const merged = [...f1];
  for (const raw of silaProducts || []) {
    const bc = String(raw.barcode || '').trim();
    if (bc && seenBarcodes.has(bc)) continue;

    const item = { ...raw, distributor: raw.distributor || DISTRIBUTOR_SILA };
    const bk = normalizeBrandKey(item.brand_name);
    if (bk && brandByName.has(bk)) {
      item.brand_id = brandByName.get(bk);
    }
    if (!item.category || /^sila\b/i.test(item.category)) {
      item.category = 'Други';
    } else {
      item.category = mapSilaCategoryToCatalogTaxonomy(item.category);
    }

    merged.push(item);
    if (bc) seenBarcodes.add(bc);
  }

  return merged;
}

export function isSilaDistributor(distributor) {
  return String(distributor || '').toLowerCase() === DISTRIBUTOR_SILA;
}

export function isFitness1Distributor(distributor) {
  const d = String(distributor || DISTRIBUTOR_FITNESS1).toLowerCase();
  return d === DISTRIBUTOR_FITNESS1 || d === 'f1';
}
