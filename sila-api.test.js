import {
  normalizeSilaProduct,
  normalizeSilaProducts,
  fetchSilaProducts,
  submitSilaOrder,
  mergeCatalogProducts,
  getSilaApiToken,
  isSilaDistributor,
  isFitness1Distributor,
  KV_SILA_TOKEN,
  DISTRIBUTOR_SILA,
  DISTRIBUTOR_FITNESS1,
  SilaError,
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

  test('normalizeSilaProduct maps to Fitness1-compatible raw SKU', () => {
    const raw = normalizeSilaProduct(sampleSilaRow);
    expect(raw).toMatchObject({
      id: '748627026123',
      group_id: 'sila-42',
      product_id: '42',
      product_name: 'Gold Standard Whey',
      brand_id: 'sila-7',
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

  test('normalizeSilaProduct uses synthetic sku when no barcode', () => {
    const raw = normalizeSilaProduct({ ...sampleSilaRow, barcode_ean: '', qty: 0 });
    expect(raw.id).toBe('sila-42-3-2');
    expect(raw.available).toBe(false);
  });

  test('normalizeSilaProducts filters invalid rows', () => {
    const list = normalizeSilaProducts([sampleSilaRow, {}, { model_id: '' }]);
    expect(list).toHaveLength(1);
  });

  test('mergeCatalogProducts tags Fitness1 and appends Sila', () => {
    const merged = mergeCatalogProducts(
      [{ id: '1', group_id: '100' }],
      [{ id: 'sila-1', group_id: 'sila-42', distributor: 'sila' }]
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].distributor).toBe('fitness1');
    expect(merged[1].distributor).toBe('sila');
  });

  test('isSilaDistributor and isFitness1Distributor', () => {
    expect(isSilaDistributor('sila')).toBe(true);
    expect(isFitness1Distributor('fitness1')).toBe(true);
    expect(isFitness1Distributor(undefined)).toBe(true);
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
