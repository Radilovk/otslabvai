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
  isSilaRawProductAvailable,
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

  test('normalizeSilaProduct: непозната категория → по име, иначе Други', () => {
    const byName = normalizeSilaProduct({ ...sampleSilaRow, category: 'Sila BG' });
    expect(byName.category).not.toBe('Други');
    const unknown = normalizeSilaProduct({ ...sampleSilaRow, category: 'Sila BG', product_name: 'Застраховка на пратката', name: 'Застраховка на пратката' });
    expect(unknown.category).toBe('Други');
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

  test('isSilaRawProductAvailable respects qty and flags', () => {
    expect(isSilaRawProductAvailable({ qty: 3 })).toBe(true);
    expect(isSilaRawProductAvailable({ qty: 0 })).toBe(false);
    expect(isSilaRawProductAvailable({ available: false })).toBe(false);
    expect(isSilaRawProductAvailable({ status: 'неналичен' })).toBe(false);
  });

  test('fetchSilaProducts returns only available SKUs', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/product') && !u.includes('/product/')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            status: 200,
            data: [
              { ...sampleSilaRow, model_id: '1', qty: 2 },
              { ...sampleSilaRow, model_id: '2', qty: 0 },
              { ...sampleSilaRow, model_id: '3', qty: 0, available: false },
            ],
          }),
        };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ status: 200, data: [] }) };
    };

    const { fetchSilaProducts } = await import('./sila-api.js');
    const products = await fetchSilaProducts('test-token');
    expect(products).toHaveLength(1);
    expect(products[0].product_id).toBe('1');

    global.fetch = originalFetch;
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
    expect(isValidSilaApiToken('A'.repeat(80))).toBe(true);
    expect(isValidSilaApiToken('x'.repeat(20))).toBe(false);
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

describe('Sila: категории по име и дубли с Fitness1', () => {
  test('classifySilaProductByName', async () => {
    const { classifySilaProductByName: c } = await import('./sila-api.js');
    expect(c('100% Creatine Monohydrate')).toBe('Креатин');
    expect(c('Iso Whey ZERO')).toBe('Протеини');
    expect(c('Deluxe Protein Bar Box')).toBe('Функционални храни');
    expect(c('Carb Blocker with Starchlite')).toBe('Отслабване и контрол на теглото');
    expect(c('Chela Mag B6 Forte')).toBe('Минерали');
    expect(c('Shaker Monster Bottle')).toBe('Спортни аксесоари и уреди');
    expect(c('Collagen Peptides Powder')).toBe('Красота и подмладяване');
    expect(c('Застраховка на пратката')).toBeNull();
  });

  test('общ баркод: Sila, ако F1 е изчерпан или Sila е по-евтин; SKU и група остават от F1', async () => {
    const { mergeCatalogProducts } = await import('./sila-api.js');
    const f1 = [
      { id: '1', group_id: '10', barcode: 'A', b2b_price: '10.00', available: false, product_name: 'X', category: 'Протеини' },
      { id: '2', group_id: '10', barcode: 'B', b2b_price: '10.00', available: true, product_name: 'X', category: 'Протеини' },
      { id: '3', group_id: '11', barcode: 'C', b2b_price: '10.00', available: true, product_name: 'Y', category: 'Протеини' },
    ];
    const sila = [
      { id: 'A', group_id: '9001', barcode: 'A', b2b_price: '12.00', available: true, distributor_ids: { model_id: 'm1', taste_id: 't1' } },
      { id: 'B', group_id: '9002', barcode: 'B', b2b_price: '8.00', available: true, distributor_ids: { model_id: 'm2', taste_id: 't2' } },
      { id: 'C', group_id: '9003', barcode: 'C', b2b_price: '11.00', available: true },
      { id: 'D', group_id: '9004', barcode: 'D', b2b_price: '5.00', available: true, product_name: 'Iso Whey', category: '' },
    ];
    const merged = mergeCatalogProducts(f1, sila);
    const byId = Object.fromEntries(merged.map((p) => [p.id, p]));

    expect(byId['1']).toMatchObject({ distributor: 'sila', available: true, b2b_price: '12.00', group_id: '10' });
    expect(byId['2']).toMatchObject({ distributor: 'sila', b2b_price: '8.00' });
    expect(byId['3']).toMatchObject({ distributor: 'fitness1', b2b_price: '10.00' });
    expect(byId.A).toBeUndefined();
    expect(byId.D).toMatchObject({ distributor: 'sila', category: 'Протеини' });
    expect(merged).toHaveLength(4);
  });
});

