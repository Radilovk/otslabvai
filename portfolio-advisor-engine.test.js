import { jest } from '@jest/globals';
import {
  filterPortfolioEligibleProducts,
  filterProductsByCategories,
  productMatchesCategories,
  enrichPortfolioProductItem,
  getPortfolioComposeOptions,
  preparePortfolioAdvisorSubmission,
  buildPortfolioAdvisorProfile,
  normalizeAdvisorCategories,
  scorePortfolioAdvisorProduct,
  rankPortfolioAdvisorProducts,
  buildAdvisorWorkingPool,
  selectAdvisorCandidatesByProfit,
  ADVISOR_POOL_DEFAULTS,
  PORTFOLIO_PACKAGE_TIER_LIMITS,
  PORTFOLIO_SINGLE_TIER_LIMITS,
} from './portfolio-advisor-engine.js';
import { portfolioGroupToSiteProduct } from './portfolio-import.js';

const sampleGroup = {
  group_id: '200',
  name: 'Whey Protein',
  brand: 'BrandX',
  brand_id: '1',
  category: 'Протеини > Whey',
  category_path: ['Протеини', 'Whey'],
  image: 'http://example.com/img.jpg',
  variants: [
    { sku_id: '10', pack: '1 кг', option: 'Шоколад', retail_price: 29.9, b2b_price: 14.95, available: true, image: 'http://example.com/v.jpg' },
  ],
};

function withMarginB2b(variants) {
  return variants.map((v) => ({
    ...v,
    b2b_price: v.b2b_price ?? (Number(v.retail_price) || 10) * 0.5,
  }));
}

function makeProduct(overrides = {}) {
  const base = portfolioGroupToSiteProduct(sampleGroup);
  base.system_data.portfolio = { group_id: '200' };
  base.system_data.goals = ['muscle'];
  return { ...base, ...overrides };
}

describe('filterPortfolioEligibleProducts', () => {
  test('включва протеин (не е oral-only ограничение)', () => {
    const products = [makeProduct()];
    expect(filterPortfolioEligibleProducts(products)).toHaveLength(1);
  });

  test('изключва пептиди', () => {
    const peptide = makeProduct({
      public_data: { ...makeProduct().public_data, name: 'BPC-157 Peptide Injectable' },
    });
    expect(filterPortfolioEligibleProducts([peptide])).toHaveLength(0);
  });

  test('изключва неналични', () => {
    const oos = makeProduct();
    oos.public_data.variants = [{ price: 10, available: false }];
    oos.system_data.inventory = 0;
    expect(filterPortfolioEligibleProducts([oos])).toHaveLength(0);
  });
});

describe('enrichPortfolioProductItem', () => {
  test('добавя portfolio URL и sku_id', () => {
    const product = makeProduct();
    const enriched = enrichPortfolioProductItem({ product_id: product.product_id, dose: '1 scoop' }, product);
    expect(enriched.product_url).toBe('portfolio-product.html?group_id=200');
    expect(enriched.sku_id).toBe('10');
    expect(enriched.price_eur).toBe(29.9);
    expect(enriched.group_id).toBe('200');
  });
});

describe('getPortfolioComposeOptions', () => {
  test('package mode', () => {
    const opts = getPortfolioComposeOptions({ selection_mode: 'package' });
    expect(opts.tierLimits).toBe(PORTFOLIO_PACKAGE_TIER_LIMITS);
  });

  test('single mode', () => {
    const opts = getPortfolioComposeOptions({ selection_mode: 'single' });
    expect(opts.tierLimits).toBe(PORTFOLIO_SINGLE_TIER_LIMITS);
  });
});

