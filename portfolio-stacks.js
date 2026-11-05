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
 * Един пакет се сглобява само от един доставчик — приоритетно Fitness1; Sila само ако
 * Fitness1 не може да запълни пакета. Никога смесено.
 *
 * Маржът и доставната цена не излизат към клиента.
 */
import { SUPPLEMENT_SLOTS, fitScore, isComboName, FIT_TOLERANCE } from './portfolio-supplement-pick.js';
import { isSampleVariantLabel } from './advisor-product-facts.js';
import { variantHasMargin } from './portfolio-margin-policy.js';
import { isSilaDistributor, DISTRIBUTOR_SILA, DISTRIBUTOR_FITNESS1 } from './sila-api.js';

/**
 * Един пакет — един доставчик (Sila или Fitness1), никога смесено:
 * поръчката към доставчика е една, без две пратки и две минимални суми.
 */
export const STACK_DISTRIBUTORS = [DISTRIBUTOR_FITNESS1, DISTRIBUTOR_SILA];

/** Доставчикът на варианта (по подразбиране Fitness1, както в каталога). */
export function variantDistributor(variant, group = null) {
  return isSilaDistributor(variant?.distributor || group?.distributor) ? DISTRIBUTOR_SILA : DISTRIBUTOR_FITNESS1;
}

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
            rule: { ...ref('silymarin'), must: /milk thistle|thistle|silymarin|бял трън|силимарин/i, avoid: /detox|debloat|charcoal|nettle|green tea/i },
          },
          {
            key: 'ala', label: 'Алфа-липоева киселина',
            why: 'Антиоксидант, който подпомага енергийния метаболизъм и черния дроб.',
            rule: { ...ref('ala'), avoid: /carnit|карнит|ultravit/i },
          },
          {
            key: 'choline_inositol', label: 'Холин и инозитол',
            why: 'Липотропни вещества — подпомагат изнасянето на мазнините от черния дроб.',
            // Липотропен холин (битартрат + инозитол), не цитиколин / Alpha-GPC — те са за мозъка.
            rule: { must: /cholin|холин/i, prefer: /inosit|инозит/i, avoid: /citicolin|цитиколин|cdp|gpc/i },
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
            key: 'nmn', label: 'NMN / NAD+', maxPrice: 120,
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
            key: 'curcumin', label: 'Куркумин', maxPrice: 90,
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
            key: 'whey_isolate', label: 'Суроватъчен изолат', maxPrice: 140,
            why: 'Чист протеин с минимум въглехидрати и мазнини — за мускул без излишни калории.',
            rule: { must: /isolat|изолат|(^|[^a-z])iso([^a-z]|$)/i, avoid: /soy|соев|gainer|mass|bar\b|water|isotonic|isoton/i, prefer: /whey|суроват|hydro/i },
            allowCombo: true,
          },
          {
            key: 'whey', label: 'Суроватъчен протеин', maxPrice: 120,
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

  joints: {
    id: 'joints',
    slots: [
      {
        id: 'cartilage',
        title: 'Хрущял',
        options: [
          {
            key: 'glucosamine', label: 'Глюкозамин и хондроитин',
            why: 'Градивните вещества на хрущяла — подпомагат възстановяването му и смазката на ставата.',
            rule: { must: /glucosam|chondroit|глюкозам|хондроит/i, avoid: /women.?s beauty|flexi move|kids/i, prefer: /chondroit|msm|1500|1600|sulfat/i },
            allowCombo: true,
          },
          {
            key: 'joint_formula', label: 'Комплексна ставна формула',
            why: 'Съчетава няколко вещества за хрущяла, сухожилията и подвижността в една доза.',
            rule: { must: /flex|joint|arthro|artro|стави|ставн/i, avoid: /drink|kids|women.?s beauty/i, prefer: /collagen|hyalur|msm|boswell|curcum/i },
            allowCombo: true,
          },
          {
            key: 'collagen', label: 'Колагенови пептиди', q: 'колагенови пептиди',
            why: 'Колагенът изгражда хрущяла и сухожилията — пептидите се усвояват бързо.',
            rule: { ...ref('collagen'), avoid: /drinks|multivitamin|hair|beauty|skin/i },
            allowCombo: true,
          },
        ],
      },
      {
        id: 'inflammation',
        title: 'Възпаление и болка',
        options: [
          {
            key: 'curcumin', label: 'Куркумин', maxPrice: 90,
            why: 'Подпомага естествения контрол на възпалението в ставите — с пиперин за усвояване.',
            rule: { ...ref('curcumin'), avoid: /ginger|berberin|джинджиф/i },
            allowCombo: true,
          },
          {
            key: 'boswellia', label: 'Босвелия',
            why: 'Босвелиевите киселини подпомагат подвижността и комфорта на ставите.',
            rule: { must: /boswell|босвел/i },
            allowCombo: true,
          },
          {
            key: 'omega3', label: 'Омега-3 (EPA/DHA)',
            why: 'EPA подпомага естествения контрол на възпалението.',
            rule: { ...ref('omega3') },
          },
        ],
      },
      {
        id: 'mobility',
        title: 'Подвижност и смазка',
        options: [
          {
            key: 'msm', label: 'MSM (органична сяра)',
            why: 'Сярата е нужна за изграждането на хрущял и съединителна тъкан.',
            rule: { must: /(^|[^a-z])msm([^a-z]|$)/i, avoid: /glucosam|chondroit|women|beauty/i },
          },
          {
            key: 'hyaluronic', label: 'Хиалуронова киселина',
            why: 'Основен компонент на ставната течност — смазва ставата.',
            rule: { must: /hyalur|хиалур/i, avoid: /collagen|колаген|multivitamin|beauty|skin/i },
            allowCombo: true,
          },
        ],
      },
    ],
  },

  immunity: {
    id: 'immunity',
    slots: [
      {
        id: 'vitamin_c',
        title: 'Първа линия на защита',
        options: [
          {
            key: 'vitamin_c', label: 'Витамин C',
            why: 'Натрупва се в имунните клетки и се изразходва бързо при инфекция и стрес.',
            rule: { ...ref('vitamin_c'), avoid: /multi|мулти|complex|collagen|колаген|theanin|charger|powder|glutath|kids/i, prefer: /liposom|липозом|1000/i },
          },
        ],
      },
      {
        id: 'vitamin_d',
        title: 'Регулация на имунитета',
        options: [
          {
            key: 'vitamin_d', label: 'Витамин D3',
            why: 'Регулира имунния отговор — дефицитът е честа причина за чести настинки през зимата.',
            rule: { ...ref('vitamin_d'), avoid: /k-?2|mk-?7|k1|multi|мулти|calcium|калций|complex|omega|fish|humic|400 iu|kids|zinc|vitamin c/i },
          },
          {
            key: 'd3k2', label: 'Витамин D3 + K2',
            why: 'D3 за имунитета, K2 насочва калция правилно.',
            rule: { ...ref('d3k2'), avoid: /omega|fish|calcium|калций|(^|[^a-z])ca([^a-z]|$)|multi|мулти|k1/i },
            allowCombo: true,
          },
        ],
      },
      {
        id: 'defence',
        title: 'Защитни клетки',
        options: [
          {
            key: 'zinc', label: 'Цинк',
            why: 'Нужен за развитието и работата на имунните клетки.',
            rule: { ...ref('zinc') },
          },
          {
            key: 'selenium', label: 'Селен',
            why: 'Антиоксидант, нужен за нормалната работа на имунната система.',
            rule: { ...ref('selenium') },
          },
          {
            key: 'colostrum', label: 'Коластра (имуноглобулини)',
            why: 'Естествени имуноглобулини и фактори, които подпомагат защитата на лигавиците.',
            rule: { must: /colostr|коластр|колостр/i },
            allowCombo: true,
          },
          {
            key: 'echinacea', label: 'Ехинацея',
            why: 'Билка, традиционно ползвана за подкрепа на имунитета в сезона на настинките.',
            rule: { must: /echinac|ехинац/i },
            allowCombo: true,
          },
        ],
      },
    ],
  },

  menopause: {
    id: 'menopause',
    slots: [
      {
        id: 'balance',
        title: 'Горещи вълни и баланс',
        options: [
          {
            key: 'black_cohosh', label: 'Грозниче (Black Cohosh)',
            why: 'Най-изследваната билка при горещи вълни и нощно изпотяване.',
            rule: { must: /cohosh|cimicif|грозниче/i },
            allowCombo: true,
          },
          {
            key: 'menopause_formula', label: 'Формула за менопауза',
            why: 'Билки и витамини, подбрани за горещите вълни, настроението и енергията в менопаузата.',
            rule: { must: /menopaus|менопауз|климакс|hormonal balance|evapro|femi health|dong quai|wild yam|red clover|isoflav/i, avoid: /fat burner|shaper/i },
            allowCombo: true,
          },
        ],
      },
      {
        id: 'bones',
        title: 'Кости',
        options: [
          {
            key: 'd3k2', label: 'Витамин D3 + K2',
            why: 'След менопаузата костната плътност спада бързо — D3 и K2 насочват калция към костите.',
            rule: { ...ref('d3k2'), avoid: /omega|fish|multi|мулти|k1/i },
            allowCombo: true,
          },
          {
            key: 'calcium_d', label: 'Калций с витамин D3 / K2',
            why: 'Калций с витамините, които го насочват към костите.',
            rule: { must: /calcium|калций/i, prefer: /k-?2|d-?3|citrat/i, avoid: /kids|zinc|akg|ketoglut/i },
            allowCombo: true,
          },
        ],
      },
      {
        id: 'sleep',
        title: 'Сън и настроение',
        options: [
          {
            key: 'magnesium', label: 'Магнезий бисглицинат', q: 'магнезиев бисглицинат',
            why: 'Подобрява съня, намалява раздразнителността и мускулните крампи.',
            rule: { ...ref('magnesium'), avoid: /alkaline|calcium|zinc|zma|\bca\b|sodium|натрий|калций|drinks|gumm/i },
          },
          {
            key: 'gaba', label: 'GABA',
            why: 'Основният успокояващ невротрансмитер — за по-лесно заспиване.',
            rule: { must: /(^|[^a-z])gaba([^a-z]|$)/i, avoid: /melatonin|tryptophan|ashwagandha sleep/i },
          },
        ],
      },
    ],
  },

  antistress: {
    id: 'antistress',
    slots: [
      {
        id: 'cortisol',
        title: 'Хормонът на стреса',
        options: [
          {
            key: 'ashwagandha', label: 'Ашваганда KSM-66',
            why: 'Адаптоген, който в изследвания понижава кортизола и усещането за стрес.',
            rule: { ...ref('ashwagandha'), avoid: /shilajit|tribulus|maca|ginseng|sleep|melatonin|sport/i, prefer: /ksm|sensoril/i },
          },
          {
            key: 'rhodiola', label: 'Родиола (златен корен)',
            why: 'Адаптоген срещу умора и изтощение при продължителен стрес.',
            rule: { must: /rhodiol|родиол|golden root|златен корен/i, avoid: /ginseng|shilajit/i },
          },
        ],
      },
      {
        id: 'nerves',
        title: 'Нервна система',
        options: [
          {
            key: 'magnesium', label: 'Магнезий бисглицинат', q: 'магнезиев бисглицинат',
            why: 'Стресът изразходва магнезия, а дефицитът засилва тревожността — порочен кръг.',
            rule: { ...ref('magnesium'), avoid: /alkaline|calcium|zinc|zma|\bca\b|sodium|натрий|калций|drinks|gumm/i },
          },
          {
            key: 'b_complex', label: 'B-комплекс',
            why: 'Витамините от група B поддържат нервната система и енергията при натоварване.',
            rule: { ...ref('b_complex'), avoid: /iron|желяз|kids|calcium|ms hope/i },
            allowCombo: true,
          },
        ],
      },
      {
        id: 'calm',
        title: 'Спокойствие без сънливост',
        options: [
          {
            key: 'theanine', label: 'L-теанин',
            why: 'Аминокиселина от зеления чай — спокойна концентрация, без сънливост.',
            rule: { ...ref('theanine'), avoid: /ms hope|happylls|vitamin c|zma|valerian/i },
            allowCombo: true,
          },
          {
            key: 'gaba', label: 'GABA',
            why: 'Основният успокояващ невротрансмитер.',
            rule: { must: /(^|[^a-z])gaba([^a-z]|$)/i, avoid: /melatonin|tryptophan|ashwagandha sleep/i },
          },
          {
            key: 'valerian', label: 'Валериана',
            why: 'Билка за успокоение и по-лесно заспиване.',
            rule: { must: /valerian|валериан/i, avoid: /zma|theanin/i },
            allowCombo: true,
          },
        ],
      },
    ],
  },
};

