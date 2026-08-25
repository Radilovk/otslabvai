/**
 * Portfolio B2B catalog API – sync, catalog query, orders.
 * Used by worker.js for /portfolio/* routes.
 */

import { filterIndex } from './portfolio-filter.js';
import { enrichIndexEntry } from './portfolio-search.js';
import { inferProductGoals, buildGoalFacetCounts } from './portfolio-goals.js';
import {
  validatePortfolioCustomer,
  sanitizePortfolioCustomer,
  validateCartHasSku
} from './portfolio-order-validation.js';
import {
  SYNC_POLICY,
  isSyncStale,
  extractCartSkuIds
} from './portfolio-sync-policy.js';
import {
  DEFAULT_PRICING_POLICY,
  resolveVariantPricing,
  summarizeGroupPricing,
  collectAvailablePacks,
  buildIndexVariantPricing,
  normalizePricingPolicy,
  applyPromoCodePrice,
  promoUsesLinePricing,
  resolvePromoLinePrice,
  sumLinePricingSavings,
  ceilRetailPrice,
} from './portfolio-pricing.js';
import { groupHasMargin, variantHasMargin, isCatalogListed } from './portfolio-margin-policy.js';
import { normalizeHeroImagePath } from './portfolio-hero-path.js';

const CATALOG_IMG_URL_RE = /^https?:\/\//i;

/** Resolve product image from API fields or first <img> in Fitness1 HTML description. */
export function resolveCatalogImage(fields = {}) {
  const image = String(fields.image || '').trim();
  if (CATALOG_IMG_URL_RE.test(image) || image.startsWith('//')) return image;
  const label = String(fields.label || '').trim();
  if (CATALOG_IMG_URL_RE.test(label) || label.startsWith('//')) return label;
  const m = String(fields.description || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1].trim() : '';
}

function finalizeGroupImages(group) {
  if (!group) return;
  if (!resolveCatalogImage({ image: group.image })) {
    group.image = resolveCatalogImage({ label: group.label, description: group.description });
  }
  for (const v of group.variants || []) {
    v.image = v.image || group.image || '';
  }
}
import { calculateCheckoutShipping, formatShippingLabel } from './checkout-shipping.js';
import { assertOrderRateLimit } from './order-rate-limit.js';
import { decodeHtmlEntities, normalizeCatalogText } from './portfolio-text.js';
import {
  resolveSiteCartSku,
  cartRequiresCatalogMeta,
  parseSiteCartRef,
  isCatalogBackedCartId
} from './portfolio-site-products.js';
import {
  getB2bProducts,
  isDirectSaleProductLine,
  orderHasB2bProducts,
} from './portfolio-order-fulfillment.js';
import {
  fetchSilaProducts,
  fetchSilaProductsForEnv,
  submitSilaOrder,
  mergeCatalogProducts,
  getSilaApiToken,
  listSilaApiTokenCandidates,
  isValidSilaApiToken,
  normalizeSilaApiToken,
  isSilaDistributor,
  isFitness1Distributor,
  KV_SILA_TOKEN,
  DISTRIBUTOR_SILA,
  DISTRIBUTOR_FITNESS1,
  SilaError,
} from './sila-api.js';

export {
  fetchSilaProducts,
  mergeCatalogProducts,
  getSilaApiToken,
  isSilaDistributor,
  isFitness1Distributor,
  DISTRIBUTOR_SILA,
  DISTRIBUTOR_FITNESS1,
};

export {
  filterIndex,
  SYNC_POLICY,
  isSyncStale,
  extractCartSkuIds,
  DEFAULT_PRICING_POLICY,
  resolveVariantPricing,
  summarizeGroupPricing,
  normalizePricingPolicy
};

