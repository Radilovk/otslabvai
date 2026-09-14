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
