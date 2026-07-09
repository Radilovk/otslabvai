/**
 * Portfolio B2B catalog API – sync, catalog query, orders.
 * Used by worker.js for /portfolio/* routes.
 */

import { filterIndex } from './portfolio-filter.js';
import { enrichIndexEntry } from './portfolio-search.js';
import {
  validatePortfolioCustomer,
  sanitizePortfolioCustomer,
  validateCartHasSku
} from './portfolio-order-validation.js';

export { filterIndex };

const CHUNK_SIZE = 150;
const KV_SETTINGS = 'portfolio_settings';
const KV_META = 'portfolio_meta';
const KV_ORDERS = 'portfolio_orders';
const KV_PROMO = 'portfolio_promo_codes';
const chunkKey = (n) => `portfolio_chunk_${n}`;
const KV_FITNESS1_KEY = 'fitness1_api_key';

export async function getFitness1ApiKey(env) {
  if (env.FITNESS1_API_KEY) return env.FITNESS1_API_KEY;
  const kvKey = await env.PAGE_CONTENT.get(KV_FITNESS1_KEY);
  return kvKey || null;
}

export const DEFAULT_SETTINGS = {
  site_name: 'BIOCODE - Nutrition Science',
  site_slogan: 'Протеини, витамини, аминокиселини',
  global_markup_percent: 30,
  brand_markups: {},
  category_markups: {},
  product_overrides: {},
  last_sync: null,
  last_sync_count: 0,
  reseller_name: '',
  reseller_phone: '',
  reseller_address: '',
  reseller_delivery_note: 'Доставка до дистрибутор — разпределяне към клиенти от админ панела.'
};

export class PortfolioError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'PortfolioError';
    this.status = status;
  }
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

function cachedResponse(data, maxAge = 3600) {
  return jsonResponse(data, 200, {
    'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=86400`
  });
}

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}

function decodeDescription(html) {
  if (!html) return '';
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

export function calculateMarkupPercent(settings, product) {
  const overrides = settings.product_overrides || {};
  if (overrides[product.group_id]) {
    const o = overrides[product.group_id];
    if (typeof o.markup_percent === 'number') return o.markup_percent;
  }
  const brandMarkups = settings.brand_markups || {};
  if (product.brand_id && brandMarkups[product.brand_id] != null) {
    return Number(brandMarkups[product.brand_id]);
  }
  const catMarkups = settings.category_markups || {};
  const topCat = (product.category || '').split(' > ').filter(Boolean)[0] || '';
  if (topCat && catMarkups[topCat] != null) {
    return Number(catMarkups[topCat]);
  }
  return Number(settings.global_markup_percent) || 0;
}

export function calculateRetailPrice(b2bPrice, markupPercent, override) {
  if (override && typeof override.fixed_price === 'number') {
    return roundPrice(override.fixed_price);
  }
  return roundPrice(b2bPrice * (1 + markupPercent / 100));
}

export function groupRawProducts(rawProducts, settings, descriptionMap = null) {
  const groups = new Map();
  const overrides = settings.product_overrides || {};

  for (const p of rawProducts) {
    const gid = String(p.group_id);
    if (!groups.has(gid)) {
      groups.set(gid, {
        group_id: gid,
        product_id: p.product_id,
        name: p.product_name,
        brand: p.brand_name,
        brand_id: String(p.brand_id),
        category: p.category || '',
        category_path: (p.category || '').split(' > ').filter(Boolean),
        image: p.image || '',
        label: p.label || '',
        description: decodeDescription(p.description || descriptionMap?.get(gid) || ''),
        variants: []
      });
    }

    const g = groups.get(gid);
    if (!g.description) {
      const desc = p.description || descriptionMap?.get(gid);
      if (desc) g.description = decodeDescription(desc);
    }
    if (p.label && !g.label) g.label = p.label;

    const b2b = parseFloat(p.b2b_price) || 0;
    const markup = calculateMarkupPercent(settings, { ...p, group_id: gid });
    const retail = calculateRetailPrice(b2b, markup, overrides[gid]);

    g.variants.push({
      sku_id: String(p.id),
      barcode: p.barcode || '',
      pack: p.pack || '',
      option: p.option || '',
      b2b_price: b2b,
      retail_price: retail,
      markup_percent: markup,
      regular_price: parseFloat(p.regular_price) || 0,
      sale_price: parseFloat(p.sale_price) || 0,
      available: p.available === true,
      image: p.image || g.image
    });
  }

  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, 'bg'));
}

