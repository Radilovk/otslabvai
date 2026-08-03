/** TTL thresholds for on-demand catalog sync (see portfolio-api.js). */
/** @type {{ BROWSE_TTL_MS: number, ORDER_FRESHNESS_MS: number, APPROVE_FRESHNESS_MS: number, SYNC_LOCK_TTL_MS: number, SYNC_LOCK_POLL_MS: number, SYNC_LOCK_MAX_WAIT_MS: number, FITNESS1_CATALOG_FETCH_FROM_WORKER: boolean, CI_SYNC_DEBOUNCE_MS: number }} */
export const SYNC_POLICY = {
  BROWSE_TTL_MS: 24 * 60 * 60 * 1000,
  ORDER_FRESHNESS_MS: 60 * 60 * 1000,
  APPROVE_FRESHNESS_MS: 15 * 60 * 1000,
  SYNC_LOCK_TTL_MS: 5 * 60 * 1000,
  SYNC_LOCK_POLL_MS: 500,
  SYNC_LOCK_MAX_WAIT_MS: 30 * 1000,
  /** Fitness1 products_v3 blocks Cloudflare Workers – catalog sync runs via CI/KV. */
  FITNESS1_CATALOG_FETCH_FROM_WORKER: false,
  /** Min interval between GitHub Actions catalog sync dispatches. */
  CI_SYNC_DEBOUNCE_MS: 45 * 60 * 1000,
};

export function isSyncStale(syncedAt, ttlMs) {
  if (!syncedAt) return true;
  const ts = new Date(syncedAt).getTime();
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts > ttlMs;
}

export function extractCartSkuIds(products) {
  if (!Array.isArray(products)) return [];
  return [...new Set(
    products
      .map((p) => String(p.sku_id || p.id || '').trim())
      .filter(Boolean)
  )];
}

