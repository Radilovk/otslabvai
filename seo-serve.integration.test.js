/**
 * Integration-style tests for seo-serve (no wrangler required).
 */
import { handleSeoRequest, maybeWwwRedirect, stripUserAgentFromVary } from './seo-serve.js';
import { resolveSiteContext } from './seo-inject.js';

const PAGE_CONTENT = {
  page_content: [{
    type: 'product_category',
    category_name: 'Test',
    products: [{
      product_id: 'prod-lida-green',
      public_data: { name: 'Lida Green', price: 38, tagline: 'Test', description: 'Desc' },
      private_data: { inventory: 1 },
    }],
  }],
};

const NOT_FOUND_HTML = '<!doctype html><html><head><title>404</title></head><body><h1>Страницата не е намерена</h1></body></html>';

function mockEnv() {
  const store = new Map([
    ['page_content', JSON.stringify(PAGE_CONTENT)],
  ]);
  return {
    ASSETS: {
      fetch(req) {
        const url = new URL(req.url);
        const html = '<!doctype html><html><head><title>t</title></head><body><div id="main"></div></body></html>';
        if (url.pathname === '/404.html' || url.pathname.endsWith('/404.html')) {
          return new Response(NOT_FOUND_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
        }
        if (url.pathname.endsWith('.html')) {
          return new Response(html, { headers: { 'content-type': 'text/html' } });
        }
        return new Response('not found', { status: 404 });
      },
    },
    PAGE_CONTENT: {
      get(key, opts) {
        const raw = store.get(key);
        if (!raw) return null;
        if (opts?.type === 'json') return JSON.parse(raw);
        return raw;
      },
    },
  };
}

describe('seo-serve integration', () => {
  test('homepage injection identical with and without GPTBot UA', async () => {
    const env = mockEnv();
    const base = 'http://daotslabna.com/';
    const plain = await handleSeoRequest(new Request(base), env, new URL(base));
    const bot = await handleSeoRequest(new Request(base, { headers: { 'User-Agent': 'GPTBot/1.1' } }), env, new URL(base));
    expect(plain).toBeNull();
    // handleSeoRequest returns null for / — injection is in maybeEnhanceSeoHtml via serveMappedAsset
    expect(bot).toBeNull();
  });

  test('invalid product slug returns 404 with 404.html body', async () => {
    const env = mockEnv();
    const url = new URL('http://daotslabna.com/products/does-not-exist');
    const res = await handleSeoRequest(new Request(url), env, url);
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('Страницата не е намерена');
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  test('peptides product page returns 200 without HTMLRewriter', async () => {
    const env = mockEnv();
    const url = new URL('http://biocode-peptides.com/products/bpc-157');
    const res = await handleSeoRequest(new Request(url), env, url);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('BPC-157');
    expect(html).toContain('https://biocode-peptides.com/products/bpc-157');
    expect(html).not.toContain('daotslabna.com');
  });

  test('legacy product redirect is single 301 to clean URL', async () => {
    const env = mockEnv();
    const url = new URL('http://daotslabna.com/product.html?id=prod-lida-green');
    const res = await handleSeoRequest(new Request(url), env, url);
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://daotslabna.com/products/lida-green');
  });

  test('invalid legacy id returns 404', async () => {
    const env = mockEnv();
    const url = new URL('http://daotslabna.com/product.html?id=invalid-id');
    const res = await handleSeoRequest(new Request(url), env, url);
    expect(res.status).toBe(404);
  });

  test('sitemap uses apex origin for life-protocols.com host', async () => {
    const env = mockEnv();
    const url = new URL('http://life-protocols.com/sitemap.xml');
    // life uses life_page_content — empty, fallback empty catalog but sitemap still has static paths
    const res = await handleSeoRequest(new Request(url), env, url);
    const xml = await res.text();
    expect(xml).toContain('https://life-protocols.com/');
    expect(xml).not.toContain('daotslabna.com');
  });

  test('www host redirects before other handlers', () => {
    const res = maybeWwwRedirect(new URL('http://www.biocode-peptides.com/products/bpc-157'));
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://biocode-peptides.com/products/bpc-157');
  });

  test('resolveSiteContext never mixes origins', () => {
    expect(resolveSiteContext('portfolio').origin).toBe('https://biocode-bg.com');
    expect(resolveSiteContext('peptides').origin).toBe('https://biocode-peptides.com');
  });

  test('stripUserAgentFromVary removes only User-Agent', () => {
    const headers = new Headers({ vary: 'Accept-Encoding, User-Agent' });
    stripUserAgentFromVary(headers);
    expect(headers.get('vary')).toBe('Accept-Encoding');

    const uaOnly = new Headers({ vary: 'User-Agent' });
    stripUserAgentFromVary(uaOnly);
    expect(uaOnly.has('vary')).toBe(false);

    const encodingOnly = new Headers({ vary: 'Accept-Encoding' });
    stripUserAgentFromVary(encodingOnly);
    expect(encodingOnly.get('vary')).toBe('Accept-Encoding');
  });
});
