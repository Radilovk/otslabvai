/**
 * Sila.bg Distro API v1 – catalog fetch, normalization, order submission.
 * API docs: https://distro.silabg.com (B2B profile → API tab)
 */

import { FITNESS1_CATALOG_CATEGORIES } from './portfolio-fitness1-categories.js';

const SILA_BASE_URL = 'https://distro.silabg.com/api/v1';
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

function normalizeSilaApiToken(raw) {
  if (!raw) return '';
  let token = String(raw).trim();
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1).trim();
  }
  return token;
}

/** Worker secret first, then KV. */
export async function getSilaApiToken(env) {
  const candidates = [
    normalizeSilaApiToken(env.SILA_API_TOKEN),
    normalizeSilaApiToken(await env.PAGE_CONTENT?.get(KV_SILA_TOKEN)),
  ].filter((key, index, all) => key && all.indexOf(key) === index);
  return candidates[0] || null;
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
    image: pickFirst(item, ['image', 'image_url', 'img'], ''),
    label: pickFirst(item, ['label', 'label_url'], ''),
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

function extractSilaProductList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.data?.products)) return data.data.products;
  return [];
}

/** Fetch all products from Sila Distro API. */
export async function fetchSilaProducts(apiToken) {
  const data = await silaRequest(apiToken, 'product', {
    method: 'POST',
    body: { brand_id: 0, model_id: 0, taste_id: 0, size_id: 0 },
  });
  const items = extractSilaProductList(data);
  if (!items.length && data?.status === 200) {
    return [];
  }
  return normalizeSilaProducts(items);
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
