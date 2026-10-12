import { filterOrderableCartSkus } from './portfolio-api.js';

describe('filterOrderableCartSkus', () => {
  const chunk = [{
    group_id: '100',
    name: 'Наличен',
    variants: [
      { sku_id: '1', barcode: '111', available: true, b2b_price: 10, retail_price: 14 },
      { sku_id: '2', barcode: '222', available: false, b2b_price: 10, retail_price: 14 },
      { sku_id: '3', barcode: '333', available: true, b2b_price: 13, retail_price: 14 },
    ],
  }];
  const meta = {
    chunk_count: 1,
    total_groups: 1,
    index: [],
    lookup: { 100: 0 },
    sku_lookup: { 1: '100', 2: '100', 3: '100' },
    synced_at: new Date().toISOString(),
  };
  const store = new Map([
    ['portfolio_meta', JSON.stringify(meta)],
    ['portfolio_chunk_0', JSON.stringify(chunk)],
  ]);
  let reads = 0;
  const env = { PAGE_CONTENT: { get: async (key) => { if (key === 'portfolio_meta') reads += 1; return store.get(key) ?? null; } } };

  test('пропуска само продукти, които checkout приема', async () => {
    const ok = await filterOrderableCartSkus(env, ['1', '2', '3', '999'], 'main');
    // 2 — изчерпан, 3 — марж под 25%, 999 — няма го в каталога
    expect([...ok.keys()]).toEqual(['1']);
    expect(ok.get('1').profit_eur).toBeGreaterThan(0);
    // метата (няколко MB в продукция) се чете веднъж за цялата проверка
    expect(reads).toBe(1);
  });
});
