/**
 * Автоматичен подбор на продукти от B2B каталога за daotslabna (main) и Life Protocols (life).
 *
 * Каталогът на сайта трябва да покрива ролите (слотовете), които консултантът търси за целите и симптомите
 * на сайта — иначе пакетите излизат от 1–2 продукта. Затова всяко място в плана е:
 *   слот (advisor-product-facts) + активно вещество с доказан ефект за ролята + целеви брой + ценови диапазон.
 *
 * Твърди правила (без AI):
 *  - наличен, марж ≥ прага (margin_eligible), БЕЗ промоция при доставчика (has_promo);
 *  - добавка за възрастен (не аксесоар/храна/детско/мостра), в правилния слот;
 *  - активното вещество е в списъка с доказан ефект за ролята (име/категория/съставки);
 *  - без стимуланти (кофеин се проверява и в описанието — след зареждане на групата);
 *  - не е вече на сайта; вече наличните продукти в слота се броят към целта;
 *  - класиране: печалба € → печалба % → по-ниска цена; 1 продукт от марка в място (разнообразие);
 *  - повторно пускане само допълва липсващите.
 *
 * Чисти функции — ползват се от scripts/auto-curate-sites.mjs (GitHub Actions с пълния каталог).
 */

import { portfolioGroupToSiteProduct } from './portfolio-import.js';
import { getProductFacts } from './advisor-product-facts.js';
import { productMatchesAnyKeyword } from './text-match.js';

const norm = (s) => String(s || '').toLowerCase();

/**
 * @typedef {{ key: string, slots: string[], category: { id: string, title: string }, target: number,
 *   goals: string[], evidence: string[], evidenceLevel: string, avoid?: string[],
 *   allowStimulant?: boolean, minPrice?: number, maxPrice?: number, note?: string }} CurationSlot
 */

/** Слаби или съмнителни съставки — не влизат, дори да са в правилната категория. */
const GLOBAL_AVOID = [
  'raspberry ketone', 'малинови кетони', 'hcg', 'vanadyl', 'ванадил', 'гугулстерон', 'guggul',
  'dmaa', 'dmha', 'ephedr', 'ефедр', 'yohimb', 'йохимб', 'anabolic', 'анабол', 'prohormone', 'прохормон',
  'detox tea', 'детокс чай', 'homeopath', 'хомеопат', 'sauna', 'сауна', 'cream', 'крем', 'gel$', 'гел$',
];

const OMEGA_EVIDENCE = ['omega 3', 'омега 3', 'fish oil', 'рибено', 'epa', 'dha', 'krill', 'крил', 'algae', 'водорасли'];
const JOINT_EVIDENCE = ['glucosamine', 'глюкозамин', 'chondroitin', 'хондроитин', 'msm', 'uc ii', 'boswellia', 'босвелия', 'collagen', 'колаген', 'curcumin', 'куркум'];

const MAIN_CATS = {
  stimFree: { id: 'stim-free-weight-loss', title: 'Отслабване без стимуланти' },
  appetite: { id: 'appetite-control', title: 'Контрол на апетита и ситост' },
  protein: { id: 'diet-protein', title: 'Протеин и заместители на хранене' },
  support: { id: 'diet-support', title: 'Подкрепа при диета: витамини, сън, стави' },
};

