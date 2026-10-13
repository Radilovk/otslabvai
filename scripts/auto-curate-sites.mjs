/**
 * Автоматичен подбор на продукти с висок марж (без промоция) от B2B каталога
 * за daotslabna (main) и Life Protocols (life). Вж. catalog-auto-curate.js за правилата.
 *
 * Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID (задължителни),
 *      FITNESS1_API_KEY (по избор — описания на продуктите),
 *      MODE=dry-run|apply (по подразбиране dry-run), PROJECTS=main,life
 *
 * apply: записва резервно копие `<ключ>_backup_<време>` преди промяната.
 */
import { kvGet, kvPut } from '../catalog-kv-client.mjs';
import { SITE_CONTENT_KEYS } from '../portfolio-site-products.js';
import { mergeProductsIntoContent } from '../portfolio-import.js';
import { fetchDescriptionMap } from '../portfolio-api.js';
import { shortlistCurationCandidates, finalizeCurationPicks, countExistingBySlot, CURATION_SLOTS } from '../catalog-auto-curate.js';

const MODE = process.env.MODE === 'apply' ? 'apply' : 'dry-run';
const PROJECTS = String(process.env.PROJECTS || 'main,life').split(',').map((s) => s.trim()).filter(Boolean);

async function loadGroups(meta, ids) {
  const byChunk = new Map();
  for (const id of ids) {
    const chunk = meta.lookup?.[id];
    if (chunk == null) continue;
    if (!byChunk.has(chunk)) byChunk.set(chunk, new Set());
    byChunk.get(chunk).add(String(id));
  }
  const groups = new Map();
  for (const [chunk, wanted] of byChunk) {
    const data = await kvGet(`portfolio_chunk_${chunk}`);
    for (const g of Array.isArray(data) ? data : []) {
      if (wanted.has(String(g.group_id))) groups.set(String(g.group_id), g);
    }
  }
  return groups;
}

async function main() {
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error('Липсват CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID.');
  }
  const meta = await kvGet('portfolio_meta');
  if (!meta?.index?.length) throw new Error('portfolio_meta липсва или е празен.');
  if (!meta.index.some((e) => Number(e.max_margin) > 0)) {
    throw new Error('Индексът няма данни за марж — подборът по печалба е невъзможен.');
  }

  const descriptions = process.env.FITNESS1_API_KEY
    ? await fetchDescriptionMap(process.env.FITNESS1_API_KEY)
    : new Map();
  console.log(`Режим: ${MODE}. Каталог: ${meta.index.length} групи. Описания: ${descriptions.size}.`);

  for (const project of PROJECTS) {
    const keys = SITE_CONTENT_KEYS[project];
    if (!keys) { console.warn(`Непознат проект: ${project}`); continue; }
    const content = (await kvGet(keys.kvKey)) || (await kvGet(keys.fallback));
    if (!content?.page_content) { console.warn(`${project}: няма съдържание`); continue; }

    const slots = CURATION_SLOTS[project] || [];
    const existing = countExistingBySlot(content, slots);
    const shortlist = shortlistCurationCandidates(meta.index, project, content);
    const groups = await loadGroups(meta, shortlist.flatMap((s) => s.candidates.map((c) => String(c.entry.group_id))));
    const { picks, rejected } = finalizeCurationPicks(shortlist, groups, descriptions);

    console.log(`\n=== ${project}: ${picks.length} нови продукта ===`);
    console.log('място | доказателства | вече има | цел | добавени');
    for (const slot of slots) {
      const added = picks.filter((p) => p.slot.key === slot.key).length;
      console.log([slot.key, slot.evidenceLevel, existing.get(slot.key) || 0, slot.target, added].join(' | '));
    }
    console.log('\nмясто | цена € | печалба € | печалба % | марка | продукт');
    for (const p of picks) {
      console.log([p.slot.key, p.price.toFixed(2), p.profit.eur.toFixed(2), p.profit.pct.toFixed(1), p.entry.brand, p.entry.name].join(' | '));
    }
    if (rejected.length) {
      console.log(`\nотхвърлени при проверка с описанието (${rejected.length}):`);
      for (const r of rejected.slice(0, 30)) console.log(`  ${r.slot} | ${r.reason} | ${r.name}`);
    }
    if (!picks.length || MODE !== 'apply') continue;

    const byCategory = new Map();
    for (const p of picks) {
      const key = p.slot.category.id;
      if (!byCategory.has(key)) byCategory.set(key, { category: p.slot.category, products: [] });
      byCategory.get(key).products.push(p.product);
    }

    const backupKey = `${keys.kvKey}_backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    await kvPut(backupKey, content);
    console.log(`Резервно копие: ${backupKey}`);

    for (const { category, products } of byCategory.values()) {
      const res = mergeProductsIntoContent(content, { categoryId: category.id, categoryTitle: category.title, products });
      console.log(`  ${category.title}: +${res.added} (обновени ${res.updated})${res.createdCategory ? ' — нова категория' : ''}`);
    }
    await kvPut(keys.kvKey, content);
    console.log(`${project}: записано в ${keys.kvKey}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