export function buildCatalogMeta(groups) {
  const brandMap = new Map();
  const categoryMap = new Map();
  const lookup = {};
  const sku_lookup = {};
  const index = [];

  groups.forEach((g, idx) => {
    const chunkIndex = Math.floor(idx / CHUNK_SIZE);
    lookup[g.group_id] = chunkIndex;

    for (const v of g.variants) {
      if (v.sku_id) sku_lookup[String(v.sku_id)] = g.group_id;
    }

    const availableVariants = g.variants.filter((v) => v.available);
    const prices = g.variants.map((v) => v.retail_price).filter((n) => n > 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    const packs = [...new Set(g.variants.map((v) => v.pack).filter(Boolean))];

    index.push(enrichIndexEntry({
      group_id: g.group_id,
      name: g.name,
      brand: g.brand,
      brand_id: g.brand_id,
      category: g.category,
      category_top: g.category_path[0] || '',
      category_path: g.category_path,
      min_price: minPrice,
      max_price: maxPrice,
      variant_count: g.variants.length,
      available: availableVariants.length > 0,
      image: g.image,
      packs
    }, g));

    const bCount = brandMap.get(g.brand_id) || { id: g.brand_id, name: g.brand, count: 0 };
    bCount.count++;
    brandMap.set(g.brand_id, bCount);

    const topCat = g.category_path[0] || 'Други';
    categoryMap.set(topCat, (categoryMap.get(topCat) || 0) + 1);
  });

  return {
    version: 1,
    chunk_size: CHUNK_SIZE,
    chunk_count: Math.ceil(groups.length / CHUNK_SIZE) || 0,
    total_groups: groups.length,
    brands: Array.from(brandMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'bg')),
    categories: Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'bg')),
    lookup,
    sku_lookup,
    index
  };
}

async function getSettings(env) {
  const raw = await env.PAGE_CONTENT.get(KV_SETTINGS);
  if (!raw) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
}

async function saveSettings(env, settings) {
  await env.PAGE_CONTENT.put(KV_SETTINGS, JSON.stringify(settings, null, 2));
}

async function getMeta(env) {
  const raw = await env.PAGE_CONTENT.get(KV_META);
  return raw ? JSON.parse(raw) : null;
}

async function getGroupFromChunks(env, meta, groupId) {
  const chunkIndex = meta.lookup[groupId];
  if (chunkIndex == null) return null;
  const chunkRaw = await env.PAGE_CONTENT.get(chunkKey(chunkIndex));
  if (!chunkRaw) return null;
  const chunk = JSON.parse(chunkRaw);
  return chunk.find((g) => g.group_id === groupId) || null;
}

export async function fetchDescriptionMap(apiKey) {
  try {
    const response = await fetch(
      `https://fitness1.bg/b2b/api/products_v3?key=${encodeURIComponent(apiKey)}&format=json&description=1`
    );
    if (!response.ok) return new Map();
    const data = await response.json();
    if (data.status !== 'ok' || !Array.isArray(data.products)) return new Map();

    const map = new Map();
    for (const p of data.products) {
      const gid = String(p.group_id);
      if (p.description && !map.has(gid)) map.set(gid, p.description);
    }
    return map;
  } catch {
    // Descriptions are non-critical — sync still succeeds with prices/stock,
    // individual product pages fall back to the on-demand fetch.
    return new Map();
  }
}

export async function syncPortfolioCatalog(env) {
  const apiKey = await getFitness1ApiKey(env);
  if (!apiKey) {
    throw new PortfolioError('FITNESS1_API_KEY не е конфигуриран (Worker secret или KV fitness1_api_key).', 500);
  }

  const settings = await getSettings(env);
  const response = await fetch(
    `https://fitness1.bg/b2b/api/products_v3?key=${encodeURIComponent(apiKey)}&format=json`
  );

  if (!response.ok) {
    throw new PortfolioError(`Fitness1 API грешка: ${response.status}`, 502);
  }

  const data = await response.json();
  if (data.status !== 'ok' || !Array.isArray(data.products)) {
    throw new PortfolioError('Невалиден отговор от Fitness1 API.', 502);
  }

  // Fetch full descriptions once here (sync is admin-triggered, not per-visitor)
  // so product pages never have to hit Fitness1 on-demand — that was the cause
  // of the very slow pf-description load.
  const descriptionMap = await fetchDescriptionMap(apiKey);

  const groups = groupRawProducts(data.products, settings, descriptionMap);
  const meta = buildCatalogMeta(groups);
  meta.synced_at = new Date().toISOString();

  const chunkCount = meta.chunk_count;
  const puts = [];

  for (let i = 0; i < chunkCount; i++) {
    const slice = groups.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    puts.push(env.PAGE_CONTENT.put(chunkKey(i), JSON.stringify(slice)));
  }

  // Remove stale chunks if catalog shrank
  const oldMeta = await getMeta(env);
  if (oldMeta && oldMeta.chunk_count > chunkCount) {
    for (let i = chunkCount; i < oldMeta.chunk_count; i++) {
      puts.push(env.PAGE_CONTENT.delete(chunkKey(i)));
    }
  }

  puts.push(env.PAGE_CONTENT.put(KV_META, JSON.stringify(meta)));
  settings.last_sync = meta.synced_at;
  settings.last_sync_count = groups.length;
  puts.push(saveSettings(env, settings));

  await Promise.all(puts);

  return {
    success: true,
    synced_at: meta.synced_at,
    total_groups: groups.length,
    total_skus: data.products.length,
    chunk_count: chunkCount
  };
}

