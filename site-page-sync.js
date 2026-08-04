/**
 * Re-fetch site page content when tab becomes visible and cache is stale.
 */

export const SITE_PAGE_STALE_MS = 30 * 60 * 1000;

/**
 * @param {object} opts
 * @param {() => number} opts.getLoadedAt
 * @param {() => void | Promise<void>} opts.onStale
 */
export function attachSitePageVisibilitySync({ getLoadedAt, onStale }) {
  if (typeof document === 'undefined') return;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const loadedAt = getLoadedAt();
    if (!loadedAt || Date.now() - loadedAt < SITE_PAGE_STALE_MS) return;
    try {
      const result = onStale();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch { /* ignore */ }
  });
}
