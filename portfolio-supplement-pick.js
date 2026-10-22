/**
 * Търсеща дума от друго приложение (NutriPlan, AIRIS: „Магнезиев бисглицинат“)
 * → до 3 продукта от каталога на BIOCODE: най-подходящите по вещество и
 * форма, а между еднакво подходящите — тези с най-голям марж.
 *
 * Текстовото търсене само по себе си подвежда („витамин D3“ дава първо
 * D3 + K2, „магнезий“ — алкална смес с натрий), затова за познатите вещества
 * изборът е по правила: думи, които ТРЯБВА да са в името, предпочитана форма,
 * изключени комбинации. За непозната дума — обичайното търсене в каталога,
 * подредено по марж.
 *
 * Маржът се ползва само тук, на сървъра; към клиента не излиза.
 *
 * Внимание: \b в JS без флага u е само за латиница — за кирилица границите
 * на думата са написани изрично (CYR_END).
 */

import { matchesSearchQuery } from './portfolio-search.js';

/**
 * @typedef {{ key: string, match: RegExp, must: RegExp, prefer?: RegExp, avoid?: RegExp, vegan?: RegExp,
 *   forms?: Array<[RegExp, RegExp]> }} SupplementSlot
 * `forms` — форма в търсещата дума → коя форма в името на продукта печели
 * (магнезиев цитрат → цитрат, колаген тип II → тип II).
 * `vegan` — при веганско хранене продуктът трябва да отговаря на този израз
 * (в името); без него — важи общото изключване на животински съставки.
 */

// Напитки и барове с добавено вещество не са добавка.
const NOT_SUPPLEMENT = /water|ready-to-drink|\bcan\b|\bbars?\b|drink|напитка|протеинов бар|cream|крем|lotion|лосион|shampoo|шампоан|soap|сапун|serum|серум|\bgel\b/i;
// Комбиниран продукт. „ / “ в каталога разделя описания („200 mg / Double Strength“), не съставки.
const COMBO = /\+|&|,(?!\d)|\band\b|\bwith\b|\badded\b|\d-in-1|complex|комплекс|formula|формула|multi|мулти|(?<!\p{L})с(?!\p{L})/iu;
// Животински съставки — отпадат при веганско хранене.
const ANIMAL = /collagen|колаген|fish|рибен|krill|крил|gelatin|желатин|bovine|говежд|marine|морск|lanolin|ланолин|colostrum|коластра|колострум/i;
const CYR_END = '(?![а-яё])';

