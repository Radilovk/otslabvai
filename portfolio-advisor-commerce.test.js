import {
  summarizeAdvisorCommercialStats,
  attachAdvisorCommercialStats,
  filterAdvisorCommercialProducts,
  isExcludedByAdvisorCommerce,
  normalizeAdvisorCommerceSettings,
  scoreAdvisorCommercialBoost,
} from './portfolio-advisor-commerce.js';
import { portfolioGroupToSiteProduct } from './portfolio-import.js';

function makeGroup(overrides = {}) {
  return {
    group_id: '100',
    name: 'Test Product',
    brand: 'Brand',
    brand_id: '1',
    category: 'Протеини',
    distributor: 'sila',
    variants: [{
      sku_id: '1',
      b2b_price: 60,
      regular_price: 100,
      retail_price: 90,
      sale_price: 0,
      available: true,
      is_on_promo: false,
      pricing_mode: 'above_b2b',
    }],
    ...overrides,
  };
}

describe('portfolio-advisor-commerce', () => {
  test('summarizeAdvisorCommercialStats computes margin on retail', () => {
    const stats = summarizeAdvisorCommercialStats(makeGroup());
    expect(stats.margin_eur).toBe(30);
    expect(stats.margin_on_retail_pct).toBeCloseTo(33.33, 1);
    expect(stats.catalog_margin_ok).toBe(true);
  });

  test('user example: 30% client promo → excluded (<25% margin on retail)', () => {
    const group = makeGroup({
      variants: [{
        sku_id: '1',
        b2b_price: 60,
        regular_price: 100,
        retail_price: 70,
        sale_price: 70,
        available: true,
        is_on_promo: true,
        pricing_mode: 'f1_promo',
      }],
    });
    const stats = summarizeAdvisorCommercialStats(group);
    expect(stats.margin_on_retail_pct).toBeCloseTo(14.29, 1);
    expect(stats.catalog_margin_ok).toBe(false);
    const product = attachAdvisorCommercialStats(portfolioGroupToSiteProduct(group), group);
    expect(isExcludedByAdvisorCommerce(product)).toBe(true);
    expect(filterAdvisorCommercialProducts([product])).toHaveLength(0);
  });

  test('user example: 10% client promo → eligible (>=25%)', () => {
    const group = makeGroup({
      variants: [{
        sku_id: '1',
        b2b_price: 60,
        regular_price: 100,
        retail_price: 90,
        sale_price: 90,
        available: true,
        is_on_promo: true,
        pricing_mode: 'f1_promo',
      }],
    });
    const stats = summarizeAdvisorCommercialStats(group);
    expect(stats.catalog_margin_ok).toBe(true);
    const product = attachAdvisorCommercialStats(portfolioGroupToSiteProduct(group), group);
    expect(isExcludedByAdvisorCommerce(product)).toBe(false);
  });

  test('scoreAdvisorCommercialBoost prefers higher margin on retail', () => {
    const high = attachAdvisorCommercialStats(portfolioGroupToSiteProduct(makeGroup()), makeGroup());
    const low = attachAdvisorCommercialStats(
      portfolioGroupToSiteProduct(makeGroup({
        variants: [{
          sku_id: '2',
          b2b_price: 60,
          regular_price: 100,
          retail_price: 72,
          sale_price: 0,
          available: true,
        }],
      })),
      makeGroup({
        variants: [{
          sku_id: '2',
          b2b_price: 60,
          regular_price: 100,
          retail_price: 72,
          sale_price: 0,
          available: true,
        }],
      })
    );
    expect(scoreAdvisorCommercialBoost(high)).toBeGreaterThan(scoreAdvisorCommercialBoost(low));
  });

  test('normalizeAdvisorCommerceSettings clamps invalid values', () => {
    const opts = normalizeAdvisorCommerceSettings({
      margin_on_retail_weight: 2,
      margin_eur_weight: -1,
    });
    expect(opts.margin_on_retail_weight).toBe(1);
    expect(opts.margin_eur_weight).toBe(0);
  });

  test('commerce filter can be disabled', () => {
    const group = makeGroup({
      variants: [{
        sku_id: '1',
        b2b_price: 60,
        regular_price: 100,
        retail_price: 70,
        sale_price: 70,
        available: true,
      }],
    });
    const product = attachAdvisorCommercialStats(portfolioGroupToSiteProduct(group), group);
    expect(filterAdvisorCommercialProducts([product], { enabled: false })).toHaveLength(1);
  });
});