/** @type {CurationSlot[]} */
export const MAIN_SLOTS = [
  {
    key: 'appetite_fiber',
    slots: ['appetite'],
    category: MAIN_CATS.appetite,
    target: 4,
    goals: ['appetite-control', 'satiety', 'weight-loss', 'stimulant-free'],
    evidence: ['glucomannan', 'глюкоманан', 'konjac', 'конжак', 'psyllium', 'псилиум', 'fiber', 'фибри', 'inulin', 'инулин'],
    evidenceLevel: 'висока',
    note: 'Глюкоманан 3 г/ден при хранителен дефицит — одобрена здравна претенция (EFSA); фибрите удължават ситостта.',
  },
  {
    key: 'meal_replacement',
    slots: ['meal'],
    category: MAIN_CATS.protein,
    target: 2,
    goals: ['satiety', 'weight-loss', 'meal-replacement'],
    evidence: ['meal', 'заместител', 'shake', 'шейк', 'diet', 'диет'],
    evidenceLevel: 'висока',
    note: 'Заместване на 1–2 хранения при нискокалоричен режим — одобрена здравна претенция (EFSA).',
  },
  {
    key: 'diet_protein',
    slots: ['protein'],
    category: MAIN_CATS.protein,
    target: 3,
    goals: ['satiety', 'muscle-retention', 'weight-loss'],
    evidence: ['isolate', 'изолат', 'hydrolyz', 'хидролиз', 'whey', 'суроват', 'plant', 'растител', 'vegan', 'веган', 'pea', 'грах'],
    avoid: ['gainer', 'гейнър', 'mass', 'bar$', 'бар$'],
    evidenceLevel: 'висока',
    minPrice: 15,
    maxPrice: 60,
    note: 'Повече протеин при дефицит пази мускулите и засища.',
  },
  {
    key: 'stim_free_core',
    slots: ['fat_burner_nonstim', 'cla', 'carnitine'],
    category: MAIN_CATS.stimFree,
    target: 4,
    goals: ['weight-loss', 'fat-metabolism', 'stimulant-free'],
    evidence: ['green tea', 'зелен чай', 'egcg', 'capsaicin', 'капсаицин', 'cayenne', 'лют червен пипер', 'cla', 'carnitine', 'карнитин', 'lipotropic', 'липотроп', 'choline', 'холин', 'chromium', 'хром'],
    evidenceLevel: 'ниска',
    note: 'Основен продукт за клиенти без стимуланти (хипертония, чувствителност). Ефектът е малък — подкрепа, не заместител на дефицита.',
  },
  {
    key: 'blood_sugar',
    slots: ['glucose'],
    category: MAIN_CATS.appetite,
    target: 2,
    goals: ['blood-sugar', 'cravings', 'weight-loss'],
    evidence: ['berberine', 'берберин', 'chromium', 'хром', 'cinnamon', 'канела', 'gymnema', 'гимнема'],
    evidenceLevel: 'умерена',
    maxPrice: 40,
    note: 'Берберин и хром — умерени доказателства за кръвната захар и апетита за сладко.',
  },
  {
    key: 'multivitamin',
    slots: ['multivitamin'],
    category: MAIN_CATS.support,
    target: 3,
    goals: ['micronutrients', 'energy'],
    evidence: ['multi', 'мулти', 'vitamins', 'витамини'],
    avoid: ['kids', 'детск', 'pack$', 'пак$'],
    evidenceLevel: 'умерена',
    maxPrice: 35,
    note: 'При калориен дефицит покрива рисковите микроелементи.',
  },
  {
    key: 'omega3',
    slots: ['omega3'],
    category: MAIN_CATS.support,
    target: 2,
    goals: ['cardio', 'inflammation'],
    evidence: OMEGA_EVIDENCE,
    avoid: ['3 6 9'],
    evidenceLevel: 'висока',
    maxPrice: 40,
  },
  {
    key: 'magnesium_sleep',
    slots: ['magnesium', 'sleep'],
    category: MAIN_CATS.support,
    target: 3,
    goals: ['sleep', 'cramps', 'stress'],
    evidence: ['magnesium', 'магнезий', 'melatonin', 'мелатонин', 'glycine', 'глицин', 'theanine', 'теанин', 'ashwagandha', 'ашваганда'],
    evidenceLevel: 'умерена',
    maxPrice: 35,
    note: 'Сънят влияе на апетита; магнезий при крампи и лош сън.',
  },
  {
    key: 'joints',
    slots: ['joint', 'collagen'],
    category: MAIN_CATS.support,
    target: 2,
    goals: ['joints', 'mobility'],
    evidence: JOINT_EVIDENCE,
    evidenceLevel: 'умерена',
    maxPrice: 45,
    note: 'За клиенти с болки в ставите при движение (въпрос в консултанта).',
  },
  {
    key: 'energy_b',
    slots: ['b_complex', 'iron'],
    category: MAIN_CATS.support,
    target: 2,
    goals: ['energy', 'fatigue'],
    evidence: ['b complex', 'б комплекс', 'b 50', 'b 100', 'b12', 'b 12', 'iron', 'желязо', 'bisglycinate', 'бисглицинат'],
    evidenceLevel: 'умерена',
    maxPrice: 30,
    note: 'При умора — витамини B и желязо (за жени).',
  },
];

