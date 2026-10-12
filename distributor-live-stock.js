/**
 * Жива проверка на наличността при доставчика в момента на checkout / поръчка.
 *
 *  - Fitness1: GET products_v3?id=<sku> (≈0.5 KB, ≈0.2–0.5 s; целият каталог е 9 MB / 20 s);
 *  - Sila:     GET product/<ean> (поле available).
 *
 * Резултат на ред: available | unavailable | unknown (таймаут, блокиран достъп, липсващ ключ).
 * „unknown“ не спира поръчката — ползва се кешът от синхронизацията.
 */

import { isSilaDistributor } from './sila-api.js';

const F1_PRODUCTS_URL = 'https://fitness1.bg/b2b/api/products_v3';
const SILA_API_URL = 'https://distro.silabg.com/api/v1';
export const LIVE_STOCK_TIMEOUT_MS = 3500;
/** Кеш в рамките на worker isolate: checkout-ът валидира количката многократно — не викаме доставчика всеки път. */
export const LIVE_STOCK_CACHE_MS = 2 * 60 * 1000;
const liveCache = new Map();

function cacheGet(key) {
  const hit = liveCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > LIVE_STOCK_CACHE_MS) {
    liveCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (liveCache.size > 2000) liveCache.clear();
  liveCache.set(key, { at: Date.now(), value });
}

export function clearLiveStockCache() {
  liveCache.clear();
}

async function fetchJson(url, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: { Accept: 'application/json', 'Accept-Encoding': 'identity' },
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`невалиден JSON (HTTP ${res.status})`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/** @returns {Promise<{ available: boolean, b2b_price: number|null, reason?: string }>} */
export async function checkFitness1Sku(skuId, apiKey, { fetchImpl = fetch, timeoutMs = LIVE_STOCK_TIMEOUT_MS } = {}) {
  const url = `${F1_PRODUCTS_URL}?key=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(skuId)}`;
  const data = await fetchJson(url, fetchImpl, timeoutMs);
  if (data?.status !== 'ok' || !Array.isArray(data.products)) throw new Error('неочакван отговор от Fitness1');
  const row = data.products.find((p) => String(p.id) === String(skuId));
  if (!row) return { available: false, b2b_price: null, reason: 'липсва в каталога на Fitness1' };
  return { available: row.available === true, b2b_price: Number(row.b2b_price) || null };
}

/** @returns {Promise<{ available: boolean, b2b_price: number|null, reason?: string }>} */
export async function checkSilaEan(ean, apiToken, { fetchImpl = fetch, timeoutMs = LIVE_STOCK_TIMEOUT_MS } = {}) {
  const url = `${SILA_API_URL}/product/${encodeURIComponent(ean)}?api_token=${encodeURIComponent(apiToken)}`;
  const data = await fetchJson(url, fetchImpl, timeoutMs);
  const rows = Array.isArray(data?.data) ? data.data : (data?.data ? [data.data] : []);
  if (!rows.length) return { available: false, b2b_price: null, reason: 'липсва в каталога на Sila' };
  const isAvailable = (r) => r.available === true || r.available === 1 || String(r.available) === '1';
  const row = rows.find(isAvailable) || rows[0];
  return { available: isAvailable(row), b2b_price: Number(row.partner_price) || null };
}

/**
 * @typedef {{ sku_id: string, name: string, distributor: string, status: string,
 *   b2b_price?: number|null, reason?: string, error?: string }} LiveStockResult
 */

/**
 * @param {Array<{ sku_id: string, barcode?: string, distributor?: string, name?: string, fulfillment?: string }>} lines
 * @param {{ f1Key?: string|null, silaToken?: string|null, fetchImpl?: typeof fetch, timeoutMs?: number, useCache?: boolean }} opts
 * @returns {Promise<{ checked_at: string, results: LiveStockResult[], unavailable: LiveStockResult[], unknown: LiveStockResult[] }>}
 */
export async function checkLiveStock(lines, { f1Key = null, silaToken = null, fetchImpl = fetch, timeoutMs = LIVE_STOCK_TIMEOUT_MS, useCache = true } = {}) {
  /** @returns {Promise<LiveStockResult>} */
  const checkOne = async (line) => {
    const base = { sku_id: String(line.sku_id), name: line.name || '', distributor: isSilaDistributor(line.distributor) ? 'sila' : 'fitness1' };
    if (line.fulfillment === 'direct') return { ...base, status: 'skipped' };
    try {
      const cacheKey = `${base.distributor}:${base.distributor === 'sila' ? line.barcode : line.sku_id}`;
      let r = useCache ? cacheGet(cacheKey) : null;
      if (!r) {
        if (base.distributor === 'sila') {
          if (!silaToken || !line.barcode) return { ...base, status: 'unknown', error: !silaToken ? 'няма Sila токен' : 'няма баркод' };
          r = await checkSilaEan(line.barcode, silaToken, { fetchImpl, timeoutMs });
        } else {
          if (!f1Key) return { ...base, status: 'unknown', error: 'няма Fitness1 ключ' };
          r = await checkFitness1Sku(line.sku_id, f1Key, { fetchImpl, timeoutMs });
        }
        cacheSet(cacheKey, r);
      }
      return { ...base, status: r.available ? 'available' : 'unavailable', b2b_price: r.b2b_price, ...(r.reason ? { reason: r.reason } : {}) };
    } catch (e) {
      return { ...base, status: 'unknown', error: e?.name === 'AbortError' ? 'таймаут' : (e?.message || String(e)) };
    }
  };
  const results = await Promise.all((lines || []).map(checkOne));

  return {
    checked_at: new Date().toISOString(),
    results,
    unavailable: results.filter((r) => r.status === 'unavailable'),
    unknown: results.filter((r) => r.status === 'unknown'),
  };
}
