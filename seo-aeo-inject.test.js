import {
  AI_CRAWLER_AGENTS,
  SITE_SEO,
  llmsTxt,
  orgJsonLd,
  productSlugFromRecord,
  productUrl,
  publicCanonical,
  robotsTxt,
  sitemapXml,
  slugify,
} from './seo-aeo-inject.js';

describe('seo-aeo-inject', () => {
  test('robotsTxt includes 2026 AI search crawlers and Content-Signal', () => {
    const txt = robotsTxt(SITE_SEO.main);
    expect(txt).toContain('Content-Signal: search=yes,ai-input=yes,ai-train=no,use=reference');
    expect(txt).not.toContain('BEGIN Cloudflare Managed');
    expect(txt).toContain('OAI-SearchBot');
    expect(txt).toContain('Claude-SearchBot');
    expect(txt).toContain('PerplexityBot');
    expect(txt).toContain('Sitemap: https://daotslabna.com/sitemap.xml');
    expect(txt).toContain('Agentmap: https://daotslabna.com/.well-known/ai-catalog.json');
    expect(txt).toContain('Allow: /.well-known/');
    expect(txt).toContain('User-agent: CCBot\nDisallow: /');
  });

  test('sitemapXml uses site origin and products', () => {
    const products = [{
      id: 'p1',
      title: 'Test Product',
      slug: 'test-product',
      price: 19.99,
      inStock: true,
    }];
    const xml = sitemapXml(SITE_SEO.life, products);
    expect(xml).toContain('https://life-protocols.com/');
    expect(xml).toContain('https://life-protocols.com/products/test-product');
    expect(xml).toContain('https://life-protocols.com/faq.html');
    expect(xml).toContain('https://life-protocols.com/life.html');
    expect(xml).not.toContain('https://life-protocols.com/index.html');
  });

  test('sitemapXml for portfolio omits index.html (uses portfolio.html)', () => {
    const xml = sitemapXml(SITE_SEO.portfolio, []);
    expect(xml).toContain('https://biocode-bg.com/portfolio.html');
    expect(xml).not.toContain('https://biocode-bg.com/index.html');
  });

  test('llmsTxt lists brand and products', () => {
    const txt = llmsTxt(SITE_SEO.portfolio, [{
      title: 'Whey Protein',
      slug: 'whey-protein',
      description: 'High quality whey',
    }]);
    expect(txt).toContain('# BIOCODE Nutrition Science');
    expect(txt).toContain('biocode-bg.com');
    expect(txt).toContain('[Whey Protein](https://biocode-bg.com/products/whey-protein)');
  });

  test('productSlugFromRecord and slugify', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(productSlugFromRecord({ title: 'Fat Burner X' })).toBe('fat-burner-x');
    expect(productUrl(SITE_SEO.main, { slug: 'abc' })).toBe('https://daotslabna.com/products/abc');
  });

  test('orgJsonLd includes sameAs network', () => {
    const org = orgJsonLd(SITE_SEO.main);
    expect(org['@type']).toBe('OnlineStore');
    expect(org.sameAs).toContain('https://life-protocols.com/');
    expect(AI_CRAWLER_AGENTS.length).toBeGreaterThanOrEqual(8);
  });

  test('publicCanonical uses apex origin and request path', () => {
    expect(publicCanonical(SITE_SEO.main, '/')).toBe('https://daotslabna.com/');
    expect(publicCanonical(SITE_SEO.life, '/shipping.html')).toBe('https://life-protocols.com/shipping.html');
    expect(publicCanonical(SITE_SEO.portfolio, '/checkout.html')).toBe('https://biocode-bg.com/checkout.html');
  });
});
