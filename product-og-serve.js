/**
 * Server-side Open Graph injection for product detail HTML pages.
 * Social crawlers (WhatsApp, Viber, Facebook) do not run JavaScript.
 */

import { injectProductOgMeta, resolveOgImageUrl, absoluteUrl } from './og-share-meta.js';
import { loadPortfolioGroupsByIds } from './portfolio-api.js';

const PRODUCT_PAGES = new Set([
  '/portfolio-product.html',
  '/product.html',
  '/life-product.html',
]);

export function isProductDetailPage(mappedPath) {
  const path = String(mappedPath || '').split('?')[0];
  return PRODUCT_PAGES.has(path);
}

function detectProductKind(mappedPath) {
  const path = String(mappedPath || '').split('?')[0];
  if (path === '/portfolio-product.html') return 'portfolio';
  if (path === '/life-product.html') return 'life';
  if (path === '/product.html') return 'main';
  return null;
}

async function loadSitePageContent(env, site) {
  if (!env?.PAGE_CONTENT) return null;
  const keys = site === 'life'
    ? ['life_page_content', 'static_backend_life_page_content.json']
    : ['page_content', 'static_backend_page_content.json'];
  for (const key of keys) {
    const raw = await env.PAGE_CONTENT.get(key);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

function findSiteProduct(data, productId) {
  for (const component of data?.page_content || []) {
    if (component.type !== 'product_category' || !Array.isArray(component.products)) continue;
    const hit = component.products.find((p) => String(p.product_id) === String(productId));
    if (hit) return hit;
  }
  return null;
}

/**
 * @param {string} html
 * @param {{ env: object, site: string|null, mappedPath: string, requestUrl: string }} ctx
 */
export async function enhanceProductPageHtml(html, ctx) {
  if (!isProductDetailPage(ctx.mappedPath)) return html;

  const kind = detectProductKind(ctx.mappedPath);
  if (!kind) return html;

  const url = new URL(ctx.requestUrl);
  const origin = url.origin;
  const pagePath = ctx.mappedPath + (url.search || '');

  if (kind === 'portfolio') {
    const groupId = url.searchParams.get('group_id');
    if (!groupId) return html;

    const groups = await loadPortfolioGroupsByIds(ctx.env, [groupId]);
    const group = groups.get(String(groupId));
    if (!group) return html;

    const sku = url.searchParams.get('sku');
    const variants = group.variants || [];
    const variant = sku
      ? variants.find((v) => String(v.sku_id) === String(sku))
      : variants.find((v) => v.available) || variants[0];

    const imageRaw = variant?.image || group.image;
    const image = resolveOgImageUrl(imageRaw, undefined, origin);
    const title = `${group.name} – BIOCODE`;
    const description = `${group.name} – ${group.brand || 'BIOCODE'}`;

    return injectProductOgMeta(html, {
      title,
      description,
      image,
      url: absoluteUrl(pagePath, origin),
    });
  }

  const productId = url.searchParams.get('id');
  if (!productId) return html;

  const data = await loadSitePageContent(ctx.env, kind);
  const product = findSiteProduct(data, productId);
  const pd = product?.public_data;
  if (!pd) return html;

  const image = resolveOgImageUrl(pd.image_url, undefined, origin);
  const title = kind === 'life'
    ? `${pd.name} - Life Protocols`
    : `${pd.name} - ДА ОТСЛАБНА`;
  const description = String(pd.tagline || pd.description || '').substring(0, 155);

  return injectProductOgMeta(html, {
    title,
    description,
    image,
    url: absoluteUrl(url.pathname + url.search, origin),
  });
}

/**
 * @param {Response} response
 * @param {{ env: object, site: string|null, mappedPath: string, requestUrl: string }} ctx
 */
export async function maybeEnhanceProductHtmlResponse(response, ctx) {
  if (!response?.ok || !isProductDetailPage(ctx.mappedPath)) return response;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  const enhanced = await enhanceProductPageHtml(html, ctx);
  if (enhanced === html) return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'public, max-age=120, stale-while-revalidate=300');
  return new Response(enhanced, { status: response.status, headers });
}
