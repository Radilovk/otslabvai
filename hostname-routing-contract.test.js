import fs from 'fs';
import path from 'path';
import {
  GENERIC_HTML_PATHS,
  MAIN_SITE_MARKER,
  PRODUCTION_API_CASES,
  PRODUCTION_PAGE_CASES,
  SITE_BRAND_MARKERS,
  SITE_HOSTS,
  expandProductionPageUrls,
  readTitleFromFile,
  resolveRoutingExpectation,
} from './hostname-routing-contract.js';
import { mapAssetPath } from './hostname-routing.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));

describe('hostname routing contract — file mapping', () => {
  test('life and portfolio mapped commerce pages exist on disk', () => {
    const required = [
      ['life', '/checkout.html', '/life-checkout.html'],
      ['life', '/product.html', '/life-product.html'],
      ['portfolio', '/checkout.html', '/portfolio-checkout.html'],
      ['portfolio', '/product.html', '/portfolio-product.html'],
      ['life', '/about-us.html', '/life-about.html'],
    ];
    for (const [site, req, mapped] of required) {
      expect(mapAssetPath(site, req)).toBe(mapped);
      expect(fs.existsSync(path.join(ROOT, mapped.slice(1)))).toBe(true);
      expect(readTitleFromFile(mapped)).toMatch(SITE_BRAND_MARKERS[site]);
    }
  });

  test('portfolio pages without dedicated files map to missing paths (no silent main leak)', () => {
    for (const reqPath of ['/category.html', '/contact.html']) {
      const mapped = mapAssetPath('portfolio', reqPath);
      expect(mapped.startsWith('/portfolio-')).toBe(true);
      expect(fs.existsSync(path.join(ROOT, mapped.slice(1)))).toBe(false);
    }
  });

  test.each(GENERIC_HTML_PATHS)('main site keeps path %s', (reqPath) => {
    expect(mapAssetPath('main', reqPath)).toBe(reqPath === '/' ? '/index.html' : reqPath);
  });
});

describe('hostname routing contract — production page matrix', () => {
  test('every production case resolves to expected mapped file when file should exist', () => {
    for (const spec of PRODUCTION_PAGE_CASES) {
      if (spec.status === 404) continue;
      const { mappedPath, fileExists } = resolveRoutingExpectation(spec.site, spec.path);
      expect(fileExists).toBe(true);
      if (spec.titleIncludes) {
        const title = readTitleFromFile(mappedPath);
        for (const needle of spec.titleIncludes) {
          expect(title).toContain(needle);
        }
      }
    }
  });

  test('production cases have unique ids', () => {
    const ids = PRODUCTION_PAGE_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('expandProductionPageUrls uses apex host per site', () => {
    const urls = expandProductionPageUrls();
    expect(urls.find((u) => u.id === 'life-home')?.url).toBe('https://life-protocols.com/');
    expect(urls.find((u) => u.id === 'portfolio-home')?.url).toBe('https://biocode-bg.com/');
  });
});

describe('hostname routing contract — cross-site isolation markers', () => {
  test('life and portfolio homepage titles never use main mission title', () => {
    expect(readTitleFromFile('/life.html')).not.toContain(MAIN_SITE_MARKER);
    expect(readTitleFromFile('/portfolio.html')).not.toContain(MAIN_SITE_MARKER);
  });

  test('checkout titles are distinct per site', () => {
    expect(readTitleFromFile('/checkout.html')).toContain('ДА ОТСЛАБНА');
    expect(readTitleFromFile('/life-checkout.html')).toContain('Life Protocols');
    expect(readTitleFromFile('/portfolio-checkout.html')).toContain('BIOCODE');
  });
});

describe('hostname routing contract — hosts configured', () => {
  test('each site has apex + www host', () => {
    for (const site of /** @type {const} */ (['main', 'life', 'portfolio'])) {
      expect(SITE_HOSTS[site]).toEqual(expect.arrayContaining([expect.stringMatching(/^[^.]+\.[^.]+$/), expect.stringMatching(/^www\./)]));
    }
  });
});

describe('hostname routing contract — API smoke list', () => {
  test('admin endpoints must require auth in smoke spec', () => {
    const blocked = PRODUCTION_API_CASES.filter((c) => c.path.includes('/portfolio/') && c.auth === false);
    expect(blocked.length).toBeGreaterThanOrEqual(2);
    for (const spec of blocked) {
      expect(spec.status).toBe(401);
    }
  });
});