async function handleGetSettings(env) {
  const settings = await getSettings(env);
  return cachedResponse(settings, 300);
}

async function handleSaveSettings(request, env) {
  const incoming = await request.json();
  const current = await getSettings(env);
  const merged = {
    ...current,
    site_name: incoming.site_name ?? current.site_name,
    site_slogan: incoming.site_slogan ?? current.site_slogan,
    global_markup_percent: Number(incoming.global_markup_percent ?? current.global_markup_percent),
    brand_markups: incoming.brand_markups ?? current.brand_markups,
    category_markups: incoming.category_markups ?? current.category_markups,
    product_overrides: incoming.product_overrides ?? current.product_overrides,
    reseller_name: incoming.reseller_name ?? current.reseller_name,
    reseller_phone: incoming.reseller_phone ?? current.reseller_phone,
    reseller_address: incoming.reseller_address ?? current.reseller_address,
    reseller_delivery_note: incoming.reseller_delivery_note ?? current.reseller_delivery_note
  };
  await saveSettings(env, merged);
  return jsonResponse({ success: true, settings: merged });
}

async function handleGetFilters(env) {
  const meta = await getMeta(env);
  if (!meta) {
    throw new PortfolioError('Каталогът не е синхронизиран. Стартирайте sync от админ панела.', 404);
  }
  return cachedResponse({
    brands: meta.brands,
    categories: meta.categories,
    total_groups: meta.total_groups,
    synced_at: meta.synced_at
  });
}

async function handleGetCatalog(request, env) {
  const meta = await getMeta(env);
  if (!meta) {
    throw new PortfolioError('Каталогът не е синхронизиран.', 404);
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '24', 10)));
  const params = {
    brand: url.searchParams.get('brand') || '',
    category: url.searchParams.get('category') || '',
    q: url.searchParams.get('q') || '',
    available: url.searchParams.get('available') || '',
    min_price: url.searchParams.get('min_price') || '',
    max_price: url.searchParams.get('max_price') || '',
    sort: url.searchParams.get('sort') || 'name'
  };

  const filtered = filterIndex(meta.index, params, meta);
  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  return cachedResponse({
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit) || 0,
    items,
    synced_at: meta.synced_at
  });
}

async function handleGetProduct(request, env) {
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id');
  if (!groupId) throw new PortfolioError('Липсва group_id.', 400);

  const meta = await getMeta(env);
  if (!meta) throw new PortfolioError('Каталогът не е синхронизиран.', 404);

  const group = await getGroupFromChunks(env, meta, groupId);
  if (!group) throw new PortfolioError('Продуктът не е намерен.', 404);

  return cachedResponse(group, 1800);
}

async function findVariantInCatalog(env, skuId) {
  const meta = await getMeta(env);
  if (!meta) return null;

  const sku = String(skuId);
  const groupId = meta.sku_lookup?.[sku];
  if (groupId) {
    const group = await getGroupFromChunks(env, meta, groupId);
    const variant = group?.variants.find((v) => v.sku_id === sku);
    if (variant) {
      return {
        group_id: group.group_id,
        group_name: group.name,
        brand: group.brand,
        image: variant.image || group.image,
        variant
      };
    }
  }

  // Fallback for catalogs synced before sku_lookup existed
  for (let i = 0; i < meta.chunk_count; i++) {
    const chunkRaw = await env.PAGE_CONTENT.get(chunkKey(i));
    if (!chunkRaw) continue;
    const chunk = JSON.parse(chunkRaw);
    for (const group of chunk) {
      const variant = group.variants.find((v) => v.sku_id === sku);
      if (variant) {
        return {
          group_id: group.group_id,
          group_name: group.name,
          brand: group.brand,
          image: variant.image || group.image,
          variant
        };
      }
    }
  }
  return null;
}

