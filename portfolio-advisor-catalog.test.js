import { jest } from '@jest/globals';
import {
  decodeHtmlEntities,
  isAdvisorExcludedProduct,
  isSamplePackLabel,
  filterAdvisorRetailProducts,
  pickSingleModeBasicProduct,
  sanitizeAdvisorProductName,
  SINGLE_MODE_BASIC_MIN_EUR,
} from './portfolio-advisor-catalog.js';
import { portfolioGroupToSiteProduct } from './portfolio-import.js';

function withMarginB2b(variants) {
  return variants.map((v) => ({
    ...v,
    b2b_price: v.b2b_price ?? (Number(v.retail_price) || 10) * 0.5,
  }));
}

function makeProduct({ name = 'Whey Protein', variants = [], tagline = '' } = {}) {
  const group = {
    group_id: '100',
    name,
    brand: 'Brand',
    brand_id: '1',
    category: 'Протеини',
    category_path: ['Протеини'],
    image: '',
    variants: withMarginB2b(variants.length
      ? variants
      : [{ sku_id: '1', pack: '1 кг', retail_price: 29.9, available: true }]),
  };
  const product = portfolioGroupToSiteProduct(group);
  if (tagline) product.public_data.tagline = tagline;
  return product;
}

describe('decodeHtmlEntities / sanitizeAdvisorProductName', () => {
  test('декодира &amp; в имена', () => {
    expect(sanitizeAdvisorProductName('Creatine &amp; Taurine')).toBe('Creatine & Taurine');
    expect(decodeHtmlEntities('A &amp; B &lt; C')).toBe('A & B < C');
  });

  test('portfolioGroupToSiteProduct декодира името', () => {
    const product = makeProduct({ name: 'Mass Gainer with Creatine &amp; Taurine' });
    expect(product.public_data.name).toBe('Mass Gainer with Creatine & Taurine');
  });
});

describe('isSamplePackLabel', () => {
  test('разпознава мостра и единична доза', () => {
    expect(isSamplePackLabel('1 бр.')).toBe(true);
    expect(isSamplePackLabel('мостра')).toBe(true);
    expect(isSamplePackLabel('1 x 30 ml')).toBe(true);
    expect(isSamplePackLabel('2 кг')).toBe(false);
  });
});

describe('isAdvisorExcludedProduct', () => {
  test('изключва продукт само с мостра варианти', () => {
    const sample = makeProduct({
      name: 'Preworkout Booster',
      variants: [{ sku_id: '1', pack: '1 бр.', retail_price: 2.5, available: true }],
    });
    sample.system_data.portfolio.variant_labels = ['1 бр.'];
    expect(isAdvisorExcludedProduct(sample)).toBe(true);
  });

  test('изключва продукт с „мостра“ в името', () => {
    const sample = makeProduct({ name: 'Whey Protein мостра' });
    expect(isAdvisorExcludedProduct(sample)).toBe(true);
  });

  test('включва нормален retail продукт', () => {
    const product = makeProduct({ name: 'Whey Isolate 1kg' });
    expect(isAdvisorExcludedProduct(product)).toBe(false);
  });
});

describe('filterAdvisorRetailProducts', () => {
  test('single mode изключва евтини и мостри', () => {
    const products = [
      makeProduct({ name: 'Sample Shot', variants: [{ sku_id: '1', pack: '1 бр.', retail_price: 1.9, available: true }] }),
      makeProduct({ name: 'Creatine 300g', variants: [{ sku_id: '2', pack: '300 g', retail_price: 12, available: true }] }),
    ];
    const filtered = filterAdvisorRetailProducts(products, { selectionMode: 'single' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].public_data.name).toContain('Creatine');
  });
});

describe('pickSingleModeBasicProduct', () => {
  test('избира най-евтин продукт над минималния праг', () => {
    const products = [
      makeProduct({ name: 'Tiny', variants: [{ sku_id: '1', pack: '1 бр.', retail_price: 6, available: true }] }),
      makeProduct({ name: 'Budget Protein', variants: [{ sku_id: '2', pack: '900 g', retail_price: SINGLE_MODE_BASIC_MIN_EUR, available: true }] }),
      makeProduct({ name: 'Premium', variants: [{ sku_id: '3', pack: '2 кг', retail_price: 45, available: true }] }),
    ];
    products[0].product_id = 'prod-pf-1';
    products[1].product_id = 'prod-pf-2';
    products[2].product_id = 'prod-pf-3';

    const picked = pickSingleModeBasicProduct(products);
    expect(picked.product_id).toBe('prod-pf-2');
  });
});