/** @type {SupplementSlot[]} */
export const SUPPLEMENT_SLOTS = [
  {
    key: 'd3k2', match: /d-?3[\s\S]*(k-?2|mk-?7)|(k-?2|mk-?7)[\s\S]*d-?3/i,
    must: /d-?3[\s\S]*(k-?2|mk-?7)|(k-?2|mk-?7)[\s\S]*d-?3/i, avoid: /omega|fish|calcium|калций|multi|мулти/i,
    vegan: /vegan|веган|lichen|лишей/i,
  },
  {
    key: 'vitamin_d', match: /витамин\s*d|vitamin\s*d|(^|[^a-z0-9])d-?3([^0-9]|$)/i, must: /d-?3|vitamin d\b/i,
    avoid: /k-?2|mk-?7|multi|мулти|calcium|калций|complex|omega|fish/i, vegan: /vegan|веган|lichen|лишей/i,
  },
  { key: 'vitamin_k2', match: /витамин\s*k|vitamin\s*k|(^|[^a-z0-9])(k-?2|mk-?7)([^0-9]|$)/i, must: /k-?2|mk-?7/i, avoid: /d-?3|calcium|калций|multi/i },
  { key: 'b12', match: /b-?12/i, must: /b-?12/i, prefer: /methyl|метил/i, avoid: /complex|комплекс|multi|folic|фолиев/i },
  { key: 'b_complex', match: /b[-\s]?комплекс|b[-\s]?complex|група\s*b/i, must: /b[-\s]?complex|b-?50|b-?100|b[-\s]?комплекс/i, avoid: /cal-?mag|calcium|magnes|vitamin c|калций|магнез/i },
  { key: 'folate', match: /фолиев|фолат|folate|folic|mthf/i, must: /folate|folic|mthf|фолиев|фолат/i, prefer: /methyl|mthf|метил/i },
  { key: 'vitamin_c', match: /витамин\s*c|vitamin\s*c/i, must: /vitamin c|витамин c|c-?1000|c-?500|ascorb/i, avoid: /multi|мулти|complex|collagen|колаген|zinc|цинк/i },
  { key: 'vitamin_e', match: /витамин\s*e|vitamin\s*e(?![a-z])/i, must: /vitamin e(?![a-z])|e-?\d{3,4}|tocopher|токофер/i, avoid: /multi|complex/i },
  { key: 'vitamin_a', match: /витамин\s*a|vitamin\s*a(?![a-z])/i, must: /vitamin a(?![a-z])|retinol|beta.?carotene|бета.?каротин/i, avoid: /multi|complex/i },
  { key: 'multivitamin', match: /мултивитамин|multivitamin|multi-vitamin/i, must: /multi|мулти/i },
  {
    key: 'magnesium', match: /магнези|magnes/i, must: /magnes|магнез|magtein/i,
    prefer: /glycinat|bisglycin|бисглицин|citrat|цитрат|chelat/i,
    avoid: /alkaline|calcium|zinc|zma|\bca\b|sodium|натрий|калций/i,
    forms: [
      [/треонат|threonat/i, /threonat|magtein/i],
      [/цитрат|citrat/i, /citrat/i],
      [/бисглицин|глицинат|glycinat/i, /glycinat/i],
    ],
  },
  {
    key: 'omega3', match: /омега|omega/i, must: /omega|омега|fish oil|рибено|krill/i, prefer: /epa|high|ultra|triple|концентр/i,
    vegan: /alga|водорасл|vegan|веган/i, avoid: /3-6-9|3 6 9|d-?3|vitamin d/i,
  },
  { key: 'iron', match: /желяз|желез|iron\b/i, must: /iron|желязо/i, prefer: /bisglycin|бисглицин|chelat|ferrochel/i, avoid: /multi|мулти/i },
  { key: 'zinc', match: new RegExp(`цинк${CYR_END}|zinc`, 'i'), must: /zinc|цинк/i, prefer: /picolinat|пиколинат|bisglycin|бисглицин/i, avoid: /magnes|магнез|calcium|zma|multi/i },
  { key: 'selenium', match: /селен|selen/i, must: /selen|селен/i, avoid: /multi|complex/i },
  { key: 'chromium', match: /хром|chromium/i, must: /chrom|хром/i, prefer: /picolinat|пиколинат/i },
  { key: 'iodine', match: /йод|iodine|iodide/i, must: /iod|йод|kelp|келп/i },
  { key: 'creatine', match: /креатин|creatine/i, must: /creatin|креатин/i, prefer: /monohydrat|монохидрат|creapure/i, avoid: /hcl|kre-alkalyn|matrix|stack/i },
  {
    key: 'collagen', match: /колаген|collagen/i, must: /collagen|колаген/i,
    prefer: /peptid|пептид|hydrolyz|хидролиз/i, avoid: /glucosamin|chondroitin|msm/i,
    vegan: /vegan|веган/i,
    forms: [
      [/тип\s*ii\b|type\s*ii\b|тип\s*2|uc-?ii/i, /type ii|uc-?ii|type 2/i],
      [/пептид|peptid|тип\s*i\s*и\s*iii/i, /peptid|hydrolyz|i & iii|i and iii/i],
    ],
  },
  { key: 'melatonin', match: /мелатонин|melatonin/i, must: /melatonin|мелатонин/i },
  { key: 'psyllium', match: /псилиум|psyllium/i, must: /psyllium|псилиум/i },
  { key: 'berberine', match: /берберин|berberin/i, must: /berberin|берберин/i },
  { key: 'inositol', match: /инозитол|inositol/i, must: /inositol|инозитол/i },
  { key: 'ashwagandha', match: /ашваганда|ashwagandha/i, must: /ashwagandha|ашваганда/i, prefer: /ksm/i },
  { key: 'ala', match: /липоева|lipoic|\bala\b/i, must: /lipoic|липоева|\bala\b/i },
  { key: 'curcumin', match: /куркум|curcum|turmeric/i, must: /curcum|turmeric|куркум/i, prefer: /piperin|bioperine|пиперин/i },
  { key: 'nac', match: /\bnac\b|ацетил\s*-?\s*цистеин|acetyl\s*-?\s*cystein/i, must: /\bnac\b|cystein|цистеин/i },
  { key: 'glutamine', match: /глутамин|glutamin/i, must: /glutamin|глутамин/i },
  { key: 'theanine', match: /теанин|theanin/i, must: /theanin|теанин/i },
  { key: 'tyrosine', match: /тирозин|tyrosin/i, must: /tyrosin|тирозин/i },
  { key: 'glutathione', match: /глутатион|glutathion/i, must: /glutathion|глутатион/i },
  { key: 'silymarin', match: /силимарин|бял трън|milk thistle|silymarin/i, must: /milk thistle|silymarin|бял трън|силимарин/i },
  { key: 'resveratrol', match: /ресвератрол|resveratrol/i, must: /resveratrol|ресвератрол/i },
  { key: 'probiotic', match: /пробиот|probiotic/i, must: /probiotic|пробиот|lactobac|acidophil/i },
  { key: 'choline', match: /холин|choline|alpha-?gpc/i, must: /gpc|cholin|холин/i, prefer: /gpc|bitartrat|pure/i, avoid: /inositol|инозитол|b-complex|комплекс/i },
  { key: 'phosphatidylserine', match: /фосфатидилсерин|phosphatidylserin/i, must: /phosphatidyl|фосфатидил/i },
  { key: 'colostrum', match: /колострум|colostrum/i, must: /colostrum|колострум/i },
  { key: 'calcium', match: /калций|calcium/i, must: /calcium|калций/i, avoid: /magnes|zinc|магнез|цинк/i },
  { key: 'potassium', match: /калий|калиев|potassium/i, must: /potassium|калий/i },
];

