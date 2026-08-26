/**
 * Version retention for catalog KV artifacts — delete only stale keys, never live data.
 */
import { CATALOG_KV } from './catalog-kv-keys.js';
import { CATALOG_SYNC_POLICY } from './catalog-sync-policy.js';

/**
 * @typedef {{ v: string, i: number }} GroupHistoryEntry
 * @typedef {{ index?: string[], stock?: string[], groups?: GroupHistoryEntry[] }} CatalogHistory
 */

function cloneHistory(history = {}) {
  return {
    index: [...(history.index || [])],
    stock: [...(history.stock || [])],
    groups: [...(history.groups || [])],
  };
}

/**
 * Pure prune plan — no KV calls. Used by tests and pruneCatalogVersions.
 * @param {object} pointer - catalog_pointer payload (needs `i`, optional `history`)
 * @param {number} [keep] - retained versions per artifact type
 * @returns {{ indexKeys: string[], stockKeys: string[], groupKeys: string[], history: CatalogHistory }}
 */
export function planCatalogPrune(pointer, keep = CATALOG_SYNC_POLICY.RETAIN_VERSIONS) {
  const history = cloneHistory(pointer.history);
  const indexKeys = [];
  const stockKeys = [];
  const groupKeys = [];

  while (history.stock.length > keep) {
    const old = history.stock.shift();
    if (old) stockKeys.push(CATALOG_KV.stock(old));
  }

  const retainedIndexVersions = new Set(history.index);
  if (pointer.i) retainedIndexVersions.add(pointer.i);

  while (history.index.length > keep) {
    const old = history.index.shift();
    if (!old) continue;
    retainedIndexVersions.delete(old);
    indexKeys.push(CATALOG_KV.index(old));
  }

  const nextGroups = [];
  for (const entry of history.groups) {
    if (!entry?.v || entry.i == null) continue;
    if (retainedIndexVersions.has(entry.v)) {
      nextGroups.push(entry);
    } else {
      groupKeys.push(CATALOG_KV.groups(entry.v, entry.i));
    }
  }
  history.groups = nextGroups;

  return { indexKeys, stockKeys, groupKeys, history };
}

/**
 * Delete stale catalog KV keys and update pointer.history in place.
 * @param {object} pointer
 * @param {(key: string) => Promise<void>} deleteFn
 * @param {number} [keep]
 * @returns {Promise<{ deleted: number, index: number, stock: number, groups: number }>}
 */
export async function pruneCatalogVersions(pointer, deleteFn, keep = CATALOG_SYNC_POLICY.RETAIN_VERSIONS) {
  const plan = planCatalogPrune(pointer, keep);
  for (const key of plan.indexKeys) await deleteFn(key);
  for (const key of plan.stockKeys) await deleteFn(key);
  for (const key of plan.groupKeys) await deleteFn(key);
  pointer.history = plan.history;
  return {
    deleted: plan.indexKeys.length + plan.stockKeys.length + plan.groupKeys.length,
    index: plan.indexKeys.length,
    stock: plan.stockKeys.length,
    groups: plan.groupKeys.length,
  };
}

/**
 * Record new group chunks in history without duplicates.
 * @param {CatalogHistory} history
 * @param {string} version
 * @param {number} chunkCount
 */
export function recordGroupChunks(history, version, chunkCount) {
  history.groups = history.groups || [];
  const seen = new Set(history.groups.map((e) => `${e.v}:${e.i}`));
  for (let i = 0; i < chunkCount; i += 1) {
    const key = `${version}:${i}`;
    if (!seen.has(key)) {
      history.groups.push({ v: version, i });
      seen.add(key);
    }
  }
}
