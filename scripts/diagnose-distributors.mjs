/**
 * Диагностика (само четене) на Sila BG Distro, Fitness1 B2B и реалния каталог в KV.
 * Нищо не се записва. Не печата токени и лични данни на клиенти.
 *
 * Env: SILA_API_TOKEN, FITNESS1_API_KEY, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 */
import { kvGet } from '../catalog-kv-client.mjs';
import { classifySilaProductByName } from '../sila-api.js';
import {
  loadPortfolioCatalogProducts,
  filterPortfolioEligibleProducts,
  rankPortfolioAdvisorProducts,
  buildPortfolioAdvisorProfile,
  getAdvisorCommerceOptionsForProfile,
} from '../portfolio-advisor-engine.js';
import { getAdvisorCommercialStats, filterAdvisorCommercialProducts } from '../portfolio-advisor-commerce.js';
import { selectCurationCandidates } from '../catalog-auto-curate.js';

const SILA = 'https://distro.silabg.com/api/v1';
const F1 = 'https://fitness1.bg/b2b/api';
const silaToken = String(process.env.SILA_API_TOKEN || '').trim();
const f1Key = String(process.env.FITNESS1_API_KEY || '').trim();

const PII_KEYS = /name|phone|email|mail|address|addr|street|city|town|zip|post|egn|person|contact|first|last|company|vat|eik/i;

function redact(value, depth = 0) {
  if (Array.isArray(value)) return value.slice(0, 3).map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, PII_KEYS.test(k) && typeof v !== 'object' ? '[скрито]' : redact(v, depth + 1)]));
  }
  if (typeof value === 'string' && value.length > 120) return `${value.slice(0, 120)}…`;
  return value;
}

const section = (title) => console.log(`\n\n######## ${title} ########`);
const show = (label, obj) => console.log(`${label}: ${JSON.stringify(obj, null, 1).slice(0, 3000)}`);

async function timed(label, fn) {
  const t = Date.now();
  try {
    const r = await fn();
    console.log(`[${label}] ${Date.now() - t} ms`);
    return r;
  } catch (e) {
    console.log(`[${label}] ГРЕШКА след ${Date.now() - t} ms: ${e.message}`);
    return null;
  }
}

async function silaGet(path, init = {}) {
  const url = `${SILA}/${path}${path.includes('?') ? '&' : '?'}api_token=${encodeURIComponent(silaToken)}`;
  const res = await fetch(url, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, bytes: text.length, data, text: data ? '' : text.slice(0, 200) };
}

function listFrom(data) {
  if (Array.isArray(data)) return data;
  for (const k of ['data', 'products', 'items', 'result']) {
    if (Array.isArray(data?.[k])) return data[k];
    if (Array.isArray(data?.data?.[k])) return data.data[k];
  }
  return [];
}

async function diagnoseSila() {
  section('SILA');
  if (!silaToken) { console.log('Няма SILA_API_TOKEN'); return; }

  const types = await timed('order/delivery/types', () => silaGet('order/delivery/types'));
  if (types) show(`delivery types (HTTP ${types.status})`, types.data ?? types.text);

  const orders = await timed('order/list', () => silaGet('order/list'));
  if (orders) {
    const list = listFrom(orders.data);
    console.log(`order/list HTTP ${orders.status}, поръчки: ${list.length}`);
    if (list[0]) {
      console.log(`ключове на поръчка: ${Object.keys(list[0]).join(', ')}`);
      show('последни поръчки (без лични данни)', list.slice(0, 3).map(redact));
      const detail = await silaGet(`order/${encodeURIComponent(list[0].id ?? list[0].order_id)}`);
      show(`order detail (HTTP ${detail.status})`, redact(detail.data));
    }
  }

  const products = await timed('POST product', () => silaGet('product', { method: 'POST', body: JSON.stringify({ brand_id: 0, model_id: 0, taste_id: 0, size_id: 0 }) }));
  const rows = listFrom(products?.data);
  console.log(`product list: HTTP ${products?.status}, ${rows.length} реда, ${products?.bytes} B`);
  if (rows.length) {
    const keys = new Set();
    rows.slice(0, 200).forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
    console.log(`полета: ${[...keys].join(', ')}`);
    show('примерен ред', redact(rows[0]));
    const catKeys = [...keys].filter((k) => /categ|group|type|class|section/i.test(k));
    for (const k of catKeys) {
      const counts = {};
      for (const r of rows) counts[String(r[k])] = (counts[String(r[k])] || 0) + 1;
      console.log(`  ${k}: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([v, n]) => `${n}×${v}`).join(' | ')}`);
    }
    const qtyKeys = [...keys].filter((k) => /qty|quant|stock|avail/i.test(k));
    for (const k of qtyKeys) console.log(`  наличност ${k}: ${rows.slice(0, 8).map((r) => r[k]).join(', ')}`);

    const unknown = rows.filter((r) => !classifySilaProductByName(r.product_name || r.model_name || r.name));
    console.log(`без категория по име: ${unknown.length} от ${rows.length}`);
    for (const r of unknown.slice(0, 3)) {
      const ean = r.barcode_ean || r.ean || r.barcode;
      if (!ean) continue;
      const d = await silaGet(`product/${encodeURIComponent(ean)}`);
      show(`product/${ean} (HTTP ${d.status})`, redact(d.data));
    }
    const brandId = rows.find((r) => r.brand_id)?.brand_id;
    if (brandId) {
      const feed = await silaGet('brandfeed', { method: 'POST', body: JSON.stringify({ brand_id: String(brandId) }) });
      const feedRows = listFrom(feed.data);
      console.log(`brandfeed ${brandId}: HTTP ${feed.status}, ${feedRows.length} реда; top keys: ${Object.keys(feed.data || {}).join(', ')}`);
      if (feedRows[0]) show('brandfeed ред', redact(feedRows[0]));
      else show('brandfeed', redact(feed.data));
    }
  }
}