const LIFE_CATS = {
  longevity: { id: 'health-longevity', title: 'Здраве и дълголетие' },
  beauty: { id: 'anti-aging-beauty', title: 'Антиейджинг и Красота' },
  brain: { id: 'brain-cognition', title: 'Мозъчна дейност' },
  sleep: { id: 'sleep-stress', title: 'Сън и стрес' },
  energy: { id: 'energy-vitality', title: 'Енергия и виталност' },
  joints: { id: 'joints-mobility', title: 'Стави и подвижност' },
};

/** @type {CurationSlot[]} */
export const LIFE_SLOTS = [
  {
    key: 'nad_longevity',
    slots: ['longevity'],
    category: LIFE_CATS.longevity,
    target: 4,
    goals: ['longevity', 'anti-aging', 'cellular-energy'],
    evidence: ['nmn', 'nicotinamide', 'никотинамид', 'nad', 'nr$', 'riboside', 'pqq', 'spermidine', 'спермидин', 'glutathione', 'глутатион', 'resveratrol', 'ресвератрол', 'fisetin', 'физетин', 'urolithin', 'уролитин'],
    evidenceLevel: 'ниска',
    maxPrice: 70,
    note: 'Нишата на сайта; доказателствата при хора са ранни — продават се като допълнение, не като основа.',
  },
  {
    key: 'coq10',
    slots: ['coq10'],
    category: LIFE_CATS.longevity,
    target: 2,
    goals: ['cellular-energy', 'cardio', 'statins'],
    evidence: ['coq10', 'co q10', 'q10', 'ubiquinol', 'убихинол', 'коензим'],
    evidenceLevel: 'умерена',
    maxPrice: 50,
    note: 'Задължителен при статини (консултантът го добавя автоматично).',
  },
  {
    key: 'omega3',
    slots: ['omega3'],
    category: LIFE_CATS.longevity,
    target: 3,
    goals: ['cardio', 'cognition', 'longevity'],
    evidence: OMEGA_EVIDENCE,
    avoid: ['3 6 9', 'kids'],
    evidenceLevel: 'висока',
    maxPrice: 45,
    note: 'Включително веган омега-3 от водорасли.',
  },
  {
    key: 'vitamin_d',
    slots: ['vitamin_d'],
    category: LIFE_CATS.longevity,
    target: 2,
    goals: ['bones', 'immunity', 'longevity'],
    evidence: ['vitamin d', 'витамин d', 'витамин д', 'd3'],
    evidenceLevel: 'висока',
    maxPrice: 30,
    note: 'Широко разпространен дефицит, особено 50+.',
  },
  {
    key: 'multivitamin_50',
    slots: ['multivitamin', 'womens', 'mens'],
    category: LIFE_CATS.longevity,
    target: 3,
    goals: ['micronutrients', 'longevity'],
    evidence: ['multi', 'мулти', '50', 'menopause', 'менопауза', 'women', 'жени', 'men', 'мъже'],
    avoid: ['kids', 'детск', 'testosterone', 'тестостерон', 'pack$', 'пак$'],
    evidenceLevel: 'умерена',
    maxPrice: 45,
    note: 'Формули за жени и мъже 50+; менопауза.',
  },
  {
    key: 'antioxidant',
    slots: ['antioxidant'],
    category: LIFE_CATS.longevity,
    target: 3,
    goals: ['antioxidant', 'longevity', 'inflammation'],
    evidence: ['curcumin', 'куркум', 'astaxanthin', 'астаксантин', 'alpha lipoic', 'алфа липоева', 'quercetin', 'кверцетин', 'sulforaphane', 'сулфорафан', 'nac', 'acetyl cysteine', 'ацетилцистеин'],
    evidenceLevel: 'умерена',
    maxPrice: 45,
  },
  {
    key: 'collagen',
    slots: ['collagen'],
    category: LIFE_CATS.beauty,
    target: 3,
    goals: ['skin', 'joints', 'anti-aging'],
    evidence: ['collagen', 'колаген', 'peptan', 'verisol', 'hydrolyz', 'хидролиз'],
    avoid: ['bar$', 'бар$'],
    evidenceLevel: 'умерена',
    maxPrice: 50,
    note: 'Хидролизиран колаген 2,5–10 г/ден — умерени доказателства за еластичност на кожата.',
  },
  {
    key: 'skin',
    slots: ['beauty', 'vitamin_c'],
    category: LIFE_CATS.beauty,
    target: 2,
    goals: ['skin', 'hair-nails'],
    evidence: ['hyaluronic', 'хиалурон', 'vitamin c', 'витамин c', 'витамин ц', 'ceramide', 'керамид'],
    evidenceLevel: 'умерена',
    maxPrice: 35,
  },
  {
    key: 'sleep',
    slots: ['sleep', 'magnesium'],
    category: LIFE_CATS.sleep,
    target: 4,
    goals: ['sleep', 'stress', 'recovery'],
    evidence: ['magnesium', 'магнезий', 'melatonin', 'мелатонин', 'glycine', 'глицин', 'theanine', 'теанин'],
    avoid: ['5 htp', 'tryptophan', 'триптофан'],
    evidenceLevel: 'умерена',
    maxPrice: 35,
    note: 'Магнезиев бисглицинат/треонат, нисък мелатонин, глицин, L-теанин.',
  },
  {
    key: 'adaptogen',
    slots: ['adaptogen'],
    category: LIFE_CATS.sleep,
    target: 2,
    goals: ['stress', 'energy'],
    evidence: ['ashwagandha', 'ашваганда', 'ksm', 'rhodiola', 'родиола'],
    evidenceLevel: 'умерена',
    maxPrice: 35,
    note: 'Ашваганда (стрес, сън) и родиола (умора) — умерени доказателства.',
  },
  {
    key: 'cognition',
    slots: ['cognition'],
    category: LIFE_CATS.brain,
    target: 4,
    goals: ['cognition', 'focus', 'memory'],
    evidence: ['bacopa', 'бакопа', 'citicoline', 'цитиколин', 'cdp', 'lion', 'phosphatidylserine', 'фосфатидилсерин', 'ginkgo', 'гинкго', 'alpha gpc', 'тирозин', 'tyrosine'],
    evidenceLevel: 'умерена',
    maxPrice: 45,
    note: 'Бакопа и цитиколин — умерени доказателства; гинко и лъвска грива — по-слаби.',
  },
  {
    key: 'energy',
    slots: ['b_complex', 'iron', 'creatine'],
    category: LIFE_CATS.energy,
    target: 3,
    goals: ['energy', 'fatigue', 'cognition'],
    evidence: ['b complex', 'б комплекс', 'b 50', 'b 100', 'b12', 'b 12', 'methyl', 'метил', 'iron', 'желязо', 'creatine monohydrate', 'креатин монохидрат', 'creapure'],
    evidenceLevel: 'висока',
    maxPrice: 35,
    note: 'B12 (честа липса след 50), желязо при жени с умора, креатин — мускули и памет при възрастни.',
  },
  {
    key: 'joints',
    slots: ['joint'],
    category: LIFE_CATS.joints,
    target: 3,
    goals: ['joints', 'mobility'],
    evidence: JOINT_EVIDENCE,
    evidenceLevel: 'умерена',
    maxPrice: 45,
  },
];