// Кирилски букви, които се пишат вместо латинските в имената на витамините:
// „Витамин С“, „В12“, „Д3“, „К2“ — само като самостоятелна буква или буква пред цифра.
const LOOKALIKE = { с: 'c', в: 'b', д: 'd', к: 'k', е: 'e', а: 'a' };

/** Уеднаквява думата: кирилски „витаминни“ букви → латински. */
export function normalizeSupplementQuery(q) {
  return String(q || '')
    .trim()
    .slice(0, 80)
    .replace(/(^|[^\p{L}])([свдкеа])(?=\d|[^\p{L}]|$)/giu, (m, pre, ch, offset, str) => {
      const lower = ch.toLowerCase();
      // Без цифра след нея буквата е витамин само непосредствено след „витамин“ —
      // иначе е предлог или съюз („колаген с витамин C“, „желязо и витамин C“).
      const afterVitamin = /витамин[\s-]*$/i.test(str.slice(0, offset + pre.length));
      const beforeDigit = /\d/.test(str.charAt(offset + m.length));
      if (!afterVitamin && !beforeDigit) return m;
      return pre + LOOKALIKE[lower];
    });
}

/**
 * Веществата в думата, по реда, в който са написани: първото е основното
 * („Колаген с витамин C“ → колаген; „Желязо + витамин C“ → желязо).
 * D3 + K2 се разпознава като едно вещество.
 * @returns {SupplementSlot[]}
 */
