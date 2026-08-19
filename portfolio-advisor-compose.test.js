import { jest } from '@jest/globals';
import {
  composeSingleProductOptions,
  composePortfolioAdvisorStacks,
  composeComplementaryPackageStacks,
} from './portfolio-advisor-compose.js';
import { PORTFOLIO_PACKAGE_TIER_LIMITS, PORTFOLIO_PACKAGE_TIER_META, PORTFOLIO_SINGLE_TIER_META } from './portfolio-advisor-engine.js';
import { portfolioGroupToSiteProduct } from './portfolio-import.js';
import { classifyProductSlot } from './portfolio-stack-slots.js';
import { productsConflictInStack } from './portfolio-stack-slots.js';

function makeRanked(id, name, categoryTop, price, score = 50) {
  const group = {
    group_id: String(id),
    name,
    brand: 'Brand',
    brand_id: '1',
    category: categoryTop,
    category_path: [categoryTop],
    image: '',
    variants: [{ sku_id: String(id), retail_price: price, b2b_price: price * 0.5, available: true }],
  };
  const product = portfolioGroupToSiteProduct(group);
  product.system_data.portfolio.category_top = categoryTop;
  return { product, score };
}

function getTierProductIds(composed, tier) {
  return composed.tiers[tier].products.map((p) => p.product_id);
}

function getTierProducts(composed, tier, ranked) {
  const ids = getTierProductIds(composed, tier);
  return ids.map((id) => ranked.find((r) => r.product.product_id === id)?.product).filter(Boolean);
}

