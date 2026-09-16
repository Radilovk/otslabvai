/**
 * RFC 9727 API catalog + RFC 8288 Link headers for AI agent discovery.
 * Complements llms.txt / sitemap (content AEO) with public API metadata.
 */

export const API_CATALOG_PROFILE = 'https://www.rfc-editor.org/info/rfc9727';

const LINKSET_HEADERS = {
  'content-type': `application/linkset+json; profile="${API_CATALOG_PROFILE}"`,
  'cache-control': 'public, max-age=3600',
};

const OPENAPI_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=3600',
};

const TEXT_PLAIN_HEADERS = {
  'content-type': 'text/plain; charset=utf-8',
};

/** @param {string} href @param {string} type */
function link(href, type) {
  return { href, type };
}

/**
 * @param {import('./seo-aeo-inject.js').SITE_SEO extends Record<string, infer S> ? S : never} site
 */
export function apiCatalogLinkset(site) {
  const origin = site.origin;
  /** @type {object[]} */
  const entries = [
    {
      anchor: `${origin}/`,
      'service-doc': [
        link(`${origin}/llms.txt`, 'text/plain'),
        link(`${origin}/faq.html`, 'text/html'),
      ],
      describedby: [
        link(`${origin}/sitemap.xml`, 'application/xml'),
        link(`${origin}/robots.txt`, 'text/plain'),
        link(`${origin}/.well-known/security.txt`, 'text/plain'),
        link(`${origin}/auth.md`, 'text/markdown'),
        link(`${origin}/.well-known/agent-skills/index.json`, 'application/json'),
      ],
      'service-desc': [
        link(`${origin}/.well-known/mcp/server-card.json`, 'application/json'),
        link(`${origin}/.well-known/agent-card.json`, 'application/json'),
        link(`${origin}/.well-known/ai-catalog.json`, 'application/ai-catalog+json'),
      ],
    },
    {
      anchor: `${origin}/c/now`,
      'service-desc': [link(`${origin}/.well-known/openapi/catalog.json`, 'application/json')],
      'service-doc': [link(`${origin}/llms.txt`, 'text/plain')],
    },
    {
      anchor: `${origin}/portfolio/bootstrap`,
      'service-desc': [link(`${origin}/.well-known/openapi/portfolio-storefront.json`, 'application/json')],
      status: [link(`${origin}/portfolio/meta-version`, 'application/json')],
    },
    {
      anchor: `${origin}/portfolio/catalog`,
      'service-desc': [link(`${origin}/.well-known/openapi/portfolio-storefront.json`, 'application/json')],
    },
  ];

  if (site.siteId === 'main') {
    entries.push({
      anchor: `${origin}/page_content.json`,
      'service-desc': [link(`${origin}/.well-known/openapi/content.json`, 'application/json')],
    });
  }
  if (site.siteId === 'life') {
    entries.push({
      anchor: `${origin}/life_page_content.json`,
      'service-desc': [link(`${origin}/.well-known/openapi/content.json`, 'application/json')],
    });
  }

  return { linkset: entries };
}

/** @param {ReturnType<typeof apiCatalogLinkset>['linkset'][0]['anchor'] extends string ? Parameters<typeof apiCatalogLinkset>[0] : never} site */
export function apiCatalogJson(site) {
  return JSON.stringify(apiCatalogLinkset(site), null, 2);
}

/**
 * RFC 8288 Link header for indexable homepages (comma-separated).
 * @param {Parameters<typeof apiCatalogLinkset>[0]} site
 */
export function agentDiscoveryLinkHeader(site) {
  return [
    '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
    '</.well-known/ai-catalog.json>; rel="ai-catalog"; type="application/ai-catalog+json"',
    '</.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"',
    '</.well-known/agent-card.json>; rel="agent-card"; type="application/json"',
    '</llms.txt>; rel="describedby"; type="text/plain"',
    '</sitemap.xml>; rel="describedby"; type="application/xml"',
    '</.well-known/openapi/catalog.json>; rel="service-desc"; type="application/json"',
    '</auth.md>; rel="describedby"; type="text/markdown"',
  ].join(', ');
}