async function validateAndNormalizeCartItems(env, products) {
  const normalized = [];
  const errors = [];

  for (const p of products) {
    const skuId = String(p.sku_id || p.id || '');
    const qty = Math.max(1, Math.min(99, Number(p.quantity) || 1));
    if (!skuId) {
      errors.push('Липсва SKU на продукт.');
      continue;
    }

    const found = await findVariantInCatalog(env, skuId);
    if (!found) {
      errors.push(`Продукт ${skuId} не е намерен в каталога.`);
      continue;
    }
    if (!found.variant.available) {
      errors.push(`${found.group_name} (${found.variant.option || found.variant.pack}) не е наличен.`);
      continue;
    }

    const label = [found.group_name, found.variant.pack, found.variant.option].filter(Boolean).join(' – ');
    normalized.push({
      sku_id: found.variant.sku_id,
      barcode: found.variant.barcode,
      name: label,
      pack: found.variant.pack,
      option: found.variant.option,
      quantity: qty,
      b2b_price: found.variant.b2b_price,
      retail_price: found.variant.retail_price,
      image: found.image
    });
  }

  if (errors.length) throw new PortfolioError(errors.join(' '), 400);
  if (!normalized.length) throw new PortfolioError('Количката е празна.', 400);
  return normalized;
}

async function handleValidateCart(request, env) {
  const body = await request.json();
  if (!Array.isArray(body.products) || !body.products.length) {
    throw new PortfolioError('Липсват продукти.', 400);
  }
  const items = await validateAndNormalizeCartItems(env, body.products);
  const retailTotal = items.reduce((s, i) => s + i.retail_price * i.quantity, 0);
  return jsonResponse({ valid: true, products: items, retail_total: roundPrice(retailTotal) });
}

async function handleGetProductDescription(request, env) {
  const apiKey = await getFitness1ApiKey(env);
  if (!apiKey) throw new PortfolioError('API ключ не е конфигуриран.', 500);

  const groupId = new URL(request.url).searchParams.get('group_id');
  if (!groupId) throw new PortfolioError('Липсва group_id.', 400);

  const meta = await getMeta(env);
  if (!meta) throw new PortfolioError('Каталогът не е синхронизиран.', 404);

  const group = await getGroupFromChunks(env, meta, groupId);
  if (!group) throw new PortfolioError('Продуктът не е намерен.', 404);

  if (group.description) {
    return jsonResponse({ description: group.description });
  }

  const response = await fetch(
    `https://fitness1.bg/b2b/api/products_v3?key=${encodeURIComponent(apiKey)}&format=json&description=1`
  );
  if (!response.ok) throw new PortfolioError('Грешка при зареждане на описание.', 502);

  const data = await response.json();
  const match = (data.products || []).find((p) => String(p.group_id) === String(groupId) && p.description);
  const description = match ? decodeDescription(match.description) : '';
  return jsonResponse({ description });
}

async function handleMetaVersion(env) {
  const meta = await getMeta(env);
  if (!meta) throw new PortfolioError('Каталогът не е синхронизиран.', 404);
  return cachedResponse({
    synced_at: meta.synced_at,
    total_groups: meta.total_groups
  }, 60);
}

/** Single bootstrap: settings + catalog meta (1 KV read batch for client cache) */
async function handleBootstrap(env) {
  const settings = await getSettings(env);
  const meta = await getMeta(env);
  if (!meta) {
    throw new PortfolioError('Каталогът не е синхронизиран.', 404);
  }
  return cachedResponse({
    settings,
    meta: {
      version: meta.version,
      synced_at: meta.synced_at,
      total_groups: meta.total_groups,
      chunk_size: meta.chunk_size,
      chunk_count: meta.chunk_count,
      brands: meta.brands,
      categories: meta.categories,
      lookup: meta.lookup,
      index: meta.index
    }
  }, 3600);
}

async function handleGetChunk(request, env) {
  const url = new URL(request.url);
  const index = parseInt(url.searchParams.get('index'), 10);
  if (Number.isNaN(index) || index < 0) {
    throw new PortfolioError('Невалиден chunk index.', 400);
  }

  const meta = await getMeta(env);
  if (!meta) throw new PortfolioError('Каталогът не е синхронизиран.', 404);
  if (index >= meta.chunk_count) throw new PortfolioError('Chunk не е намерен.', 404);

  const chunkRaw = await env.PAGE_CONTENT.get(chunkKey(index));
  if (!chunkRaw) throw new PortfolioError('Chunk не е намерен.', 404);

  return cachedResponse({ index, groups: JSON.parse(chunkRaw), synced_at: meta.synced_at }, 86400);
}

