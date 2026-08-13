import {
  normalizeSilaProduct,
  normalizeSilaProducts,
  submitSilaOrder,
  mergeCatalogProducts,
  isSilaDistributor,
  isFitness1Distributor,
  mapSilaCategoryToCatalogTaxonomy,
  normalizeSilaApiToken,
  isValidSilaApiToken,
  fetchSilaProductsWithFallback,
  resolveSilaImageUrl,
  extractSilaImageFromItem,
  buildSilaImageLookup,
  enrichSilaProductRow,
  SILA_GROUP_ID_OFFSET,
  SILA_BRAND_ID_OFFSET,
} from './sila-api.js';

describe('Sila API', () => {
  const sampleSilaRow = {
    model_id: '42',
    brand_id: '7',
    brand_name: 'Optimum Nutrition',
    product_name: 'Gold Standard Whey',
    taste_id: '3',
    taste_name: 'Шоколад',
    size_id: '2',
    size_name: '2.27 кг',
    barcode_ean: '748627026123',
    price: '89.50',
    price_retail: '119.00',
    price_promo: '0',
    qty: 5,
    image: 'https://example.com/img.jpg',
    category: 'Протеини',
  };

  test('normalizeSilaProduct maps to unified catalog raw SKU', () => {
    const raw = normalizeSilaProduct(sampleSilaRow);
    expect(raw).toMatchObject({
      id: '748627026123',
      group_id: String(SILA_GROUP_ID_OFFSET + 42),
      product_id: '42',
      product_name: 'Gold Standard Whey',
      brand_id: String(SILA_BRAND_ID_OFFSET + 7),
      brand_name: 'Optimum Nutrition',
      pack: '2.27 кг',
      option: 'Шоколад',
      barcode: '748627026123',
      b2b_price: '89.50',
      regular_price: '119.00',
      available: true,
      distributor: 'sila',
      distributor_ids: { model_id: '42', taste_id: '3', size_id: '2' },
    });
  });

  test('normalizeSilaProduct uses numeric sku when no barcode', () => {
    const raw = normalizeSilaProduct({ ...sampleSilaRow, barcode_ean: '', qty: 0 });
    expect(raw.id).toMatch(/^9\d+$/);
    expect(raw.available).toBe(false);
  });

  test('normalizeSilaProduct defaults unknown category to Други', () => {
    const raw = normalizeSilaProduct({ ...sampleSilaRow, category: 'Sila BG' });
    expect(raw.category).toBe('Други');
  });

  test('normalizeSilaProduct maps protein category to Протеини', () => {
    const raw = normalizeSilaProduct({ ...sampleSilaRow, category: 'Whey Protein' });
    expect(raw.category).toBe('Протеини');
  });

  test('mapSilaCategoryToCatalogTaxonomy aligns with Fitness1 top-level names', () => {
    expect(mapSilaCategoryToCatalogTaxonomy('Витамини > Витамин C')).toBe('Витамини > Витамин C');
    expect(mapSilaCategoryToCatalogTaxonomy('протеини')).toBe('Протеини');
  });

  test('normalizeSilaProducts filters invalid rows', () => {
    const list = normalizeSilaProducts([sampleSilaRow, {}, { model_id: '' }]);
    expect(list).toHaveLength(1);
  });

  test('mergeCatalogProducts dedupes by barcode and unifies brand names', () => {
    const merged = mergeCatalogProducts(
      [{
        id: '1',
        group_id: '100',
        brand_id: '749',
        brand_name: 'Optimum Nutrition',
        barcode: '748627026123',
        distributor: 'fitness1',
      }],
      [normalizeSilaProduct(sampleSilaRow)]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].barcode).toBe('748627026123');
  });

  test('mergeCatalogProducts appends sila-only products with unified brand id', () => {
    const silaOnly = normalizeSilaProduct({
      ...sampleSilaRow,
      barcode_ean: '999888777',
      brand_name: 'Optimum Nutrition',
    });
    const merged = mergeCatalogProducts(
      [{ id: '1', group_id: '100', brand_id: '749', brand_name: 'Optimum Nutrition', barcode: '111' }],
      [silaOnly]
    );
    expect(merged).toHaveLength(2);
    expect(merged[1].brand_id).toBe('749');
  });

  test('isSilaDistributor and isFitness1Distributor', () => {
    expect(isSilaDistributor('sila')).toBe(true);
    expect(isFitness1Distributor('fitness1')).toBe(true);
    expect(isFitness1Distributor(undefined)).toBe(true);
  });

  test('normalizeSilaApiToken extracts api_token from URL', () => {
    expect(normalizeSilaApiToken('https://distro.silabg.com/api/v1/product?api_token=abc123XYZ')).toBe('abc123XYZ');
    expect(normalizeSilaApiToken('Bearer myToken123')).toBe('myToken123');
    expect(isValidSilaApiToken('8ysXfJbcf6e6YzyEhcgAaxWk4CEN9rD3')).toBe(true);
    expect(isValidSilaApiToken('x'.repeat(80))).toBe(false);
  });

  test('resolveSilaImageUrl makes relative Sila paths absolute', () => {
    expect(resolveSilaImageUrl('/uf/product/123_small.jpg')).toBe(
      'https://www.silabg.com/uf/product/123_small.jpg'
    );
    expect(resolveSilaImageUrl('https://cdn.example/img.jpg')).toBe('https://cdn.example/img.jpg');
  });

  test('buildSilaImageLookup indexes brandfeed models by model_id', () => {
    const lookup = buildSilaImageLookup({
      data: {
        models: [
          { model_id: '42', thumb: '/uf/product/whey_small.jpg' },
          { model_id: '99', product_image: 'https://cdn.example/other.jpg' },
        ],
      },
    });
    expect(lookup.byModel.get('42')).toBe('https://www.silabg.com/uf/product/whey_small.jpg');
    expect(lookup.byModel.get('99')).toBe('https://cdn.example/other.jpg');
  });

  test('enrichSilaProductRow fills image from brandfeed lookup', () => {
    const lookup = buildSilaImageLookup({
      data: [{ model_id: '42', image: '/uf/product/whey_small.jpg' }],
    });
    const enriched = enrichSilaProductRow({ model_id: '42', product_name: 'Whey' }, lookup);
    expect(extractSilaImageFromItem(enriched)).toContain('/uf/product/whey_small.jpg');
    const normalized = normalizeSilaProduct(enriched);
    expect(normalized.image).toContain('silabg.com');
  });

  test('fetchSilaProducts loads brandfeed images when product list has none', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/brandfeed')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            status: 200,
            data: [{ model_id: '42', thumb: '/uf/product/whey_small.jpg' }],
          }),
        };
      }
      if (u.includes('/product') && !u.includes('/product/')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            status: 200,
            data: [{
              model_id: '42',
              brand_id: '7',
              product_name: 'Gold Standard Whey',
              taste_id: '3',
              size_id: '2',
              barcode_ean: '748627026123',
              price: '10.00',
              qty: 1,
            }],
          }),
        };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ status: 200, data: [] }) };
    };

    const { fetchSilaProducts } = await import('./sila-api.js');
    const products = await fetchSilaProducts('test-token');
    expect(products).toHaveLength(1);
    expect(products[0].image).toBe('https://www.silabg.com/uf/product/whey_small.jpg');

    global.fetch = originalFetch;
  });

  test('fetchSilaProductsWithFallback tries next token after 403', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      const u = String(url);
      if (u.includes('api_token=bad-token')) {
        return { ok: false, status: 403, text: async () => JSON.stringify({ message: 'Forbidden' }) };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 200, data: [sampleSilaRow] }),
      };
    };
    const { products, token_used } = await fetchSilaProductsWithFallback(['bad-token', 'good-token']);
    expect(products).toHaveLength(1);
    expect(token_used).toBe('good-token');
    global.fetch = originalFetch;
  });

  test('submitSilaOrder sends model_id/taste_id payload', async () => {
    const originalFetch = global.fetch;
    let capturedBody = null;
    global.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        text: async () => JSON.stringify({ status: 200, message: 'Ok', data: { order_id: 999 } }),
      };
    };

    const result = await submitSilaOrder('token', [{
      name: 'Test',
      quantity: 2,
      distributor_ids: { model_id: '42', taste_id: '3' },
    }]);

    expect(result.data.order_id).toBe(999);
    expect(capturedBody.data).toEqual([{ model_id: '42', taste_id: '3', qtty: 2 }]);

    global.fetch = originalFetch;
  });
});