export const CURATION_SLOTS = { main: MAIN_SLOTS, life: LIFE_SLOTS };

const DEFAULT_PRICE = { min: 8, max: 60 };
const MAX_PER_BRAND_IN_SLOT = 1;
const SHORTLIST_FACTOR = 4;

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

/** Продукт-подобие от записа в индекса (име, категория, разфасовки) — за фактите преди зареждане на групата. */
export function entryAsProduct(entry) {
  return {
    product_id: `prod-pf-${entry.group_id}`,
    public_data: {
      name: entry.name,
      brand: entry.brand,
      price: entryPrice(entry),
      variants: (entry.packs?.length ? entry.packs : ['']).map((pack) => ({ option_name: pack, price: entryPrice(entry), available: true })),
    },
    system_data: {
      goals: entry.goals || [],
      portfolio: { category: (entry.category_path || []).join(' > ') || entry.category, category_top: entry.category_top },
    },
  };
}

export function isCurationEligible(entry) {
  return entry.available !== false
    && entry.margin_eligible !== false
    && !entry.has_promo;
}

function evidenceText(product) {
  const pd = product.public_data || {};
  return [pd.name, pd.tagline, product.system_data?.portfolio?.category, ...(pd.ingredients || []).map((i) => i?.name)]
    .filter(Boolean).join(' ');
}

