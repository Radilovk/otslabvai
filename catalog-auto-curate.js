/**
 * Автоматичен подбор на продукти от B2B каталога за daotslabna (main) и Life Protocols (life).
 *
 * Правила (твърди, без AI):
 *  - наличен, марж ≥ прага (margin_eligible), БЕЗ промоция при доставчика (has_promo);
 *  - попада в нишата (слот) на сайта по категория/име;
 *  - не е вече на сайта (по group_id или SKU на вариант);
 *  - класиране: печалба € → печалба % → по-ниска цена; до 2 продукта от марка в слот;
 *  - всеки слот има целеви брой — повторно пускане само допълва липсващите.
 *
 * Чисти функции — ползват се от scripts/auto-curate-sites.mjs (GitHub Actions с пълния каталог).
 */

import { portfolioGroupToSiteProduct } from './portfolio-import.js';

const norm = (s) => String(s || '').toLowerCase();

/** @typedef {{ key: string, category: { id: string, title: string }, target: number, goals: string[],
 *   match: (e: object) => boolean, maxPrice?: number, minPrice?: number }} CurationSlot */

const pathOf = (e) => norm((e.category_path || []).join(' > ') || e.category);
const nameOf = (e) => norm(`${e.name} ${e.search_text || ''}`);
const has = (text, words) => words.some((w) => text.includes(w));

const MAIN_CATS = {
  stimFree: { id: 'stim-free-weight-loss', title: 'Отслабване без стимуланти' },
  appetite: { id: 'appetite-control', title: 'Контрол на апетита и ситост' },
  water: { id: 'water-detox', title: 'Отводняване и детокс' },
  protein: { id: 'diet-protein', title: 'Протеин при диета' },
};

/** @type {CurationSlot[]} */
export const MAIN_SLOTS = [
  {
    key: 'stim_free_burner',
    category: MAIN_CATS.stimFree,
    target: 4,
    goals: ['weight-loss', 'fat-burning', 'stimulant-free'],
    match: (e) => pathOf(e).includes('фетбърнъри без стимуланти'),
  },
  {
    key: 'cla',
    category: MAIN_CATS.stimFree,
    target: 2,
    goals: ['weight-loss', 'fat-metabolism', 'stimulant-free'],
    match: (e) => pathOf(e).startsWith('отслабване и контрол на теглото > cla'),
  },
  {
    key: 'carnitine',
    category: MAIN_CATS.stimFree,
    target: 2,
    goals: ['weight-loss', 'fat-metabolism', 'stimulant-free'],
    // ALCAR е за мозък, не за отслабване
    match: (e) => pathOf(e).includes('l-карнитин') && !pathOf(e).includes('ацетил') && !has(nameOf(e), ['acetyl', 'alcar']),
  },
  {
    key: 'appetite',
    category: MAIN_CATS.appetite,
    target: 3,
    goals: ['appetite-control', 'weight-loss'],
    match: (e) => has(pathOf(e), ['потискане на апетита', 'гарциния'])
      || has(nameOf(e), ['glucomannan', 'глюкоманан', 'konjac']),
  },
  {
    key: 'fiber',
    category: MAIN_CATS.appetite,
    target: 2,
    goals: ['satiety', 'digestion'],
    match: (e) => pathOf(e).includes('микробиом и храносмилане > фибри'),
  },
  {
    key: 'carb_metabolism',
    category: MAIN_CATS.appetite,
    target: 2,
    goals: ['blood-sugar', 'cravings'],
    maxPrice: 35,
    match: (e) => pathOf(e).includes('въглехидратния метаболизъм')
      || (pathOf(e).startsWith('минерали > хром')),
  },
  {
    key: 'diuretic',
    category: MAIN_CATS.water,
    target: 2,
    goals: ['water-retention', 'detox'],
    match: (e) => has(pathOf(e), ['отслабване и контрол на теглото > диуретици', 'ябълков оцет']),
  },
  {
    key: 'diet_protein',
    category: MAIN_CATS.protein,
    target: 2,
    goals: ['satiety', 'muscle-retention'],
    minPrice: 15,
    match: (e) => (e.category_top === 'Протеини')
      && has(pathOf(e), ['изолат', 'хидролизиран', 'растителни протеини'])
      && !has(nameOf(e), ['gainer', 'гейнър', 'mass']),
  },
];

