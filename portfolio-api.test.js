import {
  calculateMarkupPercent,
  calculateRetailPrice,
  groupRawProducts,
  buildCatalogMeta
} from './portfolio-api.js';
import { filterIndex, paginateIndex } from './portfolio-filter.js';

describe('Portfolio API', () => {
  const settings = {
    global_markup_percent: 30,
    brand_markups: { '749': 25 },
    category_markups: { Протеини: 20 },
    product_overrides: {}
  };

  const sampleProducts = [
    {
      id: '1',
      group_id: '100',
      product_id: 1,
      product_name: 'Test Protein',
      brand_id: '749',
      brand_name: 'TestBrand',
      pack: '1 кг',
      option: 'Шоколад',
      category: 'Протеини > Whey',
      image: 'http://example.com/img.jpg',
      label: '',
      barcode: '123',
      b2b_price: '10.00',
      regular_price: '20.00',
      sale_price: '0.00',
      available: true
    },
    {
      id: '2',
      group_id: '100',
      product_id: 1,
      product_name: 'Test Protein',
      brand_id: '749',
      brand_name: 'TestBrand',
      pack: '1 кг',
      option: 'Ванилия',
      category: 'Протеини > Whey',
      image: 'http://example.com/img.jpg',
      label: '',
      barcode: '456',
      b2b_price: '10.00',
      regular_price: '20.00',
      sale_price: '0.00',
      available: false
    }
  ];

  test('calculateMarkupPercent uses brand override', () => {
    const pct = calculateMarkupPercent(settings, { brand_id: '749', group_id: '100', category: 'Протеини' });
    expect(pct).toBe(25);
  });

  test('calculateRetailPrice applies markup', () => {
    expect(calculateRetailPrice(10, 30)).toBe(13);
  });

  test('groupRawProducts merges variants by group_id', () => {
    const groups = groupRawProducts(sampleProducts, settings);
    expect(groups).toHaveLength(1);
    expect(groups[0].variants).toHaveLength(2);
    expect(groups[0].variants[0].retail_price).toBe(12.5);
  });

  test('buildCatalogMeta creates index and lookup', () => {
    const groups = groupRawProducts(sampleProducts, settings);
    const meta = buildCatalogMeta(groups);
    expect(meta.total_groups).toBe(1);
    expect(meta.index[0].variant_count).toBe(2);
    expect(meta.lookup['100']).toBe(0);
  });
});

describe('Portfolio filterIndex', () => {
  const index = [
    {
      group_id: '1',
      name: 'Alpha Whey',
      brand: 'BrandA',
      brand_id: '10',
      category: 'Протеини > Whey',
      category_top: 'Протеини',
      min_price: 20,
      max_price: 30,
      available: true
    },
    {
      group_id: '2',
      name: 'Beta Vitamin',
      brand: 'BrandB',
      brand_id: '20',
      category: 'Витамини',
      category_top: 'Витамини',
      min_price: 5,
      max_price: 8,
      available: false
    }
  ];

  test('filters by search query', () => {
    const result = filterIndex(index, { q: 'whey' });
    expect(result).toHaveLength(1);
    expect(result[0].group_id).toBe('1');
  });

  test('filters available only', () => {
    const result = filterIndex(index, { available: '1' });
    expect(result).toHaveLength(1);
    expect(result[0].group_id).toBe('1');
  });

  test('paginates results', () => {
    const page = paginateIndex(index, 1, 1);
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.total_pages).toBe(2);
  });
});

describe('Portfolio promo validation', () => {
  function validatePromoRecord(promo, { increment = false } = {}) {
    if (!promo) return { valid: false, error: 'Невалиден промо код.' };
    if (!promo.active) return { valid: false, error: 'Промо кодът не е активен.' };
    const now = new Date();
    if (promo.validFrom && new Date(promo.validFrom) > now) {
      return { valid: false, error: 'Промо кодът все още не е валиден.' };
    }
    if (promo.validUntil && new Date(promo.validUntil) < now) {
      return { valid: false, error: 'Промо кодът е изтекъл.' };
    }
    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      return { valid: false, error: 'Промо кодът е изчерпан.' };
    }
    if (increment) promo.usedCount = (promo.usedCount || 0) + 1;
    return {
      valid: true,
      promoCode: {
        code: promo.code,
        discount: promo.discount,
        discountType: promo.discountType || 'percentage'
      }
    };
  }

  function applyPromoDiscount(subtotal, promo) {
    if (!promo) return 0;
    if (promo.discountType === 'percentage') {
      return Math.round(subtotal * (promo.discount / 100) * 100) / 100;
    }
    return Math.min(promo.discount, subtotal);
  }

  const promo = {
    code: 'PORTFOLIO10',
    discount: 10,
    discountType: 'percentage',
    active: true,
    usedCount: 0,
    maxUses: 5
  };

  test('validates active promo', () => {
    expect(validatePromoRecord(promo).valid).toBe(true);
  });

  test('rejects exhausted promo', () => {
    const exhausted = { ...promo, usedCount: 5 };
    expect(validatePromoRecord(exhausted).valid).toBe(false);
  });

  test('applyPromoDiscount percentage', () => {
    const check = validatePromoRecord(promo);
    expect(applyPromoDiscount(100, check.promoCode)).toBe(10);
  });
});
