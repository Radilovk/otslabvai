/**
 * Hostname-based static asset routing for multi-domain single-repo deploy.
 * Maps clean URLs on custom domains to prefixed HTML files in the asset bundle.
 */

/** @typedef {'main' | 'life' | 'portfolio'} SiteId */

/** @type {Record<string, SiteId>} */
export const SITE_BY_HOST = {
  'daotslabna.com': 'main',
  'www.daotslabna.com': 'main',
  'life-protocols.com': 'life',
  'www.life-protocols.com': 'life',
  'biocode-bg.com': 'portfolio',
  'www.biocode-bg.com': 'portfolio',
};

/** HTML pages shared across sites — never prefix-remapped. */
const SHARED_HTML = new Set([
  '/admin.html',
  '/bio.html',
  '/bioadmin.html',
  '/404.html',
]);

const STATIC_ASSET_EXTENSIONS = new Set([
  'js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico',
  'woff', 'woff2', 'ttf', 'eot', 'map', 'txt', 'xml', 'php', 'pdf', 'webmanifest',
]);

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isStaticAssetPath(pathname) {
  const path = pathname.split('?')[0];
  if (path.startsWith('/images/')) return true;
  if (path.startsWith('/office_locator')) return true;
  if (path.startsWith('/biocode/')) return true;
  if (path.startsWith('/lipolor/')) return true;
  const last = path.split('/').pop() || '';
  const dot = last.lastIndexOf('.');
  if (dot === -1) return false;
  const ext = last.slice(dot + 1).toLowerCase();
  return STATIC_ASSET_EXTENSIONS.has(ext);
}

/**
 * Worker API paths — must not be rewritten to static HTML assets.
 * @param {string} pathname
 * @returns {boolean}
 */
export function isWorkerApiPath(pathname) {
  const path = pathname.split('?')[0];

  if (path.endsWith('.json')) return true;
  if (path.startsWith('/api/')) return true;

  if (path.startsWith('/portfolio/')) return true;
  if (path === '/portfolio/sync') return true;
  if (path.startsWith('/portfolio/import/')) return true;

  if (path.startsWith('/c/')) return true;

  if (path === '/life-protocol-submit') return true;
  if (path.startsWith('/life-protocol/')) return true;

  if (path === '/portfolio-advisor-submit') return true;
  if (path.startsWith('/portfolio-advisor/')) return true;

  const exactApi = [
    '/quest-submit',
    '/quest-ai-followup',
    '/orders',
    '/contacts',
    '/promo-codes',
    '/validate-promo',
    '/ai-assistant',
    '/ai-settings',
    '/api-token',
    '/bio_rebake',
    '/admin/login',
    '/admin/session',
  ];
  return exactApi.includes(path);
}

/**
 * @param {string} hostname
 * @returns {SiteId | null}
 */
export function getSiteForHost(hostname) {
  return SITE_BY_HOST[String(hostname || '').toLowerCase()] || null;
}

/**
 * @param {SiteId} site
 * @param {string} pathname
 * @returns {string}
 */
function mapPrefixedHtml(site, pathname) {
  const path = pathname.split('?')[0];
  if (SHARED_HTML.has(path)) return path;
  if (!path.endsWith('.html')) return path;

  const file = path.slice(1);
  if (site === 'life') {
    if (file === 'life.html' || file.startsWith('life-')) return path;
    return `/life-${file}`;
  }
  if (site === 'portfolio') {
    if (
      file === 'portfolio.html' ||
      file.startsWith('portfolio-') ||
      file.startsWith('portfolio-advisor')
    ) {
      return path;
    }
    return `/portfolio-${file}`;
  }
  return path;
}

/**
 * Map a request path to the asset file path for the given site.
 * @param {SiteId | null} site
 * @param {string} pathname
 * @returns {string}
 */
export function mapAssetPath(site, pathname) {
  const path = pathname.split('?')[0] || '/';

  if (!site) return path;

  if (path === '/' || path === '') {
    switch (site) {
      case 'main': return '/index.html';
      case 'life': return '/life.html';
      case 'portfolio': return '/portfolio.html';
      default: return path;
    }
  }

  if (isStaticAssetPath(path)) return path;

  if (site === 'main') {
    return path;
  }

  return mapPrefixedHtml(site, path);
}

/**
 * Serve a static asset with hostname path mapping via env.ASSETS.
 * @param {Request} request
 * @param {{ ASSETS?: { fetch: (req: Request) => Promise<Response> } }} env
 * @param {URL} url
 * @returns {Promise<Response | null>}
 */
export async function serveMappedAsset(request, env, url) {
  if (!env.ASSETS) return null;

  const site = getSiteForHost(url.hostname);
  const pathname = url.pathname;
  const mappedPath = mapAssetPath(site, pathname);

  const assetUrl = new URL(request.url);
  assetUrl.pathname = mappedPath;
  let response = await env.ASSETS.fetch(new Request(assetUrl, request));

  if (response.status === 404 && mappedPath !== pathname) {
    assetUrl.pathname = pathname;
    response = await env.ASSETS.fetch(new Request(assetUrl, request));
  }

  return response;
}
