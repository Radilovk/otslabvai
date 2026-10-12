import {
  KV_ORDERS_LEGACY,
  orderKey,
  saveOrderRecord,
  getOrderRecord,
  listOrderRecords,
  summarizeOrderRecords,
} from './portfolio-order-store.js';
import { handlePortfolioRoute } from './portfolio-api.js';

/** KV mock с list + metadata и забавено четене (за да се провокира race condition). */
function createKv(initial = []) {
  const data = new Map(initial);
  const meta = new Map();
  const tick = () => new Promise((r) => setTimeout(r, 5));
  return {
    data,
    get: async (key) => { await tick(); return data.get(key) ?? null; },
    put: async (key, value, opts) => {
      await tick();
      data.set(key, value);
      if (opts?.metadata) meta.set(key, opts.metadata);
    },
    delete: async (key) => { data.delete(key); meta.delete(key); },
    list: async ({ prefix = '' } = {}) => ({
      keys: [...data.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name, metadata: meta.get(name) })),
      list_complete: true,
    }),
  };
}

const order = (id, extra = {}) => ({
  id,
  project: 'portfolio',
  timestamp: new Date(Date.now() - Number(id.replace(/\D/g, '') || 0) * 1000).toISOString(),
  status: 'Чака одобрение',
  products: [],
  ...extra,
});

describe('portfolio-order-store', () => {
  test('едновременни записи не губят поръчки', async () => {
    const env = { PAGE_CONTENT: createKv() };
    await Promise.all(Array.from({ length: 20 }, (_, i) => saveOrderRecord(env, order(`pf-${i}`))));
    const all = await listOrderRecords(env);
    expect(all).toHaveLength(20);
  });

  test('сливa стария масив с новите записи; новият запис има предимство', async () => {
    const legacy = [order('pf-1', { status: 'стар' }), order('pf-2')];
    const env = { PAGE_CONTENT: createKv([[KV_ORDERS_LEGACY, JSON.stringify(legacy)]]) };
    await saveOrderRecord(env, order('pf-1', { status: 'обновен' }));
    await saveOrderRecord(env, order('pf-3'));

    const all = await listOrderRecords(env);
    expect(all.map((o) => o.id).sort()).toEqual(['pf-1', 'pf-2', 'pf-3']);
    expect(all.find((o) => o.id === 'pf-1').status).toBe('обновен');
    expect((await getOrderRecord(env, 'pf-2')).id).toBe('pf-2');
    // Старият масив не се променя
    expect(JSON.parse(env.PAGE_CONTENT.data.get(KV_ORDERS_LEGACY))).toHaveLength(2);
  });

  test('филтър по проект и най-новите първи', async () => {
    const env = { PAGE_CONTENT: createKv() };
    await saveOrderRecord(env, order('pf-3', { project: 'life' }));
    await saveOrderRecord(env, order('pf-1', { project: 'life' }));
    await saveOrderRecord(env, order('pf-2', { project: 'main' }));
    const life = await listOrderRecords(env, { project: 'life' });
    expect(life.map((o) => o.id)).toEqual(['pf-1', 'pf-3']);
  });

  test('summary брои от metadata + стария масив без дублиране', async () => {
    const legacy = [order('pf-1'), order('pf-2', { status: 'Отказана' })];
    const env = { PAGE_CONTENT: createKv([[KV_ORDERS_LEGACY, JSON.stringify(legacy)]]) };
    const isB2bPending = (o) => o.status === 'Чака одобрение';
    await saveOrderRecord(env, order('pf-1', { status: 'Изпратена' }), { isB2bPending });
    await saveOrderRecord(env, order('pf-3'), { isB2bPending });
    const summary = await summarizeOrderRecords(env, { isB2bPending });
    expect(summary).toEqual({ total: 3, pending: 1 });
  });

  test('PUT /portfolio/orders обновява стара поръчка като отделен запис', async () => {
    const env = { PAGE_CONTENT: createKv([[KV_ORDERS_LEGACY, JSON.stringify([order('pf-9')])]]) };
    const request = new Request('https://example.com/portfolio/orders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'pf-9', status: 'Доставена' }),
    });
    const res = await handlePortfolioRoute(request, env, new URL(request.url));
    expect(res.status).toBe(200);
    expect(JSON.parse(env.PAGE_CONTENT.data.get(orderKey('pf-9'))).status).toBe('Доставена');

    const listReq = new Request('https://example.com/portfolio/orders', { method: 'GET' });
    const list = await (await handlePortfolioRoute(listReq, env, new URL(listReq.url))).json();
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('Доставена');
  });
});