const LIFE_CATS = {
  longevity: { id: 'health-longevity', title: 'Здраве и дълголетие' },
  beauty: { id: 'anti-aging-beauty', title: 'Антиейджинг и Красота' },
  brain: { id: 'brain-cognition', title: 'Мозъчна дейност' },
};

/** @type {CurationSlot[]} */
export const LIFE_SLOTS = [
  {
    key: 'longevity',
    category: LIFE_CATS.longevity,
    target: 5,
    goals: ['longevity', 'anti-aging'],
    match: (e) => e.category_top === 'Дълголетие / Anti-Aging',
  },
  {
    key: 'antioxidant',
    category: LIFE_CATS.longevity,
    target: 3,
    goals: ['longevity', 'energy', 'antioxidant'],
    match: (e) => e.category_top === 'Антиоксиданти'
      && has(pathOf(e), ['коензим', 'ресвератрол', 'кверцетин', 'астаксантин', 'алфа липоева', 'убиквинол']),
  },
  {
    key: 'omega3',
    category: LIFE_CATS.longevity,
    target: 2,
    goals: ['cardio', 'cognition', 'longevity'],
    match: (e) => has(pathOf(e), ['висококонцентрирано рибено масло', 'крилово масло', 'омега-3 от водорасли']),
  },
  {
    key: 'sleep',
    category: LIFE_CATS.longevity,
    target: 2,
    goals: ['sleep', 'stress', 'recovery'],
    match: (e) => has(pathOf(e), ['магнезиев бисглицинат', 'магнезиев треонат', 'сън, стрес и релакс > в подкрепа на съня', 'ашваганда ksm-66']),
  },
  {
    key: 'collagen',
    category: LIFE_CATS.beauty,
    target: 3,
    goals: ['skin', 'joints', 'anti-aging'],
    match: (e) => pathOf(e).includes('красота и подмладяване > колаген'),
  },
  {
    key: 'skin',
    category: LIFE_CATS.beauty,
    target: 2,
    goals: ['skin', 'hair-nails'],
    match: (e) => has(pathOf(e), ['хиалуронова', 'биотин', 'витамини за коса', 'в подкрепа на кожата'])
      && !has(nameOf(e), ['целулит', 'cellulite']),
  },
  {
    key: 'cognition',
    category: LIFE_CATS.brain,
    target: 5,
    goals: ['cognition', 'focus', 'memory'],
    match: (e) => has(pathOf(e), ['формули за памет и фокус', 'lion', 'бакопа', 'гинкго'])
      && !has(nameOf(e), ['men\'s', 'for men', 'за мъже']),
  },
];

export const CURATION_SLOTS = { main: MAIN_SLOTS, life: LIFE_SLOTS };

const DEFAULT_PRICE = { min: 8, max: 80 };
const MAX_PER_BRAND_IN_SLOT = 2;

/** Печалба в € и % от индекса (налични само в пълния каталог — не в публичния). */
export function entryProfit(entry) {
  const eur = Number(entry.max_margin) || 0;
  const pctOnB2b = Number(entry.max_margin_pct) || 0;
  // max_margin_pct е марж върху доставната цена → печалба като % от продажната
  const pctOnRetail = pctOnB2b > 0 ? (pctOnB2b / (100 + pctOnB2b)) * 100 : 0;
  return { eur, pct: Math.round(pctOnRetail * 10) / 10 };
}

export function entryPrice(entry) {
  return Number(entry.min_client_price) || Number(entry.min_price) || 0;
}

const STIMULANT_WORDS = ['guarana', 'гуарана', 'caffeine', 'кофеин', 'synephrine', 'синефрин', 'yohimb', 'йохимб', 'ephedr', 'ефедр', 'hardcore', 'хардкор'];

/** Категориите на доставчика не са надеждни: „без стимуланти“ понякога съдържа гуарана. */
function violatesSlot(entry, slot) {
  return slot.goals.includes('stimulant-free') && has(nameOf(entry), STIMULANT_WORDS);
}