export const STACK_IDS = Object.keys(STACK_RULES);

/**
 * Клас на марката (елитност и качество), 0–1:
 *  1    — елит: фармацевтичен стандарт, клинични дози, независим контрол (NOW, Doctor's Best, Natrol…);
 *  0.85 — премиум: европейски GMP производители, патентовани форми (Olimp, Nutrend, MagHerbs…);
 *  0.65 — масови спортни марки;
 *  0.35 — бюджетни марки; непозната марка — 0.45.
 * Админът го променя с настройката `stack_brand_trust` ({ "Марка": 0.9 }).
 */
export const BRAND_TIER = {
  'now foods': 1, now: 1, "doctor's best": 1, 'life extension': 1, 'jarrow formulas': 1, solgar: 1, thorne: 1,
  'nordic naturals': 1, natrol: 1, osavi: 1, 'optimum nutrition': 1, 'swedish nutra': 1, 'swedish collagen': 1,
  'garden of life': 1,
  'olimp sport nutrition': 0.85, olimp: 0.85, nutrend: 0.85, magherbs: 0.85, biovea: 0.85, 'holland and barrett': 0.85,
  biovital: 0.85, forcelab: 0.85, grassberg: 0.85, 'applied nutrition': 0.85, 'yava labs': 0.85,
  'gaspari nutrition': 0.85, 'universal nutrition': 0.85,
  'trec nutrition': 0.65, 'biotech usa': 0.65, scitec: 0.65, myprotein: 0.65, 'extrifit sports nutrition': 0.65,
  ostrovit: 0.65, 'kevin levrone': 0.65, vplab: 0.65, everbuild: 0.65, grewia: 0.65, freelife: 0.65,
  'swedish essentials': 0.65, 'swedish supplements': 0.65, allnutrition: 0.65, cellucor: 0.65, mutant: 0.65,
  'core champs by kai greene': 0.6,
  bioherba: 0.35, 'haya labs': 0.35, kfd: 0.35, battery: 0.35, vemoherb: 0.35, 'natura vita': 0.35,
  naturalico: 0.35, celipharm: 0.35, 'biliana yotovska': 0.35, 'cvetita herbal': 0.35,
};
export const DEFAULT_BRAND_TIER = 0.45;
/** Марка от този клас нагоре се показва като „премиум марка“. */
export const PREMIUM_BRAND_TIER = 0.85;
/** @deprecated старото име */
export const DEFAULT_BRAND_TRUST = DEFAULT_BRAND_TIER;

