import {
  SYNC_POLICY,
  isSyncStale,
  extractCartSkuIds,
  isClientCatalogStale
} from './portfolio-sync-policy.js';

describe('portfolio-sync-policy', () => {
  test('isSyncStale returns true when syncedAt is missing', () => {
    expect(isSyncStale(null, SYNC_POLICY.BROWSE_TTL_MS)).toBe(true);
    expect(isSyncStale('', SYNC_POLICY.BROWSE_TTL_MS)).toBe(true);
  });

  test('isSyncStale returns false for recent sync', () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    expect(isSyncStale(recent, SYNC_POLICY.ORDER_FRESHNESS_MS)).toBe(false);
  });

  test('isSyncStale returns true when TTL exceeded', () => {
    const old = new Date(Date.now() - SYNC_POLICY.BROWSE_TTL_MS - 1000).toISOString();
    expect(isSyncStale(old, SYNC_POLICY.BROWSE_TTL_MS)).toBe(true);
  });

  test('extractCartSkuIds deduplicates sku_id and id', () => {
    expect(extractCartSkuIds([
      { sku_id: '1', quantity: 1 },
      { id: '2', quantity: 1 },
      { sku_id: '1', quantity: 2 }
    ])).toEqual(['1', '2']);
  });

  test('FITNESS1_CATALOG_FETCH_FROM_WORKER is disabled by default', () => {
    expect(SYNC_POLICY.FITNESS1_CATALOG_FETCH_FROM_WORKER).toBe(false);
    expect(SYNC_POLICY.CI_SYNC_DEBOUNCE_MS).toBeGreaterThanOrEqual(30 * 60 * 1000);
  });

  test('isClientCatalogStale flags old bootstrap copies', () => {
    const fresh = Date.now() - 60_000;
    const stale = Date.now() - SYNC_POLICY.CLIENT_CATALOG_FRESHNESS_MS - 1000;
    expect(isClientCatalogStale(fresh)).toBe(false);
    expect(isClientCatalogStale(stale)).toBe(true);
    expect(isClientCatalogStale(null)).toBe(true);
  });
});
