/**
 * KV portfolio_settings helpers for GHA catalog sync scripts.
 * Admin/branding fields must never be overwritten by long-running catalog jobs.
 */

/** Fields embedded in catalog index artifacts (catalog-build.js). */
export const INDEX_EMBEDDED_SETTINGS_KEYS = [
  'site_name',
  'site_slogan',
  'hero_image',
  'hero_title',
  'hero_mode',
  'hero_slides',
  'hero_carousel_interval',
  'footer',
  'reseller_name',
  'reseller_phone',
  'reseller_address',
  'reseller_delivery_note',
];

/** Merge KV settings for catalog build (pricing + branding). */
export function mergeSettingsForCatalogSync(defaultSettings, kvSettings = {}) {
  return { ...defaultSettings, ...kvSettings, global_markup_percent: 30 };
}

/**
 * After catalog sync: only update sync timestamps; never clobber admin edits.
 * @param {object} freshKv - latest portfolio_settings from KV (re-read before write)
 * @param {{ last_sync: string, last_sync_count: number }} syncMeta
 */
export function persistSettingsAfterCatalogSync(freshKv, syncMeta) {
  return {
    ...(freshKv || {}),
    last_sync: syncMeta.last_sync,
    last_sync_count: syncMeta.last_sync_count,
  };
}

/**
 * Fresh KV branding/admin fields win when baking index payload.
 * Avoids race: admin saves hero while catalog-light-sync is running.
 */
export function mergeIndexEmbeddedSettings(builtSettings, freshKv = {}) {
  const out = { ...(builtSettings || {}) };
  for (const key of INDEX_EMBEDDED_SETTINGS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(freshKv, key)) {
      out[key] = freshKv[key];
    }
  }
  return out;
}