/**
 * Сила на действие по вещество: силна доза (в единицата от името на продукта)
 * и форми с по-високо усвояване / клинично изследвани (premium).
 * @type {Record<string, { unit?: 'mg'|'mcg'|'iu'|'g', strong?: number, premium?: RegExp }>}
 */
export const POTENCY = {
  carnitine: { unit: 'mg', strong: 1000, premium: /carnipure|acetyl|ацетил|tartrat/i },
  cla: { unit: 'mg', strong: 1000, premium: /tonalin|80\s?%/i },
  green_tea: { unit: 'mg', strong: 500, premium: /egcg|98\s?%|50\s?%|standard/i },
  chromium: { unit: 'mcg', strong: 200, premium: /picolinat|chromax/i },
  berberine: { unit: 'mg', strong: 500, premium: /phytosome|dihydro/i },
  glucomannan: { unit: 'mg', strong: 600 },
  inositol: { unit: 'mg', strong: 600, premium: /myo/i },
  milk_thistle: { unit: 'mg', strong: 300, premium: /80\s?%|silybin|phytosome|standard/i },
  ala: { unit: 'mg', strong: 600, premium: /r-?alpha|r-?ala\b|time release|sustain/i },
  choline_inositol: { unit: 'mg', strong: 500 },
  coq10: { unit: 'mg', strong: 100, premium: /ubiquinol|liposom|kaneka/i },
  nmn: { unit: 'mg', strong: 300, premium: /riboside|uthever/i },
  glutathione: { unit: 'mg', strong: 250, premium: /liposom|setria|reduced/i },
  resveratrol: { unit: 'mg', strong: 250, premium: /trans|liposom/i },
  astaxanthin: { unit: 'mg', strong: 6 },
  quercetin: { unit: 'mg', strong: 500, premium: /bromelain|phytosome/i },
  omega3: { premium: /triple|ultra|krill|gold|concentr|\btg\b|epa|dha|premium|molecular/i },
  curcumin: { unit: 'mg', strong: 500, premium: /meriva|bcm|longvida|piperin|bioperine|black pepper|95\s?%/i },
  whey_isolate: { premium: /hydro|pure|zero|cfm|9[05]/i },
  whey: { premium: /isolat|hydro|gold|cfm/i },
  eaa: {},
  creatine: { premium: /creapure|micronized|микронизир/i },
  hmb: { unit: 'mg', strong: 1000 },
  magnesium: { unit: 'mg', strong: 200, premium: /bisglycin|glycinat|threonat|liposom|magtein/i },
  zma: {},
  glutamine: {},
  d3k2: { unit: 'iu', strong: 2000, premium: /mk-?7|drops|liquid/i },
  vitamin_d: { unit: 'iu', strong: 2000 },
  b_complex: { premium: /methyl|active|b-?50|b-?100|coenzym/i },
  collagen: { premium: /verisol|peptan|peptid|hydrolyz|marine|fish/i },
  hyaluronic: { unit: 'mg', strong: 100 },
  vitamin_c: { unit: 'mg', strong: 1000, premium: /liposom|ester|buffer/i },
  biotin: { unit: 'mcg', strong: 10000 },
  hair_skin_nails: { premium: /biotin|collagen|keratin/i },
  zinc: { unit: 'mg', strong: 25, premium: /picolinat|bisglycin/i },
  glucosamine: { unit: 'mg', strong: 1500, premium: /chondroit|msm|sulfat/i },
  joint_formula: { premium: /collagen|hyalur|msm|boswell|curcum|uc-?ii/i },
  boswellia: { unit: 'mg', strong: 400, premium: /65\s?%|75\s?%|akba|5-loxin/i },
  msm: { unit: 'mg', strong: 1000, premium: /optimsm/i },
  selenium: { unit: 'mcg', strong: 100, premium: /selenomethion|methionin/i },
  colostrum: { unit: 'mg', strong: 1000, premium: /igg|immunoglob|имуноглоб/i },
  echinacea: { unit: 'mg', strong: 400 },
  black_cohosh: { unit: 'mg', strong: 40 },
  menopause_formula: {},
  calcium_d: { premium: /k-?2|d-?3|citrat|chela/i },
  gaba: { unit: 'mg', strong: 500 },
  ashwagandha: { unit: 'mg', strong: 300, premium: /ksm|sensoril/i },
  rhodiola: { unit: 'mg', strong: 300, premium: /3\s?%|rosavin|salidros/i },
  theanine: { unit: 'mg', strong: 200, premium: /suntheanine/i },
  valerian: { unit: 'mg', strong: 400 },
};