const CHUNK_SIZE = 150;
const KV_SETTINGS = 'portfolio_settings';
const KV_META = 'portfolio_meta';
const KV_ORDERS = 'portfolio_orders';
const KV_PROMO = 'portfolio_promo_codes';
const chunkKey = (n) => `portfolio_chunk_${n}`;
const KV_FITNESS1_KEY = 'fitness1_api_key';
const KV_SYNC_LOCK = 'portfolio_sync_lock';
const KV_CI_SYNC_LAST = 'portfolio_ci_sync_last';
const GITHUB_CATALOG_SYNC = {
  owner: 'Radilovk',
  repo: 'otslabvai',
  branch: 'main',
  workflow: 'sync-portfolio-catalog.yml',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeFitness1ApiKey(raw) {
  if (!raw) return '';
  let key = String(raw).trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

function isValidFitness1ApiKey(key) {
  return /^[a-f0-9]{32}$/i.test(String(key || ''));
}

/** Worker secret first (wrangler), then KV (deploy script). Skip invalid formats. */
export async function getFitness1ApiKey(env) {
  const candidates = [
    normalizeFitness1ApiKey(env.FITNESS1_API_KEY),
    normalizeFitness1ApiKey(await env.PAGE_CONTENT?.get(KV_FITNESS1_KEY)),
  ].filter((key, index, all) => key && all.indexOf(key) === index);

  const valid = candidates.filter(isValidFitness1ApiKey);
  return (valid[0] || candidates[0]) || null;
}

async function listFitness1ApiKeyCandidates(env) {
  const candidates = [
    normalizeFitness1ApiKey(env.FITNESS1_API_KEY),
    normalizeFitness1ApiKey(await env.PAGE_CONTENT?.get(KV_FITNESS1_KEY)),
  ].filter((key, index, all) => key && all.indexOf(key) === index);
  const valid = candidates.filter(isValidFitness1ApiKey);
  return valid.length ? valid : candidates;
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
  reseller_delivery_note: 'Доставка до дистрибутор — разпределяне към клиенти от админ панела.',
  hero_image: 'images/portfolio-hero.jpg',
  hero_title: 'Каталог добавки',
  hero_mode: 'single',
  hero_slides: [],
  hero_carousel_interval: 6000,
  pricing_policy: { ...DEFAULT_PRICING_POLICY },
  /** When true, B2B lines are sent to Fitness1/Sila immediately on order creation (secures stock). */
  auto_submit_b2b: true,
  footer: {
    contact_email: 'office@biocode.com',
    contact_phone: '',
    copyright_text: '',
    social_facebook: '',
    social_instagram: '',
    social_youtube: '',
    columns: [
      {
        type: 'links',
        title: 'Каталог',
        links: [
          { text: 'Всички продукти', url: 'portfolio.html' },
          { text: 'AI консултант', url: 'portfolio-advisor-quiz.html' },
          { text: 'Количка', url: 'portfolio-checkout.html' }
        ]
      },
      {
        type: 'links',
        title: 'Информация',
        links: [
          { text: 'Доставка', url: 'portfolio-shipping.html' },
          { text: 'Поверителност', url: 'portfolio-policy.html' },
          { text: 'Общи условия', url: 'portfolio-terms.html' }
        ]
      },
      {
        type: 'contact',
        title: 'Контакт',
        lines: [
          'office@biocode.com',
          'Доставка до офис · наложен платеж'
        ]
      }
    ]
  }
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
  return decodeHtmlEntities(html);
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

/** Stable pseudo-random 0|1 from SKU – picks .80 vs .90 when both are valid. */
export function charmEndingSeed(skuId) {
  let hash = 0;
  const s = String(skuId ?? '');
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2;
}

/** Round retail prices up to the first decimal place (14.52 → 14.60). */
export function charmRoundRetailPrice(price, _seed = 0) {
  return ceilRetailPrice(price);
}

export function calculateRetailPrice(b2bPrice, markupPercent, override, skuId) {
  if (override && typeof override.fixed_price === 'number') {
    return ceilRetailPrice(override.fixed_price);
  }
  const raw = b2bPrice * (1 + markupPercent / 100);
  return ceilRetailPrice(raw);
}

/** Margin stats for a catalog group – used for recommendation ranking. */
export function summarizeGroupMargin(group) {
  const variants = group?.variants || [];
  let maxMargin = 0;
  let maxMarginPct = 0;
  let maxMarkupPercent = 0;

  for (const variant of variants) {
    const b2b = Number(variant.b2b_price) || 0;
    const retail = Number(variant.retail_price) || 0;
    if (!(b2b > 0 && retail > b2b)) continue;

    const margin = retail - b2b;
    const marginPct = (margin / b2b) * 100;
    const markup = Number(variant.markup_percent) || marginPct;

    if (margin > maxMargin) maxMargin = margin;
    if (marginPct > maxMarginPct) maxMarginPct = marginPct;
    if (markup > maxMarkupPercent) maxMarkupPercent = markup;
  }

  return {
    max_margin: roundPrice(maxMargin),
    max_margin_pct: roundPrice(maxMarginPct),
    markup_percent: roundPrice(maxMarkupPercent)
  };
}

function pricingPolicyFromSettings(settings) {
  return normalizePricingPolicy(settings?.pricing_policy, settings);
}

function buildVariantPricing(raw, settings, gid) {
  const overrides = settings.product_overrides || {};
  const b2b = parseFloat(raw.b2b_price) || 0;
  const regular = parseFloat(raw.regular_price) || 0;
  const sale = parseFloat(raw.sale_price) || 0;
  const markup = calculateMarkupPercent(settings, { ...raw, group_id: gid });
  const skuId = String(raw.id);
  const resolved = resolveVariantPricing({
    b2b,
    regular,
    sale,
    override: overrides[gid],
    policy: pricingPolicyFromSettings(settings),
    settings,
    markupRetail: () => calculateRetailPrice(b2b, markup, overrides[gid], skuId)
  });

  const distributor = raw.distributor || DISTRIBUTOR_FITNESS1;

  return {
    sku_id: skuId,
    barcode: raw.barcode || '',
    pack: raw.pack || '',
    option: raw.option || '',
    b2b_price: b2b,
    retail_price: resolved.retail_price,
    markup_percent: markup,
    regular_price: regular,
    sale_price: sale,
    compare_at_price: resolved.compare_at_price,
    is_on_promo: resolved.is_on_promo,
    f1_reference_price: resolved.f1_reference_price,
    pricing_mode: resolved.pricing_mode,
    available: raw.available === true,
    image: raw.image || '',
    distributor,
    distributor_ids: raw.distributor_ids || null,
  };
}

export function groupRawProducts(rawProducts, settings, descriptionMap = null) {
  const groups = new Map();

  for (const p of rawProducts) {
    const gid = String(p.group_id);
    if (!groups.has(gid)) {
      groups.set(gid, {
        group_id: gid,
        product_id: p.product_id,
        name: normalizeCatalogText(p.product_name),
        brand: normalizeCatalogText(p.brand_name),
        brand_id: String(p.brand_id),
        category: p.category || '',
        category_path: (p.category || '').split(' > ').filter(Boolean),
        image: p.image || '',
        label: p.label || '',
        description: decodeDescription(p.description || descriptionMap?.get(gid) || ''),
        distributor: p.distributor || DISTRIBUTOR_FITNESS1,
        variants: []
      });
    }

    const g = groups.get(gid);
    if (!g.description) {
      const desc = p.description || descriptionMap?.get(gid);
      if (desc) g.description = decodeDescription(desc);
    }
    if (p.label && !g.label) g.label = p.label;
    const rowImage = resolveCatalogImage({
      image: p.image,
      label: p.label,
      description: p.description || descriptionMap?.get(gid) || '',
    });
    if (!g.image && rowImage) g.image = rowImage;

    const variant = buildVariantPricing(p, settings, gid);
    variant.image = variant.image || rowImage || g.image;
    g.variants.push(variant);
  }

  const listed = Array.from(groups.values());
  for (const g of listed) finalizeGroupImages(g);
  return listed
    .filter((g) => resolveCatalogImage({ image: g.image }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'));
}

export function buildCatalogMeta(groups, settings = null) {
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
    const priceStats = summarizeGroupPricing(availableVariants);
    const indexPricing = buildIndexVariantPricing(availableVariants);
    const packs = collectAvailablePacks(availableVariants);
    const marginStats = summarizeGroupMargin(g);

    const marginEligible = availableVariants.length > 0 && groupHasMargin(g);

    const entry = enrichIndexEntry({
      group_id: g.group_id,
      name: g.name,
      brand: g.brand,
      brand_id: g.brand_id,
      category: g.category,
      category_top: g.category_path[0] || '',
      category_path: g.category_path,
      min_price: priceStats.min_price,
      max_price: priceStats.max_price,
      min_client_price: indexPricing.min_client_price,
      max_client_price: indexPricing.max_client_price,
      vp: indexPricing.vp,
      has_promo: priceStats.has_promo,
      compare_at_price: priceStats.compare_at_price,
      default_sku_id: priceStats.default_sku_id,
      variant_count: g.variants.length,
      available: availableVariants.length > 0,
      margin_eligible: marginEligible,
      image: g.image,
      packs,
      ...marginStats
    }, g);
    entry.goals = inferProductGoals(entry, settings);
    index.push(entry);

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
    goals: buildGoalFacetCounts(index),
    lookup,
    sku_lookup,
    index
  };
}

/** Strip admin-only / internal fields before sending product data to the client. */
export function sanitizeVariantForClient(variant) {
  if (!variant) return variant;
  const clientFinal = Number(variant.regular_price) || Number(variant.retail_price) || 0;
  const wholesale = Number(variant.b2b_price) || 0;
  const margin_eur = wholesale > 0 && clientFinal > wholesale
    ? Math.round((clientFinal - wholesale) * 100) / 100
    : 0;
  const {
    b2b_price,
    markup_percent,
    f1_reference_price,
    distributor,
    distributor_ids,
    ...client
  } = variant;
  return margin_eur > 0 ? { ...client, margin_eur } : client;
}

export function sanitizeGroupForClient(group) {
  if (!group) return group;
  const { distributor, ...rest } = group;
  return {
    ...rest,
    variants: (rest.variants || []).map(sanitizeVariantForClient),
  };
}

/** Strip admin-only pricing fields before sending catalog index to the client. */
export function sanitizeIndexEntryForClient(entry) {
  if (!entry) return entry;
  const {
    max_margin,
    max_margin_pct,
    markup_percent,
    ...clientEntry
  } = entry;
  return clientEntry;
}

/** Client-facing meta: only in-stock products with sufficient margin, no margin fields. */
export function buildClientCatalogMeta(meta, { includeLowMargin = false } = {}) {
  const index = (meta.index || [])
    .filter((item) => item.available && isCatalogListed(item, includeLowMargin))
    .map(sanitizeIndexEntryForClient);

  const brandMap = new Map();
  const categoryMap = new Map();
  for (const item of index) {
    const bCount = brandMap.get(item.brand_id) || { id: item.brand_id, name: item.brand, count: 0 };
    bCount.count++;
    brandMap.set(item.brand_id, bCount);
    const topCat = item.category_top || 'Други';
    categoryMap.set(topCat, (categoryMap.get(topCat) || 0) + 1);
  }

  return {
    version: meta.version,
    synced_at: meta.synced_at,
    total_groups: index.length,
    chunk_size: meta.chunk_size,
    chunk_count: meta.chunk_count,
    brands: Array.from(brandMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'bg')),
    categories: Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'bg')),
    goals: buildGoalFacetCounts(index),
    lookup: meta.lookup,
    sku_lookup: meta.sku_lookup || {},
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

/** Каталожната мета информация (за portfolio-import.js и worker.js). */
export async function getPortfolioMeta(env) {
  return getMeta(env);
}

/**
 * Зарежда каталожни групи по group_id, като чете всеки нужен chunk само веднъж.
 * @param {object} env
 * @param {string[]} ids - portfolio group_id-та
 * @returns {Promise<Map<string, object>>} намерените групи по group_id
 */
export async function loadPortfolioGroupsByIds(env, ids) {
  const groups = new Map();
  const meta = await getMeta(env);
  if (!meta) return groups;

  const byChunk = new Map();
  for (const id of ids) {
    const gid = String(id);
    const chunkIndex = meta.lookup?.[gid];
    if (chunkIndex == null) continue;
    if (!byChunk.has(chunkIndex)) byChunk.set(chunkIndex, new Set());
    byChunk.get(chunkIndex).add(gid);
  }

  await Promise.all(Array.from(byChunk.entries()).map(async ([chunkIndex, gids]) => {
    const raw = await env.PAGE_CONTENT.get(chunkKey(chunkIndex));
    if (!raw) return;
    for (const g of JSON.parse(raw)) {
      if (gids.has(String(g.group_id))) groups.set(String(g.group_id), g);
    }
  }));

  return groups;
}

async function getGroupFromChunks(env, meta, groupId) {
  const chunkIndex = meta.lookup[groupId];
  if (chunkIndex == null) return null;
  const chunkRaw = await env.PAGE_CONTENT.get(chunkKey(chunkIndex));
  if (!chunkRaw) return null;
  const chunk = JSON.parse(chunkRaw);
  return chunk.find((g) => g.group_id === groupId) || null;
}

async function fetchFitness1Catalog(apiKey, { description = false } = {}) {
  let url = `https://fitness1.bg/b2b/api/products_v3?key=${encodeURIComponent(apiKey)}`;
  if (description) url += '&description=1';

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Encoding': 'identity',
      'Accept-Language': 'bg-BG,bg;q=0.9,en;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; BiocodePortfolio/1.0; +https://daotslabna.com)',
      'Cache-Control': 'no-cache',
    },
  });
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const preview = text.replace(/\s+/g, ' ').slice(0, 120);
    throw new PortfolioError(
      `Fitness1 API грешка: ${response.status} (невалиден JSON)${preview ? ` — ${preview}` : ''}`,
      502
    );
  }

  if (!response.ok) {
    const detail = data?.error || data?.message || '';
    throw new PortfolioError(
      `Fitness1 API грешка: ${response.status}${detail ? ` — ${detail}` : ''}`,
      502
    );
  }
  if (data.status !== 'ok') {
    throw new PortfolioError(data.error || 'Невалиден отговор от Fitness1 API.', 502);
  }
  return data;
}