// --- Portfolio promo codes ---

async function getPromoCodes(env) {
  const raw = await env.PAGE_CONTENT.get(KV_PROMO);
  return raw ? JSON.parse(raw) : [];
}

async function savePromoCodes(env, codes) {
  await env.PAGE_CONTENT.put(KV_PROMO, JSON.stringify(codes, null, 2));
}

function validatePromoRecord(promo, { increment = false } = {}) {
  if (!promo) return { valid: false, error: 'Невалиден промо код.' };
  if (!promo.active) return { valid: false, error: 'Промо кодът не е активен.' };
  const now = new Date();
  if (promo.validFrom && new Date(promo.validFrom) > now) {
    return { valid: false, error: 'Промо кодът все още не е валиден.' };
  }
  if (promo.validUntil && new Date(promo.validUntil) < now) {
    return { valid: false, error: 'Промо кодът е изтекъл.' };
  }
  if (promo.maxUses && promo.usedCount >= promo.maxUses) {
    return { valid: false, error: 'Промо кодът е изчерпан.' };
  }
  if (increment) promo.usedCount = (promo.usedCount || 0) + 1;
  return {
    valid: true,
    promoCode: {
      id: promo.id,
      code: promo.code,
      discount: promo.discount,
      discountType: promo.discountType || 'percentage',
      description: promo.description || ''
    }
  };
}

async function handleGetPromoCodes(env) {
  return jsonResponse(await getPromoCodes(env));
}

async function handleCreatePromoCode(request, env) {
  const data = await request.json();
  if (!data?.code || data.discount === undefined) {
    throw new PortfolioError('Липсват код или отстъпка.', 400);
  }
  const codes = await getPromoCodes(env);
  const code = data.code.toUpperCase().trim();
  if (codes.some((p) => p.code === code)) {
    throw new PortfolioError('Промо кодът вече съществува.', 409);
  }
  const newPromo = {
    id: `pf-promo-${Date.now()}`,
    code,
    discount: parseFloat(data.discount),
    discountType: data.discountType || 'percentage',
    description: data.description || '',
    validFrom: data.validFrom || new Date().toISOString(),
    validUntil: data.validUntil || null,
    maxUses: data.maxUses ? parseInt(data.maxUses, 10) : null,
    usedCount: 0,
    active: data.active !== false,
    createdAt: new Date().toISOString()
  };
  codes.push(newPromo);
  await savePromoCodes(env, codes);
  return jsonResponse({ success: true, promoCode: newPromo }, 201);
}

async function handleUpdatePromoCode(request, env) {
  const data = await request.json();
  if (!data?.id) throw new PortfolioError('Липсва ID.', 400);
  const codes = await getPromoCodes(env);
  const idx = codes.findIndex((p) => p.id === data.id);
  if (idx === -1) throw new PortfolioError('Промо кодът не е намерен.', 404);
  Object.assign(codes[idx], {
    code: data.code ? data.code.toUpperCase().trim() : codes[idx].code,
    discount: data.discount !== undefined ? parseFloat(data.discount) : codes[idx].discount,
    discountType: data.discountType || codes[idx].discountType,
    description: data.description ?? codes[idx].description,
    validFrom: data.validFrom ?? codes[idx].validFrom,
    validUntil: data.validUntil ?? codes[idx].validUntil,
    maxUses: data.maxUses !== undefined ? (data.maxUses ? parseInt(data.maxUses, 10) : null) : codes[idx].maxUses,
    active: data.active !== undefined ? data.active : codes[idx].active
  });
  await savePromoCodes(env, codes);
  return jsonResponse({ success: true, promoCode: codes[idx] });
}

async function handleDeletePromoCode(request, env) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) throw new PortfolioError('Липсва ID.', 400);
  let codes = await getPromoCodes(env);
  const before = codes.length;
  codes = codes.filter((p) => p.id !== id);
  if (codes.length === before) throw new PortfolioError('Промо кодът не е намерен.', 404);
  await savePromoCodes(env, codes);
  return jsonResponse({ success: true });
}