const UNIT_RE = {
  mg: /(\d[\d.,]*)\s*(?:mg|мг)(?![a-zа-я])/gi,
  mcg: /(\d[\d.,]*)\s*(?:mcg|µg|мкг)(?![a-zа-я])/gi,
  iu: /(\d[\d.,]*)\s*(?:iu|ме|ie)(?![a-zа-я])|d-?3\s*(\d{3,5})(?!\d)/gi,
  g: /(\d[\d.,]*)\s*(?:g|гр?)(?![a-zа-я])/gi,
};

function parseNumber(raw) {
  let t = String(raw || '').trim();
  // 10,000 / 1.000 — разделител на хилядите; 2,5 / 2.5 — десетична запетая.
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) t = t.replace(/[.,]/g, '');
  else t = t.replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

/** Най-голямата доза в името в дадената единица (1000 mg, 10,000 mcg, D3 4000), или 0. */
export function parseDose(name, unit) {
  const re = UNIT_RE[unit];
  if (!re) return 0;
  let best = 0;
  for (const m of String(name || '').matchAll(re)) best = Math.max(best, parseNumber(m[1] || m[2]));
  return best;
}

/**
 * Сила на действие 0–1: доза спрямо силната доза + премиум форма.
 * Без посочена доза в името — 0.7 (неизвестно, не се наказва като слабо).
 */