async function f1Fetch(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Encoding': 'identity' } });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* */ }
  return { status: res.status, bytes: text.length, data, text: data ? '' : text.slice(0, 160) };
}

async function diagnoseFitness1() {
  section('FITNESS1');
  if (!f1Key) { console.log('Няма FITNESS1_API_KEY'); return; }
  const key = `key=${encodeURIComponent(f1Key)}`;
  const full = await timed('products_v3', () => f1Fetch(`${F1}/products_v3?${key}`));
  const products = full?.data?.products || [];
  console.log(`products_v3: HTTP ${full?.status}, ${products.length} SKU, ${full?.bytes} B; top keys: ${Object.keys(full?.data || {}).join(', ')}`);
  if (!products.length) return;
  show('примерен SKU', redact(products[0]));
  const sample = products.find((p) => p.available === true) || products[0];
  const probes = [
    `products_v3?${key}&id=${sample.id}`,
    `products_v3?${key}&ids=${sample.id}`,
    `products_v3?${key}&sku=${sample.id}`,
    `products_v3?${key}&product_id=${sample.product_id}`,
    `products_v3?${key}&group_id=${sample.group_id}`,
    `products_v3?${key}&barcode=${sample.barcode}`,
    `products_v3?${key}&available=1`,
    `products_v3?${key}&limit=1`,
    `products_v3?${key}&updated_since=${encodeURIComponent(new Date(Date.now() - 6 * 3600e3).toISOString())}`,
    `product/${sample.id}?${key}`,
    `products/${sample.id}?${key}`,
    `stock?${key}`,
    `products_v2?${key}`,
    `orders?${key}`,
    `orders/list?${key}`,
  ];
  for (const p of probes) {
    const r = await timed(p.replace(key, 'key=***'), () => f1Fetch(`${F1}/${p}`));
    if (!r) continue;
    const n = Array.isArray(r.data?.products) ? r.data.products.length : (Array.isArray(r.data) ? r.data.length : '-');
    console.log(`   → HTTP ${r.status}, ${r.bytes} B, продукти: ${n}, keys: ${Object.keys(r.data || {}).slice(0, 8).join(',')} ${r.text}`);
  }
}

function kvEnv() {
  return {
    PAGE_CONTENT: {
      get: async (key) => {
        const v = await kvGet(key);
        if (v == null) return null;
        return typeof v === 'string' ? v : JSON.stringify(v);
      },
    },
  };
}

