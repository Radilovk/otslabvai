/**
 * Load catalog data from KV for edge SEO/AEO layer.
 */

import { getProductPriceEur } from './protocol-quiz-engine.js';
import { getPortfolioMeta } from './portfolio-api.js';
import {
  getPeptidesCatalog,
  productSlugFromRecord,
  slugify,
} from './seo-inject.js';

async function loadJsonFromKv(env, keys) {
  if (!env?.PAGE_CONTENT) return null;
  for (const key of keys) {
    const raw = await env.PAGE_CONTENT.get(key);
    if (!raw) continue;
    try {
      return JSON.parse(raw);
    } catch {
      /* try next key */
    }
  }
  return null;
}

export function extractPageContentProducts(pageContent, categoryFallback = 'Продукти') {
  const out = [];
  for (const component of pageContent?.page_content || []) {
    if (component.type !== 'product_category' || !Array.isArray(component.products)) continue;
    const category = component.category_name || component.title || categoryFallback;
    for (const p of component.products) {
      const pd = p.public_data || {};
      const priceEur = getProductPriceEur(p);
      out.push({
        id: p.product_id,
        legacyId: p.product_id,
        title: pd.name || p.product_id,
        description: pd.tagline || String(pd.description || '').slice(0, 400),
        price: priceEur > 0 ? Math.round(priceEur * 100) / 100 : null,
        image: pd.image_url || '',
        category,
        inStock: (p.private_data?.inventory ?? 1) > 0,
        slug: productSlugFromRecord({ ...p, title: pd.name }),
      });
    }
  }

  const seen = new Set();
  return out.filter((p) => p.slug && !seen.has(p.slug) && seen.add(p.slug));
}

export function extractPortfolioIndexProducts(meta) {
  if (!meta?.index) return [];
  return meta.index
    .filter((e) => e.available !== false)
    .map((e) => ({
      id: e.group_id,
      legacyId: e.group_id,
      group_id: e.group_id,
      default_sku_id: e.default_sku_id,
      title: e.name,
      description: `${e.name} — ${e.brand || 'BIOCODE'}${e.category_top ? `, ${e.category_top}` : ''}`,
      price: e.min_client_price > 0 ? e.min_client_price : (e.min_price > 0 ? e.min_price : null),
      image: e.image || '',
      category: e.category_top || e.category || 'Каталог',
      inStock: e.available !== false,
      slug: slugify(e.name) || String(e.group_id),
    }));
}

export async function loadSiteCatalog(env, siteId) {
  if (siteId === 'peptides') {
    return getPeptidesCatalog();
  }

  if (siteId === 'portfolio') {
    const meta = await getPortfolioMeta(env);
    return extractPortfolioIndexProducts(meta);
  }

  const keys = siteId === 'life'
    ? ['life_page_content', 'static_backend_life_page_content.json']
    : ['page_content', 'static_backend_page_content.json'];

  const data = await loadJsonFromKv(env, keys);
  return extractPageContentProducts(data);
}

export function findProductBySlug(products, slug) {
  const needle = String(slug || '').toLowerCase();
  return products.find((p) => productSlugFromRecord(p) === needle) || null;
}

export function findProductByLegacyId(products, legacyId) {
  const id = String(legacyId || '');
  return products.find((p) => String(p.legacyId || p.id) === id) || null;
}