async function handleValidatePromo(request, env) {
  const body = await request.json();
  if (!body?.code) throw new PortfolioError('Липсва промо код.', 400);
  const code = body.code.toUpperCase().trim();
  const codes = await getPromoCodes(env);
  const promo = codes.find((p) => p.code === code);
  const result = validatePromoRecord(promo);
  if (!result.valid) return jsonResponse(result);

  if (body.incrementUsage) {
    const idx = codes.findIndex((p) => p.id === promo.id);
    const fresh = validatePromoRecord(codes[idx], { increment: true });
    if (!fresh.valid) return jsonResponse(fresh);
    await savePromoCodes(env, codes);
  }
  return jsonResponse(result);
}

function applyPromoDiscount(subtotal, promo) {
  if (!promo) return 0;
  if (promo.discountType === 'percentage') {
    return roundPrice(subtotal * (promo.discount / 100));
  }
  return roundPrice(Math.min(promo.discount, subtotal));
}

async function handleCreateOrder(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new PortfolioError('Невалиден JSON.', 400);
  }

  if (!body?.customer || !Array.isArray(body.products) || body.products.length === 0) {
    throw new PortfolioError('Липсват данни за клиент или продукти.', 400);
  }

  const meta = await getMeta(env);
  if (!meta) {
    throw new PortfolioError('Каталогът не е синхронизиран. Поръчката не може да бъде приета.', 503);
  }

  const cartCheck = validateCartHasSku(body.products);
  if (!cartCheck.valid) {
    throw new PortfolioError(cartCheck.errors.join(' '), 400);
  }

  const customerCheck = validatePortfolioCustomer(body.customer);
  if (!customerCheck.valid) {
    throw new PortfolioError(customerCheck.errors.join(' '), 400);
  }

  const customer = sanitizePortfolioCustomer(body.customer);
  const items = await validateAndNormalizeCartItems(env, body.products);

  let b2bTotal = 0;
  let retailTotal = 0;
  for (const item of items) {
    b2bTotal += item.b2b_price * item.quantity;
    retailTotal += item.retail_price * item.quantity;
  }

  let promoDiscount = 0;
  let appliedPromo = null;
  if (body.promoCode) {
    const codes = await getPromoCodes(env);
    const promo = codes.find((p) => p.code === String(body.promoCode).toUpperCase().trim());
    const check = validatePromoRecord(promo, { increment: true });
    if (!check.valid) throw new PortfolioError(check.error, 400);
    promoDiscount = applyPromoDiscount(retailTotal, check.promoCode);
    appliedPromo = check.promoCode;
    await savePromoCodes(env, codes);
  }

  const newOrder = {
    id: `pf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    project: 'portfolio',
    timestamp: new Date().toISOString(),
    status: 'Чака одобрение',
    customer,
    products: items,
    promo: appliedPromo,
    summary: {
      retail_total: roundPrice(retailTotal),
      b2b_total: roundPrice(b2bTotal),
      margin: roundPrice(retailTotal - b2bTotal),
      promo_discount: promoDiscount,
      shipping: body.summary?.shipping ?? null,
      total: body.summary?.total ?? `${roundPrice(retailTotal - promoDiscount)} €`
    },
    fitness1_order: null,
    admin_note: ''
  };

  const ordersRaw = await env.PAGE_CONTENT.get(KV_ORDERS);
  const orders = ordersRaw ? JSON.parse(ordersRaw) : [];
  orders.unshift(newOrder);
  await env.PAGE_CONTENT.put(KV_ORDERS, JSON.stringify(orders, null, 2));

  return jsonResponse({ success: true, order: newOrder }, 201);
}

async function handleGetOrders(env) {
  const ordersRaw = await env.PAGE_CONTENT.get(KV_ORDERS);
  const orders = ordersRaw ? JSON.parse(ordersRaw) : [];
  return jsonResponse(orders);
}

async function handleGetOrdersSummary(env) {
  const ordersRaw = await env.PAGE_CONTENT.get(KV_ORDERS);
  const orders = ordersRaw ? JSON.parse(ordersRaw) : [];
  const pending = orders.filter(
    (o) => !o.fitness1_order?.id && o.status !== 'Отказана'
  ).length;
  return jsonResponse({ pending, total: orders.length });
}

async function handleGetOrder(request, env) {
  const id = new URL(request.url).searchParams.get('id')?.trim();
  if (!id) throw new PortfolioError('Липсва ID на поръчка.', 400);

  const ordersRaw = await env.PAGE_CONTENT.get(KV_ORDERS);
  const orders = ordersRaw ? JSON.parse(ordersRaw) : [];
  const order = orders.find((o) => o.id === id);
  if (!order) throw new PortfolioError('Поръчката не е намерена.', 404);

  return jsonResponse({
    id: order.id,
    status: order.status,
    timestamp: order.timestamp,
    customer: {
      firstName: order.customer?.firstName || '',
      lastName: order.customer?.lastName || '',
      phone: order.customer?.phone || ''
    }
  });
}

async function validateOrderProductsForF1(env, order) {
  for (const p of order.products) {
    const found = await findVariantInCatalog(env, p.sku_id);
    if (!found?.variant.available) {
      throw new PortfolioError(`„${p.name}" вече не е наличен. Актуализирайте поръчката.`, 400);
    }
    if (!p.barcode && !found.variant.barcode) {
      throw new PortfolioError(`Липсва баркод за „${p.name}".`, 400);
    }
    if (!p.barcode) p.barcode = found.variant.barcode;
  }
}