/**
 * Продуктът подхожда ли на мястото: слот, вид, активно вещество с доказан ефект, без слаби съставки,
 * без стимулант.
 * @returns {string|null} причина за отказ или null
 */
export function curationRejectReason(product, slot) {
  const facts = getProductFacts(product);
  if (facts.kind !== 'supplement') return `не е добавка (${facts.kind})`;
  if (!slot.slots.includes(facts.slot)) return `друг слот (${facts.slot})`;
  if (facts.stimulant && !slot.allowStimulant) return 'стимулант';
  const text = evidenceText(product);
  if (productMatchesAnyKeyword(text, GLOBAL_AVOID)) return 'слаба/съмнителна съставка';
  if (slot.avoid?.length && productMatchesAnyKeyword(text, slot.avoid)) return 'неподходящ вид за мястото';
  if (!productMatchesAnyKeyword(text, slot.evidence)) return 'няма доказано активно вещество за ролята';
  return null;
}

/** group_id-та, SKU-та и имена, които вече са на сайта (импортирани или вързани ръчно). */
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

/** Колко продаваеми продукта вече има сайтът за всяко място (по слот, във видимите категории). */
export function countExistingBySlot(pageContent, slots) {
  const counts = new Map();
  for (const comp of pageContent?.page_content || []) {
    if (comp.type !== 'product_category' || comp.is_hidden) continue;
    for (const p of comp.products || []) {
      if (!(Number(p.system_data?.inventory) > 0) || p.system_data?.margin_eligible === false) continue;
      const curated = p.system_data?.curation?.slot;
      const place = curated
        ? slots.find((s) => s.key === curated)
        : slots.find((s) => s.slots.includes(getProductFacts(p).slot));
      if (place) counts.set(place.key, (counts.get(place.key) || 0) + 1);
    }
  }
  return counts;
}

/**
 * Фаза 1 (само индекс): кандидати по място — повече от нужното, за проверка с пълните данни.
 * @returns {{ slot: CurationSlot, need: number, candidates: { entry: object, profit: {eur:number,pct:number}, price: number }[] }[]}
 */
