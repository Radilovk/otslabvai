import {
  extractPageContentProducts,
  extractPortfolioIndexProducts,
} from './seo-data.js';
import {
  getPeptidesCatalog,
  productSlugFromRecord,
  productUrl,
  renderCatalogHtml,
  robotsTxt,
  sitemapXml,
  SITE_SEO,
  slugify,
} from './seo-inject.js';
import { matchCatalogProduct, matchPortfolioIndexEntry } from './seo-hydration.js';

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
    expect(productUrl(SITE_SEO.main, products[0])).toBe('https://daotslabna.com/products/lida-green');
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
    const txt = robotsTxt(SITE_SEO.main);
    expect(txt).toContain('GPTBot');
    expect(txt).toContain('ClaudeBot');
    expect(txt).toContain('https://daotslabna.com/sitemap.xml');
  });

  test('sitemap includes product URLs', () => {
    const xml = sitemapXml(SITE_SEO.peptides, getPeptidesCatalog());
    expect(xml).toContain('/products/bpc-157');
    expect(xml).toContain('biocode-peptides.com');
  });

  test('renderCatalogHtml includes EUR prices', () => {
    const html = renderCatalogHtml(SITE_SEO.main, [{
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