export function potencyScore(optionKey, name) {
  const spec = POTENCY[optionKey] || {};
  const prem = spec.premium ? (spec.premium.test(String(name || '')) ? 1 : 0) : null;
  let dose = null;
  if (spec.unit && spec.strong) {
    const d = parseDose(name, spec.unit);
    // Без доза в името (капки, течности) — 0.7: не се наказва като слаб продукт.
    dose = d > 0 ? Math.min(1, d / spec.strong) : 0.7;
  }
  // Вещества без мерило за доза (ZMA, EAA, B-комплекс…) — средно-силни по подразбиране.
  if (dose == null && prem == null) return 0.65;
  if (dose == null) return 0.6 + 0.4 * prem;
  if (prem == null) return dose;
  return 0.6 * dose + 0.4 * prem;
}

/** Форми с доказано по-добро усвояване / клинично изследвани — за обосновката на продукта. */
/** @type {Array<[RegExp, string]>} */
const FORM_LABELS = [
  [/liposom|липозом/i, 'Липозомна форма — по-високо усвояване'],
  [/ubiquinol/i, 'Убихинол — активната форма на Q10'],
  [/creapure/i, 'Creapure® — германски стандарт за чистота'],
  [/verisol/i, 'VERISOL® — клинично изследвани пептиди'],
  [/phytosome/i, 'Фитозомна форма — по-високо усвояване'],
  [/bisglycin|glycinat/i, 'Бисглицинат — най-добре поносимата форма'],
  [/threonat|magtein/i, 'Треонат — преминава в мозъка'],
  [/methyl|метил/i, 'Метилирана (активна) форма'],
  [/r-?alpha|r-?ala\b/i, 'R-ALA — биологично активният изомер'],
  [/krill|крил/i, 'Крил — омега-3 във фосфолипидна форма'],
  [/mk-?7/i, 'K2 като MK-7 — най-дълго действащата форма'],
  [/picolinat|пиколин/i, 'Пиколинат — най-изследваната форма'],
  [/hydro|hydrolyz|хидролиз|peptid|пептид/i, 'Хидролизирани пептиди — бързо усвояване'],
  [/isolat|изолат/i, 'Изолат — протеин без излишни въглехидрати и мазнини'],
  [/acetyl|ацетил/i, 'Ацетил форма — преминава в мозъка'],
  [/piperin|bioperine|black pepper/i, 'С пиперин за по-високо усвояване'],
  [/marine|fish|морск|рибен/i, 'Морски колаген — тип I, като в кожата'],
];

