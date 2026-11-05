/**
 * Готови стакове (по 3 продукта) за biocode-bg.com — подбор и автоматична замяна.
 *
 * Всеки стак има 3 функционални места. Всяко място има подредени вещества:
 * основното и заместителите със същата роля. Изборът:
 *   1. основното вещество → всички налични продукти с него, които минават правилата;
 *   2. между тях печели най-високата „стойност“ = качество × марж;
 *   3. ако за основното вещество няма наличен продукт (или живата проверка при
 *      доставчика го показва изчерпан) → следващият по стойност продукт, после
 *      следващото вещество от списъка.
 *
 * Маржът се мери двойно:
 *   - спрямо цената в официалния магазин на доставчика (f1_reference_price):
 *     (наша цена − доставна) / цена при доставчика — колко печелим от всяко евро,
 *     което клиентът би платил там; така евтин и скъп продукт се сравняват честно;
 *   - в евро (абсолютно) — с по-малко тегло, за да не печелят само големите разфасовки.
 * Качеството: доверие към марката (MARKA_TRUST, настройка `stack_brand_trust`)
 * + съвпадение по форма (бисглицинат, пептиди, монохидрат…).
 *
 * Маржът и доставната цена не излизат към клиента.
 */
import { SUPPLEMENT_SLOTS, fitScore, isComboName, FIT_TOLERANCE } from './portfolio-supplement-pick.js';
import { isSampleVariantLabel } from './advisor-product-facts.js';
import { variantHasMargin } from './portfolio-margin-policy.js';

const ref = (key) => {
  const slot = SUPPLEMENT_SLOTS.find((s) => s.key === key);
  if (!slot) throw new Error(`Unknown supplement slot ${key}`);
  return slot;
};

/**
 * Вещество в място на стака.
 * @typedef {{ key: string, label: string, why: string, rule: object, q?: string, allowCombo?: boolean, maxPrice?: number }} StackOption
 * `rule` — правило по името (must / avoid / prefer / forms), като в portfolio-supplement-pick.js.
 * `q` — думата, по която се избира форма (магнезиев бисглицинат → glycinate).
 * `maxPrice` — таван на цената на разфасовката (по подразбиране DEFAULT_MAX_PRICE).
 */

