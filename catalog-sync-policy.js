/** Catalog v2 delivery policy (GHA + /c/* endpoints). */
/** @type {{ TRANSFORM_VERSION: string, REFRESH_WINDOW_MS: number, DISPATCH_DEBOUNCE_MS: number, SAFETY_THRESHOLD: number, RETAIN_VERSIONS: number, SOFT_TTL_MS: number, POINTER_SMAXAGE_SEC: number }} */
export const CATALOG_SYNC_POLICY = {
  TRANSFORM_VERSION: '1',
  REFRESH_WINDOW_MS: 5 * 60 * 1000,
  DISPATCH_DEBOUNCE_MS: 90 * 1000,
  /** Fitness1 returns boolean stock; threshold applies when numeric qty exists. */
  SAFETY_THRESHOLD: 0,
  RETAIN_VERSIONS: 5,
  /** Client-side min interval between /c/now polls (portfolio-cache.js). */
  SOFT_TTL_MS: 5 * 60 * 1000,
  /** CDN edge cache for GET /c/now (branding + catalog pointer). */
  POINTER_SMAXAGE_SEC: 300
};