describe('composeComplementaryPackageStacks', () => {
  const ranked = [
    makeRanked(1, 'Thermo Fat Burner', 'Изгаряне на мазнини', 25, 90),
    makeRanked(2, 'Lida Green Thermo', 'Изгаряне на мазнини', 30, 85),
    makeRanked(3, 'L-Carnitine 2000', 'Аминокиселини', 18, 80),
    makeRanked(4, 'Herbal Slim Detox', 'Билки', 15, 75),
    makeRanked(5, 'Vitamin C 1000', 'Витамини', 12, 70),
    makeRanked(6, 'Omega 3 Fish Oil', 'Мастни киселини', 20, 65),
    makeRanked(7, 'Whey Protein', 'Протеини', 35, 60),
    makeRanked(8, 'Green Tea Extract', 'Билки', 14, 55),
    makeRanked(9, 'Berberine Complex', 'Билки', 22, 50),
    makeRanked(10, 'Magnesium Citrate', 'Минерали', 16, 45),
    makeRanked(11, 'Zinc Picolinate', 'Минерали', 11, 44),
    makeRanked(12, 'Ashwagandha', 'Билки', 19, 43),
    makeRanked(13, 'BCAA Powder', 'Аминокиселини', 21, 42),
    makeRanked(14, 'Creatine Mono', 'Креатин', 17, 41),
    makeRanked(15, 'Multivitamin', 'Мултивитамини', 22, 40),
  ];

  test('малък pool използва shared pool вместо празни tier-ове', () => {
    const ranked = [
      makeRanked(1, 'Thermo Burn', 'Изгаряне на мазнини', 25),
      makeRanked(2, 'L-Carnitine', 'Аминокиселини', 18),
      makeRanked(3, 'Herbal Slim', 'Билки', 15),
      makeRanked(4, 'Vitamin C', 'Витамини', 12),
      makeRanked(5, 'Omega 3', 'Мастни киселини', 20),
      makeRanked(6, 'Green Tea', 'Билки', 14),
    ];
    const composed = composeComplementaryPackageStacks(
      { priority: 'otshalvane', selection_mode: 'package' },
      ranked,
      { tierLimits: PORTFOLIO_PACKAGE_TIER_LIMITS, tierMeta: PORTFOLIO_PACKAGE_TIER_META }
    );
    expect(composed.meta.mode).toBe('complementary_shared_pool');
    expect(composed.tiers.premium.products.length).toBeGreaterThan(0);
    expect(composed.tiers.basic.products.length).toBeGreaterThan(0);
  });

  test('връща независими tier-ове без повтарящи се product_id', () => {
    const composed = composeComplementaryPackageStacks(
      { priority: 'otshalvane', selection_mode: 'package' },
      ranked,
      { tierLimits: PORTFOLIO_PACKAGE_TIER_LIMITS, tierMeta: PORTFOLIO_PACKAGE_TIER_META }
    );

    const allIds = [
      ...getTierProductIds(composed, 'basic'),
      ...getTierProductIds(composed, 'optimal'),
      ...getTierProductIds(composed, 'premium'),
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(composed.meta.mode).toBe('complementary_independent');
  });

  test('не включва конфликтни продукти в един tier', () => {
    const composed = composeComplementaryPackageStacks(
      { priority: 'otshalvane', selection_mode: 'package' },
      ranked,
      { tierLimits: PORTFOLIO_PACKAGE_TIER_LIMITS, tierMeta: PORTFOLIO_PACKAGE_TIER_META }
    );

    for (const tier of ['basic', 'optimal', 'premium']) {
      const products = getTierProducts(composed, tier, ranked);
      for (let i = 0; i < products.length; i += 1) {
        for (let j = i + 1; j < products.length; j += 1) {
          expect(productsConflictInStack(products[i], products[j])).toBe(false);
        }
      }
    }
  });

  test('basic tier за отслабване започва с fat burner, не с протеин', () => {
    const composed = composeComplementaryPackageStacks(
      { priority: 'otshalvane', selection_mode: 'package' },
      ranked,
      { tierLimits: PORTFOLIO_PACKAGE_TIER_LIMITS, tierMeta: PORTFOLIO_PACKAGE_TIER_META }
    );

    const basicProducts = getTierProducts(composed, 'basic', ranked);
    const slots = basicProducts.map((p) => classifyProductSlot(p));
    expect(slots).toContain('fat_burner');
    expect(slots).not.toContain('protein');
    expect(basicProducts.length).toBeGreaterThanOrEqual(2);
  });

  test('muscle tier включва протеин и креатин, не fat burner', () => {
    const muscleRanked = [
      makeRanked(1, 'Gold Whey', 'Протеини', 40, 90),
      makeRanked(2, 'Creatine Mono', 'Креатин', 15, 85),
      makeRanked(3, 'BCAA 2:1:1', 'Аминокиселини', 18, 80),
      makeRanked(4, 'Thermo Burn', 'Изгаряне на мазнини', 25, 75),
      makeRanked(5, 'Multivitamin', 'Мултивитамини', 20, 70),
      makeRanked(6, 'Mass Gainer', 'Качване на маса и възстановяване', 35, 65),
      makeRanked(7, 'Casein Night', 'Протеини', 38, 60),
      makeRanked(8, 'ZMA', 'Минерали', 14, 55),
    ];

    const composed = composeComplementaryPackageStacks(
      { priority: 'muscle', selection_mode: 'package', activity: 'regular' },
      muscleRanked,
      { tierLimits: PORTFOLIO_PACKAGE_TIER_LIMITS, tierMeta: PORTFOLIO_PACKAGE_TIER_META }
    );

    const optimalProducts = getTierProducts(composed, 'optimal', muscleRanked);
    const slots = optimalProducts.map((p) => classifyProductSlot(p));
    expect(slots).toContain('protein');
    expect(slots).not.toContain('fat_burner');
    expect(new Set(optimalProducts.map((p) => p.product_id)).size).toBe(optimalProducts.length);
  });
});

describe('composeSingleProductOptions', () => {
  test('връща 3 различни продукта на различни ценови нива', () => {
    const ranked = [
      makeRanked(1, 'Premium Whey', 'Протеини', 55),
      makeRanked(2, 'Creatine', 'Креатин', 12),
      makeRanked(3, 'Multivitamin', 'Мултивитамини', 18),
      makeRanked(4, 'Budget Protein', 'Протеини', 15),
    ];

    const composed = composeSingleProductOptions(ranked, PORTFOLIO_SINGLE_TIER_META);
    const ids = ['basic', 'optimal', 'premium'].map((k) => composed.tiers[k].products[0].product_id);

    expect(new Set(ids).size).toBe(3);
    expect(composed.meta.distinct_products).toBe(3);
    expect(ids[1]).toBe(ranked[0].product.product_id);
  });

  test('не предлага мостра за basic tier', () => {
    const ranked = [
      makeRanked(1, 'Optimal Whey', 'Протеини', 40),
      makeRanked(2, 'Creatine 300g', 'Креатин', 14),
      makeRanked(3, 'Sample мостра', 'Протеини', 2.5),
    ];
    ranked[2].product.public_data.variants = [{ option_name: '1 бр.', price: 2.5, available: true, sku: '3' }];
    ranked[2].product.system_data.portfolio.variant_labels = ['1 бр.'];

    const composed = composeSingleProductOptions(ranked, PORTFOLIO_SINGLE_TIER_META);
    const basicId = composed.tiers.basic.products[0].product_id;
    expect(basicId).not.toBe(ranked[2].product.product_id);
  });
});

describe('composePortfolioAdvisorStacks', () => {
  test('package mode използва complementary independent stacks при достатъчен pool', () => {
    const ranked = [
      makeRanked(1, 'Thermo Burn', 'Изгаряне на мазнини', 25),
      makeRanked(2, 'L-Carnitine', 'Аминокиселини', 18),
      makeRanked(3, 'Herbal Slim', 'Билки', 15),
      makeRanked(4, 'Vitamin C', 'Витамини', 12),
      makeRanked(5, 'Omega 3', 'Мастни киселини', 20),
      makeRanked(6, 'Green Tea', 'Билки', 14),
      makeRanked(7, 'Berberine', 'Билки', 22),
      makeRanked(8, 'Green Coffee', 'Изгаряне на мазнини', 17),
      makeRanked(9, 'BCAA', 'Аминокиселини', 21),
      makeRanked(10, 'Zinc', 'Минерали', 11),
      makeRanked(11, 'Ashwagandha', 'Билки', 19),
      makeRanked(12, 'Magnesium', 'Минерали', 16),
    ];
    const composed = composePortfolioAdvisorStacks(
      { selection_mode: 'package', priority: 'otshalvane' },
      ranked,
      { tierLimits: PORTFOLIO_PACKAGE_TIER_LIMITS, tierMeta: PORTFOLIO_PACKAGE_TIER_META }
    );
    expect(composed.meta.mode).toBe('complementary_independent');
  });

  test('single mode използва composeSingleProductOptions', () => {
    const ranked = [
      makeRanked(1, 'A', 'Протеини', 40),
      makeRanked(2, 'B', 'Креатин', 15),
      makeRanked(3, 'C', 'Мултивитамини', 25),
    ];
    const composed = composePortfolioAdvisorStacks(
      { selection_mode: 'single' },
      ranked,
      { tierMeta: PORTFOLIO_SINGLE_TIER_META }
    );
    expect(composed.meta.mode).toBe('single');
    expect(composed.meta.distinct_products).toBe(3);
  });
});