/** @type {Record<string, { id: string, slots: Array<{ id: string, title: string, options: StackOption[] }> }>} */
export const STACK_RULES = {
  slim: {
    id: 'slim',
    slots: [
      {
        id: 'fat_transport',
        title: 'Използване на мазнините',
        options: [
          {
            key: 'carnitine', label: 'L-карнитин',
            why: 'Пренася мастните киселини в митохондриите, където се изгарят за енергия.',
            rule: { must: /carnit|карнит/i, avoid: /chrom|хром|green tea|cla\b|lipoic|липоев|for her/i, prefer: /tartrat|тартрат|acetyl|ацетил|1000|3000/i },
          },
          {
            key: 'cla', label: 'CLA',
            why: 'Конюгирана линолова киселина — подпомага съотношението мазнини / мускули.',
            rule: { must: /(^|[^a-z])cla([^a-z]|$)/i, avoid: /multivitamin|мулти|carnit/i },
          },
          {
            key: 'green_tea', label: 'Екстракт от зелен чай',
            why: 'Катехини (EGCG) — леко повишават разхода на енергия. Съдържа кофеин.',
            rule: { must: /green tea|зелен чай|egcg/i, avoid: /cocoa|какао|detox|carnit|cla\b|guarana/i },
          },
        ],
      },
      {
        id: 'appetite',
        title: 'Апетит и кръвна захар',
        options: [
          {
            key: 'chromium', label: 'Хром пиколинат',
            why: 'Подпомага нормалните нива на кръвната захар — по-малко пристъпи на глад за сладко.',
            rule: { ...ref('chromium'), avoid: /carnit|карнит|cinnamon|biotin|b12|magnes|zinc/i },
          },
          {
            key: 'berberine', label: 'Берберин',
            why: 'Подпомага усвояването на глюкозата и метаболизма на мазнините.',
            rule: { ...ref('berberine'), avoid: /turmeric|куркум/i, prefer: /phytosome|hcl/i },
          },
          {
            key: 'glucomannan', label: 'Глюкоманан',
            why: 'Разтворима фибра — набъбва в стомаха и удължава засищането.',
            rule: { must: /glucoman|глюкоман/i },
          },
          {
            key: 'inositol', label: 'Инозитол',
            why: 'Подпомага чувствителността към инсулин.',
            rule: { ...ref('inositol'), avoid: /cholin|холин/i },
          },
        ],
      },
      {
        id: 'liver',
        title: 'Черен дроб и изчистване',
        options: [
          {
            key: 'milk_thistle', label: 'Бял трън (силимарин)',
            why: 'Подпомага черния дроб — органът, който преработва мазнините и токсините.',
            rule: { ...ref('silymarin'), avoid: /detox|debloat|charcoal|nettle|green tea/i },
          },
          {
            key: 'ala', label: 'Алфа-липоева киселина',
            why: 'Антиоксидант, който подпомага енергийния метаболизъм и черния дроб.',
            rule: { ...ref('ala'), avoid: /carnit|карнит|ultravit/i },
          },
          {
            key: 'choline_inositol', label: 'Холин и инозитол',
            why: 'Липотропни вещества — подпомагат изнасянето на мазнините от черния дроб.',
            rule: { must: /cholin|холин/i, prefer: /inosit|инозит/i },
            allowCombo: true,
          },
        ],
      },
    ],
  },

  antiaging: {
    id: 'antiaging',
    slots: [
      {
        id: 'mito',
        title: 'Клетъчна енергия',
        options: [
          {
            key: 'coq10', label: 'Коензим Q10',
            why: 'Нужен на митохондриите за производство на енергия; нивото му спада с възрастта.',
            rule: { must: /q-?10|ubiquin|коензим/i, avoid: /multivitamin|мулти|collagen|колаген|hair/i, prefer: /ubiquinol|liposom|100 ?mg|120 ?mg/i },
          },
          {
            key: 'nmn', label: 'NMN / NAD+', maxPrice: 70,
            why: 'Прекурсор на NAD+ — молекулата на клетъчната енергия и възстановяване.',
            rule: { must: /(^|[^a-z])nmn([^a-z]|$)|nicotinamide ribos|nad\+/i },
            allowCombo: true,
          },
          {
            key: 'ala', label: 'Алфа-липоева киселина',
            why: 'Антиоксидант, който работи и в мазнините, и във водата на клетката.',
            rule: { ...ref('ala'), avoid: /carnit|карнит|ultravit/i, prefer: /r-alpha|r-ala|600/i },
          },
        ],
      },
      {
        id: 'antiox',
        title: 'Антиоксидантна защита',
        options: [
          {
            key: 'glutathione', label: 'Глутатион',
            why: 'Основният вътреклетъчен антиоксидант на организма.',
            rule: { ...ref('glutathione'), avoid: /cancer|canceral/i, prefer: /liposom|reduced|l-glutath/i },
            allowCombo: true,
          },
          {
            key: 'resveratrol', label: 'Ресвератрол',
            why: 'Полифенол, който активира гените на клетъчното обновяване (сиртуини).',
            rule: { ...ref('resveratrol'), avoid: /chaga|dandelion|resvatrip/i, prefer: /250|150/i },
          },
          {
            key: 'astaxanthin', label: 'Астаксантин',
            why: 'Силен каротеноиден антиоксидант — защитава кожата и очите.',
            rule: { must: /astax|астаксант/i },
          },
          {
            key: 'quercetin', label: 'Кверцетин',
            why: 'Флавоноид с антиоксидантно и противовъзпалително действие.',
            rule: { must: /quercet|кверцет/i, avoid: /humic|allergo|ganoderma/i },
          },
        ],
      },
      {
        id: 'membranes',
        title: 'Мембрани и възпаление',
        options: [
          {
            key: 'omega3', label: 'Омега-3 (EPA/DHA)',
            why: 'Изграждат клетъчните мембрани и поддържат сърцето, мозъка и кожата.',
            rule: { ...ref('omega3') },
          },
          {
            key: 'curcumin', label: 'Куркумин', maxPrice: 55,
            why: 'Подпомага естествения контрол на възпалението.',
            rule: { ...ref('curcumin'), avoid: /boswell|ginger|berberin|джинджиф/i },
          },
        ],
      },
    ],
  },

  tone: {
    id: 'tone',
    slots: [
      {
        id: 'protein',
        title: 'Строителен материал',
        options: [
          {
            key: 'whey_isolate', label: 'Суроватъчен изолат', maxPrice: 65,
            why: 'Чист протеин с минимум въглехидрати и мазнини — за мускул без излишни калории.',
            rule: { must: /isolat|изолат|(^|[^a-z])iso([^a-z]|$)/i, avoid: /soy|соев|gainer|mass|bar\b|water|isotonic|isoton/i, prefer: /whey|суроват|hydro/i },
            allowCombo: true,
          },
          {
            key: 'whey', label: 'Суроватъчен протеин', maxPrice: 55,
            why: 'Бързо усвоим протеин след тренировка.',
            rule: { must: /whey|суроват/i, avoid: /gainer|mass|bar\b|crisp|cookie|wafer|chips/i },
            allowCombo: true,
          },
          {
            key: 'eaa', label: 'Есенциални аминокиселини (EAA)',
            why: 'Всичките 9 аминокиселини, от които се строи мускулът.',
            rule: { must: /(^|[^a-z])eaa([^a-z]|$)/i, avoid: /energy|focus/i },
            allowCombo: true,
          },
        ],
      },
      {
        id: 'strength',
        title: 'Сила и плътност',
        options: [
          {
            key: 'creatine', label: 'Креатин монохидрат',
            why: 'Най-изследваната добавка за сила — повече повторения, по-плътна мускулатура.',
            rule: { ...ref('creatine'), avoid: /hcl|kre-alkalyn|matrix|stack|box|sachet|mega caps 1250|x \d/i },
          },
          {
            key: 'hmb', label: 'HMB',
            why: 'Пази мускула от разграждане при калориен дефицит.',
            rule: { must: /(^|[^a-z])hmb([^a-z]|$)/i },
          },
        ],
      },
      {
        id: 'recovery',
        title: 'Възстановяване',
        options: [
          {
            key: 'magnesium', label: 'Магнезий бисглицинат', q: 'магнезиев бисглицинат',
            why: 'Мускулна релаксация, сън и по-малко крампи. Бисглицинатът се понася най-добре.',
            rule: { ...ref('magnesium'), avoid: /alkaline|calcium|zinc|zma|\bca\b|sodium|натрий|калций|drinks|gumm/i },
          },
          {
            key: 'zma', label: 'ZMA',
            why: 'Цинк, магнезий и B6 — за сън и възстановяване.',
            rule: { must: /(^|[^a-z])zma([^a-z]|$)/i, avoid: /provit/i },
            allowCombo: true,
          },
          {
            key: 'glutamine', label: 'L-глутамин',
            why: 'Подпомага възстановяването и чревната лигавица.',
            rule: { ...ref('glutamine'), avoid: /eaa|bcaa|energy/i },
          },
        ],
      },
    ],
  },

  postpartum: {
    id: 'postpartum',
    slots: [
      {
        id: 'omega',
        title: 'Мозък и настроение',
        options: [
          {
            key: 'omega3', label: 'Омега-3 (DHA)',
            why: 'DHA се изчерпва при бременност и кърмене; важен е за мозъка — и на майката, и на бебето.',
            rule: { ...ref('omega3'), prefer: /dha|epa|high|ultra|gold|concentr|концентр/i },
          },
        ],
      },
      {
        id: 'vitamin_d',
        title: 'Кости и имунитет',
        options: [
          {
            key: 'd3k2', label: 'Витамин D3 + K2',
            why: 'D3 за имунитета и усвояването на калций, K2 насочва калция към костите.',
            rule: { ...ref('d3k2'), avoid: /omega|fish|calcium|калций|(^|[^a-z])ca([^a-z]|$)|multi|мулти|k1/i },
            allowCombo: true,
          },
          {
            key: 'vitamin_d', label: 'Витамин D3',
            why: 'За имунитета, костите и настроението — дефицитът е честа причина за умора.',
            rule: { ...ref('vitamin_d'), avoid: /k-?2|mk-?7|k1|multi|мулти|calcium|калций|complex|omega|fish|humic|drops 400|400 iu/i },
          },
        ],
      },
      {
        id: 'nerves',
        title: 'Сън, нерви, мускули',
        options: [
          {
            key: 'magnesium', label: 'Магнезий бисглицинат', q: 'магнезиев бисглицинат',
            why: 'Безопасна форма — успокоява, подобрява съня и намалява мускулните крампи.',
            rule: { ...ref('magnesium'), avoid: /alkaline|calcium|zinc|zma|\bca\b|sodium|натрий|калций|drinks|gumm/i },
          },
          {
            key: 'b_complex', label: 'B-комплекс',
            why: 'Витамините от група B поддържат нервната система и енергията.',
            rule: { ...ref('b_complex'), avoid: /iron|желяз|nerveshope|kids|calcium/i },
            allowCombo: true,
          },
        ],
      },
    ],
  },

  beauty: {
    id: 'beauty',
    slots: [
      {
        id: 'collagen',
        title: 'Плътност на кожата',
        options: [
          {
            key: 'collagen', label: 'Колагенови пептиди', q: 'колагенови пептиди',
            why: 'Основният протеин на кожата — подпомага еластичността и плътността ѝ.',
            rule: { ...ref('collagen'), avoid: /glucosamin|chondroitin|msm|drinks|flexi|joint|multivitamin/i, prefer: /peptid|пептид|hydrolyz|хидролиз|verisol|marine|fish/i },
            allowCombo: true,
          },
        ],
      },
      {
        id: 'hydration',
        title: 'Хидратация',
        options: [
          {
            key: 'hyaluronic', label: 'Хиалуронова киселина',
            why: 'Задържа водата в кожата — по-гладка и хидратирана кожа отвътре.',
            rule: { must: /hyalur|хиалур/i, avoid: /collagen|колаген|multivitamin|flexi|joint|glucosamin/i },
            allowCombo: true,
          },
          {
            key: 'vitamin_c', label: 'Витамин C',
            why: 'Без витамин C организмът не може да изгради колаген.',
            rule: { ...ref('vitamin_c'), avoid: /multi|мулти|complex|collagen|колаген|zinc|цинк|theanin|charger|powder/i },
          },
        ],
      },
      {
        id: 'hair',
        title: 'Коса и нокти',
        options: [
          {
            key: 'biotin', label: 'Биотин',
            why: 'Витамин B7 — подпомага растежа на косата и здравината на ноктите.',
            rule: { must: /biotin|биотин/i, avoid: /chrom|cinnamon|hormonal|diabet|evapro/i, prefer: /5000|10,?000/i },
          },
          {
            key: 'hair_skin_nails', label: 'Формула за коса, кожа и нокти',
            why: 'Комбинация от витамини и минерали за коса, кожа и нокти.',
            rule: { must: /hair|skin|nail|коса|кожа|нокт/i, avoid: /collagen|колаген|liquid/i },
            allowCombo: true,
          },
          {
            key: 'zinc', label: 'Цинк',
            why: 'Нужен за обновяването на кожата и растежа на косата.',
            rule: { ...ref('zinc') },
          },
        ],
      },
    ],
  },
};