export async function fetchFitness1Products(apiKey) {
  const data = await fetchFitness1Catalog(apiKey);
  if (!Array.isArray(data.products)) {
    throw new PortfolioError('Невалиден отговор от Fitness1 API.', 502);
  }
  return data.products;
}

/**
 * Fetch raw SKUs from all configured distributors (Fitness1 + Sila).
 * @returns {Promise<{ products: object[], fitness1_count: number, sila_count: number, fitness1_error: string|null, sila_error: string|null }>}
 */
export async function fetchAllCatalogRawProducts(env) {
  let fitness1Products = [];
  let silaProducts = [];
  let fitness1Error = null;
  let silaError = null;

  const f1Key = await getFitness1ApiKey(env);
  if (f1Key) {
    try {
      fitness1Products = await fetchFitness1Products(f1Key);
    } catch (e) {
      fitness1Error = e;
    }
  }

  const silaToken = await getSilaApiToken(env);
  if (silaToken) {
    try {
      const { products, error } = await fetchSilaProductsForEnv(env);
      silaProducts = products;
      if (error) silaError = error;
    } catch (e) {
      silaError = e;
    }
  }

  if (!f1Key && !silaToken) {
    throw new PortfolioError(
      'Няма конфигуриран API ключ (FITNESS1_API_KEY или SILA_API_TOKEN).',
      500
    );
  }

  if (!fitness1Products.length && !silaProducts.length) {
    const parts = [];
    if (fitness1Error) parts.push(`Fitness1: ${fitness1Error.message}`);
    if (silaError) parts.push(`Sila: ${silaError.message}`);
    throw new PortfolioError(
      parts.join(' | ') || 'Неуспешно зареждане на каталог от дистрибуторите.',
      502
    );
  }

  return {
    products: mergeCatalogProducts(fitness1Products, silaProducts),
    fitness1_count: fitness1Products.length,
    sila_count: silaProducts.length,
    fitness1_error: fitness1Error?.message || null,
    sila_error: silaError?.message || null,
  };
}

export async function fetchDescriptionMap(apiKey) {
  try {
    const data = await fetchFitness1Catalog(apiKey, { description: true });
    if (!Array.isArray(data.products)) return new Map();

    const map = new Map();
    for (const p of data.products) {
      const gid = String(p.group_id);
      if (p.description && !map.has(gid)) map.set(gid, p.description);
    }
    return map;
  } catch {
    return new Map();
  }
}

function buildKvCachedSyncResult(meta) {
  return {
    success: true,
    source: 'kv_cached',
    warning:
      'Fitness1 API не отговаря директно от Cloudflare Worker. Използван е кешираният каталог в KV. Пълен sync се стартира през GitHub Actions.',
    synced_at: meta.synced_at,
    total_groups: meta.total_groups,
    total_skus: meta.total_skus ?? null,
    chunk_count: meta.chunk_count,
  };
}

/** Returns cached catalog stats when KV already has a synced catalog. */
export async function syncPortfolioCatalogFromKv(env) {
  const meta = await getMeta(env);
  if (!meta?.chunk_count) {
    throw new PortfolioError('Каталогът не е синхронизиран в KV.', 404);
  }
  return buildKvCachedSyncResult(meta);
}

/**
 * Dispatch GitHub Actions catalog sync (debounced). Used when Worker cannot call Fitness1.
 * @returns {Promise<{ triggered: boolean, reason?: string, retry_after_ms?: number }>}
 */
export async function requestPortfolioCatalogCiSync(env) {
  const token = env.GITHUB_API_TOKEN || await env.PAGE_CONTENT?.get('api_token');
  if (!token) {
    return { triggered: false, reason: 'no_github_token' };
  }

  const lastRaw = await env.PAGE_CONTENT?.get(KV_CI_SYNC_LAST);
  if (lastRaw) {
    const last = Number(lastRaw);
    const debounceMs = SYNC_POLICY.CI_SYNC_DEBOUNCE_MS;
    if (!Number.isNaN(last) && Date.now() - last < debounceMs) {
      return {
        triggered: false,
        reason: 'debounced',
        retry_after_ms: debounceMs - (Date.now() - last),
      };
    }
  }

  const { owner, repo, branch, workflow } = GITHUB_CATALOG_SYNC;
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Worker',
      },
      body: JSON.stringify({ ref: branch }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('Portfolio CI sync dispatch failed:', res.status, text);
    return { triggered: false, reason: `http_${res.status}` };
  }

  await env.PAGE_CONTENT.put(KV_CI_SYNC_LAST, String(Date.now()));
  return { triggered: true };
}

export async function syncPortfolioCatalog(env, { includeDescriptions = false, fallbackToKv = false } = {}) {
  if (!SYNC_POLICY.FITNESS1_CATALOG_FETCH_FROM_WORKER) {
    if (fallbackToKv) {
      return syncPortfolioCatalogFromKv(env);
    }
    throw new PortfolioError(
      'Fitness1 каталогът не може да се дърпа директно от Worker. Използвайте админ sync или GitHub Actions.',
      502
    );
  }

  const keys = await listFitness1ApiKeyCandidates(env);
  const silaToken = await getSilaApiToken(env);
  if (!keys.length && !silaToken) {
    throw new PortfolioError(
      'Няма конфигуриран API ключ (FITNESS1_API_KEY или SILA_API_TOKEN).',
      500
    );
  }

  let rawProducts;
  let fitness1_count = 0;
  let sila_count = 0;
  /** @type {PortfolioError | null} */
  let lastError = null;

  if (keys.length) {
    let apiKey = keys[0];
    for (const candidate of keys) {
      try {
        const f1Products = await fetchFitness1Products(candidate);
        fitness1_count = f1Products.length;
        apiKey = candidate;
        const { products: silaFetched } = silaToken
          ? await fetchSilaProductsForEnv(env).catch(() => ({ products: [] }))
          : { products: [] };
        sila_count = silaFetched.length;
        rawProducts = mergeCatalogProducts(f1Products, silaFetched);
        lastError = null;
        break;
      } catch (e) {
        lastError = e instanceof PortfolioError ? e : new PortfolioError(e?.message || String(e), 502);
      }
    }
  }

  if (!rawProducts && silaToken) {
    try {
      const { products: silaFetched, error } = await fetchSilaProductsForEnv(env);
      sila_count = silaFetched.length;
      if (silaFetched.length) {
        rawProducts = mergeCatalogProducts([], silaFetched);
        lastError = null;
      } else if (error) {
        lastError = error instanceof SilaError
          ? new PortfolioError(error.message, error.status)
          : new PortfolioError(error.message || String(error), 502);
      }
    } catch (e) {
      lastError = e instanceof SilaError
        ? new PortfolioError(e.message, e.status)
        : new PortfolioError(e?.message || String(e), 502);
    }
  }

  if (!rawProducts) {
    if (fallbackToKv) {
      try {
        return await syncPortfolioCatalogFromKv(env);
      } catch {
        // Fall through to the original Fitness1 error below.
      }
    }
    throw lastError || new PortfolioError('Fitness1 API ключът не работи.', 502);
  }

  const settings = await getSettings(env);
  const descriptionMap = includeDescriptions && keys.length
    ? await fetchDescriptionMap(keys[0])
    : null;

  const groups = groupRawProducts(rawProducts, settings, descriptionMap);
  const meta = buildCatalogMeta(groups, settings);
  meta.synced_at = new Date().toISOString();
  meta.distributors = {
    fitness1_skus: fitness1_count,
    sila_skus: sila_count,
  };

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
    total_skus: rawProducts.length,
    fitness1_skus: fitness1_count,
    sila_skus: sila_count,
    chunk_count: chunkCount
  };
}