export function slotsForQuery(q) {
  const s = normalizeSupplementQuery(q);
  const d3k2 = SUPPLEMENT_SLOTS[0];
  if (d3k2.match.test(s)) return [d3k2];
  return SUPPLEMENT_SLOTS.slice(1)
    .map((slot) => ({ slot, at: s.search(slot.match) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.slot)
    // „Витамин K“ в „витамин K2“ се хваща и от vitamin_k2 — един и същ слот не се повтаря.
    .filter((slot, i, arr) => arr.indexOf(slot) === i);
}

/** Основният слот на думата или null (тогава — обичайното търсене). */
export function slotForQuery(q) {
  return slotsForQuery(q)[0] || null;
}

export const isComboName = (name) => COMBO.test(String(name || ''));

/**
 * Колко добре продуктът отговаря на думата (по-голямо — по-добре), или -1.
 * @param {SupplementSlot} slot
 * @param {object} entry — запис от индекса на каталога
 * @param {{ q: string, vegan?: boolean, also?: SupplementSlot[] }} ctx — also: другите вещества в думата
 */
export function fitScore(slot, entry, ctx) {
  const name = String(entry?.name || '');
  const also = ctx.also || [];
  if (!name || !slot.must.test(name) || NOT_SUPPLEMENT.test(name)) return -1;
  // При поискана комбинация („калций + D3“) изключванията на основния слот не важат.
  if (!also.length && slot.avoid && slot.avoid.test(name)) return -1;
  const wantsVegan = !!(ctx.vegan || /водорасл|alga|vegan|веган/i.test(ctx.q));
  if (wantsVegan) {
    if (slot.vegan ? !slot.vegan.test(name) : ANIMAL.test(name)) return -1;
  }
  let score = 0;
  const form = (slot.forms || []).find(([re]) => re.test(ctx.q));
  if (form && form[1].test(name)) score += 5;
  if (slot.prefer && slot.prefer.test(name)) score += 3;
  for (const other of also) if (other.must.test(name)) score += 4;
  return score;
}

/** Колко по-малко подходящ може да е продукт и пак да се състезава по марж. */
export const FIT_TOLERANCE = 2;

/**
 * Подредени кандидати: първо подходящите (до FIT_TOLERANCE под най-добрия),
 * между тях — по марж (€), после по съвпадение. При едно вещество
 * комбинираните продукти отпадат, щом има поне един самостоятелен.
 * @param {object[]} index — налични записи с марж (вътрешният индекс, с max_margin)
 * @param {string} q
 * @param {{ vegan?: boolean, max?: number }} [opts]
 * @returns {{ slot: string|null, candidates: object[] }}
 */
export function rankSupplementCandidates(index, q, opts = {}) {
  const query = normalizeSupplementQuery(q);
  const max = opts.max || 6;
  if (!query) return { slot: null, candidates: [] };
  const [slot, ...also] = slotsForQuery(query);
  let scored;
  if (slot) {
    scored = (index || [])
      .map((entry) => ({ entry, fit: fitScore(slot, entry, { q: query, vegan: opts.vegan, also }) }))
      .filter((x) => x.fit >= 0);
    const combo = slot.key === 'd3k2' || slot.key === 'multivitamin' || slot.key === 'b_complex' || also.length > 0;
    if (!combo) {
      const single = scored.filter((x) => !isComboName(x.entry.name));
      if (single.length) scored = single;
    }
  } else {
    // Непознато вещество — обичайното търсене; всички намерени са „еднакво подходящи“.
    scored = (index || [])
      .filter((entry) => !NOT_SUPPLEMENT.test(entry?.name || '') && matchesSearchQuery(entry, query))
      .filter((entry) => !(opts.vegan && ANIMAL.test(entry?.name || '')))
      .map((entry) => ({ entry, fit: 0 }));
  }
  if (!scored.length) return { slot: slot?.key || null, candidates: [] };
  const best = Math.max(...scored.map((x) => x.fit));
  const candidates = scored
    .filter((x) => x.fit >= best - FIT_TOLERANCE)
    .sort((a, b) => (Number(b.entry.max_margin) || 0) - (Number(a.entry.max_margin) || 0) || b.fit - a.fit)
    .slice(0, max)
    .map((x) => x.entry);
  return { slot: slot?.key || null, candidates };
}