export const STACK_IDS = Object.keys(STACK_RULES);

/**
 * Доверие към марката (качество): 1 — производители с фармацевтичен GMP стандарт
 * и независим контрол, 0.9 — утвърдени марки, по подразбиране 0.8.
 * Админът може да го промени с настройката `stack_brand_trust` ({ "Марка": 0.95 }).
 */
export const BRAND_TRUST = {
  'now foods': 1, natrol: 1, biovea: 1, 'optimum nutrition': 1, 'olimp sport nutrition': 1, olimp: 1,
  nutrend: 1, 'swedish nutra': 1, osavi: 1, 'holland and barrett': 1, grassberg: 1, 'applied nutrition': 1,
  forcelab: 0.95, 'yava labs': 0.95, myprotein: 0.95,
  'biotech usa': 0.9, scitec: 0.9, 'trec nutrition': 0.9, 'haya labs': 0.9, vplab: 0.9, ostrovit: 0.9,
  everbuild: 0.9, magherbs: 0.9, bioherba: 0.9, 'kevin levrone': 0.9, 'swedish collagen': 0.9,
  'swedish essentials': 0.9, 'extrifit sports nutrition': 0.9, 'core champs by kai greene': 0.85,
};
export const DEFAULT_BRAND_TRUST = 0.8;