async function diagnoseKv() {
  section('KV: РЕАЛЕН КАТАЛОГ');
  if (!process.env.CLOUDFLARE_API_TOKEN) { console.log('Няма CLOUDFLARE_API_TOKEN'); return; }
  const meta = await kvGet('portfolio_meta');
  const index = meta?.index || [];
  const isSila = (gid) => Number(gid) >= 90000000;
  const stat = (arr) => ({
    общо: arr.length,
    налични: arr.filter((e) => e.available).length,
    марж_ok: arr.filter((e) => e.available && e.margin_eligible).length,
    видимо_промо: arr.filter((e) => e.available && e.has_promo).length,
    ср_печалба_eur: Math.round(arr.filter((e) => e.max_margin > 0).reduce((s, e) => s + e.max_margin, 0) / Math.max(1, arr.filter((e) => e.max_margin > 0).length) * 100) / 100,
  });
  console.log(`synced_at ${meta?.synced_at}; групи ${meta?.total_groups}`);
  show('Fitness1', stat(index.filter((e) => !isSila(e.group_id))));
  show('Sila', stat(index.filter((e) => isSila(e.group_id))));
  const silaCats = {};
  for (const e of index.filter((x) => isSila(x.group_id) && x.available)) silaCats[e.category_top || e.category] = (silaCats[e.category_top || e.category] || 0) + 1;
  show('Sila по категория (в KV)', silaCats);

  section('KV: ПОРЪЧКИ — B2B ГРЕШКИ (без лични данни)');
  const legacy = (await kvGet('portfolio_orders')) || [];
  const all = Array.isArray(legacy) ? legacy : [];
  const errors = {};
  let withError = 0;
  for (const o of all) {
    if (!o?.b2b_submit_error) continue;
    withError += 1;
    const msg = String(o.b2b_submit_error.message || '').replace(/\d{3,}/g, '#').slice(0, 140);
    errors[msg] = (errors[msg] || 0) + 1;
  }
  const byStatus = {};
  for (const o of all) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  console.log(`поръчки в стария масив: ${all.length}; с B2B грешка: ${withError}`);
  show('по статус', byStatus);
  show('B2B грешки', errors);
  const silaOrders = all.filter((o) => o.sila_order);
  console.log(`поръчки към Sila: ${silaOrders.length}`);
  if (silaOrders[0]) show('Sila отговор (последна)', redact(silaOrders[0].sila_order.raw));

  section('KV: КОНСУЛТАНТ BIOCODE С РЕАЛНИ МАРЖОВЕ');
  const env = kvEnv();
  const advisorSettings = (await kvGet('portfolio_advisor_settings')) || {};
  const products = await loadPortfolioCatalogProducts(env);
  const eligible = filterPortfolioEligibleProducts(products, { selectionMode: 'package' });
  const silaP = (p) => isSila(p.system_data?.portfolio?.group_id);
  console.log(`продукти: ${products.length}; допустими: ${eligible.length}; от Sila: ${eligible.filter(silaP).length}`);
  for (const goal of ['otshalvane', 'muscle', 'health', 'antiaging', 'energy', 'recovery']) {
    const profile = buildPortfolioAdvisorProfile({ priority: goal, email: 'a@b.cc', sex: 'female', product_categories: ['all'] });
    const commerce = getAdvisorCommerceOptionsForProfile(advisorSettings, profile);
    const pool = filterAdvisorCommercialProducts(eligible, commerce);
    const { ranked } = rankPortfolioAdvisorProducts(profile, pool.length >= 3 ? pool : eligible, commerce);
    const top = ranked.slice(0, 40);
    console.log(`\n${goal}: пул ${pool.length} (Sila ${pool.filter(silaP).length}); топ40 Sila: ${top.filter((e) => silaP(e.product)).length}`);
    for (const e of top.slice(0, 8)) {
      const s = getAdvisorCommercialStats(e.product) || {};
      console.log(`  ${e.score.toFixed(1).padStart(6)} ${silaP(e.product) ? 'SILA' : 'F1  '} печалба ${String(s.profit_eur).padStart(6)}€ ${String(s.profit_pct).padStart(5)}% промо ${s.customer_discount_pct}% | ${e.product.public_data?.name?.slice(0, 50)}`);
    }
  }

  section('KV: ПОДБОР ЗА САЙТОВЕТЕ (dry-run)');
  for (const [project, key] of [['main', 'page_content'], ['life', 'life_page_content']]) {
    const content = await kvGet(key);
    const picks = selectCurationCandidates(index, project, content);
    console.log(`\n${project}: ${picks.length}`);
    for (const p of picks) console.log(`  ${p.slot.key.padEnd(17)} ${p.price.toFixed(2).padStart(6)}€ печалба ${p.profit.eur.toFixed(2).padStart(6)}€ ${p.profit.pct.toFixed(1).padStart(5)}% ${isSila(p.entry.group_id) ? 'SILA' : 'F1  '} | ${p.entry.brand} | ${p.entry.name.slice(0, 50)}`);
  }
}

for (const fn of [diagnoseSila, diagnoseFitness1, diagnoseKv]) {
  try { await fn(); } catch (e) { console.log(`!!! ${fn.name}: ${e.stack || e.message}`); }
}
