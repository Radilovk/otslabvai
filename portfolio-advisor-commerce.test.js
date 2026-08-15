import {
  summarizeAdvisorCommercialStats,
  attachAdvisorCommercialStats,
  filterAdvisorCommercialProducts,
  isExcludedByAdvisorCommerce,
  isHighProfitAdvisorProduct,
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
      retail_price: 80,
      sale_price: 0,
      available: true,
      is_on_promo: false,
      pricing_mode: 'above_b2b',
    }],
    ...overrides,
  };
}

describe('portfolio-advisor-commerce', () => {
  test('summarizeAdvisorCommercialStats computes profit on retail price', () => {
    const stats = summarizeAdvisorCommercialStats(makeGroup());
    expect(stats.profit_eur).toBe(20);
    expect(stats.profit_pct).toBe(25);
    expect(stats.margin_pct).toBeCloseTo(33.3, 1);
    expect(stats.distributor_discount_pct).toBe(40);
    expect(stats.has_end_user_promo).toBe(false);
    expect(stats.distributor).toBe('sila');
  });

  test('flags end-user promo when sale_price is set', () => {
    const group = makeGroup({
      variants: [{
        sku_id: '1',
        b2b_price: 60,
        regular_price: 100,
        retail_price: 75,
        sale_price: 80,
        available: true,
        is_on_promo: true,
        pricing_mode: 'f1_promo',
      }],
    });
    const stats = summarizeAdvisorCommercialStats(group);
    expect(stats.has_end_user_promo).toBe(true);
    expect(isExcludedByAdvisorCommerce({ system_data: { portfolio: { commerce: stats } } })).toBe(true);
  });

  test('excludes low distributor discount products', () => {
    const group = makeGroup({
      variants: [{
        sku_id: '1',
        b2b_price: 85,
        regular_price: 100,
        retail_price: 95,
        sale_price: 0,
        available: true,
      }],
    });
    const product = attachAdvisorCommercialStats(portfolioGroupToSiteProduct(group), group);
    expect(isExcludedByAdvisorCommerce(product)).toBe(true);
    expect(filterAdvisorCommercialProducts([product])).toHaveLength(0);
  });

  test('isHighProfitAdvisorProduct uses profit_pct threshold', () => {
    const high = attachAdvisorCommercialStats(portfolioGroupToSiteProduct(makeGroup()), makeGroup());
    const low = attachAdvisorCommercialStats(
      portfolioGroupToSiteProduct(makeGroup({
        variants: [{
          sku_id: '2',
          b2b_price: 74,
          regular_price: 100,
          retail_price: 80,
          sale_price: 0,
          available: true,
        }],
      })),
      makeGroup({
        variants: [{
          sku_id: '2',
          b2b_price: 74,
          regular_price: 100,
          retail_price: 80,
          sale_price: 0,
          available: true,
        }],
      })
    );
    expect(isHighProfitAdvisorProduct(high)).toBe(true);
    expect(isHighProfitAdvisorProduct(low)).toBe(false);
  });

  test('scoreAdvisorCommercialBoost prefers higher profit_pct', () => {
    const high = attachAdvisorCommercialStats(portfolioGroupToSiteProduct(makeGroup()), makeGroup());
    const low = attachAdvisorCommercialStats(
      portfolioGroupToSiteProduct(makeGroup({
        variants: [{
          sku_id: '2',
          b2b_price: 74,
          regular_price: 100,
          retail_price: 80,
          sale_price: 0,
          available: true,
        }],
      })),
      makeGroup({
        variants: [{
          sku_id: '2',
          b2b_price: 74,
          regular_price: 100,
          retail_price: 80,
          sale_price: 0,
          available: true,
        }],
      })
    );
    expect(scoreAdvisorCommercialBoost(high)).toBeGreaterThan(scoreAdvisorCommercialBoost(low));
  });

  test('normalizeAdvisorCommerceSettings clamps invalid values', () => {
    const opts = normalizeAdvisorCommerceSettings({
      min_distributor_discount_pct: 999,
      min_profit_pct_on_retail: -5,
      profit_pct_weight: 2,
      margin_eur_weight: -1,
    });
    expect(opts.min_distributor_discount_pct).toBe(80);
    expect(opts.min_profit_pct_on_retail).toBe(0);
    expect(opts.profit_pct_weight).toBe(1);
    expect(opts.margin_eur_weight).toBe(0);
  });

  test('commerce filter can be disabled', () => {
    const product = attachAdvisorCommercialStats(portfolioGroupToSiteProduct(makeGroup({
      variants: [{
        sku_id: '1',
        b2b_price: 85,
        regular_price: 100,
        retail_price: 95,
        sale_price: 0,
        available: true,
      }],
    })), makeGroup({
      variants: [{
        sku_id: '1',
        b2b_price: 85,
        regular_price: 100,
        retail_price: 95,
        sale_price: 0,
        available: true,
      }],
    }));
    expect(filterAdvisorCommercialProducts([product], { enabled: false })).toHaveLength(1);
  });
});
