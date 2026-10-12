import { composePortfolioAdvisorStacks } from './portfolio-advisor-compose.js';
import {
  PORTFOLIO_PACKAGE_TIER_LIMITS,
  PORTFOLIO_PACKAGE_TIER_META,
  PORTFOLIO_SINGLE_TIER_LIMITS,
  PORTFOLIO_SINGLE_TIER_META,
} from './portfolio-advisor-engine.js';
import { portfolioGroupToSiteProduct } from './portfolio-import.js';
import { classifyProductSlot, productsConflictInStack } from './portfolio-stack-slots.js';

function makeRanked(id, name, category, price, score = 50, variants = null) {
  const group = {
    group_id: String(id),
    name,
    brand: 'Brand',
    brand_id: '1',
    category,
    category_path: category.split(' > '),
    image: '',
    variants: variants || [{ sku_id: String(id), retail_price: price, b2b_price: price * 0.5, available: true }],
  };
  const product = portfolioGroupToSiteProduct(group);
  product.system_data.portfolio.category_top = category.split(' > ')[0];
  return { product, score };
}

const ids = (composed, tier) => composed.tiers[tier].products.map((p) => p.product_id);
const productsOf = (composed, tier, ranked) => ids(composed, tier)
  .map((id) => ranked.find((r) => r.product.product_id === id)?.product).filter(Boolean);

const PACKAGE = { tierLimits: PORTFOLIO_PACKAGE_TIER_LIMITS, tierMeta: PORTFOLIO_PACKAGE_TIER_META };
const SINGLE = { tierLimits: PORTFOLIO_SINGLE_TIER_LIMITS, tierMeta: PORTFOLIO_SINGLE_TIER_META };