function rebuildIndexEntryForGroup(entry, group, settings) {
  const availableVariants = group.variants.filter((v) => v.available);
  const priceStats = summarizeGroupPricing(availableVariants);
  const indexPricing = buildIndexVariantPricing(availableVariants);
  const packs = collectAvailablePacks(availableVariants);
  const marginStats = summarizeGroupMargin(group);
  const updated = enrichIndexEntry({
    ...entry,
    min_price: priceStats.min_price,
    max_price: priceStats.max_price,
    min_client_price: indexPricing.min_client_price,
    max_client_price: indexPricing.max_client_price,
    vp: indexPricing.vp,
    has_promo: priceStats.has_promo,
    compare_at_price: priceStats.compare_at_price,
    default_sku_id: priceStats.default_sku_id,
    variant_count: group.variants.length,
    available: availableVariants.length > 0,
    packs,
    ...marginStats
  }, group);
  updated.goals = inferProductGoals(updated, settings);
  return updated;
}

async function isSyncInProgress(env) {
  return !!(await env.PAGE_CONTENT.get(KV_SYNC_LOCK));
}

/**
 * @typedef {object} SyncLockOptions
 * @property {() => Promise<boolean>} [isFresh] Return true when data is already fresh (skip waiting).
 */

/**
 * @param {object} env
 * @param {() => Promise<*>} fn
 * @param {SyncLockOptions} [options]
 */
async function withSyncLock(env, fn, options = {}) {
  const isFresh = options.isFresh;
  const token = crypto.randomUUID();
  const maxAttempts = Math.ceil(SYNC_POLICY.SYNC_LOCK_MAX_WAIT_MS / SYNC_POLICY.SYNC_LOCK_POLL_MS);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const existing = await env.PAGE_CONTENT.get(KV_SYNC_LOCK);
    if (!existing) {
      await env.PAGE_CONTENT.put(KV_SYNC_LOCK, token, {
        expirationTtl: Math.ceil(SYNC_POLICY.SYNC_LOCK_TTL_MS / 1000)
      });
      await sleep(30);
      const check = await env.PAGE_CONTENT.get(KV_SYNC_LOCK);
      if (check === token) {
        try {
          return await fn();
        } finally {
          const current = await env.PAGE_CONTENT.get(KV_SYNC_LOCK);
          if (current === token) {
            if (typeof env.PAGE_CONTENT.delete === 'function') {
              await env.PAGE_CONTENT.delete(KV_SYNC_LOCK);
            } else {
              await env.PAGE_CONTENT.put(KV_SYNC_LOCK, '', { expirationTtl: 1 });
            }
          }
        }
      }
    }
    if (isFresh && await isFresh()) return null;
    await sleep(SYNC_POLICY.SYNC_LOCK_POLL_MS);
  }

  throw new PortfolioError('Синхронизацията отнема твърде дълго. Опитайте отново.', 503);
}

/**
 * Patch cart SKUs in KV from Fitness1 (only when Worker can reach products_v3).
 * Otherwise request a debounced CI sync and keep serving cached KV data.
 */
export async function refreshCartStockInKv(env, skuIds) {
  const meta = await getMeta(env);
  if (!meta) throw new PortfolioError('Каталогът не е синхронизиран.', 404);

  if (!SYNC_POLICY.FITNESS1_CATALOG_FETCH_FROM_WORKER) {
    await requestPortfolioCatalogCiSync(env);
    return meta.synced_at;
  }

  const uniqueSkus = [...new Set((skuIds || []).map(String).filter(Boolean))];
  if (!uniqueSkus.length) return null;

  const settings = await getSettings(env);
  const apiKey = await getFitness1ApiKey(env);
  if (!apiKey) throw new PortfolioError('FITNESS1_API_KEY не е конфигуриран.', 500);

  const rawProducts = await fetchFitness1Products(apiKey);
  const skuSet = new Set(uniqueSkus);
  const freshBySku = new Map();
  for (const p of rawProducts) {
    const id = String(p.id);
    if (skuSet.has(id)) freshBySku.set(id, p);
  }

  const affectedGroupIds = new Set();
  const chunkIndexes = new Set();

  for (const skuId of uniqueSkus) {
    const found = await findVariantInCatalog(env, skuId);
    if (found) {
      affectedGroupIds.add(found.group_id);
      const chunkIndex = meta.lookup[found.group_id];
      if (chunkIndex != null) chunkIndexes.add(chunkIndex);
    }
    const fresh = freshBySku.get(skuId);
    if (fresh?.group_id) affectedGroupIds.add(String(fresh.group_id));
  }

  const chunksToSave = new Map();
  for (const chunkIndex of chunkIndexes) {
    const chunkRaw = await env.PAGE_CONTENT.get(chunkKey(chunkIndex));
    if (!chunkRaw) continue;
    const chunk = JSON.parse(chunkRaw);
    let modified = false;

    for (const group of chunk) {
      if (!affectedGroupIds.has(group.group_id)) continue;
      for (const variant of group.variants) {
        const fresh = freshBySku.get(variant.sku_id);
        if (!fresh) {
          if (skuSet.has(variant.sku_id)) {
            variant.available = false;
            modified = true;
          }
          continue;
        }
        const priced = buildVariantPricing(fresh, settings, group.group_id);
        Object.assign(variant, priced, {
          image: variant.image || priced.image || group.image
        });
        modified = true;
      }
    }

    if (modified) chunksToSave.set(chunkIndex, chunk);
  }

  const newIndex = [...meta.index];
  for (let i = 0; i < newIndex.length; i++) {
    const entry = newIndex[i];
    if (!affectedGroupIds.has(entry.group_id)) continue;
    const chunkIndex = meta.lookup[entry.group_id];
    let group = chunksToSave.get(chunkIndex);
    if (!group) {
      const chunkRaw = await env.PAGE_CONTENT.get(chunkKey(chunkIndex));
      if (!chunkRaw) continue;
      group = JSON.parse(chunkRaw).find((g) => g.group_id === entry.group_id);
    } else {
      group = group.find((g) => g.group_id === entry.group_id);
    }
    if (!group) continue;
    newIndex[i] = rebuildIndexEntryForGroup(entry, group, settings);
  }

  const syncedAt = new Date().toISOString();
  meta.synced_at = syncedAt;
  meta.index = newIndex;
  meta.goals = buildGoalFacetCounts(newIndex);

  const puts = [env.PAGE_CONTENT.put(KV_META, JSON.stringify(meta))];
  for (const [idx, chunk] of chunksToSave) {
    puts.push(env.PAGE_CONTENT.put(chunkKey(idx), JSON.stringify(chunk)));
  }
  settings.last_sync = syncedAt;
  puts.push(saveSettings(env, settings));
  await Promise.all(puts);

  return syncedAt;
}

async function ensureStockFresh(env, skuIds, freshnessMs) {
  const meta = await getMeta(env);
  if (!meta) throw new PortfolioError('Каталогът не е синхронизиран.', 404);
  if (!isSyncStale(meta.synced_at, freshnessMs)) return meta.synced_at;

  try {
    await withSyncLock(env, async () => {
      const current = await getMeta(env);
      if (current && !isSyncStale(current.synced_at, freshnessMs)) return null;
      return refreshCartStockInKv(env, skuIds);
    }, {
      isFresh: async () => {
        const m = await getMeta(env);
        return !!(m && !isSyncStale(m.synced_at, freshnessMs));
      }
    });

    const updated = await getMeta(env);
    return updated?.synced_at || meta.synced_at;
  } catch (e) {
    if (meta.synced_at) {
      console.warn('Stock refresh failed, using cached catalog:', e?.message || e);
      return meta.synced_at;
    }
    throw e;
  }
}

function scheduleBrowseSyncIfStale(env, ctx) {
  if (!ctx?.waitUntil) return;
  ctx.waitUntil((async () => {
    const meta = await getMeta(env);
    if (!meta || !isSyncStale(meta.synced_at, SYNC_POLICY.BROWSE_TTL_MS)) return;

    if (!SYNC_POLICY.FITNESS1_CATALOG_FETCH_FROM_WORKER) {
      await requestPortfolioCatalogCiSync(env);
      return;
    }

    await withSyncLock(env, async () => {
      const current = await getMeta(env);
      if (!current || !isSyncStale(current.synced_at, SYNC_POLICY.BROWSE_TTL_MS)) return null;
      return syncPortfolioCatalog(env, { includeDescriptions: false });
    }, {
      isFresh: async () => {
        const m = await getMeta(env);
        return !!(m && !isSyncStale(m.synced_at, SYNC_POLICY.BROWSE_TTL_MS));
      }
    });
  })());
}