const UNIT_LABEL = { mg: 'мг', mcg: 'мкг', iu: 'IU', g: 'г' };

/**
 * Обосновка на избора за клиента (без марж): доза, форма, клас на марката.
 * @returns {string[]}
 */
export function stackProof(optionKey, name, brand, trustOverrides = null) {
  const out = [];
  const spec = POTENCY[optionKey] || {};
  if (spec.unit) {
    const d = parseDose(name, spec.unit);
    if (d > 0) {
      const strong = spec.strong && d >= spec.strong;
      out.push(`${d.toLocaleString('bg-BG')} ${UNIT_LABEL[spec.unit]} в доза${strong ? ' — силна доза' : ''}`);
    }
  }
  const form = FORM_LABELS.find(([re]) => re.test(String(name || '')));
  if (form) out.push(form[1]);
  const tier = brandTrust(brand, trustOverrides);
  if (tier >= 1) out.push('Елитна марка — фармацевтичен стандарт');
  else if (tier >= PREMIUM_BRAND_TIER) out.push('Премиум марка — GMP производство');
  return out.slice(0, 3);
}

/** Категории, които не са добавки (аксесоари, облекло, храни, хардкор стимуланти). */
const NON_STACK_CATEGORY = /аксесоари|облекло|тениски|уреди|козметика|функционални храни|хардкор|стимулатор/i;

/** Таван на цената на разфасовка (евро) — само срещу кашони и абсурдни разфасовки; протеините имат свой. */
export const DEFAULT_MAX_PRICE = 90;

/** Тегла на маржа: спрямо цената при доставчика тежи повече от маржа в евро. */
export const VALUE_WEIGHTS = { relative: 0.65, absolute: 0.35 };
/** Сила на действие: в силната група влизат продуктите до толкова под най-силния. */
export const POTENCY_BAND = 0.25;
/** Праг за елит: марка поне от масовия клас и поне средна сила (иначе — само резерва). */
export const ELITE_GATE = { brand: 0.6, potency: 0.6 };
/** Висок марж: в групата влизат продуктите с поне толкова от най-високия относителен марж. */
export const MARGIN_BAND = 0.75;
/** Вътре в елитната група: тегла на марката и на цената. */
export const PRESTIGE_WEIGHTS = { brand: 0.55, price: 0.45 };
/** Колко кандидата на място се проверяват на живо при доставчика. */
export const LIVE_BACKUPS_PER_SLOT = 4;

const norm = (s) => String(s || '').trim().toLowerCase();

