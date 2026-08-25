import {
  extractPageContentProducts,
  extractPortfolioIndexProducts,
} from './seo-data.js';
import {
  getPeptidesCatalog,
  getSameAsForSite,
  productJsonLd,
  productSlugFromRecord,
  productUrl,
  renderCatalogHtml,
  resolveSiteContext,
  robotsTxt,
  sitemapXml,
  SITE_SEO,
  slugify,
  wwwToApexRedirectUrl,
} from './seo-inject.js';
import { matchCatalogProduct, matchPortfolioIndexEntry } from './seo-hydration.js';
import { maybeWwwRedirect } from './seo-serve.js';

describe('seo-inject', () => {
  test('extractPageContentProducts maps nested KV structure', () => {
    const products = extractPageContentProducts({
      page_content: [{
        type: 'product_category',
        category_name: 'Отслабване',
        products: [{
          product_id: 'prod-lida-green',
          public_data: { name: 'Lida Green', price: 38, tagline: 'Лидер', description: 'Описание' },
          private_data: { inventory: 5 },
        }],
      }],
    });

    expect(products).toHaveLength(1);
    expect(products[0].title).toBe('Lida Green');
    expect(products[0].price).toBe(38);
    expect(products[0].slug).toBe('lida-green');
    expect(productUrl(resolveSiteContext('main'), products[0])).toBe('https://daotslabna.com/products/lida-green');
  });

  test('resolveSiteContext uses canonical apex origin per site', () => {
    const life = resolveSiteContext('life');
    const peptides = resolveSiteContext('peptides');
    expect(life.origin).toBe('https://life-protocols.com');
    expect(peptides.origin).toBe('https://biocode-peptides.com');
    expect(life.origin).not.toBe(peptides.origin);
  });

  test('retail sameAs excludes peptides domain', () => {
    const retail = getSameAsForSite('main');
    expect(retail).toContain('https://daotslabna.com/');
    expect(retail).not.toContain('https://biocode-peptides.com/');
  });

  test('peptides sameAs is isolated from retail storefronts', () => {
    const peptides = getSameAsForSite('peptides');
    expect(peptides).toContain('https://biocode-peptides.com/');
    expect(peptides).not.toContain('https://daotslabna.com/');
  });

  test('peptides product JSON-LD has no Offer block', () => {
    const site = resolveSiteContext('peptides');
    const schema = productJsonLd(site, getPeptidesCatalog()[0]);
    expect(schema.offers).toBeUndefined();
    expect(schema.category).toContain('RUO');
  });

  test('www redirects to apex', () => {
    const url = new URL('https://www.daotslabna.com/products/test');
    expect(wwwToApexRedirectUrl(url)).toBe('https://daotslabna.com/products/test');
    const res = maybeWwwRedirect(url);
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://daotslabna.com/products/test');
  });

  test('extractPortfolioIndexProducts builds slugs from names', () => {
    const products = extractPortfolioIndexProducts({
      index: [{
        group_id: '100',
        name: 'Whey Protein',
        brand: 'BIOCODE',
        category_top: 'Протеини',
        min_client_price: 42.5,
        available: true,
      }],
    });
    expect(products[0].slug).toBe('whey-protein');
    expect(products[0].price).toBe(42.5);
  });

  test('robots.txt allows AI crawlers', () => {
    const txt = robotsTxt(resolveSiteContext('main'));
    expect(txt).toContain('GPTBot');
    expect(txt).toContain('https://daotslabna.com/sitemap.xml');
  });

  test('sitemap uses site-specific origin', () => {
    const xml = sitemapXml(resolveSiteContext('peptides'), getPeptidesCatalog());
    expect(xml).toContain('https://biocode-peptides.com/products/bpc-157');
    expect(xml).not.toContain('daotslabna.com');
  });

  test('renderCatalogHtml includes EUR prices', () => {
    const html = renderCatalogHtml(resolveSiteContext('main'), [{
      title: 'Test',
      slug: 'test',
      price: 19.99,
      description: 'Desc',
      category: 'Cat',
      inStock: true,
    }]);
    expect(html).toContain('19.99 EUR');
    expect(html).toContain('seo-catalog');
  });
});

describe('seo-hydration', () => {
  test('matchCatalogProduct resolves slug', () => {
    const products = [{ product_id: 'prod-x', public_data: { name: 'Mega Burn' } }];
    expect(matchCatalogProduct(products, 'mega-burn')?.product_id).toBe('prod-x');
  });

  test('matchPortfolioIndexEntry resolves slug', () => {
    const index = [{ group_id: '55', name: 'Creatine Mono' }];
    expect(matchPortfolioIndexEntry(index, 'creatine-mono')?.group_id).toBe('55');
  });
});

describe('slugify', () => {
  test('normalizes Bulgarian text', () => {
    expect(slugify('Елегантна фигура')).toBe('елегантна-фигура');
  });
});
