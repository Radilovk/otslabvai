/**
 * Edge SEO/AEO request handler.
 *
 * ANTI-CLOAKING: HTML injection runs for ALL requests (no User-Agent branching).
 * Client hydration removes #seo-catalog / #seo-product after JS loads.
 * Only strip User-Agent from Vary — preserve Accept-Encoding etc.
 */

import {
  injectSeo,
  isCatalogHomePath,
  itemListJsonLd,
  ldTag,
  llmsTxt,
  orgJsonLd,
  productIdScript,
  productJsonLd,
  productSlugFromRecord,
  productUrl,
  renderCatalogHtml,
  renderPeptidesProductDocument,
  renderProductHtml,
  resolveSiteContext,
  robotsTxt,
  sitemapXml,
  wwwToApexRedirectUrl,
} from './seo-inject.js';
import {
  findProductByLegacyId,
  findProductBySlug,
  loadSiteCatalog,
} from './seo-data.js';
import { getSiteForHost, mapAssetPath } from './site-routing.js';

const TEXT_PLAIN = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' };
const TEXT_XML = { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600' };
/** Short edge TTL — catalog prices must not linger after KV updates. Purge on deploy too. */
export const HTML_CACHE = 'public, max-age=60, s-maxage=120, stale-while-revalidate=60';

function assetFetchInit(request) {
  const init = { method: request.method, headers: request.headers };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;
  return init;
}

function redirect(url, status = 301) {
  return new Response(null, { status, headers: { Location: url } });
}

/** Remove only User-Agent from Vary; keep Accept-Encoding and other values. */
export function stripUserAgentFromVary(headers) {
  const vary = headers.get('vary');
  if (!vary) return;
  const parts = vary.split(',').map((p) => p.trim()).filter(Boolean);
  const filtered = parts.filter((p) => p.toLowerCase() !== 'user-agent');
  if (!filtered.length) headers.delete('vary');
  else headers.set('vary', filtered.join(', '));
}

function withHtmlCacheHeaders(response, status = response.status) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  stripUserAgentFromVary(headers);
  headers.set('cache-control', HTML_CACHE);
  return new Response(response.body, { status, headers });
}

async function notFoundResponse(env, request) {
  if (!env?.ASSETS) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  const pageUrl = new URL('/404.html', request.url);
  const res = await env.ASSETS.fetch(new Request(pageUrl.toString(), assetFetchInit(request)));
  if (!res.ok) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  stripUserAgentFromVary(headers);
  headers.set('cache-control', 'public, max-age=300');
  return new Response(res.body, { status: 404, headers });
}

export function maybeWwwRedirect(url) {
  const target = wwwToApexRedirectUrl(url);
  return target ? redirect(target) : null;
}

async function fetchMappedAsset(env, request, siteId, pathname) {
  if (!env.ASSETS) return null;
  const mappedPath = mapAssetPath(siteId, pathname);
  const assetUrl = new URL(request.url);
  assetUrl.pathname = mappedPath;
  let response = await env.ASSETS.fetch(new Request(assetUrl.toString(), assetFetchInit(request)));
  if (response.status === 404 && mappedPath !== pathname) {
    assetUrl.pathname = pathname;
    response = await env.ASSETS.fetch(new Request(assetUrl.toString(), assetFetchInit(request)));
  }
  return response;
}

export async function maybeLegacyProductRedirect(url, env, siteId, request) {
  const site = resolveSiteContext(siteId);
  if (!site) return null;

  const path = url.pathname.split('?')[0];
  const templates = {
    main: '/product.html',
    life: '/life-product.html',
    portfolio: '/portfolio-product.html',
  };
  if (path !== templates[siteId]) return null;

  const legacyId = url.searchParams.get('id') || url.searchParams.get('group_id');
  if (!legacyId) return null;

  const products = await loadSiteCatalog(env, siteId);
  const product = findProductByLegacyId(products, legacyId);
  if (!product) {
    return notFoundResponse(env, request);
  }

  return redirect(productUrl(site, product));
}

export async function handleSeoRequest(request, env, url) {
  const wwwRedirect = maybeWwwRedirect(url);
  if (wwwRedirect) return wwwRedirect;

  const siteId = getSiteForHost(url.hostname);
  if (!siteId) return null;

  const site = resolveSiteContext(siteId);
  const pathname = url.pathname.split('?')[0];

  if (pathname === '/robots.txt') {
    return new Response(robotsTxt(site), { headers: TEXT_PLAIN });
  }

  if (pathname === '/sitemap.xml') {
    const products = await loadSiteCatalog(env, siteId);
    return new Response(sitemapXml(site, products), { headers: TEXT_XML });
  }

  if (pathname === '/llms.txt' || pathname === '/llms-full.txt') {
    const products = await loadSiteCatalog(env, siteId);
    return new Response(llmsTxt(site, products), { headers: TEXT_PLAIN });
  }

  const legacyRedirect = await maybeLegacyProductRedirect(url, env, siteId, request);
  if (legacyRedirect) return legacyRedirect;

  const productMatch = pathname.match(/^\/products\/([^/]+)\/?$/);
  if (productMatch) {
    return serveSeoProductPage(request, env, url, siteId, decodeURIComponent(productMatch[1]));
  }

  return null;
}

async function serveSeoProductPage(request, env, url, siteId, slug) {
  const site = resolveSiteContext(siteId);
  const products = await loadSiteCatalog(env, siteId);
  const product = findProductBySlug(products, slug);
  if (!product) {
    return notFoundResponse(env, request);
  }

  const canonical = productUrl(site, product);

  if (siteId === 'peptides') {
    return new Response(renderPeptidesProductDocument(site, product), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': HTML_CACHE,
      },
    });
  }

  const templatePath = site.productTemplate;
  const response = await fetchMappedAsset(env, request, siteId, templatePath);
  if (!response?.ok) {
    return notFoundResponse(env, request);
  }

  const head = [
    ldTag(orgJsonLd(site)),
    ldTag(productJsonLd(site, product)),
    productIdScript(product),
  ];

  if (siteId === 'portfolio' && product.group_id) {
    head.push(`<meta name="portfolio-group-id" content="${product.group_id}">`);
    if (product.default_sku_id) {
      head.push(`<meta name="portfolio-sku-id" content="${product.default_sku_id}">`);
    }
  }

  const enhanced = injectSeo(response, {
    head,
    body: [renderProductHtml(site, product)],
    canonical,
  });

  return withHtmlCacheHeaders(enhanced);
}

export async function maybeEnhanceSeoHtml(response, ctx) {
  const { env, site: siteId, mappedPath, requestUrl } = ctx;
  if (!response?.ok || !siteId) return response;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const site = resolveSiteContext(siteId);
  if (!site) return response;

  const url = new URL(requestUrl);
  const pathname = url.pathname.split('?')[0];

  if (!isCatalogHomePath(site, pathname) && !isCatalogHomePath(site, mappedPath.split('?')[0])) {
    return response;
  }

  const products = await loadSiteCatalog(env, siteId);
  if (!products.length) return response;

  const canonical = `${site.origin}/`;
  const enhanced = injectSeo(response, {
    head: [ldTag(orgJsonLd(site)), ldTag(itemListJsonLd(site, products))],
    body: [renderCatalogHtml(site, products)],
    canonical,
  });

  return withHtmlCacheHeaders(enhanced);
}

export { productSlugFromRecord, productUrl };