export function brandTrust(brand, overrides = null) {
  const key = norm(brand);
  const custom = overrides && Object.entries(overrides).find(([b]) => norm(b) === key);
  if (custom && Number(custom[1]) > 0) return Math.min(1.2, Number(custom[1]));
  return BRAND_TIER[key] ?? DEFAULT_BRAND_TIER;
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
export function pickStackVariant(group, maxPrice = DEFAULT_MAX_PRICE, distributor = null) {
  const ok = (group?.variants || []).filter((v) => v.available !== false && variantHasMargin(v)
    && !isStackUnfitPack(v) && (!(maxPrice > 0) || Number(v.retail_price) <= maxPrice)
    && (!distributor || variantDistributor(v, group) === distributor));
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
 * Подрежда кандидатите на едно вещество — три нива:
 *  0. Праг: марка поне ELITE_GATE.brand и сила поне ELITE_GATE.potency (иначе — резерва).
 *  1. Най-подходящи (tier 0) с най-силно действие (доза и форма, до POTENCY_BAND под най-силния).
 *  2. Сред тях — висок марж (поне MARGIN_BAND от най-високия марж спрямо цената при доставчика).
 *  3. В тази елитна група първи са по-скъпите продукти на елитни марки
 *     (PRESTIGE_WEIGHTS: марка 55%, цена 45%), при равенство — по-високият марж.
 * Останалите са резерва при изчерпване: подредени по марж, сила и марка.
 * @param {Array<{ entry: any, fit: number, tier?: number, group?: any, variant: any }>} rows
 * @param {object|null} trustOverrides
 * @param {string} [optionKey]
 */
export function rankByValue(rows, trustOverrides = null, optionKey = '') {
  if (!rows.length) return [];
  /** @type {any[]} */
  const scored = rows.map((r) => {
    const v = variantValue(r.variant);
    return {
      ...r,
      rel: v.rel,
      abs: v.abs,
      price: Number(r.variant.retail_price) || 0,
      potency: potencyScore(optionKey, r.entry.name),
      quality: brandTrust(r.entry.brand, trustOverrides),
    };
  });
  // Само минаващите прага за марка и сила могат да са в елитната група.
  // Формата вече е в силата (potency), затова и продукти извън предпочитаната форма (tier 1) могат да минат.
  const gated = scored.filter((r) => r.quality >= ELITE_GATE.brand && r.potency >= ELITE_GATE.potency);
  const maxPot = Math.max(...gated.map((r) => r.potency), 0);
  const strong = gated.filter((r) => r.potency >= maxPot - POTENCY_BAND);
  const maxRelStrong = Math.max(...strong.map((r) => r.rel), 0);
  const elite = strong.filter((r) => r.rel > 0 && r.rel >= MARGIN_BAND * maxRelStrong);
  const maxPrice = Math.max(...elite.map((r) => r.price), 1e-9);
  for (const r of elite) {
    r.band = 'elite';
    r.score = PRESTIGE_WEIGHTS.brand * r.quality + PRESTIGE_WEIGHTS.price * (r.price / maxPrice);
  }
  elite.sort((a, b) => b.score - a.score || b.rel - a.rel || String(a.entry.name).localeCompare(String(b.entry.name), 'bg'));

  const rest = scored.filter((r) => !elite.includes(r));
  const maxRel = Math.max(...rest.map((r) => r.rel), 1e-9);
  const maxAbs = Math.max(...rest.map((r) => r.abs), 1e-9);
  for (const r of rest) {
    const margin = VALUE_WEIGHTS.relative * (r.rel / maxRel) + VALUE_WEIGHTS.absolute * (r.abs / maxAbs);
    // „strong“ — минава прага за марка и сила, но не е в групата на най-високия марж.
    r.band = gated.includes(r) ? 'strong' : 'reserve';
    r.score = 0.45 * margin + 0.3 * r.potency + 0.25 * r.quality;
  }
  const bandOrder = { strong: 0, reserve: 1 };
  rest.sort((a, b) => bandOrder[a.band] - bandOrder[b.band] || (a.tier || 0) - (b.tier || 0) || b.score - a.score
    || String(a.entry.name).localeCompare(String(b.entry.name), 'bg'));
  return [...elite, ...rest];
}

/**
 * Подреден списък кандидати за място в стака: веществата по ред, във всяко — по стойност.
 * @param {object[]} index
 * @param {{ options: StackOption[] }} slot
 * @param {(groupId: string) => object|null} getGroup
 * @param {{ exclude?: Set<string>, trust?: object|null, distributor?: string|null }} [opts]
 * distributor — само продукти от този доставчик.
 * @returns {Array<any>}
 */
export function rankSlotCandidates(index, slot, getGroup, opts = {}) {
  const exclude = opts.exclude || new Set();
  /** @type {any[]} */
  const out = [];
  for (const option of slot.options) {
    const rows = optionCandidates(index, option)
      .filter(({ entry }) => !exclude.has(String(entry.group_id)))
      .map(({ entry, fit, tier }) => {
        const group = getGroup(String(entry.group_id));
        const variant = group && pickStackVariant(group, option.maxPrice ?? DEFAULT_MAX_PRICE, opts.distributor || null);
        return variant ? { entry, fit, tier, group, variant } : null;
      })
      .filter(Boolean);
    for (const row of rankByValue(rows, opts.trust, option.key)) out.push({ option, ...row });
  }
  // Първо всички продукти над прага (по реда на веществата: елит, после силни),
  // едва после резервата — бюджетен продукт с основното вещество не изпреварва
  // елитен продукт със заместителя.
  const rank = { elite: 0, strong: 0, reserve: 1 };
  return out
    .map((row, i) => ({ row, i }))
    .sort((a, b) => rank[a.row.band] - rank[b.row.band] || a.i - b.i)
    .map(({ row }) => row);
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
 * Сглобява стака от един доставчик: за всяко място — първият наличен кандидат.
 * Един продукт не може да заеме две места.
 * @returns {Array<{ slot: object, pick: object|null, primary: boolean }>}
 */
function resolveForDistributor(index, stack, getGroup, distributor, unavailable, trust) {
  const used = new Set();
  return stack.slots.map((slot) => {
    const ranked = rankSlotCandidates(index, slot, getGroup, { exclude: used, trust, distributor });
    const pick = ranked.find((c) => !unavailable.has(String(c.variant.sku_id))) || null;
    if (pick) used.add(String(pick.entry.group_id));
    return { slot, pick, primary: !!pick && pick.option === slot.options[0] };
  });
}

/**
 * Сравнение на два варианта на пакета (по-голямо — по-добре):
 * пълнота → брой основни вещества → качество × марж спрямо цените при доставчика.
 */
export function stackStrength(slots) {
  const picks = slots.map((s) => s.pick).filter(Boolean);
  let abs = 0;
  let official = 0;
  let quality = 0;
  for (const p of picks) {
    const v = variantValue(p.variant);
    abs += v.abs;
    official += Number(p.variant.f1_reference_price) || Number(p.variant.retail_price) || 0;
    quality += p.quality || DEFAULT_BRAND_TIER;
  }
  const value = picks.length && official > 0 ? (quality / picks.length) * (abs / official) : 0;
  return [picks.length, slots.filter((s) => s.primary).length, value];
}

const stronger = (a, b) => {
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

/** Приоритетният доставчик за пакетите (настройка `stack_preferred_distributor`). */
export const DEFAULT_PREFERRED_DISTRIBUTOR = DISTRIBUTOR_FITNESS1;

/**
 * Сглобява стака изцяло от ЕДИН доставчик — никога смесено.
 * Приоритет: Fitness1. Пакетът се сглобява от него (основно вещество → заместители,
 * между продуктите — качество × марж). Sila се ползва САМО ако Fitness1 не може
 * да запълни и трите места (изчерпано без заместител) — тогава целият пакет минава към Sila.
 * Ако никой не е пълен — по-пълният (stackStrength).
 * @param {object[]} index
 * @param {string} stackId
 * @param {(groupId: string) => object|null} getGroup
 * @param {{ unavailable?: Set<string>, trust?: object|null, distributor?: string, preferred?: string }} [opts]
 * unavailable: sku_id-та, изчерпани при живата проверка; distributor: само този доставчик;
 * preferred: приоритетният доставчик (по подразбиране fitness1).
 * @returns {{ distributor: string|null, fallback: boolean, slots: Array<{ slot: object, pick: object|null, primary: boolean }> }}
 */
export function resolveStack(index, stackId, getGroup, opts = {}) {
  const stack = STACK_RULES[stackId];
  if (!stack) return { distributor: null, fallback: false, slots: [] };
  const unavailable = opts.unavailable || new Set();
  const preferred = STACK_DISTRIBUTORS.includes(String(opts.preferred)) ? String(opts.preferred) : DEFAULT_PREFERRED_DISTRIBUTOR;
  const order = opts.distributor
    ? [opts.distributor]
    : [preferred, ...STACK_DISTRIBUTORS.filter((d) => d !== preferred)];
  let best = null;
  for (const distributor of order) {
    const slots = resolveForDistributor(index, stack, getGroup, distributor, unavailable, opts.trust);
    if (slots.every((s) => s.pick)) {
      return { distributor, fallback: distributor !== order[0], slots };
    }
    const strength = stackStrength(slots);
    if (!best || stronger(strength, best.strength)) best = { distributor, slots, strength };
  }
  const empty = !best || best.strength[0] === 0;
  return { distributor: empty ? null : best.distributor, fallback: !empty && best.distributor !== order[0], slots: best.slots };
}

/** Кандидатите за жива проверка: първите N на всяко място — за всеки доставчик. */
export function liveCheckCandidates(index, stackId, getGroup, opts = {}) {
  const stack = STACK_RULES[stackId];
  if (!stack) return [];
  const rows = [];
  for (const distributor of STACK_DISTRIBUTORS) {
    for (const slot of stack.slots) {
      rows.push(...rankSlotCandidates(index, slot, getGroup, { trust: opts.trust, distributor })
        .slice(0, opts.perSlot || LIVE_BACKUPS_PER_SLOT));
    }
  }
  return rows;
}