export function isCurationEligible(entry) {
  return entry.available !== false
    && entry.margin_eligible !== false
    && !entry.has_promo;
}

/** group_id-та и SKU-та, които вече са на сайта (импортирани или вързани ръчно). */
export function collectSiteCatalogRefs(pageContent) {
  const groupIds = new Set();
  const skus = new Set();
  const names = new Set();
  for (const comp of pageContent?.page_content || []) {
    if (comp.type !== 'product_category' || !Array.isArray(comp.products)) continue;
    for (const p of comp.products) {
      const gid = p.system_data?.portfolio?.group_id;
      if (gid) groupIds.add(String(gid));
      for (const v of p.public_data?.variants || []) if (v?.sku) skus.add(String(v.sku));
      if (p.public_data?.name) names.add(norm(p.public_data.name));
    }
  }
  return { groupIds, skus, names };
}

/** Колко продукта вече има сайтът във всеки слот (от предишно пускане). */
function countExistingBySlot(pageContent) {
  const counts = new Map();
  for (const comp of pageContent?.page_content || []) {
    for (const p of comp.products || []) {
      const slot = p.system_data?.curation?.slot;
      if (slot && Number(p.system_data?.inventory) > 0) counts.set(slot, (counts.get(slot) || 0) + 1);
    }
  }
  return counts;
}

/**
 * @param {object[]} index - meta.index от пълния каталог
 * @param {'main'|'life'} project
 * @param {object} pageContent - текущото съдържание на сайта
 * @param {{ slots?: CurationSlot[] }} [opts]
 * @returns {{ slot: CurationSlot, entry: object, profit: {eur:number,pct:number}, price: number }[]}
 */
export function selectCurationCandidates(index, project, pageContent, opts = {}) {
  const slots = opts.slots || CURATION_SLOTS[project] || [];
  const { groupIds, skus, names } = collectSiteCatalogRefs(pageContent);
  const existing = countExistingBySlot(pageContent);
  const taken = new Set();
  const picks = [];

  for (const slot of slots) {
    const need = slot.target - (existing.get(slot.key) || 0);
    if (need <= 0) continue;
    const minPrice = slot.minPrice ?? DEFAULT_PRICE.min;
    const maxPrice = slot.maxPrice ?? DEFAULT_PRICE.max;

    const pool = (index || [])
      .filter((e) => isCurationEligible(e) && slot.match(e) && !violatesSlot(e, slot))
      .filter((e) => !groupIds.has(String(e.group_id)) && !taken.has(String(e.group_id)))
      .filter((e) => !skus.has(String(e.default_sku_id)) && !names.has(norm(e.name)))
      .filter((e) => {
        const price = entryPrice(e);
        return price >= minPrice && price <= maxPrice;
      })
      .map((e) => ({ entry: e, profit: entryProfit(e), price: entryPrice(e) }))
      .sort((a, b) => (b.profit.eur - a.profit.eur)
        || (b.profit.pct - a.profit.pct)
        || (a.price - b.price));

    const perBrand = new Map();
    let added = 0;
    for (const cand of pool) {
      if (added >= need) break;
      const brand = norm(cand.entry.brand);
      if ((perBrand.get(brand) || 0) >= MAX_PER_BRAND_IN_SLOT) continue;
      perBrand.set(brand, (perBrand.get(brand) || 0) + 1);
      taken.add(String(cand.entry.group_id));
      picks.push({ slot, ...cand });
      added += 1;
    }
  }

  return picks;
}

/**
 * Каталожна група → продукт за сайта, с цели за консултанта и маркер за слота.
 * @param {object} group - пълната каталожна група (с варианти)
 * @param {CurationSlot} slot
 * @param {{ description?: string }} [extra]
 */
export function curatedGroupToSiteProduct(group, slot, extra = {}) {
  const product = portfolioGroupToSiteProduct(extra.description ? { ...group, description: extra.description } : group);
  product.system_data.goals = [...slot.goals];
  product.system_data.curation = { slot: slot.key, curated_at: new Date().toISOString() };
  return product;
}