describe('composePortfolioAdvisorStacks — пакет', () => {
  const ranked = [
    makeRanked(1, 'Thermo Fat Burner', 'Отслабване и контрол на теглото > Термогенни фетбърнъри', 25, 90),
    makeRanked(2, 'Lida Green Thermo', 'Отслабване и контрол на теглото > Термогенни фетбърнъри', 30, 85),
    makeRanked(3, 'L-Carnitine 2000', 'Отслабване и контрол на теглото > L-Карнитин', 18, 80),
    makeRanked(4, 'Glucomannan', 'Отслабване и контрол на теглото > Потискане на апетита', 15, 75),
    makeRanked(5, 'Vitamin C 1000', 'Витамини > Витамин C', 12, 70),
    makeRanked(6, 'Omega 3 Fish Oil', 'Мастни киселини > Рибено масло', 20, 65),
    makeRanked(7, 'Whey Protein', 'Протеини > Суроватъчен протеин', 35, 60),
    makeRanked(9, 'Berberine Complex', 'Билки и растителни екстракти > Берберин', 22, 50),
    makeRanked(10, 'Magnesium Citrate', 'Минерали > Магнезий', 16, 45),
    makeRanked(15, 'Multivitamin', 'Мултивитамини > Дневни мултивитамини', 22, 40),
    makeRanked(16, 'Shaker 700 ml', 'Спортни аксесоари и уреди > Шейкъри', 5, 99),
  ];
  const profile = { priority: 'otshalvane', selection_mode: 'package' };

  test('нивата са вложени и нарастват: basic ⊂ optimal ⊂ premium', () => {
    const composed = composePortfolioAdvisorStacks(profile, ranked, PACKAGE);
    const basic = ids(composed, 'basic');
    const optimal = ids(composed, 'optimal');
    const premium = ids(composed, 'premium');
    expect(basic.length).toBeLessThan(optimal.length);
    expect(optimal.length).toBeLessThan(premium.length);
    expect(optimal.slice(0, basic.length)).toEqual(basic);
    expect(premium.slice(0, optimal.length)).toEqual(optimal);
  });

  test('основният продукт за отслабване е бърнър; един бърнър на пакет; без конфликти', () => {
    const composed = composePortfolioAdvisorStacks(profile, ranked, PACKAGE);
    const premium = productsOf(composed, 'premium', ranked);
    expect(classifyProductSlot(premium[0])).toBe('fat_burner');
    expect(premium.filter((p) => classifyProductSlot(p) === 'fat_burner')).toHaveLength(1);
    for (let i = 0; i < premium.length; i += 1) {
      for (let j = i + 1; j < premium.length; j += 1) {
        expect(productsConflictInStack(premium[i], premium[j])).toBe(false);
      }
    }
  });

  test('следва плана: апетит и карнитин преди витамините', () => {
    const composed = composePortfolioAdvisorStacks(profile, ranked, PACKAGE);
    const slots = productsOf(composed, 'premium', ranked).map(classifyProductSlot);
    expect(slots.indexOf('appetite')).toBeLessThan(slots.indexOf('multivitamin'));
    expect(slots).toContain('carnitine');
    expect(slots).not.toContain('vitamin_c');
  });

  test('мускули: протеин и креатин, без бърнър', () => {
    const muscleRanked = [
      makeRanked(1, 'Gold Whey', 'Протеини > Суроватъчен изолат', 40, 90),
      makeRanked(2, 'Creatine Mono', 'Креатин > Креатин монохидрат', 15, 85),
      makeRanked(3, 'BCAA 2:1:1', 'Аминокиселини > BCAA', 18, 80),
      makeRanked(4, 'Thermo Burn', 'Отслабване и контрол на теглото > Термогенни фетбърнъри', 25, 75),
      makeRanked(5, 'Multivitamin', 'Мултивитамини > Спортни мултивитамини', 20, 70),
      makeRanked(7, 'Casein Night', 'Протеини > Казеин', 38, 60),
    ];
    const composed = composePortfolioAdvisorStacks({ priority: 'muscle', selection_mode: 'package' }, muscleRanked, PACKAGE);
    const slots = productsOf(composed, 'premium', muscleRanked).map(classifyProductSlot);
    expect(slots[0]).toBe('protein');
    expect(slots).toContain('creatine');
    expect(slots).not.toContain('fat_burner');
    expect(slots.filter((s) => s === 'protein')).toHaveLength(1);
  });

  test('цената е на основната разфасовка, не на мострата', () => {
    const withSample = [
      makeRanked(1, 'Whey Gold', 'Протеини > Суроватъчен протеин', 0, 90, [
        { sku_id: 's', pack: '30 гр', retail_price: 2, b2b_price: 1, available: true },
        { sku_id: 'big', pack: '908 гр', retail_price: 39.9, b2b_price: 25, available: true },
      ]),
      makeRanked(2, 'Creatine', 'Креатин > Креатин монохидрат', 15, 80),
    ];
    const composed = composePortfolioAdvisorStacks({ priority: 'muscle', selection_mode: 'package' }, withSample, PACKAGE);
    expect(ids(composed, 'premium')).toContain('prod-pf-1');
  });
});

describe('composePortfolioAdvisorStacks — един продукт', () => {
  test('3 различни продукта от основния слот; икономичният е най-евтин', () => {
    const ranked = [
      makeRanked(1, 'Whey A', 'Протеини > Суроватъчен протеин', 35, 90),
      makeRanked(2, 'Whey B', 'Протеини > Суроватъчен протеин', 22, 85),
      makeRanked(3, 'Whey C', 'Протеини > Суроватъчен изолат', 48, 80),
      makeRanked(4, 'Creatine', 'Креатин > Креатин монохидрат', 15, 75),
    ];
    const composed = composePortfolioAdvisorStacks({ priority: 'muscle', selection_mode: 'single' }, ranked, SINGLE);
    const picked = ['basic', 'optimal', 'premium'].map((t) => ids(composed, t)[0]);
    expect(new Set(picked).size).toBe(3);
    expect(picked).toEqual(['prod-pf-2', 'prod-pf-1', 'prod-pf-3']);
    expect(composed.meta.mode).toBe('alternatives');
  });
});