describe('Sila: реални полета от API-то', () => {
  test('доставната цена е partner_price', async () => {
    const { normalizeSilaProduct } = await import('./sila-api.js');
    const p = normalizeSilaProduct({ model_id: '1', taste_id: '2', size_id: null, available: '1', barcode_ean: '123', product_name: 'Iso Whey', brand_name: 'X', regular_price: '94.990', partner_price: '56.990' });
    expect(p.b2b_price).toBe('56.99');
    expect(p.regular_price).toBe('94.99');
    expect(p.available).toBe(true);
  });

  test('brandfeed дава категория, описание и етикет по model_id', async () => {
    const { buildSilaImageLookup, enrichSilaProductRow, normalizeSilaProduct } = await import('./sila-api.js');
    const lookup = buildSilaImageLookup({ data: [{ id: '9902', model_id: '42015', category: 'Ставно възстановяване', description: '<p>Описание</p>', label: '/uf/stickers/x.jpg', image: '/uf/product/x.jpg', taste: [{ id: 11, ean: '91759' }] }] });
    const row = enrichSilaProductRow({ model_id: '42015', taste_id: '11', product_name: 'Flex' }, lookup);
    expect(row.category).toBe('Ставно възстановяване');
    expect(row.image).toMatch(/x\.jpg$/);
    const p = normalizeSilaProduct({ ...row, available: '1', partner_price: '10', regular_price: '20' });
    expect(p.category).toBe('Стави и сухожилия > Ставно възстановяване');
    expect(p.description).toBe('<p>Описание</p>');
  });

  test('доставка: изрична настройка, иначе първият реален адрес; без адрес → грешка', async () => {
    const { resolveSilaDelivery } = await import('./sila-api.js');
    const types = [
      { delivery_type: 1, options: [{ id: '1723', address: 'България, Бургас, ул. Александровка 21' }, { id: '17302266', address: 'До офис' }] },
      { delivery_type: 2, options: { 1: 'ПЛОВДИВ - СКЛАД' } },
    ];
    expect(resolveSilaDelivery(types)).toEqual({ delivery_type: 1, address_id: '1723', office: null });
    expect(resolveSilaDelivery([], { delivery_type: 2, office: '1' })).toEqual({ delivery_type: 2, address_id: null, office: '1' });
    expect(() => resolveSilaDelivery([{ delivery_type: 1, options: [{ id: '1', address: 'До офис' }] }])).toThrow(/адрес/);
    expect(() => resolveSilaDelivery([], { delivery_type: 2 })).toThrow(/офис/);
  });

  test('редът към Sila включва size_id при разфасовки', async () => {
    const { submitSilaOrder } = await import('./sila-api.js');
    const original = global.fetch;
    let body = null;
    global.fetch = async (url, init) => { body = JSON.parse(init.body); return { ok: true, status: 200, text: async () => JSON.stringify({ status: 200, data: { order_id: 5 } }), json: async () => ({ status: 200, data: { order_id: 5 } }) }; };
    try {
      await submitSilaOrder('tok', [{ quantity: 2, distributor_ids: { model_id: '1', taste_id: '2', size_id: '3' } }], { delivery_type: 1, address_id: '1723' });
    } finally {
      global.fetch = original;
    }
    expect(body.data[0]).toEqual({ model_id: '1', taste_id: '2', size_id: '3', qtty: 2 });
    expect(body).toMatchObject({ delivery_type: 1, address_id: '1723' });
  });
});

describe('един каталог по баркод', () => {
  test('модел на Sila с общ баркод → останалите му варианти влизат в продукта на Fitness1', async () => {
    const { mergeCatalogProducts } = await import('./sila-api.js');
    const f1 = [
      { id: 'f1', group_id: '100', product_id: 'p100', barcode: 'A', b2b_price: '20.00', available: true, product_name: 'Diet Whey', brand_name: 'Applied Nutrition', brand_id: '7', category: 'Протеини > Изолат', option: 'Шоколад', pack: '1 кг' },
    ];
    const sila = [
      { id: 'A', group_id: '90000001', barcode: 'A', b2b_price: '18.00', available: true, product_name: 'Diet Whey Protein', brand_name: 'Applied Nutrition', distributor_ids: { model_id: 'm1', taste_id: 't1' } },
      { id: 'B', group_id: '90000001', barcode: 'B', b2b_price: '18.00', available: true, product_name: 'Diet Whey Protein', brand_name: 'Applied Nutrition', option: 'Banana', distributor_ids: { model_id: 'm1', taste_id: 't2' } },
      { id: 'C', group_id: '90000002', barcode: 'C', b2b_price: '9.00', available: true, product_name: 'Iso Whey', brand_name: 'APPLIED NUTRITION', category: '' },
    ];
    const merged = mergeCatalogProducts(f1, sila);
    const byId = Object.fromEntries(merged.map((p) => [p.id, p]));

    expect(byId.f1).toMatchObject({ distributor: 'sila', b2b_price: '18.00', group_id: '100' });
    expect(byId.A).toBeUndefined();
    expect(byId.B).toMatchObject({ group_id: '100', product_name: 'Diet Whey', category: 'Протеини > Изолат', option: 'Banana', distributor: 'sila' });
    expect(byId.C).toMatchObject({ group_id: '90000002', brand_name: 'Applied Nutrition', category: 'Протеини' });
  });
});
