/**
 * Single source of truth for multi-domain routing expectations.
 * Used by Jest unit tests and production smoke scripts.
 */
import fs from 'fs';
import path from 'path';
import { mapAssetPath } from './hostname-routing.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));

/** @typedef {'main' | 'life' | 'portfolio'} SiteId */

/** @type {Record<SiteId, string[]>} */
export const SITE_HOSTS = {
  main: ['daotslabna.com', 'www.daotslabna.com'],
  life: ['life-protocols.com', 'www.life-protocols.com'],
  portfolio: ['biocode-bg.com', 'www.biocode-bg.com'],
};

export const MAIN_SITE_MARKER = 'ДА ОТСЛАБНА - Мисията';

/** @type {Record<SiteId, string>} */
export const SITE_BRAND_MARKERS = {
  main: 'ДА ОТСЛАБНА',
  life: 'Life Protocols',
  portfolio: 'BIOCODE',
};

/** @type {Record<SiteId, string>} */
export const SITE_STYLESHEETS = {
  main: 'index.css',
  life: 'life.css',
  portfolio: 'portfolio.css',
};

/**
 * User-facing paths exercised in production smoke tests.
 * @type {Array<{
 *   id: string,
 *   site: SiteId,
 *   path: string,
 *   titleIncludes?: string[],
 *   titleExcludes?: string[],
 *   cssIncludes?: string[],
 *   status?: number,
 *   allowMainFallback?: boolean,
 * }>}
 */
export const PRODUCTION_PAGE_CASES = [
  { id: 'main-home', site: 'main', path: '/', titleIncludes: ['ДА ОТСЛАБНА - Мисията'], cssIncludes: ['index.css'] },
  { id: 'life-home', site: 'life', path: '/', titleIncludes: ['Life Protocols - Протоколи'], titleExcludes: [MAIN_SITE_MARKER], cssIncludes: ['life.css'] },
  { id: 'portfolio-home', site: 'portfolio', path: '/', titleIncludes: ['BIOCODE – Nutrition Science'], titleExcludes: [MAIN_SITE_MARKER], cssIncludes: ['portfolio.css'] },

  { id: 'main-checkout', site: 'main', path: '/checkout.html', titleIncludes: ['Поръчка - ДА ОТСЛАБНА'], cssIncludes: ['index.css'] },
  { id: 'life-checkout', site: 'life', path: '/checkout.html', titleIncludes: ['Поръчка - Life Protocols'], titleExcludes: ['Поръчка - ДА ОТСЛАБНА'], cssIncludes: ['life.css'] },
  { id: 'portfolio-checkout', site: 'portfolio', path: '/checkout.html', titleIncludes: ['Поръчка – BIOCODE'], titleExcludes: ['Поръчка - ДА ОТСЛАБНА'], cssIncludes: ['portfolio.css'] },

  { id: 'main-product', site: 'main', path: '/product.html', titleIncludes: ['Продукт - ДА ОТСЛАБНА'] },
  { id: 'life-product', site: 'life', path: '/product.html', titleIncludes: ['Продукт - Life Protocols'], titleExcludes: ['Продукт - ДА ОТСЛАБНА'] },
  { id: 'portfolio-product', site: 'portfolio', path: '/product.html', titleIncludes: ['Продукт – BIOCODE'], titleExcludes: ['Продукт - ДА ОТСЛАБНА'] },

  { id: 'life-shipping', site: 'life', path: '/shipping.html', titleIncludes: ['Life Protocols'], titleExcludes: [MAIN_SITE_MARKER] },
  { id: 'portfolio-shipping', site: 'portfolio', path: '/shipping.html', titleIncludes: ['BIOCODE'], titleExcludes: [MAIN_SITE_MARKER] },

  { id: 'life-policy', site: 'life', path: '/policy.html', titleIncludes: ['Life Protocols'], titleExcludes: [MAIN_SITE_MARKER] },
  { id: 'portfolio-policy', site: 'portfolio', path: '/policy.html', titleIncludes: ['BIOCODE'], titleExcludes: [MAIN_SITE_MARKER] },

  { id: 'life-terms', site: 'life', path: '/terms.html', titleIncludes: ['Life Protocols'], titleExcludes: [MAIN_SITE_MARKER] },
  { id: 'portfolio-terms', site: 'portfolio', path: '/terms.html', titleIncludes: ['BIOCODE'], titleExcludes: [MAIN_SITE_MARKER] },

  { id: 'life-contact', site: 'life', path: '/contact.html', titleIncludes: ['Life Protocols'], titleExcludes: ['Контакти - ДА ОТСЛАБНА'] },
  { id: 'life-about', site: 'life', path: '/about-us.html', titleIncludes: ['Life Protocols'], titleExcludes: ['За нас - ДА ОТСЛАБНА'] },

  { id: 'life-protocol-quiz', site: 'life', path: '/life-protocol-quiz.html', titleIncludes: ['Life Protocols'] },
  { id: 'portfolio-advisor-quiz', site: 'portfolio', path: '/portfolio-advisor-quiz.html', titleIncludes: ['BIOCODE'] },

  { id: 'main-faq', site: 'main', path: '/faq.html', titleIncludes: ['ДА ОТСЛАБНА'], cssIncludes: ['index.css'] },
  { id: 'life-faq', site: 'life', path: '/faq.html', titleIncludes: ['Life Protocols'], titleExcludes: [MAIN_SITE_MARKER] },
  { id: 'portfolio-faq', site: 'portfolio', path: '/faq.html', titleIncludes: ['BIOCODE'], titleExcludes: [MAIN_SITE_MARKER] },

  { id: 'shared-admin', site: 'main', path: '/admin.html', titleIncludes: ['Админ Панел'] },
  { id: 'shared-admin-life-host', site: 'life', path: '/admin.html', titleIncludes: ['Админ Панел'] },
  { id: 'shared-admin-portfolio-host', site: 'portfolio', path: '/admin.html', titleIncludes: ['Админ Панел'] },

  // Missing mapped asset — must not leak main storefront HTML.
  { id: 'portfolio-category-gap', site: 'portfolio', path: '/category.html', titleExcludes: ['Категория - ДА ОТСЛАБНА'], status: 404 },
  { id: 'portfolio-contact-gap', site: 'portfolio', path: '/contact.html', titleExcludes: ['Контакти - ДА ОТСЛАБНА'], status: 404 },
];