function productsToF1Payload(products) {
  return products.map((p) => {
    if (p.barcode) return { barcode: p.barcode, quantity: p.quantity };
    return { id: String(p.sku_id), quantity: p.quantity };
  });
}

function aggregateProductLines(productLists) {
  const map = new Map();
  for (const products of productLists) {
    for (const p of products) {
      const key = p.barcode || String(p.sku_id);
      const existing = map.get(key);
      if (existing) {
        existing.quantity += p.quantity;
      } else {
        map.set(key, { ...p });
      }
    }
  }
  return productsToF1Payload(Array.from(map.values()));
}

async function submitProductsToFitness1(env, products) {
  if (env.MOCK_FITNESS1 === '1' || env.MOCK_FITNESS1 === true) {
    return {
      status: 'ok',
      order: {
        id: 900000 + Math.floor(Math.random() * 99999),
        price: '0.00'
      }
    };
  }

  const apiKey = await getFitness1ApiKey(env);
  if (!apiKey) throw new PortfolioError('FITNESS1_API_KEY не е конфигуриран.', 500);

  const f1Response = await fetch('https://fitness1.bg/b2b/api/orders/create', {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ products })
  });

  let f1Data;
  try {
    f1Data = await f1Response.json();
  } catch {
    throw new PortfolioError('Невалиден отговор от Fitness1 при създаване на поръчка.', 502);
  }

  if (!f1Response.ok || f1Data.status !== 'ok') {
    const errMsg = f1Data?.error || f1Data?.message || JSON.stringify(f1Data);
    throw new PortfolioError(`Fitness1 отказа поръчката: ${errMsg}`, 400);
  }

  return f1Data;
}

async function handleUpdateOrder(request, env) {
  const update = await request.json();
  if (!update?.id) throw new PortfolioError('Липсва ID на поръчка.', 400);

  const ordersRaw = await env.PAGE_CONTENT.get(KV_ORDERS);
  let orders = ordersRaw ? JSON.parse(ordersRaw) : [];
  const idx = orders.findIndex((o) => o.id === update.id);
  if (idx === -1) throw new PortfolioError('Поръчката не е намерена.', 404);

  if (update.status) orders[idx].status = update.status;
  if (update.admin_note != null) orders[idx].admin_note = update.admin_note;

  await env.PAGE_CONTENT.put(KV_ORDERS, JSON.stringify(orders, null, 2));
  return jsonResponse({ success: true, order: orders[idx] });
}

async function handleApproveOrder(request, env) {
  const body = await request.json();
  if (!body?.id) throw new PortfolioError('Липсва ID на поръчка.', 400);

  const ordersRaw = await env.PAGE_CONTENT.get(KV_ORDERS);
  let orders = ordersRaw ? JSON.parse(ordersRaw) : [];
  const idx = orders.findIndex((o) => o.id === body.id);
  if (idx === -1) throw new PortfolioError('Поръчката не е намерена.', 404);

  const order = orders[idx];

  if (order.fitness1_order?.id) {
    throw new PortfolioError(`Поръчката вече е изпратена (F1 #${order.fitness1_order.id}).`, 409);
  }

  await validateOrderProductsForF1(env, order);
  const products = productsToF1Payload(order.products);
  const f1Data = await submitProductsToFitness1(env, products);

  orders[idx].status = 'Изпратена към Fitness1';
  orders[idx].fitness1_order = {
    id: f1Data.order?.id,
    price: f1Data.order?.price,
    submitted_at: new Date().toISOString(),
    batch: false,
    source_order_ids: [order.id]
  };
  if (body.admin_note) orders[idx].admin_note = body.admin_note;

  await env.PAGE_CONTENT.put(KV_ORDERS, JSON.stringify(orders, null, 2));
  return jsonResponse({ success: true, order: orders[idx], fitness1: f1Data });
}