async function handleFitness1KeyStatus(env) {
  const secret = normalizeFitness1ApiKey(env.FITNESS1_API_KEY);
  const kv = normalizeFitness1ApiKey(await env.PAGE_CONTENT?.get(KV_FITNESS1_KEY));
  const mask = (key) => (key ? `${key.slice(0, 4)}…${key.slice(-4)} (${key.length})` : null);
  return jsonResponse({
    worker_secret: {
      present: Boolean(secret),
      valid_format: isValidFitness1ApiKey(secret),
      preview: mask(secret),
    },
    kv: {
      present: Boolean(kv),
      valid_format: isValidFitness1ApiKey(kv),
      preview: mask(kv),
    },
    active_key_preview: mask(await getFitness1ApiKey(env)),
  });
}

async function handleSilaKeyStatus(env) {
  const secret = normalizeSilaApiToken(env.SILA_API_TOKEN);
  const kv = normalizeSilaApiToken(await env.PAGE_CONTENT?.get(KV_SILA_TOKEN));
  const mask = (key) => (key ? `${key.slice(0, 4)}…${key.slice(-4)} (${key.length})` : null);
  const candidates = await listSilaApiTokenCandidates(env);
  const active = await getSilaApiToken(env);
  return jsonResponse({
    worker_secret: {
      present: Boolean(secret),
      valid_format: isValidSilaApiToken(secret),
      preview: mask(secret),
    },
    kv: {
      present: Boolean(kv),
      valid_format: isValidSilaApiToken(kv),
      preview: mask(kv),
    },
    active_key_preview: mask(active),
    active_source: secret && active === secret
      ? 'worker_secret'
      : (kv && active === kv ? 'kv' : (active ? 'fallback' : null)),
    hint: (!isValidSilaApiToken(secret) && secret)
      ? 'Worker secret изглежда невалиден (очаква се 24–96 буквено-цифрени символа от Sila B2B → API). Проверете GitHub Secret SILA_API_TOKEN.'
      : null,
  });
}

function getOrderDistributors(order) {
  const dists = new Set();
  for (const p of getB2bProducts(order)) {
    dists.add(p.distributor || DISTRIBUTOR_FITNESS1);
  }
  return [...dists];
}

function isOrderFullySubmitted(order) {
  const b2bProducts = getB2bProducts(order);
  if (!b2bProducts.length) {
    if (!Array.isArray(order.products) || order.products.length === 0) {
      return Boolean(order.fitness1_order?.id);
    }
    return true;
  }
  const distributors = getOrderDistributors(order);
  if (!distributors.length) {
    return Boolean(order.fitness1_order?.id);
  }
  for (const d of distributors) {
    if (isSilaDistributor(d)) {
      if (!order.sila_order?.id) return false;
    } else if (!order.fitness1_order?.id) {
      return false;
    }
  }
  return distributors.length > 0;
}

function isOrderB2bPending(order) {
  if (!order || order.status === 'Отказана') return false;
  const b2b = getB2bProducts(order);
  if (!b2b.length) {
    if (!Array.isArray(order.products) || order.products.length === 0) {
      return !isOrderFullySubmitted(order);
    }
    return false;
  }
  return !isOrderFullySubmitted(order);
}

function filterProductsByDistributor(products, distributor) {
  return (products || []).filter((p) => {
    const d = p.distributor || DISTRIBUTOR_FITNESS1;
    return isSilaDistributor(distributor)
      ? isSilaDistributor(d)
      : isFitness1Distributor(d);
  });
}

function buildOrderStatusLabel(order) {
  if (isOrderFullySubmitted(order)) return 'Изпратена към доставчик';
  if (order.fitness1_order?.id || order.sila_order?.id) return 'Обработва се';
  return order.status;
}

async function handleGetSettings(env) {
  const settings = await getSettings(env);
  return jsonResponse(settings, 200, { 'Cache-Control': 'private, no-store' });
}

/** Public site branding only — no markup / B2B fields. */
export function buildPublicSiteSettings(settings) {
  const s = settings || {};
  const slides = Array.isArray(s.hero_slides)
    ? s.hero_slides
      .map((sl, i) => ({
        id: sl?.id || `slide-${i}`,
        image: normalizeHeroImagePath(sl?.image)
      }))
      .filter((sl) => sl.image)
    : [];
  return {
    site_name: s.site_name,
    site_slogan: s.site_slogan,
    hero_image: normalizeHeroImagePath(slides[0]?.image ?? s.hero_image),
    hero_title: s.hero_title,
    hero_mode: s.hero_mode || 'single',
    hero_slides: slides,
    hero_carousel_interval: Number(s.hero_carousel_interval) || 6000,
    footer: s.footer,
    last_sync: s.last_sync,
    last_sync_count: s.last_sync_count
  };
}

export async function getPublicSiteSettings(env) {
  return buildPublicSiteSettings(await getSettings(env));
}

async function handleSaveSettings(request, env) {
  const incoming = await request.json();
  const current = await getSettings(env);
  const heroSlides = Array.isArray(incoming.hero_slides)
    ? incoming.hero_slides
      .map((s, i) => ({
        id: s?.id || `slide-${i}`,
        image: normalizeHeroImagePath(s?.image)
      }))
      .filter((s) => s.image)
    : (current.hero_slides || []);
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
    reseller_delivery_note: incoming.reseller_delivery_note ?? current.reseller_delivery_note,
    hero_image: normalizeHeroImagePath(heroSlides[0]?.image ?? incoming.hero_image ?? current.hero_image),
    hero_title: incoming.hero_title ?? current.hero_title,
    hero_mode: heroSlides.length > 1 ? 'carousel' : 'single',
    hero_slides: heroSlides,
    hero_carousel_interval: Number(incoming.hero_carousel_interval ?? current.hero_carousel_interval) || 6000,
    footer: incoming.footer ?? current.footer,
    pricing_policy: incoming.pricing_policy
      ? { ...current.pricing_policy, ...incoming.pricing_policy }
      : current.pricing_policy,
    auto_submit_b2b: incoming.auto_submit_b2b != null
      ? Boolean(incoming.auto_submit_b2b)
      : (current.auto_submit_b2b != null ? Boolean(current.auto_submit_b2b) : true)
  };
  await saveSettings(env, merged);
  return jsonResponse({ success: true, settings: merged });
}

async function handleGetFilters(env) {
  const meta = await getMeta(env);
  if (!meta) {
    throw new PortfolioError('Каталогът не е синхронизиран. Стартирайте sync от админ панела.', 404);
  }
  const clientMeta = buildClientCatalogMeta(meta);
  return cachedResponse({
    brands: clientMeta.brands,
    categories: clientMeta.categories,
    goals: clientMeta.goals,
    total_groups: clientMeta.total_groups,
    synced_at: meta.synced_at
  });
}

async function promoAllowsLowMargin(code, env) {
  const raw = String(code || '').trim().toUpperCase();
  if (!raw) return false;
  const codes = await getPromoCodes(env);
  const promo = codes.find((p) => p.code === raw);
  return validatePromoRecord(promo).valid;
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
    goal: url.searchParams.get('goal') || '',
    q: url.searchParams.get('q') || '',
    available: url.searchParams.get('available') || '',
    min_price: url.searchParams.get('min_price') || '',
    max_price: url.searchParams.get('max_price') || '',
    sort: url.searchParams.get('sort') || 'relevance'
  };

  const includeLowMargin = await promoAllowsLowMargin(url.searchParams.get('promo_code'), env);
  const clientMeta = buildClientCatalogMeta(meta, { includeLowMargin });
  const filtered = filterIndex(clientMeta.index, params, clientMeta);
  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit).map(sanitizeIndexEntryForClient);

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

  const indexEntry = (meta.index || []).find((e) => e.group_id === groupId);
  const includeLowMargin = await promoAllowsLowMargin(url.searchParams.get('promo_code'), env);
  if (!isCatalogListed(indexEntry, includeLowMargin)) {
    throw new PortfolioError('Продуктът не е наличен.', 404);
  }

  const group = await getGroupFromChunks(env, meta, groupId);
  if (!group) throw new PortfolioError('Продуктът не е намерен.', 404);

  const clientGroup = includeLowMargin
    ? group
    : {
      ...group,
      variants: (group.variants || []).filter(
        (v) => v.available !== false && variantHasMargin(v)
      ),
    };

  return cachedResponse(
    sanitizeGroupForClient(clientGroup),
    1800
  );
}

function parseLifeCartRef(rawId) {
  const id = String(rawId || '').trim();
  if (!id) return { skuId: null, groupId: null };

  const variantMatch = id.match(/^prod-pf-(\d+)_(.+)$/);
  if (variantMatch) {
    return { groupId: variantMatch[1], skuId: variantMatch[2] };
  }

  const groupMatch = id.match(/^prod-pf-(\d+)$/);
  if (groupMatch) {
    return { groupId: groupMatch[1], skuId: null };
  }

  return { skuId: id, groupId: null };
}