/** Категории, които не са добавки (аксесоари, облекло, храни, хардкор стимуланти). */
const NON_STACK_CATEGORY = /аксесоари|облекло|тениски|уреди|козметика|функционални храни|хардкор|стимулатор/i;

/** Таван на цената за място в стака (евро), за да остане пакетът достъпен; протеините имат свой. */
export const DEFAULT_MAX_PRICE = 45;

/** Тегла на стойността: маржът спрямо цената при доставчика тежи повече от маржа в евро. */
export const VALUE_WEIGHTS = { relative: 0.65, absolute: 0.35 };
/** Колко кандидата на място се проверяват на живо при доставчика. */
export const LIVE_BACKUPS_PER_SLOT = 4;

const norm = (s) => String(s || '').trim().toLowerCase();

export function brandTrust(brand, overrides = null) {
  const key = norm(brand);
  const custom = overrides && Object.entries(overrides).find(([b]) => norm(b) === key);
  if (custom && Number(custom[1]) > 0) return Math.min(1.2, Number(custom[1]));
  return BRAND_TRUST[key] ?? DEFAULT_BRAND_TRUST;
}

/** Опаковка, неподходяща за стак: мостра, сашета, кашон „60 x 15“. */
export function isStackUnfitPack(variant) {
  const label = [variant?.pack, variant?.option].filter(Boolean).join(' ');
  if (isSampleVariantLabel(variant?.pack || variant?.option || '')) return true;
  return /\d+\s*[xх×]\s*\d+|sachet|саше/i.test(label);
}