export function shortlistCurationCandidates(index, project, pageContent, opts = {}) {
  const slots = opts.slots || CURATION_SLOTS[project] || [];
  const { groupIds, skus, names } = collectSiteCatalogRefs(pageContent);
  const existing = countExistingBySlot(pageContent, slots);
  const out = [];

  for (const slot of slots) {
    const need = slot.target - (existing.get(slot.key) || 0);
    if (need <= 0) continue;
    const minPrice = slot.minPrice ?? DEFAULT_PRICE.min;
    const maxPrice = slot.maxPrice ?? DEFAULT_PRICE.max;
    const candidates = (index || [])
      .filter((e) => isCurationEligible(e))
      .filter((e) => !groupIds.has(String(e.group_id)) && !skus.has(String(e.default_sku_id)) && !names.has(norm(e.name)))
      .filter((e) => {
        const price = entryPrice(e);
        return price >= minPrice && price <= maxPrice;
      })
      .filter((e) => !curationRejectReason(entryAsProduct(e), slot))
      .map((e) => ({ entry: e, profit: entryProfit(e), price: entryPrice(e) }))
      .sort((a, b) => (b.profit.eur - a.profit.eur) || (b.profit.pct - a.profit.pct) || (a.price - b.price))
      .slice(0, need * SHORTLIST_FACTOR + 4);
    out.push({ slot, need, candidates });
  }
  return out;
}

/**
 * Фаза 2 (пълни групи с описание): окончателен избор — проверка за скрит кофеин и т.н.,
 * 1 продукт от марка в място, без повторение между местата.
 * @param {ReturnType<typeof shortlistCurationCandidates>} shortlist
 * @param {Map<string, object>} groupsById
 * @param {Map<string, string>} [descriptions]
 */
export function finalizeCurationPicks(shortlist, groupsById, descriptions = new Map()) {
  const taken = new Set();
  const picks = [];
  const rejected = [];
  for (const { slot, need, candidates } of shortlist) {
    const perBrand = new Map();
    let added = 0;
    for (const cand of candidates) {
      if (added >= need) break;
      const gid = String(cand.entry.group_id);
      if (taken.has(gid)) continue;
      const brand = norm(cand.entry.brand);
      if ((perBrand.get(brand) || 0) >= MAX_PER_BRAND_IN_SLOT) continue;
      const group = groupsById.get(gid);
      if (!group) continue;
      const product = curatedGroupToSiteProduct(group, slot, { description: descriptions.get(gid) });
      const reason = curationRejectReason(product, slot);
      if (reason) {
        rejected.push({ slot: slot.key, name: cand.entry.name, reason });
        continue;
      }
      perBrand.set(brand, (perBrand.get(brand) || 0) + 1);
      taken.add(gid);
      picks.push({ slot, product, ...cand });
      added += 1;
    }
  }
  return { picks, rejected };
}

/** Избор само по индекса (без проверка на описанието) — за тестове и бърз преглед. */
export function selectCurationCandidates(index, project, pageContent, opts = {}) {
  const taken = new Set();
  const picks = [];
  for (const { slot, need, candidates } of shortlistCurationCandidates(index, project, pageContent, opts)) {
    const perBrand = new Map();
    let added = 0;
    for (const cand of candidates) {
      if (added >= need) break;
      const gid = String(cand.entry.group_id);
      const brand = norm(cand.entry.brand);
      if (taken.has(gid) || (perBrand.get(brand) || 0) >= MAX_PER_BRAND_IN_SLOT) continue;
      perBrand.set(brand, (perBrand.get(brand) || 0) + 1);
      taken.add(gid);
      picks.push({ slot, ...cand });
      added += 1;
    }
  }
  return picks;
}

/**
 * Каталожна група → продукт за сайта, с цели за консултанта и маркер за мястото.
 * @param {object} group - пълната каталожна група (с варианти)
 * @param {CurationSlot} slot
 * @param {{ description?: string }} [extra]
 */
export function curatedGroupToSiteProduct(group, slot, extra = {}) {
  const product = portfolioGroupToSiteProduct(extra.description ? { ...group, description: extra.description } : group);
  product.system_data.goals = [...slot.goals];
  product.system_data.curation = {
    slot: slot.key,
    evidence: slot.evidenceLevel,
    curated_at: new Date().toISOString(),
  };
  return product;
}
