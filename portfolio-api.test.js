import {
  calculateMarkupPercent,
  calculateRetailPrice,
  groupRawProducts,
  buildCatalogMeta,
  handlePortfolioRoute
} from './portfolio-api.js';
import { filterIndex, paginateIndex, computeFacets } from './portfolio-filter.js';

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

  test('handlePortfolioRoute returns 404 when catalog is not synced', async () => {
    const env = {
      PAGE_CONTENT: {
        get: async (key) => (key === 'portfolio_settings' ? JSON.stringify(settings) : null)
      }
    };
    const request = new Request('https://example.com/portfolio/bootstrap');
    const url = new URL(request.url);
    const res = await handlePortfolioRoute(request, env, url);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/синхронизиран/i);
  });
});

describe('Portfolio search', () => {
  const index = [
    {
      group_id: '1',
      name: 'Gold Whey Protein',
      brand: 'Optimum',
      brand_id: '10',
      category: 'Протеини > Whey',
      category_top: 'Протеини',
      min_price: 20,
      max_price: 30,
      available: true,
      search_text: 'gold whey protein optimum протеини whey'
    },
    {
      group_id: '2',
      name: 'Vitamin C 1000',
      brand: 'Now',
      brand_id: '20',
      category: 'Витамини',
      category_top: 'Витамини',
      min_price: 5,
      max_price: 8,
      available: true,
      search_text: 'vitamin c 1000 now витамини'
    }
  ];

  test('finds products by Bulgarian query протеин', () => {
    const result = filterIndex(index, { q: 'протеин' }, { categories: [{ name: 'Протеини' }] });
    expect(result.some((i) => i.group_id === '1')).toBe(true);
    expect(result.some((i) => i.group_id === '2')).toBe(false);
  });

  test('finds products by English query whey', () => {
    const result = filterIndex(index, { q: 'whey' });
    expect(result).toHaveLength(1);
  });

  test('multi-word search requires all tokens', () => {
    const result = filterIndex(index, { q: 'gold whey' });
    expect(result).toHaveLength(1);
    expect(filterIndex(index, { q: 'gold витамин' })).toHaveLength(0);
  });

  test('sorts name descending', () => {
    const result = filterIndex(index, { sort: 'name_desc' });
    expect(result[0].name).toBe('Vitamin C 1000');
  });

  test('paginates results', () => {
    const page = paginateIndex(index, 1, 1);
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
  });
});

describe('Portfolio faceted filters', () => {
  const meta = {
    categories: [{ name: 'Протеини', count: 2 }, { name: 'Витамини', count: 1 }],
    brands: [{ id: '10', name: 'Optimum', count: 2 }, { id: '20', name: 'Now', count: 1 }]
  };
  const index = [
    { group_id: '1', name: 'Whey', brand: 'Optimum', brand_id: '10', category: 'Протеини > Whey', category_top: 'Протеини', min_price: 20, max_price: 30, available: true, search_text: 'whey optimum протеини' },
    { group_id: '2', name: 'Creatine', brand: 'Optimum', brand_id: '10', category: 'Протеини > Creatine', category_top: 'Протеини', min_price: 10, max_price: 10, available: true, search_text: 'creatine optimum протеини' },
    { group_id: '3', name: 'Vitamin C', brand: 'Now', brand_id: '20', category: 'Витамини', category_top: 'Витамини', min_price: 5, max_price: 8, available: true, search_text: 'vitamin c now витамини' }
  ];

  test('selecting a category hides brands with nothing in it and scopes their counts', () => {
    const { brands } = computeFacets(index, { category: 'Витамини' }, meta);
    expect(brands).toEqual([{ id: '20', name: 'Now', count: 1 }]);
  });

  test('selecting a brand hides categories it does not carry', () => {
    const { categories } = computeFacets(index, { brand: '20' }, meta);
    expect(categories).toEqual([{ name: 'Витамини', count: 1 }]);
  });

  test('with no filters, both facets list everything with full counts', () => {
    const { categories, brands } = computeFacets(index, {}, meta);
    expect(categories).toEqual([{ name: 'Протеини', count: 2 }, { name: 'Витамини', count: 1 }]);
    expect(brands).toEqual([{ id: '10', name: 'Optimum', count: 2 }, { id: '20', name: 'Now', count: 1 }]);
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

describe('Portfolio Fitness1 order approval', () => {
  const catalogChunk = [{
    group_id: '100',
    name: 'Test Protein',
    brand: 'TestBrand',
    image: '',
    variants: [{
      sku_id: '1',
      barcode: '1234567890',
      pack: '1 кг',
      option: 'Шоколад',
      available: true,
      b2b_price: 10,
      retail_price: 13
    }]
  }];

  const pendingOrder = {
    id: 'pf-test-1',
    status: 'Чака одобрение',
    products: [{ sku_id: '1', barcode: '1234567890', name: 'Test Protein', quantity: 2 }],
    fitness1_order: null
  };

  test('POST /portfolio/orders/approve submits to Fitness1 and updates order', async () => {
    const store = new Map([
      ['portfolio_orders', JSON.stringify([pendingOrder])],
      ['portfolio_meta', JSON.stringify({ chunk_count: 1, total_groups: 1, index: [], lookup: {} })],
      ['portfolio_chunk_0', JSON.stringify(catalogChunk)]
    ]);

    const env = {
      FITNESS1_API_KEY: 'test-key',
      PAGE_CONTENT: {
        get: async (key) => store.get(key) ?? null,
        put: async (key, value) => { store.set(key, value); }
      }
    };

    const originalFetch = global.fetch;
    let fetchCalled = false;
    global.fetch = async (url, opts) => {
      fetchCalled = true;
      expect(url).toBe('https://fitness1.bg/b2b/api/orders/create');
      expect(opts.headers['X-Api-Key']).toBe('test-key');
      const body = JSON.parse(opts.body);
      expect(body.products).toEqual([{ barcode: '1234567890', quantity: 2 }]);
      return {
        ok: true,
        json: async () => ({ status: 'ok', order: { id: 99999, price: '20.00' } })
      };
    };

    const request = new Request('https://example.com/portfolio/orders/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'pf-test-1' })
    });
    const res = await handlePortfolioRoute(request, env, new URL(request.url));
    global.fetch = originalFetch;

    expect(fetchCalled).toBe(true);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.order.status).toBe('Изпратена към Fitness1');
    expect(data.order.fitness1_order.id).toBe(99999);
  });
});
