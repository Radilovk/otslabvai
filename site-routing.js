/** @typedef {'main' | 'life' | 'portfolio' | 'peptides'} SiteId */

/** @type {Record<string, SiteId>} */
export const SITE_BY_HOST = {
  'daotslabna.com': 'main',
  'www.daotslabna.com': 'main',
  'life-protocols.com': 'life',
  'www.life-protocols.com': 'life',
  'biocode-bg.com': 'portfolio',
  'www.biocode-bg.com': 'portfolio',
  'biocode-peptides.com': 'peptides',
  'www.biocode-peptides.com': 'peptides',
};

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

const PEPTIDES_ROOT_PAGES = new Set([
  'index.html',
  'about.html',
  'science.html',
  'quality.html',
  'products.html',
  'contact.html',
]);

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

  if (path === '/main-advisor-submit') return true;
  if (path.startsWith('/main-advisor/')) return true;

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

export function getSiteForHost(hostname) {
  return SITE_BY_HOST[String(hostname || '').toLowerCase()] || null;
}

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

function mapPeptidesAssetPath(pathname) {
  const path = pathname.split('?')[0] || '/';
  if (path.startsWith('/biocode/')) return path;
  if (path === '/' || path === '') return '/biocode/index.html';
  if (path.startsWith('/assets/')) return `/biocode${path}`;
  if (path.startsWith('/products/')) return path;
  const file = path.replace(/^\//, '');
  if (PEPTIDES_ROOT_PAGES.has(file)) return `/biocode/${file}`;
  if (path.endsWith('.html') && !path.includes('/')) return `/biocode/${file}`;
  return path;
}

export function mapAssetPath(site, pathname) {
  const path = pathname.split('?')[0] || '/';

  if (!site) return path;

  if (site === 'peptides') {
    return mapPeptidesAssetPath(path);
  }

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
