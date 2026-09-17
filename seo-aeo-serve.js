/**
 * Edge SEO/AEO request handler — robots, sitemap, llms.txt, product URLs, HTML injection.
 */

import {
  htmlToAgentMarkdown,
  markdownResponseHeaders,
  wantsMarkdownResponse,
} from './seo-aeo-markdown.js';
import {
  SITE_SEO,
  injectSeo,
  isCatalogHomePath,
  itemListJsonLd,
  ldTag,
  llmsTxt,
  llmsFullTxt,
  orgJsonLd,
  productIdScript,
  productJsonLd,
  productUrl,
  publicCanonical,
  robotsTxt,
  sitemapXml,
} from './seo-aeo-inject.js';
import { agentDiscoveryLinkHeader, serveAgentDiscoveryAsset } from './seo-aeo-agent-discovery.js';
import { serveAdvancedIntegrationAsset, a2aJsonRpcResponse } from './seo-aeo-advanced-integration.js';
import {
  findProductByLegacyId,
  findProductBySlug,
  loadSiteCatalog,
} from './seo-aeo-data.js';
import { getSiteForHost, mapAssetPath } from './hostname-routing.js';

const TEXT_PLAIN = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' };
const TEXT_XML = { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' };

function assetFetchInit(request) {
  const init = { method: request.method, headers: request.headers };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;
  return init;
}

async function fetchMappedAsset(env, request, siteId, pathname) {
  if (!env.ASSETS) return null;
  const mappedPath = mapAssetPath(siteId, pathname);
  const assetUrl = new URL(request.url);
  assetUrl.pathname = mappedPath;
  let response = await env.ASSETS.fetch(new Request(assetUrl.toString(), assetFetchInit(request)));
  if (response.status === 404 && mappedPath !== pathname && siteId === 'main') {
    assetUrl.pathname = pathname;
    response = await env.ASSETS.fetch(new Request(assetUrl.toString(), assetFetchInit(request)));
  }
  return response;
}

function redirect(url, status = 301) {
  return new Response(null, { status, headers: { Location: url } });
}

export async function maybeLegacyProductRedirect(url, env, siteId) {
  const site = SITE_SEO[siteId];
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
  if (!product) return null;

  return redirect(productUrl(site, product));
}

/** @param {Request} request @param {object} env @param {URL} url */
export async function handleSeoRequest(request, env, url) {
  const siteId = getSiteForHost(url.hostname);
  if (!siteId) return null;

  const site = SITE_SEO[siteId];
  const pathname = url.pathname.split('?')[0];

  const discoveryResponse = serveAgentDiscoveryAsset(site, pathname);
  if (discoveryResponse) return discoveryResponse;

  const advancedResponse = await serveAdvancedIntegrationAsset(site, pathname);
  if (advancedResponse) return advancedResponse;

  if (pathname === '/a2a/v1' && request.method === 'POST') {
    return handleA2aJsonRpc(request, site);
  }

  if (pathname === '/robots.txt') {
    return new Response(robotsTxt(site), { headers: TEXT_PLAIN });
  }

  if (pathname === '/sitemap.xml') {
    const products = await loadSiteCatalog(env, siteId);
    return new Response(sitemapXml(site, products), { headers: TEXT_XML });
  }

  if (pathname === '/llms.txt') {
    const products = await loadSiteCatalog(env, siteId);
    return new Response(llmsTxt(site, products), { headers: TEXT_PLAIN });
  }

  if (pathname === '/llms-full.txt') {
    const products = await loadSiteCatalog(env, siteId);
    return new Response(llmsFullTxt(site, products), { headers: TEXT_PLAIN });
  }

  const legacyRedirect = await maybeLegacyProductRedirect(url, env, siteId);
  if (legacyRedirect) return legacyRedirect;

  const productMatch = pathname.match(/^\/products\/([^/]+)\/?$/);
  if (productMatch) {
    return serveSeoProductPage(request, env, url, siteId, decodeURIComponent(productMatch[1]));
  }

  return null;
}

async function serveSeoProductPage(request, env, url, siteId, slug) {
  const site = SITE_SEO[siteId];
  const products = await loadSiteCatalog(env, siteId);
  const product = findProductBySlug(products, slug);
  if (!product) return new Response('Not found', { status: 404 });

  const canonical = productUrl(site, product);
  const templatePath = site.productTemplate;
  const response = await fetchMappedAsset(env, request, siteId, templatePath);
  if (!response?.ok) return new Response('Not found', { status: 404 });

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
    canonical,
  });

  const headers = new Headers(enhanced.headers);
  headers.set('cache-control', 'public, max-age=300, stale-while-revalidate=60');
  headers.set('x-robots-tag', 'index, follow, max-snippet:-1');
  return new Response(enhanced.body, { status: enhanced.status, headers });
}

/**
 * @param {Response} response
 * @param {{ env: object, site: string|null, mappedPath: string, requestUrl: string, request?: Request }} ctx
 */
export async function maybeEnhanceSeoHtml(response, ctx) {
  const { env, site: siteId, mappedPath, requestUrl, request } = ctx;
  if (!response?.ok || !siteId) return response;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const site = SITE_SEO[siteId];
  if (!site) return response;

  const url = new URL(requestUrl);
  const pathname = url.pathname.split('?')[0];
  const canonical = publicCanonical(site, pathname);

  const head = [];

  if (isCatalogHomePath(site, pathname) || isCatalogHomePath(site, mappedPath.split('?')[0])) {
    head.push(ldTag(orgJsonLd(site)));
    const products = await loadSiteCatalog(env, /** @type {'main'|'life'|'portfolio'} */ (siteId));
    if (products.length) {
      head.push(ldTag(itemListJsonLd(site, products)));
    }
  } else if (!mappedPath.includes('checkout') && !mappedPath.includes('order-success')) {
    head.push(ldTag(orgJsonLd(site)));
  }

  const html = await response.text();
  const isNoIndex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);

  // @ts-ignore Cloudflare Workers runtime global
  const hasRewriter = typeof HTMLRewriter !== 'undefined';

  if (request && wantsMarkdownResponse(request)) {
    const sourceHtml = hasRewriter
      ? await injectSeo(new Response(html, { headers: response.headers }), { head, canonical }).text()
      : html;
    const markdown = htmlToAgentMarkdown(sourceHtml, { canonical, siteName: site.name });
    const headers = new Headers(markdownResponseHeaders(markdown, { originalHtml: sourceHtml }));
    headers.set('x-robots-tag', 'index, follow, max-snippet:-1');
    if (!isNoIndex && isCatalogHomePath(site, pathname)) {
      headers.set('Link', agentDiscoveryLinkHeader(site));
    }
    return new Response(markdown, { status: response.status, headers });
  }

  if (!hasRewriter) {
    return new Response(html, { status: response.status, headers: response.headers });
  }

  const enhanced = injectSeo(new Response(html, { headers: response.headers }), { head, canonical });

  const headers = new Headers(enhanced.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'public, max-age=300, stale-while-revalidate=60');
  if (!isNoIndex) {
    headers.set('x-robots-tag', 'index, follow, max-snippet:-1');
    if (isCatalogHomePath(site, pathname)) {
      headers.set('Link', agentDiscoveryLinkHeader(site));
    }
  }

  return new Response(enhanced.body, { status: enhanced.status, headers });
}

/** @param {Request} request @param {import('./seo-aeo-inject.js').SITE_SEO extends Record<string, infer S> ? S : never} site */
async function handleA2aJsonRpc(request, site) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const payload = a2aJsonRpcResponse(body?.id ?? null, site);
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