/** @type {Array<{ id: string, path: string, method?: string, status: number, auth?: boolean, bodyIncludes?: string[] }>} */
export const PRODUCTION_API_CASES = [
  { id: 'catalog-now', path: '/c/now', status: 200, bodyIncludes: ['"i"'] },
  { id: 'portfolio-bootstrap', path: '/portfolio/bootstrap', status: 200, bodyIncludes: ['meta'] },
  { id: 'page-content', path: '/page_content.json', status: 200, bodyIncludes: ['"page_content"'] },
  { id: 'life-page-content', path: '/life_page_content.json', status: 200 },
  { id: 'admin-settings-blocked', path: '/portfolio/settings', status: 401, auth: false },
  { id: 'admin-orders-blocked', path: '/portfolio/orders', status: 401, auth: false },
];

/**
 * Generic storefront paths mapped for life/portfolio sites.
 * @type {string[]}
 */
export const GENERIC_HTML_PATHS = [
  '/',
  '/checkout.html',
  '/product.html',
  '/category.html',
  '/contact.html',
  '/policy.html',
  '/terms.html',
  '/shipping.html',
  '/about-us.html',
];

/**
 * @param {string} filePath
 * @returns {string | null}
 */
export function readTitleFromFile(filePath) {
  const abs = path.join(ROOT, filePath.replace(/^\//, ''));
  if (!fs.existsSync(abs)) return null;
  const html = fs.readFileSync(abs, 'utf8');
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : null;
}

/**
 * @param {SiteId} site
 * @param {string} requestPath
 * @returns {{ mappedPath: string, fileExists: boolean, title: string | null }}
 */
export function resolveRoutingExpectation(site, requestPath) {
  const mappedPath = mapAssetPath(site, requestPath);
  const title = readTitleFromFile(mappedPath);
  return {
    mappedPath,
    fileExists: title !== null || fs.existsSync(path.join(ROOT, mappedPath.replace(/^\//, ''))),
    title,
  };
}

/**
 * Expand page cases to concrete URLs (apex host per site).
 * @returns {Array<{ id: string, url: string, site: SiteId, path: string } & Omit<import('./hostname-routing-contract.js').PRODUCTION_PAGE_CASES[0], 'id' | 'site' | 'path'>>}
 */
export function expandProductionPageUrls(cases = PRODUCTION_PAGE_CASES) {
  return cases.map((spec) => {
    const host = SITE_HOSTS[spec.site][0];
    return {
      ...spec,
      url: `https://${host}${spec.path}`,
    };
  });
}

export const WORKER_API_BASE = process.env.PLATFORM_API_BASE || 'https://port.radilov-k.workers.dev';

/**
 * AEO/GEO edge endpoints — per-domain robots, sitemap, llms.txt
 * @type {Array<{ id: string, site: SiteId, path: string, bodyIncludes: string[] }>}
 */
export const PRODUCTION_AEO_CASES = [
  { id: 'main-robots', site: 'main', path: '/robots.txt', bodyIncludes: ['Content-Signal: search=yes,ai-input=yes,ai-train=no', 'OAI-SearchBot', 'Claude-SearchBot', 'Sitemap: https://daotslabna.com/sitemap.xml'], bodyExcludes: ['# BEGIN Cloudflare Managed content'] },
  { id: 'life-robots', site: 'life', path: '/robots.txt', bodyIncludes: ['Content-Signal:', 'PerplexityBot', 'Sitemap: https://life-protocols.com/sitemap.xml'], bodyExcludes: ['# BEGIN Cloudflare Managed content'] },
  { id: 'portfolio-robots', site: 'portfolio', path: '/robots.txt', bodyIncludes: ['Content-Signal:', 'ChatGPT-User', 'Sitemap: https://biocode-bg.com/sitemap.xml'], bodyExcludes: ['# BEGIN Cloudflare Managed content'] },
  { id: 'main-llms', site: 'main', path: '/llms.txt', bodyIncludes: ['ДА ОТСЛАБНА', 'daotslabna.com'] },
  { id: 'life-llms', site: 'life', path: '/llms.txt', bodyIncludes: ['Life Protocols', 'life-protocols.com'] },
  { id: 'portfolio-llms', site: 'portfolio', path: '/llms.txt', bodyIncludes: ['BIOCODE', 'biocode-bg.com'] },
  { id: 'main-sitemap', site: 'main', path: '/sitemap.xml', bodyIncludes: ['https://daotslabna.com/', '<urlset'] },
  { id: 'life-sitemap', site: 'life', path: '/sitemap.xml', bodyIncludes: ['https://life-protocols.com/faq.html', 'https://life-protocols.com/life.html'], bodyExcludes: ['https://life-protocols.com/index.html'] },
  { id: 'portfolio-sitemap', site: 'portfolio', path: '/sitemap.xml', bodyIncludes: ['https://biocode-bg.com/'] },
  { id: 'main-gptbot-home', site: 'main', path: '/', userAgent: 'GPTBot' },
  { id: 'life-gptbot-home', site: 'life', path: '/', userAgent: 'GPTBot' },
  { id: 'portfolio-gptbot-home', site: 'portfolio', path: '/', userAgent: 'GPTBot' },
];

/**
 * RFC 9727 api-catalog + RFC 8288 Link headers (Agent Readiness).
 * @type {Array<{ id: string, site: SiteId, path: string, bodyIncludes?: string[], contentTypeIncludes?: string[], linkHeaderIncludes?: string[] }>}
 */
export const PRODUCTION_AGENT_DISCOVERY_CASES = [
  {
    id: 'main-security-txt',
    site: 'main',
    path: '/.well-known/security.txt',
    bodyIncludes: ['Contact: mailto:radilov.k@gmail.com', 'Preferred-Languages'],
  },
  {
    id: 'main-api-catalog',
    site: 'main',
    path: '/.well-known/api-catalog',
    contentTypeIncludes: ['application/linkset+json'],
    bodyIncludes: ['"linkset"', 'llms.txt', '/c/now', 'page_content.json'],
  },
  {
    id: 'life-api-catalog',
    site: 'life',
    path: '/.well-known/api-catalog',
    contentTypeIncludes: ['application/linkset+json'],
    bodyIncludes: ['life-protocols.com', 'life_page_content.json'],
  },
  {
    id: 'portfolio-api-catalog',
    site: 'portfolio',
    path: '/.well-known/api-catalog',
    contentTypeIncludes: ['application/linkset+json'],
    bodyIncludes: ['portfolio/bootstrap', 'portfolio/catalog'],
  },
  {
    id: 'main-home-link',
    site: 'main',
    path: '/',
    linkHeaderIncludes: ['rel="api-catalog"', 'llms.txt'],
  },
  {
    id: 'life-home-link',
    site: 'life',
    path: '/',
    linkHeaderIncludes: ['rel="api-catalog"', 'describedby'],
  },
  {
    id: 'portfolio-home-link',
    site: 'portfolio',
    path: '/',
    linkHeaderIncludes: ['rel="api-catalog"'],
  },
];

/** Advanced Integration (Level 4/5) — OAuth, MCP, A2A, Agent Skills, ARD (all 3 domains). */
function advancedIntegrationCases(site, origin, skillId, mcpToolNeedle = 'get_llms_index') {
  return [
    {
      id: `${site}-oauth-as`,
      site,
      path: '/.well-known/oauth-authorization-server',
      bodyIncludes: [`"issuer": "${origin}"`, 'authorization_endpoint', 'jwks_uri', 'agent_auth', '"skill"'],
    },
    {
      id: `${site}-oauth-prm`,
      site,
      path: '/.well-known/oauth-protected-resource',
      bodyIncludes: [`"resource": "${origin}"`, 'authorization_servers', 'bearer_methods_supported'],
    },
    {
      id: `${site}-mcp-card`,
      site,
      path: '/.well-known/mcp/server-card.json',
      bodyIncludes: ['"transport": "http"', '"tools"', mcpToolNeedle],
    },
    {
      id: `${site}-a2a-card`,
      site,
      path: '/.well-known/agent-card.json',
      bodyIncludes: ['supportedInterfaces', '/a2a/v1', '"skills"'],
    },
    {
      id: `${site}-agent-skills`,
      site,
      path: '/.well-known/agent-skills/index.json',
      bodyIncludes: ['$schema', `${skillId}-storefront`, 'sha256:'],
    },
    {
      id: `${site}-auth-md`,
      site,
      path: '/auth.md',
      bodyIncludes: ['#', 'auth.md', 'anonymous-flow'],
    },
    {
      id: `${site}-ai-catalog`,
      site,
      path: '/.well-known/ai-catalog.json',
      contentTypeIncludes: ['application/ai-catalog+json'],
      bodyIncludes: ['specVersion', 'representativeQueries', 'application/mcp-server-card+json'],
    },
    {
      id: `${site}-web-bot-auth`,
      site,
      path: '/.well-known/http-message-signatures-directory',
      contentTypeIncludes: ['application/http-message-signatures-directory+json'],
      bodyIncludes: ['"keys"', 'Ed25519'],
    },
  ];
}

export const PRODUCTION_ADVANCED_INTEGRATION_CASES = [
  ...advancedIntegrationCases('main', 'https://daotslabna.com', 'main', 'get_llms_index'),
  ...advancedIntegrationCases('life', 'https://life-protocols.com', 'life', 'get_storefront_bootstrap'),
  ...advancedIntegrationCases('portfolio', 'https://biocode-bg.com', 'portfolio', 'get_storefront_bootstrap'),
];
