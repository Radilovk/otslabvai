import { handlePortfolioRoute, buildCatalogMeta } from './portfolio-api.js';

function variant(sku, retail, b2b, extra = {}) {
  return { sku_id: sku, pack: '90 капсули', option: '', retail_price: retail, b2b_price: b2b, f1_reference_price: retail * 1.05, available: true, ...extra };
}

function group(id, name, brand, category, variants, distributor = 'fitness1') {
  return {
    group_id: id, product_id: id, name, brand, brand_id: brand, category, category_path: [category],
    image: `https://example.com/${id}.jpg`, distributor, variants: variants.map((v) => ({ ...v, distributor })),
  };
}

const groups = [
  group('1', 'Ashwagandha KSM-66 300 mg', 'Forcelab', 'Билки', [variant('101', 22.4, 12)]),
  group('2', 'Ashwagandha KSM-66 200 mg', 'Trec Nutrition', 'Билки', [variant('102', 11, 6)]),
  group('3', 'Ashwagandha KSM-66 600 mg', 'NOW Foods', 'Билки', [variant('103', 25, 10)], 'sila'),
  group('4', 'Magnesium Bisglycinate 200 mg', 'NOW Foods', 'Минерали', [variant('104', 20, 11)]),
  group('5', 'GABA 750 mg', 'NOW Foods', 'Добавки', [variant('105', 17.2, 9)]),
  group('6', 'Rhodiola Rosea 500 mg', 'Olimp Sport Nutrition', 'Билки', [variant('106', 18, 9)]),
];

function makeEnv() {
  const meta = buildCatalogMeta(groups, { product_overrides: {}, global_markup_percent: 30 });
  meta.synced_at = new Date().toISOString();
  const data = new Map([
    ['portfolio_meta', JSON.stringify(meta)],
    ...Array.from({ length: meta.chunk_count }, (_, i) => [`portfolio_chunk_${i}`, JSON.stringify(groups.slice(i * meta.chunk_size, (i + 1) * meta.chunk_size))]),
  ]);
  return {
    MOCK_FITNESS1: '1',
    PAGE_CONTENT: {
      data,
      get: async (key) => data.get(key) ?? null,
      put: async (key, value) => { data.set(key, value); },
      delete: async (key) => { data.delete(key); },
    },
  };
}

const call = async (env, path, body) => {
  const request = new Request(`https://example.com${path}`, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { method: 'GET' });
  const res = await handlePortfolioRoute(request, env, new URL(request.url));
  return { status: res.status, data: await res.json() };
};

describe('Пакети — API', () => {
  test('GET /portfolio/stacks?id=antistress: пълен пакет, без марж към клиента', async () => {
    const { status, data } = await call(makeEnv(), '/portfolio/stacks?id=antistress');
    expect(status).toBe(200);
    const [stack] = data.stacks;
    expect(stack.complete).toBe(true);
    expect(stack.slots[0].item.brand).toBe('Forcelab');
    const json = JSON.stringify(data);
    expect(json).not.toMatch(/b2b_price|f1_reference_price|max_margin/);
  });

  test('validate-cart връща кои SKU-та са изчерпани', async () => {
    const env = makeEnv();
    const chunk = JSON.parse(env.PAGE_CONTENT.data.get('portfolio_chunk_0'));
    chunk.find((g) => g.group_id === '1').variants[0].available = false;
    env.PAGE_CONTENT.data.set('portfolio_chunk_0', JSON.stringify(chunk));
    const { status, data } = await call(env, '/portfolio/validate-cart', {
      products: [{ sku_id: '101', quantity: 1 }, { sku_id: '105', quantity: 1 }],
    });
    expect(status).toBe(400);
    expect(data.unavailable_sku_ids).toEqual(['101']);
  });

  test('POST /portfolio/stacks/replace: същото място, доставчикът на пакета, без продуктите в пакета', async () => {
    const env = makeEnv();
    const { status, data } = await call(env, '/portfolio/stacks/replace', {
      stack_id: 'antistress', slot_id: 'cortisol', unavailable_sku_ids: ['101'], keep_sku_ids: ['104', '105'],
    });
    expect(status).toBe(200);
    // NOW 600 mg е на Sila — пакетът е от Fitness1, затова не се предлага.
    expect(data.item.pick_variant.sku_id).toBe('102');
    expect(data.substance.key).toBe('ashwagandha');
    expect(JSON.stringify(data)).not.toMatch(/b2b_price|f1_reference_price/);

    const none = await call(env, '/portfolio/stacks/replace', {
      stack_id: 'antistress', slot_id: 'cortisol', unavailable_sku_ids: ['101', '102'], keep_sku_ids: ['104', '106'],
    });
    expect(none.data.item).toBeNull();

    const bad = await call(env, '/portfolio/stacks/replace', { stack_id: 'antistress', slot_id: 'x' });
    expect(bad.status).toBe(404);
  });
});