/**
 * Марж на варианта: в евро и като дял от цената в официалния магазин на доставчика.
 * @returns {{ abs: number, rel: number }}
 */
export function variantValue(variant) {
  const b2b = Number(variant?.b2b_price) || 0;
  const retail = Number(variant?.retail_price) || 0;
  const official = Number(variant?.f1_reference_price) || 0;
  const abs = retail > b2b && b2b > 0 ? retail - b2b : 0;
  const base = official > 0 ? official : retail;
  return { abs, rel: base > 0 ? abs / base : 0 };
}

/**
 * Най-добрият вариант на групата за стак (наличен, с марж, не мостра, под тавана на цената)
 * — по марж спрямо цената при доставчика.
 */
export function pickStackVariant(group, maxPrice = DEFAULT_MAX_PRICE) {
  const ok = (group?.variants || []).filter((v) => v.available !== false && variantHasMargin(v)
    && !isStackUnfitPack(v) && (!(maxPrice > 0) || Number(v.retail_price) <= maxPrice));
  if (!ok.length) return null;
  return ok.reduce((best, v) => {
    const a = variantValue(v);
    const b = variantValue(best);
    return a.rel > b.rel + 1e-9 || (Math.abs(a.rel - b.rel) <= 1e-9 && a.abs > b.abs) ? v : best;
  }, ok[0]);
}

/**
 * Кандидати от индекса за едно вещество, минаващи правилото.
 * `tier` 0 — в допуска по съвпадение спрямо най-добрия (предпочитана форма), 1 — останалите:
 * те са резерва, ако всички от tier 0 са изчерпани.
 * Комбинирани продукти отпадат, ако има поне един самостоятелен (освен при allowCombo).
 * @param {object[]} index — налични записи с марж
 * @param {StackOption} option
 * @returns {Array<{ entry: object, fit: number, tier: number }>}
 */
export function optionCandidates(index, option) {
  const q = option.q || option.label;
  let scored = (index || [])
    .filter((entry) => !NON_STACK_CATEGORY.test(String(entry?.category_top || entry?.category || '')))
    .map((entry) => ({ entry, fit: fitScore(option.rule, entry, { q }) }))
    .filter((x) => x.fit >= 0);
  if (!option.allowCombo) {
    const single = scored.filter((x) => !isComboName(x.entry.name));
    if (single.length) scored = single;
  }
  if (!scored.length) return [];
  const best = Math.max(...scored.map((x) => x.fit));
  return scored.map((x) => ({ ...x, tier: x.fit >= best - FIT_TOLERANCE ? 0 : 1 }));
}

/**
 * Подрежда кандидатите на едно вещество по стойност = качество × марж.
 * Маржовете се нормират спрямо най-добрия кандидат в същото вещество.
 * @param {Array<{ entry: any, fit: number, tier?: number, group?: any, variant: any }>} rows
 * @param {object|null} trustOverrides
 */
