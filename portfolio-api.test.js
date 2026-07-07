import {
  calculateMarkupPercent,
  calculateRetailPrice,
  groupRawProducts,
  buildCatalogMeta
} from './portfolio-api.js';

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
