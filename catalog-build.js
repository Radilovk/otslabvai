/**
 * Build versioned catalog artifacts from Fitness1 raw products.
 * Used by GHA light sync and unit tests.
 */
import {
  groupRawProducts,
  buildCatalogMeta,
  sanitizeIndexEntryForClient,
  DEFAULT_SETTINGS
} from './portfolio-api.js';
import { catalogHash } from './catalog-hash.js';
import { CATALOG_SYNC_POLICY } from './catalog-sync-policy.js';

const CHUNK_SIZE = 150;

function pricingConfigFingerprint(settings) {
  const slice = {
    global_markup_percent: settings.global_markup_percent,
    brand_markups: settings.brand_markups,
    category_markups: settings.category_markups,
    product_overrides: settings.product_overrides,
    pricing_policy: settings.pricing_policy
  };
  return catalogHash(slice);
}

/** Fitness1 exposes boolean availability, not numeric qty. */
export function effectiveStockQty(rawAvailable, rawQty = null) {
  if (typeof rawQty === 'number' && Number.isFinite(rawQty)) {
    return rawQty > CATALOG_SYNC_POLICY.SAFETY_THRESHOLD ? rawQty : 0;
  }
  return rawAvailable === true ? 1 : 0;
}

function buildStockMap(groups) {
  const q = {};
  for (const group of groups) {
    for (const variant of group.variants || []) {
      if (!variant.sku_id) continue;
      q[String(variant.sku_id)] = effectiveStockQty(variant.available);
    }
  }
  return q;
}

function groupContentHash(entry) {
  return catalogHash({
    name: entry.name,
    brand: entry.brand,
    brand_id: entry.brand_id,
    category: entry.category,
    category_top: entry.category_top,
    min_price: entry.min_price,
    max_price: entry.max_price,
    has_promo: entry.has_promo,
    compare_at_price: entry.compare_at_price,
    default_sku_id: entry.default_sku_id,
    image: entry.image,
    packs: entry.packs,
    goals: entry.goals,
    variant_skus: entry.variant_skus
  });
}

function brandingFingerprint(settings) {
  return catalogHash({
    site_name: settings.site_name,
    site_slogan: settings.site_slogan,
    hero_image: settings.hero_image,
    hero_title: settings.hero_title,
    hero_mode: settings.hero_mode,
    hero_slides: settings.hero_slides,
    hero_carousel_interval: settings.hero_carousel_interval,
    footer: settings.footer,
  });
}

/**
 * @param {object[]} rawProducts
 * @param {object} [settings]
 * @param {{ now?: number }} [options]
 */
export function buildCatalogArtifacts(rawProducts, settings = DEFAULT_SETTINGS, options = {}) {
  const now = options.now ?? Date.now();
  const generatedAt = Math.floor(now / 1000);
  const groups = groupRawProducts(rawProducts, settings);
  const meta = buildCatalogMeta(groups, settings);
  const pricingVersion = pricingConfigFingerprint(settings);
  const transformVersion = CATALOG_SYNC_POLICY.TRANSFORM_VERSION;

  const products = meta.index.map((entry) => {
    const group = groups.find((g) => g.group_id === entry.group_id);
    const variantSkus = (group?.variants || []).map((v) => String(v.sku_id)).filter(Boolean);
    const clientEntry = sanitizeIndexEntryForClient({
      ...entry,
      variant_skus: variantSkus
    });
    return clientEntry;
  });

  const perGroupHashes = {};
  for (const product of products) {
    perGroupHashes[product.group_id] = groupContentHash(product);
  }

  const indexContentHash = catalogHash({
    perGroupHashes,
    pricingVersion,
    transformVersion,
    branding: brandingFingerprint(settings),
  });
  const indexVersion = catalogHash({ indexContentHash, pricingVersion, transformVersion });

  const q = buildStockMap(groups);
  const stockContentHash = catalogHash(q);
  const stockVersion = catalogHash({ stockContentHash, transformVersion });

  const indexPayload = {
    v: indexVersion,
    generatedAt,
    brands: meta.brands,
    categories: meta.categories,
    goals: meta.goals,
    products,
    lookup: meta.lookup,
    sku_lookup: meta.sku_lookup,
    chunk_count: meta.chunk_count,
    chunk_size: CHUNK_SIZE,
    total_groups: products.length,
    settings: {
      site_name: settings.site_name,
      site_slogan: settings.site_slogan,
      hero_image: settings.hero_image,
      hero_title: settings.hero_title,
      hero_mode: settings.hero_mode,
      hero_slides: settings.hero_slides,
      hero_carousel_interval: settings.hero_carousel_interval,
      footer: settings.footer,
      reseller_name: settings.reseller_name,
      reseller_phone: settings.reseller_phone,
      reseller_address: settings.reseller_address,
      reseller_delivery_note: settings.reseller_delivery_note
    }
  };

  const stockPayload = {
    v: stockVersion,
    generatedAt,
    q
  };

  const chunks = [];
  for (let i = 0; i < meta.chunk_count; i += 1) {
    chunks.push(groups.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
  }

  const legacyMeta = {
    ...meta,
    synced_at: new Date(now).toISOString()
  };

  return {
    indexVersion,
    stockVersion,
    indexPayload,
    stockPayload,
    chunks,
    groups,
    legacyMeta,
    legacySettings: {
      ...settings,
      last_sync: legacyMeta.synced_at,
      last_sync_count: groups.length
    },
    hashes: {
      indexContent: indexContentHash,
      stockContent: stockContentHash,
      perGroup: perGroupHashes,
      pricingVersion,
      transformVersion
    },
    pointer: {
      i: indexVersion,
      s: stockVersion,
      t: generatedAt,
      dispatchedAt: 0
    }
  };
}
