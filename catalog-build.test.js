import { buildCatalogArtifacts, effectiveStockQty } from './catalog-build.js';
import { CATALOG_SYNC_POLICY } from './catalog-sync-policy.js';

describe('catalog-build', () => {
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

  test('effectiveStockQty maps boolean availability', () => {
    expect(effectiveStockQty(true)).toBe(1);
    expect(effectiveStockQty(false)).toBe(0);
  });

  test('effectiveStockQty applies numeric safety threshold', () => {
    expect(effectiveStockQty(true, 5)).toBe(5);
    expect(effectiveStockQty(true, 1)).toBe(1);
    expect(effectiveStockQty(true, 0)).toBe(0);
  });

  test('buildCatalogArtifacts produces versioned index and stock', () => {
    const built = buildCatalogArtifacts(sampleProducts, undefined, { now: 1_700_000_000_000 });
    expect(built.indexVersion).toHaveLength(8);
    expect(built.stockVersion).toHaveLength(8);
    expect(built.indexPayload.products).toHaveLength(1);
    expect(built.indexPayload.products[0].variant_skus).toEqual(['1', '2']);
    expect(built.stockPayload.q['1']).toBe(1);
    expect(built.stockPayload.q['2']).toBe(0);
    expect(built.chunks[0][0].group_id).toBe('100');
    expect(built.pointer.i).toBe(built.indexVersion);
    expect(built.pointer.s).toBe(built.stockVersion);
  });

  test('pricing config change produces new index version', () => {
    const a = buildCatalogArtifacts(sampleProducts, { global_markup_percent: 30 });
    const b = buildCatalogArtifacts(sampleProducts, { global_markup_percent: 35 });
    expect(a.indexVersion).not.toBe(b.indexVersion);
    expect(a.stockVersion).toBe(b.stockVersion);
  });

  test('transform version is part of policy', () => {
    expect(CATALOG_SYNC_POLICY.TRANSFORM_VERSION).toBeTruthy();
  });
});
