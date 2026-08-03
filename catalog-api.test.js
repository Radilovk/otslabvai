import { handleCatalogRoute, requestCatalogLightSync } from './catalog-api.js';
import { CATALOG_KV } from './catalog-kv-keys.js';

describe('catalog-api', () => {
  const pointer = { i: 'abc12345', s: 'def67890', t: Math.floor(Date.now() / 1000) - 60, dispatchedAt: 0 };

  function makeEnv(store = new Map()) {
    if (!store.has(CATALOG_KV.POINTER)) {
      store.set(CATALOG_KV.POINTER, JSON.stringify(pointer));
    }
    store.set(CATALOG_KV.index('abc12345'), JSON.stringify({ v: 'abc12345', products: [] }));
    store.set(CATALOG_KV.stock('def67890'), JSON.stringify({ v: 'def67890', q: {} }));
    return {
      GITHUB_API_TOKEN: 'gh-test',
      PAGE_CONTENT: {
        get: async (key) => store.get(key) ?? null,
        put: async (key, value) => { store.set(key, value); }
      }
    };
  }

  test('GET /c/now returns pointer with s-maxage headers', async () => {
    const env = makeEnv();
    const res = await handleCatalogRoute(
      new Request('https://example.com/c/now'),
      env,
      new URL('https://example.com/c/now'),
      { waitUntil: (p) => p }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=60');
    const data = await res.json();
    expect(data.i).toBe('abc12345');
    expect(data.s).toBe('def67890');
  });

  test('GET /c/index-{v}.json is immutable cached', async () => {
    const env = makeEnv();
    const res = await handleCatalogRoute(
      new Request('https://example.com/c/index-abc12345.json'),
      env,
      new URL('https://example.com/c/index-abc12345.json')
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('immutable');
  });

  test('requestCatalogLightSync debounces rapid dispatches', async () => {
    const store = new Map();
    store.set(CATALOG_KV.POINTER, JSON.stringify({
      ...pointer,
      dispatchedAt: Math.floor(Date.now() / 1000)
    }));
    const env = makeEnv(store);
    const result = await requestCatalogLightSync(env);
    expect(result.triggered).toBe(false);
    expect(result.reason).toBe('debounced');
  });
});
