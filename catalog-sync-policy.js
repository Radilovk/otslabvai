/** Catalog v2 delivery policy (GHA + /c/* endpoints). */
/** @type {{ TRANSFORM_VERSION: string, REFRESH_WINDOW_MS: number, DISPATCH_DEBOUNCE_MS: number, SAFETY_THRESHOLD: number, RETAIN_VERSIONS: number, SOFT_TTL_MS: number }} */
export const CATALOG_SYNC_POLICY = {
  TRANSFORM_VERSION: '1',
  REFRESH_WINDOW_MS: 5 * 60 * 1000,
  DISPATCH_DEBOUNCE_MS: 90 * 1000,
  /** Fitness1 returns boolean stock; threshold applies when numeric qty exists. */
  SAFETY_THRESHOLD: 0,
  RETAIN_VERSIONS: 5,
  SOFT_TTL_MS: 60 * 1000
};
