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
import { DEFAULT_SETTINGS, fetchFitness1Products, groupRawProducts, buildCatalogMeta } from '../portfolio-api.js';
import { fetchSilaProducts, mergeCatalogProducts } from '../sila-api.js';
import { mergeSettingsForCatalogSync } from '../catalog-settings-kv.mjs';
import { checkLiveStock } from '../distributor-live-stock.js';

const SILA = 'https://distro.silabg.com/api/v1';
const F1 = 'https://fitness1.bg/b2b/api';
const silaToken = String(process.env.SILA_API_TOKEN || '').trim();
const f1Key = String(process.env.FITNESS1_API_KEY || '').trim();

const PII_KEYS = /^(name|first_?name|last_?name|customer.*|client.*)$|phone|email|mail|address|addr|street|city|town|zip|post_?code|egn|person|contact|company|vat|eik/i;

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

async function diagnoseRound2() {
  section('ROUND 2: SILA ЦЕНИ И КАТЕГОРИИ');
  if (silaToken) {
    const products = await silaGet('product', { method: 'POST', body: JSON.stringify({ brand_id: 0, model_id: 0, taste_id: 0, size_id: 0 }) });
    const rows = listFrom(products.data);
    const avail = rows.filter((r) => String(r.available) === '1' || r.available === 1 || r.available === true);
    const withPartner = avail.filter((r) => Number(r.partner_price) > 0);
    console.log(`налични ${avail.length}; с partner_price>0: ${withPartner.length}`);
    for (const r of withPartner.slice(0, 6)) {
      const m = Number(r.regular_price) > 0 ? ((Number(r.regular_price) - Number(r.partner_price)) / Number(r.regular_price) * 100).toFixed(1) : '-';
      console.log(`  ${r.brand_name} | ${r.product_name} | ${r.taste_name || ''} ${r.size_name || ''} | partner ${r.partner_price} regular ${r.regular_price} (${m}% под RRP) s=${r.s}`);
    }
    const marginDist = {};
    for (const r of withPartner) {
      const m = (Number(r.regular_price) - Number(r.partner_price)) / Number(r.regular_price) * 100;
      const b = m < 15 ? '<15%' : m < 25 ? '15-25%' : m < 35 ? '25-35%' : '35%+';
      marginDist[b] = (marginDist[b] || 0) + 1;
    }
    show('отстъпка от RRP при налични', marginDist);
    const brandIds = [...new Set(avail.map((r) => r.brand_id))].slice(0, 60);
    const cats = {};
    let models = 0;
    for (const id of brandIds) {
      const feed = await silaGet('brandfeed', { method: 'POST', body: JSON.stringify({ brand_id: String(id) }) });
      for (const row of listFrom(feed.data)) {
        models += 1;
        cats[row.category || '(празно)'] = (cats[row.category || '(празно)'] || 0) + 1;
      }
    }
    console.log(`brandfeed: ${brandIds.length} марки, ${models} модела, ${Object.keys(cats).length} категории`);
    console.log(Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}× ${k}`).join('\n'));
  }

  section('ROUND 2: FITNESS1 ЖИВА ПРОВЕРКА');
  if (f1Key) {
    const key = `key=${encodeURIComponent(f1Key)}`;
    const full = await f1Fetch(`${F1}/products_v3?${key}&limit=3`);
    const ids = (full.data?.products || []).map((p) => p.id);
    for (const q of [`id=${ids.join(',')}`, `id[]=${ids[0]}&id[]=${ids[1]}`, `id=${ids[0]}&id=${ids[1]}`, `limit=2&offset=5`, `limit=2&page=3`]) {
      const r = await timed(q, () => f1Fetch(`${F1}/products_v3?${key}&${q}`));
      console.log(`   → ${r?.status} ${r?.bytes} B, продукти ${r?.data?.products?.length ?? '-'}: ${(r?.data?.products || []).map((p) => p.id).join(',')}`);
    }
    const orders = await f1Fetch(`${F1}/orders?${key}`);
    const list = orders.data?.orders || [];
    console.log(`F1 orders: ${list.length}; pagination ${JSON.stringify(orders.data?.pagination)}`);
    if (list[0]) show('F1 поръчка (без лични данни)', redact(list[0]));
  }
}

async function diagnoseRound3() {
  section('ROUND 3: НОВИЯТ ПОТОК С РЕАЛНИ ДАННИ');
  const settings = mergeSettingsForCatalogSync(DEFAULT_SETTINGS, (await kvGet('portfolio_settings')) || {});
  const f1 = await timed('Fitness1 каталог', () => fetchFitness1Products(f1Key));
  const sila = await timed('Sila каталог (нов код)', () => fetchSilaProducts(silaToken));
  console.log(`Fitness1 SKU: ${f1?.length}; Sila налични SKU: ${sila?.length}; Sila с доставна цена: ${(sila || []).filter((p) => Number(p.b2b_price) > 0).length}`);
  const silaCats = {};
  for (const p of sila || []) { const top = String(p.category).split(' > ')[0]; silaCats[top] = (silaCats[top] || 0) + 1; }
  show('Sila SKU по горно ниво', silaCats);

  const merged = mergeCatalogProducts(f1 || [], sila || []);
  const switched = merged.filter((p) => p.distributor === 'sila' && Number(p.group_id) < 90000000);
  console.log(`общи баркодове, снабдявани от Sila (по-евтино или F1 изчерпан): ${switched.length}`);

  const groups = groupRawProducts(merged, settings);
  const meta = buildCatalogMeta(groups, settings);
  const isSila = (e) => Number(e.group_id) >= 90000000;
  const stat = (arr) => ({
    групи: arr.length,
    налични: arr.filter((e) => e.available).length,
    марж_ok: arr.filter((e) => e.available && e.margin_eligible).length,
    видимо_промо: arr.filter((e) => e.available && e.has_promo).length,
    ср_печалба_eur: Math.round(arr.filter((e) => e.available && e.max_margin > 0).reduce((s, e) => s + e.max_margin, 0) / Math.max(1, arr.filter((e) => e.available && e.max_margin > 0).length) * 100) / 100,
    в_Други: arr.filter((e) => e.available && (e.category_top || e.category) === 'Други').length,
  });
  show('Fitness1 групи', stat(meta.index.filter((e) => !isSila(e))));
  show('Sila групи', stat(meta.index.filter(isSila)));
  const silaOnPromo = (sila || []).filter((p) => Number(p.sale_price) > 0);
  console.log(`Sila SKU с промоция в магазина на Sila: ${silaOnPromo.length}`);
  const allVars = groups.flatMap((g) => g.variants.map((v) => ({ ...v, sila: Number(g.group_id) >= 90000000 || v.distributor === 'sila' })));
  const avail = allVars.filter((v) => v.available);
  const undercut = avail.filter((v) => Number(v.f1_reference_price) > 0 && v.retail_price > Number(v.f1_reference_price) + 0.005);
  console.log(`налични варианти: ${avail.length}; по-скъпи от магазина на доставчика (скрити): ${undercut.length} (Sila ${undercut.filter((v) => v.sila).length})`);
  const mixed = groups.filter((g) => g.variants.some((v) => v.distributor === 'sila') && g.variants.some((v) => v.distributor !== 'sila'));
  console.log(`продукти с варианти и от двата доставчика (една страница): ${mixed.length}`);

  for (const [project, key] of [['main', 'page_content'], ['life', 'life_page_content']]) {
    const content = await kvGet(key);
    const picks = selectCurationCandidates(meta.index, project, content);
    console.log(`\nподбор ${project}: ${picks.length} (Sila ${picks.filter((p) => isSila(p.entry)).length})`);
    for (const p of picks) console.log(`  ${p.slot.key.padEnd(17)} ${p.price.toFixed(2).padStart(6)}€ печалба ${p.profit.eur.toFixed(2).padStart(6)}€ ${p.profit.pct.toFixed(1).padStart(5)}% ${isSila(p.entry) ? 'SILA' : 'F1  '} | ${p.entry.brand} | ${p.entry.name.slice(0, 50)}`);
  }

  const store = new Map([['portfolio_meta', JSON.stringify({ chunk_count: Math.ceil(groups.length / 150) })]]);
  for (let i = 0; i * 150 < groups.length; i += 1) store.set(`portfolio_chunk_${i}`, JSON.stringify(groups.slice(i * 150, (i + 1) * 150)));
  store.set('portfolio_settings', JSON.stringify(settings));
  const env = { PAGE_CONTENT: { get: async (k) => store.get(k) ?? null } };
  const advisorSettings = (await kvGet('portfolio_advisor_settings')) || {};
  const products = await loadPortfolioCatalogProducts(env);
  const eligible = filterPortfolioEligibleProducts(products, { selectionMode: 'package' });
  const silaP = (p) => Number(p.system_data?.portfolio?.group_id) >= 90000000;
  console.log(`\nbiocode консултант: допустими ${eligible.length}, от Sila ${eligible.filter(silaP).length}`);
  for (const goal of ['otshalvane', 'muscle', 'health', 'antiaging', 'energy', 'recovery']) {
    const profile = buildPortfolioAdvisorProfile({ priority: goal, email: 'a@b.cc', sex: 'female', product_categories: ['all'] });
    const commerce = getAdvisorCommerceOptionsForProfile(advisorSettings, profile);
    const pool = filterAdvisorCommercialProducts(eligible, commerce);
    const { ranked } = rankPortfolioAdvisorProducts(profile, pool.length >= 3 ? pool : eligible, commerce);
    const top = ranked.slice(0, 40);
    console.log(`${goal}: пул ${pool.length} (Sila ${pool.filter(silaP).length}); топ40 Sila ${top.filter((e) => silaP(e.product)).length}; топ5: ${top.slice(0, 5).map((e) => `${silaP(e.product) ? '[S]' : '[F]'} ${e.product.public_data?.name?.slice(0, 28)}`).join(' ; ')}`);
  }

  const liveLines = [
    ...(f1 || []).filter((p) => p.available === true).slice(0, 2).map((p) => ({ sku_id: String(p.id), distributor: 'fitness1', name: p.product_name })),
    ...(f1 || []).filter((p) => p.available !== true).slice(0, 1).map((p) => ({ sku_id: String(p.id), distributor: 'fitness1', name: p.product_name })),
    ...(sila || []).slice(0, 2).map((p) => ({ sku_id: p.id, barcode: p.barcode, distributor: 'sila', name: p.product_name })),
  ];
  const live = await timed('жива проверка (5 реда)', () => checkLiveStock(liveLines, { f1Key, silaToken }));
  show('жива проверка', live?.results);
}

async function diagnoseWorkerLiveStock() {
  section('ЖИВА ПРОВЕРКА ОТ CLOUDFLARE WORKER');
  const base = process.env.WORKER_URL || 'https://port.radilov-k.workers.dev';
  if (!process.env.ADMIN_PASSWORD) { console.log('Няма ADMIN_PASSWORD'); return; }
  const login = await fetch(`${base}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }) });
  const { token } = await login.json().catch(() => ({}));
  if (!token) { console.log(`вход: HTTP ${login.status}`); return; }
  const f1 = f1Key ? await fetchFitness1Products(f1Key) : [];
  const sila = silaToken ? await fetchSilaProducts(silaToken) : [];
  const qs = [
    ...f1.filter((p) => p.available === true).slice(0, 2).map((p) => `sku=${p.id}`),
    ...sila.slice(0, 2).map((p) => `ean=${p.barcode}`),
  ].join('&');
  const res = await fetch(`${base}/portfolio/diagnostics/live-stock?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  console.log(`HTTP ${res.status}`);
  show('от worker-а', await res.json().catch(() => null));
}

const normBrand = (b) => String(b || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9а-я]/g, '');
const UNIT = /\b\d+([.,]\d+)?\s*(caps?|capsules?|softgels?|soft|vcaps?|tabs?|tablets?|serv\w*|g|gr|kg|ml|l|lbs?|mg|mcg|iu|pcs|x)\b\.?/gi;
function nameTokens(name, brand) {
  const b = normBrand(brand);
  return new Set(String(name || '').toLowerCase()
    .replace(/\[.*?\]|\(.*?\)/g, ' ')
    .replace(UNIT, ' ')
    .split(/[^a-z0-9а-я+%]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !/^\d+$/.test(t) && normBrand(t) !== b && !['with', 'and', 'for', 'the', 'от', 'за', 'със', 'с', 'и'].includes(t)));
}
const jaccard = (a, b) => { let i = 0; for (const t of a) if (b.has(t)) i += 1; return i / Math.max(1, a.size + b.size - i); };

async function diagnoseRound4() {
  section('ROUND 4: ДУБЛИ МЕЖДУ ДОСТАВЧИЦИТЕ И ПРОМОЦИИ');
  const settings = mergeSettingsForCatalogSync(DEFAULT_SETTINGS, (await kvGet('portfolio_settings')) || {});
  show('ценова политика (KV)', settings.pricing_policy || { standard_mode: settings.standard_mode, below_regular_percent: settings.below_regular_percent, min_profit_eur: settings.min_profit_eur });
  show('настройки на консултанта (KV)', ((await kvGet('portfolio_advisor_settings')) || {}).commerce || '(по подразбиране)');
  const f1 = await fetchFitness1Products(f1Key);
  const sila = await fetchSilaProducts(silaToken);
  const f1Avail = f1.filter((p) => p.available === true);
  console.log(`Fitness1 налични SKU: ${f1Avail.length}; с баркод: ${f1Avail.filter((p) => String(p.barcode || '').trim()).length}`);
  console.log(`Sila налични SKU: ${sila.length}; с баркод: ${sila.filter((p) => String(p.barcode || '').trim()).length}`);

  const merged = mergeCatalogProducts(f1, sila);
  const groups = groupRawProducts(merged, settings);
  const f1Groups = groups.filter((g) => Number(g.group_id) < 90000000);
  const silaGroups = groups.filter((g) => Number(g.group_id) >= 90000000 && g.variants.some((v) => v.available));
  const byBrand = new Map();
  for (const g of f1Groups) {
    const k = normBrand(g.brand);
    if (!byBrand.has(k)) byBrand.set(k, []);
    byBrand.get(k).push({ g, tokens: nameTokens(g.name, g.brand) });
  }
  let sameBrand = 0;
  const matches = [];
  for (const sg of silaGroups) {
    const cands = byBrand.get(normBrand(sg.brand)) || [];
    if (cands.length) sameBrand += 1;
    const st = nameTokens(sg.name, sg.brand);
    let best = null;
    for (const c of cands) {
      const j = jaccard(st, c.tokens);
      if (!best || j > best.j) best = { j, c };
    }
    if (best && best.j >= 0.5) matches.push({ sg, fg: best.c.g, j: best.j });
  }
  console.log(`Sila групи (налични) след сливането: ${silaGroups.length}; с марка, която я има и във Fitness1: ${sameBrand}; останали кандидати по име (Jaccard ≥0.5, за ръчна проверка): ${matches.length}`);
  const buckets = { '0.5-0.6': 0, '0.6-0.75': 0, '0.75-1': 0, '1': 0 };
  for (const m of matches) buckets[m.j === 1 ? '1' : m.j >= 0.75 ? '0.75-1' : m.j >= 0.6 ? '0.6-0.75' : '0.5-0.6'] += 1;
  show('по сходство', buckets);
  for (const m of matches.sort((a, b) => a.j - b.j).filter((_, i) => i % Math.max(1, Math.floor(matches.length / 30)) === 0).slice(0, 30)) {
    const sMin = Math.min(...m.sg.variants.filter((v) => v.available).map((v) => v.b2b_price || 999));
    const fMin = Math.min(...m.fg.variants.filter((v) => v.available).map((v) => v.b2b_price || 999));
    console.log(`  ${m.j.toFixed(2)} | S: ${m.sg.brand} ${m.sg.name.slice(0, 40)} (${m.sg.variants.length} вар., b2b ${sMin}) | F: ${m.fg.name.slice(0, 40)} (${m.fg.variants.length} вар., b2b ${fMin === 999 ? 'изч.' : fMin})`);
  }

  section('ROUND 4: ПРОМОЦИИ ПРИ FITNESS1');
  const f1Vars = f1Groups.flatMap((g) => g.variants).filter((v) => v.available && v.distributor !== 'sila');
  const modes = {};
  for (const v of f1Vars) modes[v.pricing_mode] = (modes[v.pricing_mode] || 0) + 1;
  show('режим на цената (налични варианти Fitness1)', modes);
  const onF1Sale = f1Avail.filter((p) => Number(p.sale_price) > 0);
  console.log(`Fitness1 SKU с промо цена при Fitness1 (sale_price): ${onF1Sale.length}`);
  const pricier = f1Vars.filter((v) => Number(v.f1_reference_price) > 0 && v.retail_price > Number(v.f1_reference_price) + 0.005);
  console.log(`варианти, където НИЕ сме по-скъпи от клиентската цена на Fitness1: ${pricier.length}`);
  const lowProfit = f1Vars.filter((v) => v.b2b_price > 0 && (v.retail_price - v.b2b_price) / v.retail_price < 0.10);
  console.log(`варианти с печалба <10% от продажната цена: ${lowProfit.length} (от тях f1_promo/floor: ${lowProfit.filter((v) => ['f1_promo', 'floor'].includes(v.pricing_mode)).length})`);
  for (const v of onF1Sale.slice(0, 5)) console.log(`  ${v.product_name?.slice(0, 40)} | regular ${v.regular_price} sale ${v.sale_price} b2b ${v.b2b_price}`);

  section('ROUND 4: SILA ПРОМОЦИИ');
  const sKeys = new Set();
  sila.slice(0, 50).forEach((p) => Object.keys(p).forEach((k) => sKeys.add(k)));
  console.log(`полета след нормализация: ${[...sKeys].join(', ')}`);
  const silaRaw = await silaGet('product', { method: 'POST', body: JSON.stringify({ brand_id: 0, model_id: 0, taste_id: 0, size_id: 0 }) });
  const rows = listFrom(silaRaw.data).filter((r) => String(r.available) === '1');
  const disc = rows.map((r) => (Number(r.regular_price) - Number(r.partner_price)) / Number(r.regular_price) * 100).filter((x) => Number.isFinite(x));
  const hist = {};
  for (const d of disc) { const b = `${Math.floor(d / 5) * 5}%`; hist[b] = (hist[b] || 0) + 1; }
  show('partner_price спрямо regular_price (налични)', hist);
}

for (const fn of [diagnoseRound4]) {
  try { await fn(); } catch (e) { console.log(`!!! ${fn.name}: ${e.stack || e.message}`); }
}