/** @param {Parameters<typeof apiCatalogLinkset>[0]} site */
function openapiBase(site, title) {
  return {
    openapi: '3.0.3',
    info: {
      title,
      description: `${site.name} — public read-only endpoints for AI agents and integrators.`,
      version: '1.0.0',
    },
    servers: [{ url: site.origin }],
  };
}

/** @param {Parameters<typeof apiCatalogLinkset>[0]} site */
export function openapiCatalogSpec(site) {
  return {
    ...openapiBase(site, `${site.name} catalog artifacts`),
    paths: {
      '/c/now': {
        get: {
          summary: 'Current immutable catalog artifact hashes',
          responses: { 200: { description: 'Pointer to index/stock/group JSON artifacts' } },
        },
      },
      '/c/index-{hash}.json': {
        get: { summary: 'Product index snapshot', responses: { 200: { description: 'Product index JSON' } } },
      },
      '/c/stock-{hash}.json': {
        get: { summary: 'Stock snapshot', responses: { 200: { description: 'Stock JSON' } } },
      },
    },
  };
}

/** @param {Parameters<typeof apiCatalogLinkset>[0]} site */
export function openapiPortfolioStorefrontSpec(site) {
  return {
    ...openapiBase(site, `${site.name} storefront API`),
    paths: {
      '/portfolio/bootstrap': {
        get: { summary: 'Storefront bootstrap payload', responses: { 200: { description: 'Bootstrap JSON' } } },
      },
      '/portfolio/meta-version': {
        get: { summary: 'Catalog version pointer', responses: { 200: { description: 'Version JSON' } } },
      },
      '/portfolio/catalog': {
        get: { summary: 'Paginated product catalog', responses: { 200: { description: 'Catalog JSON' } } },
      },
      '/portfolio/product': {
        get: { summary: 'Single product detail', responses: { 200: { description: 'Product JSON' } } },
      },
      '/portfolio/validate-cart': {
        post: { summary: 'Validate cart lines', responses: { 200: { description: 'Validation result' } } },
      },
    },
  };
}

/** @param {Parameters<typeof apiCatalogLinkset>[0]} site */
export function openapiContentSpec(site) {
  const path = site.siteId === 'life' ? '/life_page_content.json' : '/page_content.json';
  return {
    ...openapiBase(site, `${site.name} page content`),
    paths: {
      [path]: {
        get: { summary: 'Published storefront page content JSON', responses: { 200: { description: 'Page content' } } },
      },
    },
  };
}

/** RFC 9116 security.txt for Agent Readiness / responsible disclosure. */
export function securityTxt(site) {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  const contact = site.securityContact || 'office@biocode.com';
  return [
    `Contact: mailto:${contact}`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: bg, en',
    `Canonical: ${site.origin}/.well-known/security.txt`,
    '',
  ].join('\n');
}

/** @param {Parameters<typeof apiCatalogLinkset>[0]} site @param {string} pathname */
export function serveAgentDiscoveryAsset(site, pathname) {
  if (pathname === '/.well-known/security.txt') {
    return new Response(securityTxt(site), { headers: { ...TEXT_PLAIN_HEADERS, 'cache-control': 'public, max-age=86400' } });
  }
  if (pathname === '/.well-known/api-catalog') {
    return new Response(apiCatalogJson(site), { headers: LINKSET_HEADERS });
  }
  if (pathname === '/.well-known/openapi/catalog.json') {
    return new Response(JSON.stringify(openapiCatalogSpec(site), null, 2), { headers: OPENAPI_HEADERS });
  }
  if (pathname === '/.well-known/openapi/portfolio-storefront.json') {
    return new Response(JSON.stringify(openapiPortfolioStorefrontSpec(site), null, 2), { headers: OPENAPI_HEADERS });
  }
  if (pathname === '/.well-known/openapi/content.json' && site.siteId !== 'portfolio') {
    return new Response(JSON.stringify(openapiContentSpec(site), null, 2), { headers: OPENAPI_HEADERS });
  }
  return null;
}

export { LINKSET_HEADERS, OPENAPI_HEADERS };