export function rankByValue(rows, trustOverrides = null) {
  if (!rows.length) return [];
  const values = rows.map((r) => variantValue(r.variant));
  const maxRel = Math.max(...values.map((v) => v.rel), 1e-9);
  const maxAbs = Math.max(...values.map((v) => v.abs), 1e-9);
  const maxFit = Math.max(...rows.map((r) => r.fit), 0);
  return rows
    .map((r, i) => {
      const margin = VALUE_WEIGHTS.relative * (values[i].rel / maxRel) + VALUE_WEIGHTS.absolute * (values[i].abs / maxAbs);
      // Съвпадение по форма: до +10% за най-подходящата форма.
      const fitBonus = maxFit > 0 ? 1 + 0.1 * (r.fit / maxFit) : 1;
      const quality = brandTrust(r.entry.brand, trustOverrides) * fitBonus;
      return { ...r, score: quality * margin, quality, rel: values[i].rel };
    })
    .sort((a, b) => (a.tier || 0) - (b.tier || 0) || b.score - a.score
      || String(a.entry.name).localeCompare(String(b.entry.name), 'bg'));
}

/**
 * Подреден списък кандидати за място в стака: веществата по ред, във всяко — по стойност.
 * @param {object[]} index
 * @param {{ options: StackOption[] }} slot
 * @param {(groupId: string) => object|null} getGroup
 * @param {{ exclude?: Set<string>, trust?: object|null }} [opts]
 * @returns {Array<any>}
 */
export function rankSlotCandidates(index, slot, getGroup, opts = {}) {
  const exclude = opts.exclude || new Set();
  const out = [];
  for (const option of slot.options) {
    const rows = optionCandidates(index, option)
      .filter(({ entry }) => !exclude.has(String(entry.group_id)))
      .map(({ entry, fit, tier }) => {
        const group = getGroup(String(entry.group_id));
        const variant = group && pickStackVariant(group, option.maxPrice ?? DEFAULT_MAX_PRICE);
        return variant ? { entry, fit, tier, group, variant } : null;
      })
      .filter(Boolean);
    for (const row of rankByValue(rows, opts.trust)) out.push({ option, ...row });
  }
  return out;
}

/** group_id-тата, които трябва да се заредят за стака (всички кандидати на всички места). */
export function stackCandidateGroupIds(index, stackId) {
  const stack = STACK_RULES[stackId];
  if (!stack) return [];
  const ids = new Set();
  for (const slot of stack.slots) {
    for (const option of slot.options) {
      for (const { entry } of optionCandidates(index, option)) ids.add(String(entry.group_id));
    }
  }
  return [...ids];
}

/**
 * Сглобява стака: за всяко място — първият наличен кандидат.
 * Един продукт не може да заеме две места.
 * @param {object[]} index
 * @param {string} stackId
 * @param {(groupId: string) => object|null} getGroup
 * @param {{ unavailable?: Set<string>, trust?: object|null }} [opts] unavailable: sku_id-та, изчерпани при живата проверка
 * @returns {Array<{ slot: object, pick: object|null, primary: boolean }>}
 */
export function resolveStack(index, stackId, getGroup, opts = {}) {
  const stack = STACK_RULES[stackId];
  if (!stack) return [];
  const unavailable = opts.unavailable || new Set();
  const used = new Set();
  return stack.slots.map((slot) => {
    const ranked = rankSlotCandidates(index, slot, getGroup, { exclude: used, trust: opts.trust });
    const pick = ranked.find((c) => !unavailable.has(String(c.variant.sku_id))) || null;
    if (pick) used.add(String(pick.entry.group_id));
    return { slot, pick, primary: !!pick && pick.option === slot.options[0] };
  });
}

/** Кандидатите за жива проверка: първите N на всяко място. */
export function liveCheckCandidates(index, stackId, getGroup, opts = {}) {
  const stack = STACK_RULES[stackId];
  if (!stack) return [];
  const rows = [];
  for (const slot of stack.slots) {
    rows.push(...rankSlotCandidates(index, slot, getGroup, { trust: opts.trust }).slice(0, opts.perSlot || LIVE_BACKUPS_PER_SLOT));
  }
  return rows;
}