async function resolveCartSku(env, rawId) {
  const { skuId, groupId } = parseLifeCartRef(rawId);

  if (skuId) {
    const found = await findVariantInCatalog(env, skuId);
    if (found) return found;
  }

  if (groupId) {
    const meta = await getMeta(env);
    if (!meta) return null;
    const group = await getGroupFromChunks(env, meta, groupId);
    if (!group?.variants?.length) return null;
    const variant = group.variants.find((v) => v.available) || group.variants[0];
    return {
      group_id: group.group_id,
      group_name: group.name,
      brand: group.brand,
      image: variant.image || group.image,
      variant
    };
  }

  return null;
}

async function resolveCartSkuForProject(env, rawId, project) {
  const catalog = await resolveCartSku(env, rawId);
  if (catalog) return catalog;
  return await resolveSiteCartSku(env, project, rawId);
}

function extractCatalogSkuIdsForStock(products) {
  const ids = new Set();
  for (const p of products || []) {
    const raw = String(p.sku_id || p.id || '').trim();
    if (!raw || !isCatalogBackedCartId(raw)) continue;
    const { variantSku } = parseSiteCartRef(raw);
    if (variantSku && /^\d+$/.test(variantSku)) ids.add(variantSku);
    const pf = raw.match(/^prod-pf-\d+_(.+)$/);
    if (pf?.[1]) ids.add(pf[1]);
    if (/^\d+$/.test(raw)) ids.add(raw);
  }
  return [...ids];
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

async function validateAndNormalizeCartItems(env, products, { promoRecord = null, project = 'portfolio' } = {}) {
  const settings = await getSettings(env);
  const policy = pricingPolicyFromSettings(settings);
  const normalized = [];
  const errors = [];

  for (const p of products) {
    const skuId = String(p.sku_id || p.id || '');
    const qty = Math.max(1, Math.min(99, Number(p.quantity) || 1));
    if (!skuId) {
      errors.push('Липсва SKU на продукт.');
      continue;
    }

    const found = await resolveCartSkuForProject(env, skuId, project);
    if (!found) {
      errors.push(`Продукт ${skuId} не е намерен в каталога.`);
      continue;
    }
    if (!found.variant.available) {
      errors.push(`${found.group_name} (${found.variant.option || found.variant.pack}) не е наличен.`);
      continue;
    }
    const allowLowMargin = !!promoRecord;
    if (!allowLowMargin) {
      if (Number(found.variant.b2b_price) > 0 && !variantHasMargin(found.variant)) {
        errors.push(`${found.group_name} не е наличен за поръчка.`);
        continue;
      }
      if (!isCatalogListed(found)) {
        errors.push(`${found.group_name} не е наличен за поръчка.`);
        continue;
      }
    }

    const catalogRetail = Number(found.variant.retail_price) || 0;
    const retailPrice = promoRecord
      ? resolvePromoLinePrice(found.variant, promoRecord, policy)
      : catalogRetail;

    const label = [found.group_name, found.variant.pack, found.variant.option].filter(Boolean).join(' – ');
    normalized.push({
      sku_id: found.variant.sku_id,
      barcode: found.variant.barcode,
      name: label,
      pack: found.variant.pack,
      option: found.variant.option,
      quantity: qty,
      b2b_price: found.variant.b2b_price,
      retail_price: retailPrice,
      catalog_retail_price: catalogRetail,
      compare_at_price: found.variant.compare_at_price || 0,
      pricing_mode: promoRecord?.discountType === 'margin_percentage'
        ? 'promo_margin_percentage'
        : (promoRecord?.pricing_mode && promoRecord.pricing_mode !== 'none'
          ? `promo_${promoRecord.pricing_mode}`
          : (found.variant.pricing_mode || 'catalog')),
      image: found.image,
      distributor: found.variant.distributor || DISTRIBUTOR_FITNESS1,
      distributor_ids: found.variant.distributor_ids || null,
      fulfillment: isDirectSaleProductLine({ sku_id: found.variant.sku_id, name: label }) ? 'direct' : 'b2b',
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
  const project = String(body.project || 'portfolio').trim() || 'portfolio';
  const catalogSkuIds = extractCatalogSkuIdsForStock(body.products);
  let stockCheckedAt = null;
  if (catalogSkuIds.length) {
    stockCheckedAt = await ensureStockFresh(env, catalogSkuIds, SYNC_POLICY.ORDER_FRESHNESS_MS);
  }

  let promoRecord = null;
  if (body.promoCode) {
    const codes = await getPromoCodes(env);
    const promo = codes.find((p) => p.code === String(body.promoCode).toUpperCase().trim());
    const check = validatePromoRecord(promo);
    if (!check.valid) throw new PortfolioError(check.error, 400);
    promoRecord = promo;
  }

  const items = await validateAndNormalizeCartItems(env, body.products, { promoRecord, project });
  const retailTotal = items.reduce((s, i) => s + i.retail_price * i.quantity, 0);
  return jsonResponse({
    valid: true,
    products: items,
    retail_total: roundPrice(retailTotal),
    stock_checked_at: stockCheckedAt
  });
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

  const data = await fetchFitness1Catalog(apiKey, { description: true });
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
async function handleBootstrap(env, ctx) {
  const settings = await getSettings(env);
  let meta = await getMeta(env);

  if (!meta) {
    const apiKey = await getFitness1ApiKey(env);
    if (!apiKey) {
      throw new PortfolioError('Каталогът не е синхронизиран.', 404);
    }
    await syncPortfolioCatalog(env, { includeDescriptions: false, fallbackToKv: true });
    meta = await getMeta(env);
    if (!meta) throw new PortfolioError('Каталогът не е синхронизиран.', 404);
  } else if (isSyncStale(meta.synced_at, SYNC_POLICY.BROWSE_TTL_MS)) {
    scheduleBrowseSyncIfStale(env, ctx);
  }

  const clientMeta = buildClientCatalogMeta(meta);
  const syncing = await isSyncInProgress(env);
  return cachedResponse({
    settings: buildPublicSiteSettings(settings),
    meta: {
      version: clientMeta.version,
      synced_at: clientMeta.synced_at,
      total_groups: clientMeta.total_groups,
      chunk_size: clientMeta.chunk_size,
      chunk_count: clientMeta.chunk_count,
      brands: clientMeta.brands,
      categories: clientMeta.categories,
      goals: clientMeta.goals,
      lookup: clientMeta.lookup,
      sku_lookup: clientMeta.sku_lookup,
      index: clientMeta.index
    },
    syncing
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

  const groups = JSON.parse(chunkRaw).map(sanitizeGroupForClient);
  return cachedResponse({ index, groups, synced_at: meta.synced_at }, 86400);
}

// --- Portfolio promo codes ---

function promoCodeKey(code) {
  return String(code || '').toUpperCase().trim();
}

function promoRecordId(promo, index = 0) {
  if (promo?.id) return promo.id;
  const code = promoCodeKey(promo?.code);
  return code ? `pf-promo-mig-${code}` : `pf-promo-row-${index}`;
}

async function removePromoFromLegacy(env, { id, code }) {
  const legacyRaw = await env.PAGE_CONTENT.get('promo_codes');
  if (!legacyRaw) return;
  const legacyCodes = JSON.parse(legacyRaw);
  const key = promoCodeKey(code);
  const filtered = legacyCodes.filter((p) => {
    if (id && p.id === id) return false;
    if (key && promoCodeKey(p.code) === key) return false;
    return true;
  });
  if (filtered.length !== legacyCodes.length) {
    await env.PAGE_CONTENT.put('promo_codes', JSON.stringify(filtered, null, 2));
  }
}

async function getPromoCodes(env) {
  const raw = await env.PAGE_CONTENT.get(KV_PROMO);
  let codes = raw ? JSON.parse(raw) : [];

  const legacyRaw = await env.PAGE_CONTENT.get('promo_codes');
  if (!legacyRaw) return codes;

  const legacyCodes = JSON.parse(legacyRaw);
  const existing = new Set(codes.map((p) => promoCodeKey(p.code)));
  const legacyRemaining = [];
  let merged = false;

  for (const legacy of legacyCodes) {
    const code = promoCodeKey(legacy.code);
    if (!code) {
      legacyRemaining.push(legacy);
      continue;
    }
    if (existing.has(code)) {
      merged = true;
      continue;
    }
    codes.push({
      ...legacy,
      id: promoRecordId(legacy),
      code,
      pricing_mode: legacy.pricing_mode || 'none',
      pricing_percent: legacy.pricing_percent ?? null
    });
    existing.add(code);
    merged = true;
  }

  if (merged) {
    await savePromoCodes(env, codes);
    if (legacyRemaining.length !== legacyCodes.length) {
      await env.PAGE_CONTENT.put('promo_codes', JSON.stringify(legacyRemaining, null, 2));
    }
  }
  return codes;
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
      description: promo.description || '',
      pricing_mode: promo.pricing_mode || 'none',
      pricing_percent: promo.pricing_percent ?? null,
      show_low_margin: promo.show_low_margin === true,
      validUntil: promo.validUntil || null,
      maxUses: promo.maxUses || null,
      usedCount: promo.usedCount || 0,
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
    pricing_mode: data.pricing_mode || 'none',
    pricing_percent: data.pricing_percent != null ? Number(data.pricing_percent) : null,
    show_low_margin: data.show_low_margin === true,
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

  const nextCode = data.code ? promoCodeKey(data.code) : promoCodeKey(codes[idx].code);
  if (nextCode && codes.some((p, i) => i !== idx && promoCodeKey(p.code) === nextCode)) {
    throw new PortfolioError('Промо код с такъв код вече съществува.', 409);
  }

  Object.assign(codes[idx], {
    code: data.code ? promoCodeKey(data.code) : codes[idx].code,
    discount: data.discount !== undefined ? parseFloat(data.discount) : codes[idx].discount,
    discountType: data.discountType || codes[idx].discountType,
    description: data.description ?? codes[idx].description,
    validFrom: data.validFrom ?? codes[idx].validFrom,
    validUntil: data.validUntil ?? codes[idx].validUntil,
    maxUses: data.maxUses !== undefined ? (data.maxUses ? parseInt(data.maxUses, 10) : null) : codes[idx].maxUses,
    usedCount: data.usedCount !== undefined ? parseInt(data.usedCount, 10) : codes[idx].usedCount,
    active: data.active !== undefined ? data.active : codes[idx].active,
    pricing_mode: data.pricing_mode ?? codes[idx].pricing_mode ?? 'none',
    pricing_percent: data.pricing_percent !== undefined
      ? (data.pricing_percent != null ? Number(data.pricing_percent) : null)
      : codes[idx].pricing_percent,
    show_low_margin: data.show_low_margin !== undefined
      ? data.show_low_margin === true
      : codes[idx].show_low_margin === true
  });
  await savePromoCodes(env, codes);
  return jsonResponse({ success: true, promoCode: codes[idx] });
}

async function handleDeletePromoCode(request, env) {
  const id = decodeURIComponent(new URL(request.url).searchParams.get('id') || '');
  if (!id) throw new PortfolioError('Липсва ID.', 400);
  let codes = await getPromoCodes(env);
  const target = codes.find((p) => p.id === id);
  if (!target) throw new PortfolioError('Промо кодът не е намерен.', 404);
  codes = codes.filter((p) => p.id !== id);
  await savePromoCodes(env, codes);
  await removePromoFromLegacy(env, { id: target.id, code: target.code });
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
  try {
    await assertOrderRateLimit(request, env);
  } catch (e) {
    if (e?.name === 'RateLimitError') throw new PortfolioError(e.message, e.status || 429);
    throw e;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    throw new PortfolioError('Невалиден JSON.', 400);
  }

  if (!body?.customer || !Array.isArray(body.products) || body.products.length === 0) {
    throw new PortfolioError('Липсват данни за клиент или продукти.', 400);
  }

  const project = String(body.project || 'portfolio').trim() || 'portfolio';

  if (cartRequiresCatalogMeta(body.products)) {
    const meta = await getMeta(env);
    if (!meta) {
      throw new PortfolioError('Каталогът не е синхронизиран. Поръчката не може да бъде приета.', 503);
    }
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
  const catalogSkuIds = extractCatalogSkuIdsForStock(body.products);
  let stockCheckedAt = null;
  if (catalogSkuIds.length) {
    stockCheckedAt = await ensureStockFresh(env, catalogSkuIds, SYNC_POLICY.ORDER_FRESHNESS_MS);
  }

  let promoRecord = null;
  let appliedPromo = null;
  if (body.promoCode) {
    const codes = await getPromoCodes(env);
    const promo = codes.find((p) => p.code === String(body.promoCode).toUpperCase().trim());
    const check = validatePromoRecord(promo, { increment: true });
    if (!check.valid) throw new PortfolioError(check.error, 400);
    promoRecord = promo;
    appliedPromo = check.promoCode;
    await savePromoCodes(env, codes);
  }

  const items = await validateAndNormalizeCartItems(env, body.products, { promoRecord, project });

  let b2bTotal = 0;
  let retailTotal = 0;
  for (const item of items) {
    b2bTotal += item.b2b_price * item.quantity;
    retailTotal += item.retail_price * item.quantity;
  }

  let promoDiscount = 0;
  if (appliedPromo) {
    if (promoUsesLinePricing(appliedPromo)) {
      promoDiscount = sumLinePricingSavings(items);
    } else {
      promoDiscount = applyPromoDiscount(retailTotal, appliedPromo);
    }
  }

  const orderPrefix = project === 'life' ? 'life' : (project === 'main' ? 'main' : 'pf');

  const chargeTotal = appliedPromo && promoUsesLinePricing(appliedPromo)
    ? retailTotal
    : retailTotal - promoDiscount;

  const shippingAmount = calculateCheckoutShipping(chargeTotal, customer);
  const serverTotal = roundPrice(chargeTotal + shippingAmount);

  if (body.summary?.total) {
    const parsed = parseFloat(String(body.summary.total).replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!Number.isNaN(parsed) && Math.abs(parsed - serverTotal) > 0.05) {
      throw new PortfolioError('Общата сума не съвпада. Презаредете checkout и опитайте отново.', 400);
    }
  }

  const settings = await getSettings(env);

  const newOrder = {
    id: `${orderPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    project,
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
      shipping: formatShippingLabel(shippingAmount),
      shipping_amount: shippingAmount,
      total: `${serverTotal.toFixed(2)} €`
    },
    fitness1_order: null,
    sila_order: null,
    admin_note: '',
    stock_checked_at: stockCheckedAt
  };

  if (isAutoSubmitB2bEnabled(settings) && orderHasB2bProducts(newOrder)) {
    try {
      await submitB2bForOrder(env, newOrder, {
        sourceOrderIds: [newOrder.id],
        refreshStock: false,
      });
    } catch (e) {
      const msg = e instanceof PortfolioError
        ? e.message
        : (e?.message || 'B2B изпращане неуспешно');
      newOrder.b2b_submit_error = { message: msg, at: new Date().toISOString() };
      newOrder.status = 'Чака одобрение';
    }
  }

  const ordersRaw = await env.PAGE_CONTENT.get(KV_ORDERS);
  const orders = ordersRaw ? JSON.parse(ordersRaw) : [];
  orders.unshift(newOrder);
  await env.PAGE_CONTENT.put(KV_ORDERS, JSON.stringify(orders, null, 2));

  return jsonResponse({ success: true, order: newOrder }, 201);
}

async function handleGetOrders(request, env) {
  const ordersRaw = await env.PAGE_CONTENT.get(KV_ORDERS);
  let orders = ordersRaw ? JSON.parse(ordersRaw) : [];
  const project = new URL(request.url).searchParams.get('project')?.trim();
  if (project) {
    orders = orders.filter((o) => String(o.project || 'portfolio') === project);
  }
  return jsonResponse(orders);
}

async function handleGetOrdersSummary(request, env) {
  const ordersRaw = await env.PAGE_CONTENT.get(KV_ORDERS);
  let orders = ordersRaw ? JSON.parse(ordersRaw) : [];
  const project = new URL(request.url).searchParams.get('project')?.trim();
  if (project) {
    orders = orders.filter((o) => String(o.project || 'portfolio') === project);
  }
  const pending = orders.filter((o) => isOrderB2bPending(o)).length;
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

async function validateOrderProducts(env, order) {
  for (const p of getB2bProducts(order)) {
    const found = await findVariantInCatalog(env, p.sku_id);
    if (!found?.variant.available) {
      throw new PortfolioError(`„${p.name}" вече не е наличен. Актуализирайте поръчката.`, 400);
    }
    const isSila = isSilaDistributor(p.distributor || found.variant.distributor);
    if (!isSila && !p.barcode && !found.variant.barcode) {
      throw new PortfolioError(`Липсва баркод за „${p.name}".`, 400);
    }
    if (!p.barcode) p.barcode = found.variant.barcode;
    if (!p.distributor) p.distributor = found.variant.distributor || DISTRIBUTOR_FITNESS1;
    if (!p.distributor_ids && found.variant.distributor_ids) {
      p.distributor_ids = found.variant.distributor_ids;
    }
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

async function submitProductsToSila(env, products) {
  if (env.MOCK_SILA === '1' || env.MOCK_SILA === true) {
    return {
      status: 200,
      message: 'Ok',
      data: { order_id: 800000 + Math.floor(Math.random() * 99999) },
    };
  }

  const apiToken = await getSilaApiToken(env);
  if (!apiToken) throw new PortfolioError('SILA_API_TOKEN не е конфигуриран.', 500);

  try {
    return await submitSilaOrder(apiToken, products);
  } catch (e) {
    if (e instanceof SilaError) {
      throw new PortfolioError(`Доставчикът отказа поръчката: ${e.message}`, e.status >= 400 ? e.status : 400);
    }
    throw e;
  }
}

function aggregateProductLinesByDistributor(productLists, distributor) {
  const map = new Map();
  for (const products of productLists) {
    for (const p of filterProductsByDistributor(products, distributor)) {
      const key = isSilaDistributor(distributor)
        ? `${p.distributor_ids?.model_id || ''}-${p.distributor_ids?.taste_id || ''}-${p.barcode || p.sku_id}`
        : (p.barcode || String(p.sku_id));
      const existing = map.get(key);
      if (existing) {
        existing.quantity += p.quantity;
      } else {
        map.set(key, { ...p });
      }
    }
  }
  return Array.from(map.values());
}

async function submitDistributorOrders(env, products, { sourceOrderIds = [] } = {}) {
  const productLists = Array.isArray(products) && products.length && Array.isArray(products[0])
    ? products
    : [products];
  const f1Products = aggregateProductLinesByDistributor(productLists, DISTRIBUTOR_FITNESS1);
  const silaProducts = aggregateProductLinesByDistributor(productLists, DISTRIBUTOR_SILA);
  const result = { fitness1: null, sila: null };

  if (f1Products.length) {
    const payload = productsToF1Payload(f1Products);
    const f1Data = await submitProductsToFitness1(env, payload);
    result.fitness1 = {
      id: f1Data.order?.id,
      price: f1Data.order?.price,
      submitted_at: new Date().toISOString(),
      batch: sourceOrderIds.length > 1,
      source_order_ids: sourceOrderIds,
      raw: f1Data,
    };
  }

  if (silaProducts.length) {
    const silaData = await submitProductsToSila(env, silaProducts);
    result.sila = {
      id: silaData.data?.order_id ?? silaData.order_id ?? silaData.data?.id,
      price: silaData.data?.total ?? silaData.data?.price ?? null,
      submitted_at: new Date().toISOString(),
      batch: sourceOrderIds.length > 1,
      source_order_ids: sourceOrderIds,
      raw: silaData,
    };
  }

  return result;
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

  const f1Response = await fetch(
    `https://fitness1.bg/b2b/api/orders/create?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ products }),
    }
  );

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

export function isAutoSubmitB2bEnabled(settings) {
  return settings?.auto_submit_b2b !== false;
}

function getPendingB2bProducts(order) {
  return getB2bProducts(order).filter((p) => {
    const d = p.distributor || DISTRIBUTOR_FITNESS1;
    if (isSilaDistributor(d)) return !order.sila_order?.id;
    return !order.fitness1_order?.id;
  });
}

function applyB2bSubmissionToOrder(order, submitted) {
  if (submitted.fitness1) order.fitness1_order = submitted.fitness1;
  if (submitted.sila) order.sila_order = submitted.sila;
  order.status = buildOrderStatusLabel(order);
  if (isOrderFullySubmitted(order)) {
    delete order.b2b_submit_error;
  }
}

async function refreshOrderStockIfStale(env, order, freshnessMs = SYNC_POLICY.APPROVE_FRESHNESS_MS) {
  if (!isSyncStale(order.stock_checked_at, freshnessMs)) return;
  const syncedAt = await ensureStockFresh(env, extractCartSkuIds(order.products), freshnessMs);
  if (syncedAt) order.stock_checked_at = syncedAt;
}

/**
 * Re-validate stock and submit pending B2B lines to Fitness1/Sila.
 * @param {object} env
 * @param {object} order
 * @param {{ sourceOrderIds?: string[], refreshStock?: boolean }} [options]
 * @returns {Promise<{ submitted: { fitness1: object|null, sila: object|null } }>}
 */
async function submitB2bForOrder(env, order, { sourceOrderIds, refreshStock = true } = {}) {
  if (isOrderFullySubmitted(order)) {
    return { submitted: { fitness1: null, sila: null } };
  }

  const pendingProducts = getPendingB2bProducts(order);
  if (!pendingProducts.length) {
    return { submitted: { fitness1: null, sila: null } };
  }

  if (refreshStock) {
    await refreshOrderStockIfStale(env, order);
  }

  await validateOrderProducts(env, order);

  const submitted = await submitDistributorOrders(env, pendingProducts, {
    sourceOrderIds: sourceOrderIds || [order.id],
  });

  applyB2bSubmissionToOrder(order, submitted);
  return { submitted };
}

async function handleApproveOrder(request, env) {
  const body = await request.json();
  if (!body?.id) throw new PortfolioError('Липсва ID на поръчка.', 400);

  const ordersRaw = await env.PAGE_CONTENT.get(KV_ORDERS);
  let orders = ordersRaw ? JSON.parse(ordersRaw) : [];
  const idx = orders.findIndex((o) => o.id === body.id);
  if (idx === -1) throw new PortfolioError('Поръчката не е намерена.', 404);

  const order = orders[idx];

  if (isOrderFullySubmitted(order)) {
    throw new PortfolioError('Поръчката вече е изпратена към дистрибуторите.', 409);
  }

  if (!getPendingB2bProducts(order).length) {
    throw new PortfolioError('Поръчката няма продукти за B2B изпращане (директни продажби се обработват ръчно).', 400);
  }

  const { submitted } = await submitB2bForOrder(env, order, { sourceOrderIds: [order.id] });
  if (body.admin_note) orders[idx].admin_note = body.admin_note;

  await env.PAGE_CONTENT.put(KV_ORDERS, JSON.stringify(orders, null, 2));
  return jsonResponse({
    success: true,
    order: orders[idx],
    fitness1: submitted.fitness1?.raw || null,
    sila: submitted.sila?.raw || null,
  });
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
    if (isOrderFullySubmitted(order)) {
      throw new PortfolioError(`Поръчка ${id} вече е изпратена към дистрибуторите.`, 409);
    }
    selected.push({ idx, order });
  }

  const allSkuIds = selected.flatMap((s) => extractCartSkuIds(s.order.products));
  const needsRefresh = selected.some((s) =>
    isSyncStale(s.order.stock_checked_at, SYNC_POLICY.APPROVE_FRESHNESS_MS)
  );
  if (needsRefresh) {
    await ensureStockFresh(env, allSkuIds, SYNC_POLICY.APPROVE_FRESHNESS_MS);
  }

  for (const { order } of selected) {
    await validateOrderProducts(env, order);
  }

  const allProducts = selected.map((s) => getB2bProducts(s.order));
  const submitted = await submitDistributorOrders(env, allProducts, { sourceOrderIds: ids });

  for (const { idx } of selected) {
    if (submitted.fitness1) orders[idx].fitness1_order = { ...submitted.fitness1 };
    if (submitted.sila) orders[idx].sila_order = { ...submitted.sila };
    orders[idx].status = buildOrderStatusLabel(orders[idx]);
    if (body.admin_note) orders[idx].admin_note = body.admin_note;
  }

  await env.PAGE_CONTENT.put(KV_ORDERS, JSON.stringify(orders, null, 2));
  return jsonResponse({
    success: true,
    orders: selected.map((s) => orders[s.idx]),
    fitness1: submitted.fitness1?.raw || null,
    sila: submitted.sila?.raw || null,
  });
}

/**
 * Main router for /portfolio/* paths.
 */
export async function handlePortfolioRoute(request, env, url, ctx) {
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
      return await handleBootstrap(env, ctx);
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
    if (path === '/portfolio/fitness1-key-status' && method === 'GET') {
      return await handleFitness1KeyStatus(env);
    }
    if (path === '/portfolio/sila-key-status' && method === 'GET') {
      return await handleSilaKeyStatus(env);
    }
    if (path === '/portfolio/sync' && method === 'POST') {
      const result = await syncPortfolioCatalog(env);
      return jsonResponse(result);
    }
    if (path === '/portfolio/chunk' && method === 'GET') {
      return await handleGetChunk(request, env);
    }
    if (path === '/portfolio/orders') {
      if (method === 'GET') return await handleGetOrders(request, env);
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
      return await handleGetOrdersSummary(request, env);
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

export { promoCodeKey, promoRecordId, removePromoFromLegacy };
