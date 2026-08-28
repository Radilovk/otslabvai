/**
 * Refresh daotslabna (main) and life-protocols imported products after catalog sync.
 */
import { refreshImportedProductsInContent, collectImportedGroupIds } from './portfolio-import.js';
import { SITE_CONTENT_KEYS } from './portfolio-site-products.js';
import { kvGet, kvPut } from './catalog-kv-client.mjs';

export async function refreshSiteProjectsFromCatalog(groups) {
  const groupsById = new Map(groups.map((g) => [String(g.group_id), g]));
  const results = {};

  for (const project of ['main', 'life']) {
    const keys = SITE_CONTENT_KEYS[project];
    let content = await kvGet(keys.kvKey);
    if (!content) content = await kvGet(keys.fallback);
    if (!content) {
      results[project] = { skipped: true, reason: 'no content' };
      continue;
    }

    const groupIds = collectImportedGroupIds(content);
    if (!groupIds.length) {
      results[project] = { skipped: true, reason: 'no imported products' };
      continue;
    }

    const stats = refreshImportedProductsInContent(content, groupsById);
    await kvPut(keys.kvKey, content);
    results[project] = stats;
  }

  return results;
}
