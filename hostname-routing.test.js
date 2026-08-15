import {
  getSiteForHost,
  isWorkerApiPath,
  isStaticAssetPath,
  mapAssetPath,
} from './hostname-routing.js';

describe('getSiteForHost', () => {
  test('maps configured domains', () => {
    expect(getSiteForHost('daotslabna.com')).toBe('main');
    expect(getSiteForHost('www.daotslabna.com')).toBe('main');
    expect(getSiteForHost('life-protocols.com')).toBe('life');
    expect(getSiteForHost('www.life-protocols.com')).toBe('life');
    expect(getSiteForHost('biocode-bg.com')).toBe('portfolio');
    expect(getSiteForHost('www.biocode-bg.com')).toBe('portfolio');
  });

  test('returns null for unknown hosts', () => {
    expect(getSiteForHost('port.radilov-k.workers.dev')).toBeNull();
    expect(getSiteForHost('localhost')).toBeNull();
  });
});

describe('isWorkerApiPath', () => {
  test('detects json and /api routes', () => {
    expect(isWorkerApiPath('/page_content.json')).toBe(true);
    expect(isWorkerApiPath('/api/biocode-inquiries')).toBe(true);
  });

  test('detects portfolio API without touching static portfolio pages', () => {
    expect(isWorkerApiPath('/portfolio/orders')).toBe(true);
    expect(isWorkerApiPath('/portfolio/bootstrap')).toBe(true);
    expect(isWorkerApiPath('/portfolio.html')).toBe(false);
    expect(isWorkerApiPath('/portfolio-checkout.html')).toBe(false);
  });

  test('detects life-protocol and portfolio-advisor API paths', () => {
    expect(isWorkerApiPath('/life-protocol-submit')).toBe(true);
    expect(isWorkerApiPath('/life-protocol/settings')).toBe(true);
    expect(isWorkerApiPath('/life-protocol-quiz.html')).toBe(false);
    expect(isWorkerApiPath('/portfolio-advisor/settings')).toBe(true);
    expect(isWorkerApiPath('/portfolio-advisor-quiz.html')).toBe(false);
  });

  test('detects catalog and legacy API paths', () => {
    expect(isWorkerApiPath('/c/now')).toBe(true);
    expect(isWorkerApiPath('/orders')).toBe(true);
    expect(isWorkerApiPath('/quest-submit')).toBe(true);
  });
});

describe('isStaticAssetPath', () => {
  test('skips images and bundled assets', () => {
    expect(isStaticAssetPath('/images/logo.png')).toBe(true);
    expect(isStaticAssetPath('/life.css')).toBe(true);
    expect(isStaticAssetPath('/portfolio.js')).toBe(true);
    expect(isStaticAssetPath('/product.html')).toBe(false);
  });
});

describe('mapAssetPath', () => {
  test('maps root paths per site', () => {
    expect(mapAssetPath('main', '/')).toBe('/index.html');
    expect(mapAssetPath('life', '/')).toBe('/life.html');
    expect(mapAssetPath('portfolio', '/')).toBe('/portfolio.html');
    expect(mapAssetPath(null, '/')).toBe('/');
  });

  test('maps life subpages with life- prefix', () => {
    expect(mapAssetPath('life', '/checkout.html')).toBe('/life-checkout.html');
    expect(mapAssetPath('life', '/life-product.html')).toBe('/life-product.html');
    expect(mapAssetPath('life', '/life-protocol-quiz.html')).toBe('/life-protocol-quiz.html');
    expect(mapAssetPath('life', '/admin.html')).toBe('/admin.html');
  });

  test('maps portfolio subpages with portfolio- prefix', () => {
    expect(mapAssetPath('portfolio', '/checkout.html')).toBe('/portfolio-checkout.html');
    expect(mapAssetPath('portfolio', '/portfolio-product.html')).toBe('/portfolio-product.html');
    expect(mapAssetPath('portfolio', '/portfolio-advisor-quiz.html')).toBe('/portfolio-advisor-quiz.html');
    expect(mapAssetPath('portfolio', '/portfolio/orders')).toBe('/portfolio/orders');
  });

  test('keeps main site paths unchanged', () => {
    expect(mapAssetPath('main', '/product.html')).toBe('/product.html');
    expect(mapAssetPath('main', '/life.html')).toBe('/life.html');
  });

  test('does not remap static assets', () => {
    expect(mapAssetPath('life', '/life.css')).toBe('/life.css');
    expect(mapAssetPath('portfolio', '/portfolio.css')).toBe('/portfolio.css');
    expect(mapAssetPath('life', '/images/life-icons/logo.png')).toBe('/images/life-icons/logo.png');
  });
});
