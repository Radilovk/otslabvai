import { checkLiveStock, clearLiveStockCache } from './distributor-live-stock.js';

const jsonResponse = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });

describe('checkLiveStock', () => {
  beforeEach(() => clearLiveStockCache());
  test('Fitness1 по ?id=, Sila по EAN; изчерпано → unavailable', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(String(url));
      if (url.includes('id=1')) return jsonResponse({ status: 'ok', products: [{ id: '1', available: true, b2b_price: '5.00' }] });
      if (url.includes('id=2')) return jsonResponse({ status: 'ok', products: [{ id: '2', available: false }] });
      if (url.includes('product/EAN1')) return jsonResponse({ status: 200, data: [{ available: '1', partner_price: '7.5' }] });
      if (url.includes('product/EAN2')) return jsonResponse({ status: 200, data: [{ available: '0' }] });
      return jsonResponse({}, 404);
    };
    const live = await checkLiveStock([
      { sku_id: '1', distributor: 'fitness1' },
      { sku_id: '2', distributor: 'fitness1', name: 'Протеин' },
      { sku_id: 'x', barcode: 'EAN1', distributor: 'sila' },
      { sku_id: 'y', barcode: 'EAN2', distributor: 'sila' },
      { sku_id: 'z', distributor: 'fitness1', fulfillment: 'direct' },
    ], { f1Key: 'k', silaToken: 't', fetchImpl });

    expect(live.results.map((r) => r.status)).toEqual(['available', 'unavailable', 'available', 'unavailable', 'skipped']);
    expect(live.unavailable.map((r) => r.sku_id)).toEqual(['2', 'y']);
    expect(live.results[2].b2b_price).toBe(7.5);
    expect(calls.some((u) => u.includes('products_v3') && u.includes('id=1'))).toBe(true);
  });

  test('недостъпен доставчик → unknown, не спира поръчката', async () => {
    const live = await checkLiveStock([{ sku_id: '1', distributor: 'fitness1' }], {
      f1Key: 'k',
      fetchImpl: async () => ({ ok: false, status: 403, text: async () => '<html>blocked</html>' }),
    });
    expect(live.unavailable).toHaveLength(0);
    expect(live.unknown[0].error).toMatch(/403/);
  });

  test('SKU липсва в отговора на Fitness1 → unavailable', async () => {
    const live = await checkLiveStock([{ sku_id: '9', distributor: 'fitness1' }], {
      f1Key: 'k',
      fetchImpl: async () => jsonResponse({ status: 'ok', products: [] }),
    });
    expect(live.unavailable[0].reason).toMatch(/липсва/);
  });
});

describe('кеш на живата проверка', () => {
  beforeEach(() => clearLiveStockCache());

  test('повторна проверка в рамките на 2 минути не вика доставчика; useCache:false вика', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls += 1; return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'ok', products: [{ id: '5', available: true }] }) }; };
    const line = [{ sku_id: '5', distributor: 'fitness1' }];
    await checkLiveStock(line, { f1Key: 'k', fetchImpl });
    await checkLiveStock(line, { f1Key: 'k', fetchImpl });
    expect(calls).toBe(1);
    await checkLiveStock(line, { f1Key: 'k', fetchImpl, useCache: false });
    expect(calls).toBe(2);
  });
});