async function handleApproveBatchOrder(request, env) {
  const body = await request.json();
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new PortfolioError('Липсват ID-та на поръчки за обобщаване.', 400);
  }

  const ordersRaw = await env.PAGE_CONTENT.get(KV_ORDERS);
  let orders = ordersRaw ? JSON.parse(ordersRaw) : [];
  const selected = [];

  for (const id of ids) {
    const idx = orders.findIndex((o) => o.id === id);
    if (idx === -1) throw new PortfolioError(`Поръчка ${id} не е намерена.`, 404);
    const order = orders[idx];
    if (order.fitness1_order?.id) {
      throw new PortfolioError(`Поръчка ${id} вече е изпратена (F1 #${order.fitness1_order.id}).`, 409);
    }
    selected.push({ idx, order });
  }

  for (const { order } of selected) {
    await validateOrderProductsForF1(env, order);
  }

  const aggregated = aggregateProductLines(selected.map((s) => s.order.products));
  const f1Data = await submitProductsToFitness1(env, aggregated);
  const f1OrderMeta = {
    id: f1Data.order?.id,
    price: f1Data.order?.price,
    submitted_at: new Date().toISOString(),
    batch: true,
    source_order_ids: ids
  };

  for (const { idx } of selected) {
    orders[idx].status = 'Изпратена към Fitness1';
    orders[idx].fitness1_order = { ...f1OrderMeta };
    if (body.admin_note) orders[idx].admin_note = body.admin_note;
  }

  await env.PAGE_CONTENT.put(KV_ORDERS, JSON.stringify(orders, null, 2));
  return jsonResponse({
    success: true,
    orders: selected.map((s) => orders[s.idx]),
    fitness1: f1Data,
    aggregated_products: aggregated
  });
}

/**
 * Main router for /portfolio/* paths.
 */
export async function handlePortfolioRoute(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  try {
    if (path === '/portfolio/settings') {
      if (method === 'GET') return await handleGetSettings(env);
      if (method === 'POST') return await handleSaveSettings(request, env);
    }
    if (path === '/portfolio/filters' && method === 'GET') {
      return await handleGetFilters(env);
    }
    if (path === '/portfolio/catalog' && method === 'GET') {
      return await handleGetCatalog(request, env);
    }
    if (path === '/portfolio/product' && method === 'GET') {
      return await handleGetProduct(request, env);
    }
    if (path === '/portfolio/product/description' && method === 'GET') {
      return await handleGetProductDescription(request, env);
    }
    if (path === '/portfolio/validate-cart' && method === 'POST') {
      return await handleValidateCart(request, env);
    }
    if (path === '/portfolio/bootstrap' && method === 'GET') {
      return await handleBootstrap(env);
    }
    if (path === '/portfolio/meta-version' && method === 'GET') {
      return await handleMetaVersion(env);
    }
    if (path === '/portfolio/promo-codes') {
      if (method === 'GET') return await handleGetPromoCodes(env);
      if (method === 'POST') return await handleCreatePromoCode(request, env);
      if (method === 'PUT') return await handleUpdatePromoCode(request, env);
      if (method === 'DELETE') return await handleDeletePromoCode(request, env);
    }
    if (path === '/portfolio/validate-promo' && method === 'POST') {
      return await handleValidatePromo(request, env);
    }
    if (path === '/portfolio/sync' && method === 'POST') {
      const result = await syncPortfolioCatalog(env);
      return jsonResponse(result);
    }
    if (path === '/portfolio/chunk' && method === 'GET') {
      return await handleGetChunk(request, env);
    }
    if (path === '/portfolio/orders') {
      if (method === 'GET') return await handleGetOrders(env);
      if (method === 'POST') return await handleCreateOrder(request, env);
      if (method === 'PUT') return await handleUpdateOrder(request, env);
    }
    if (path === '/portfolio/orders/approve' && method === 'POST') {
      return await handleApproveOrder(request, env);
    }
    if (path === '/portfolio/orders/approve-batch' && method === 'POST') {
      return await handleApproveBatchOrder(request, env);
    }
    if (path === '/portfolio/orders/summary' && method === 'GET') {
      return await handleGetOrdersSummary(env);
    }
    if (path === '/portfolio/order' && method === 'GET') {
      return await handleGetOrder(request, env);
    }

    throw new PortfolioError('Not Found', 404);
  } catch (e) {
    if (e instanceof PortfolioError) {
      return jsonResponse({ error: e.message }, e.status);
    }
    console.error('Portfolio API error:', e);
    return jsonResponse({ error: 'Вътрешна грешка в Portfolio API.' }, 500);
  }
}