describe('preparePortfolioAdvisorSubmission', () => {
  const groups = [
    sampleGroup,
    { ...sampleGroup, group_id: '201', name: 'Creatine', category_path: ['Креатин'], variants: withMarginB2b([{ sku_id: '11', retail_price: 12, available: true }]) },
    { ...sampleGroup, group_id: '202', name: 'Multivitamin', category_path: ['Витамини'], variants: withMarginB2b([{ sku_id: '12', retail_price: 18, available: true }]) },
    { ...sampleGroup, group_id: '203', name: 'Omega 3', category_path: ['Омега'], variants: withMarginB2b([{ sku_id: '13', retail_price: 22, available: true }]) },
  ];

  const mockEnv = {
    PAGE_CONTENT: {
      get: jest.fn(async (key) => {
        if (key === 'portfolio_meta') {
          return JSON.stringify({ chunk_count: 1, lookup: Object.fromEntries(groups.map((g) => [g.group_id, 0])) });
        }
        if (key === 'portfolio_chunk_0') return JSON.stringify(groups);
        if (key === 'portfolio_settings') return null;
        return null;
      }),
    },
  };

  const sampleAnswers = {
    selection_mode: 'package',
    sex: 'male',
    age_band: '25-34',
    height_cm: 180,
    weight_kg: 80,
    priority: 'muscle',
    product_categories: ['all'],
    conditions: ['none'],
    medications: ['none'],
    activity: 'regular',
    diet: 'omnivore',
    symptoms: ['none'],
    allergies: ['none'],
    email: 'test@example.com',
  };

  test('връща ranked pool от portfolio каталог', async () => {
    const prepared = await preparePortfolioAdvisorSubmission(mockEnv, sampleAnswers);
    expect(prepared.profile.priority).toBe('muscle');
    expect(prepared.ranked.length).toBeGreaterThanOrEqual(3);
    expect(prepared.payload.catalog_stats.eligible_available).toBeGreaterThanOrEqual(3);
    expect(prepared.payload.constraints.oral_only).toBe(false);
  });

  test('отхвърля невалиден имейл', async () => {
    await expect(
      preparePortfolioAdvisorSubmission(mockEnv, { ...sampleAnswers, email: 'bad' })
    ).rejects.toThrow(/имейл/i);
  });

  test('buildPortfolioAdvisorProfile default priority е health', () => {
    const profile = buildPortfolioAdvisorProfile({ email: 'a@b.com', priority: 'muscle' });
    expect(profile.priority).toBe('muscle');
    const fallback = buildPortfolioAdvisorProfile({ email: 'a@b.com' });
    expect(fallback.priority).toBe('health');
  });

  test('нормализира липсващи категории към all', () => {
    expect(normalizeAdvisorCategories({ selection_mode: 'package', product_categories: [] })).toEqual(['all']);
    expect(buildPortfolioAdvisorProfile({
      selection_mode: 'single',
      email: 'a@b.com',
      priority: 'muscle',
    }).product_categories).toEqual(['all']);
  });

  test('филтрира по избрани категории', () => {
    const protein = makeProduct();
    protein.system_data.portfolio.category_top = 'Протеини';
    const vitamin = makeProduct({ product_id: 'prod-pf-201' });
    vitamin.system_data.portfolio.category_top = 'Витамини';
    const filtered = filterProductsByCategories([protein, vitamin], ['Витамини']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].product_id).toBe(vitamin.product_id);
    expect(productMatchesCategories(protein, ['all'])).toBe(true);
  });

  test('scorePortfolioAdvisorProduct boost при съвпадение на goal', () => {
    const product = makeProduct();
    product.system_data.goals = ['muscle'];
    product.system_data.portfolio = { category_top: 'Протеини', category_path: ['Протеини'] };
    const score = scorePortfolioAdvisorProduct(product, buildPortfolioAdvisorProfile({
      priority: 'muscle',
      email: 'a@b.com',
    }));
    const other = scorePortfolioAdvisorProduct(product, buildPortfolioAdvisorProfile({
      priority: 'health',
      email: 'a@b.com',
    }));
    expect(score).toBeGreaterThan(other);
  });

  test('scorePortfolioAdvisorProduct изключва конфликтни продукти при отслабване', () => {
    const gainer = makeProduct();
    gainer.public_data.name = 'Mass Gainer 5000';
    gainer.system_data.portfolio = { category_top: 'Гейнъри', category_path: ['Гейнъри'] };
    gainer.system_data.goals = ['muscle'];
    const score = scorePortfolioAdvisorProduct(gainer, buildPortfolioAdvisorProfile({
      priority: 'otshalvane',
      email: 'a@b.com',
    }));
    expect(score).toBe(-Infinity);
  });

  test('scorePortfolioAdvisorProduct предпочита по-висока печалба при равна релевантност', () => {
    const profile = buildPortfolioAdvisorProfile({ priority: 'muscle', email: 'a@b.com' });
    const low = makeProduct();
    low.system_data.portfolio.commerce = {
      margin_eur: 5, margin_on_retail_pct: 20, catalog_margin_ok: true,
    };
    const high = makeProduct({ product_id: 'prod-pf-999' });
    high.system_data.portfolio.commerce = {
      margin_eur: 25, margin_on_retail_pct: 40, catalog_margin_ok: true,
    };
    expect(scorePortfolioAdvisorProduct(high, profile)).toBeGreaterThan(scorePortfolioAdvisorProduct(low, profile));
  });

  test('buildAdvisorWorkingPool балансира размер, печалба и категории', () => {
    const makeRanked = (id, profitPct, categoryTop) => ({
      product: {
        product_id: `prod-pf-${id}`,
        public_data: { name: `Product ${id}` },
        system_data: {
          portfolio: {
            category_top: categoryTop,
            commerce: { margin_on_retail_pct: profitPct, margin_eur: profitPct, catalog_margin_ok: true },
          },
        },
      },
      score: profitPct,
    });

    const ranked = Array.from({ length: 30 }, (_, i) => makeRanked(
      i + 1,
      i < 20 ? 25 : 8,
      ['Протеини', 'Витамини', 'Билки', 'Мастни киселини', 'Минерали'][i % 5]
    ));

    const aiPool = buildAdvisorWorkingPool(ranked, {}, { selection_mode: 'package', priority: 'health' }, {
      purpose: 'ai_pick',
    });
    expect(aiPool.workingRanked.length).toBeLessThanOrEqual(ADVISOR_POOL_DEFAULTS.ai_pick_max);
    expect(aiPool.stats.categories_represented).toBeGreaterThanOrEqual(4);

    const composePool = buildAdvisorWorkingPool(ranked, {}, { selection_mode: 'package', priority: 'health' }, {
      purpose: 'compose',
    });
    expect(composePool.workingRanked.length).toBeGreaterThanOrEqual(12);
    expect(composePool.workingRanked.length).toBeLessThanOrEqual(ADVISOR_POOL_DEFAULTS.compose_working_max);
  });

  test('selectAdvisorCandidatesByProfit предпочита високопечеливши и допълва при нужда', () => {
    const makeRanked = (id, profitPct, categoryTop) => ({
      product: {
        product_id: `prod-pf-${id}`,
        system_data: {
          portfolio: {
            category_top: categoryTop,
            commerce: { margin_on_retail_pct: profitPct, margin_eur: profitPct, catalog_margin_ok: true },
          },
        },
      },
      score: profitPct,
    });

    const ranked = [
      makeRanked(1, 30, 'Протеини'),
      makeRanked(2, 28, 'Протеини'),
      makeRanked(3, 26, 'Витамини'),
      makeRanked(4, 8, 'Протеини'),
      makeRanked(5, 6, 'Витамини'),
    ];

    const result = selectAdvisorCandidatesByProfit(ranked, { min_profit_pct_on_retail: 15 }, {
      maxCandidates: 4,
      maxPerCategory: 1,
    });

    expect(result.candidates).toHaveLength(4);
    expect(result.selected_high_profit).toBeGreaterThanOrEqual(2);
    expect(result.candidates.some((p) => (p.system_data.portfolio.commerce.margin_on_retail_pct || 0) < 15)).toBe(true);
  });
});
