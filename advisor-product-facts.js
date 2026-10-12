/**
 * Факти за продукт, които трите консултанта ползват преди AI:
 *   вид (добавка / храна / аксесоар), функционален слот, стимулант, животински произход, пол,
 *   основна разфасовка (не мостра) и приблизително за колко дни стига.
 *
 * Източници по сила: дървото на категориите от доставчика → името → съставките →
 * описанието (само за конкретни активни вещества, напр. кофеин, и само при слотове, където има смисъл).
 * Изчислява се веднъж на продукт (WeakMap кеш).
 */
import { normalizeMatchText, productMatchesAnyKeyword } from './text-match.js';

/** Слотове: роля в пакета, кога се приема, конфликтна група (по един продукт от група в пакет). */
export const SLOT_META = {
  fat_burner: { label: 'термогенен фетбърнър', timing: 'сутрин, 30 мин преди закуска или тренировка', group: 'fat_burner' },
  fat_burner_nonstim: { label: 'фетбърнър без стимуланти', timing: 'сутрин с храна', group: 'fat_burner' },
  carnitine: { label: 'L-карнитин', timing: 'сутрин или преди тренировка', group: 'carnitine' },
  cla: { label: 'CLA', timing: 'с храна', group: 'cla' },
  appetite: { label: 'контрол на апетита', timing: '30 мин преди основно хранене с чаша вода', group: 'appetite' },
  glucose: { label: 'кръвна захар и метаболизъм', timing: 'с храна', group: 'glucose' },
  diuretic: { label: 'отводняване', timing: 'сутрин', group: 'diuretic' },
  caffeine: { label: 'кофеин / енергия', timing: 'сутрин', group: 'stimulant' },
  preworkout: { label: 'предтренировъчна формула', timing: '20–30 мин преди тренировка', group: 'preworkout' },
  pump: { label: 'азотен бустер без стимуланти', timing: '30 мин преди тренировка', group: 'pump' },
  protein: { label: 'протеин', timing: 'след тренировка или като закуска', group: 'protein' },
  meal: { label: 'заместител на хранене', timing: 'вместо едно хранене', group: 'protein' },
  gainer: { label: 'гейнър', timing: 'между храненията', group: 'gainer' },
  carbs: { label: 'въглехидрати за тренировка', timing: 'по време или след тренировка', group: 'carbs' },
  creatine: { label: 'креатин', timing: 'всеки ден по едно и също време', group: 'creatine' },
  aminos: { label: 'аминокиселини', timing: 'по време или след тренировка', group: 'aminos' },
  electrolytes: { label: 'електролити', timing: 'по време на натоварване или в жега', group: 'electrolytes' },
  multivitamin: { label: 'мултивитамини', timing: 'сутрин със закуска', group: 'multivitamin' },
  vitamin_d: { label: 'витамин D', timing: 'с храна, съдържаща мазнини', group: 'vitamin_d' },
  vitamin_c: { label: 'витамин C', timing: 'сутрин', group: 'vitamin_c' },
  b_complex: { label: 'витамини от група B', timing: 'сутрин със закуска', group: 'b_complex' },
  vitamins: { label: 'витамини', timing: 'с храна', group: 'vitamins' },
  magnesium: { label: 'магнезий', timing: 'вечер', group: 'magnesium' },
  iron: { label: 'желязо', timing: 'сутрин на гладно, с витамин C', group: 'iron' },
  minerals: { label: 'минерали', timing: 'с храна', group: 'minerals' },
  omega3: { label: 'омега-3', timing: 'с храна', group: 'omega3' },
  mct: { label: 'MCT масло', timing: 'сутрин, с кафе или храна', group: 'mct' },
  collagen: { label: 'колаген', timing: 'сутрин', group: 'collagen' },
  beauty: { label: 'коса, кожа и нокти', timing: 'с храна', group: 'beauty' },
  joint: { label: 'стави', timing: 'с храна', group: 'joint' },
  coq10: { label: 'коензим Q10', timing: 'с храна, съдържаща мазнини', group: 'coq10' },
  antioxidant: { label: 'антиоксидант', timing: 'сутрин с храна', group: 'antioxidant' },
  longevity: { label: 'дълголетие (NAD, PQQ, глутатион)', timing: 'сутрин', group: 'longevity' },
  adaptogen: { label: 'адаптоген', timing: 'сутрин', group: 'adaptogen' },
  sleep: { label: 'сън и релакс', timing: 'вечер, 30–60 мин преди сън', group: 'sleep' },
  cognition: { label: 'фокус и памет', timing: 'сутрин', group: 'cognition' },
  gut: { label: 'храносмилане', timing: 'с храна', group: 'gut' },
  immune: { label: 'имунитет', timing: 'сутрин', group: 'immune' },
  liver: { label: 'черен дроб', timing: 'с храна', group: 'liver' },
  heart: { label: 'сърце и съдове', timing: 'с храна', group: 'heart' },
  hormone_male: { label: 'мъжки хормонален баланс', timing: 'сутрин', group: 'hormone_male' },
  womens: { label: 'женско здраве', timing: 'с храна', group: 'womens' },
  mens: { label: 'мъжко здраве', timing: 'с храна', group: 'mens' },
  herbal: { label: 'билков екстракт', timing: 'с храна', group: null },
  other: { label: 'добавка', timing: 'според етикета', group: null },
};

/** Стимулантни слотове — изключват се при „без стимуланти“, хипертония, бременност и т.н. */
const STIM_SLOTS = new Set(['fat_burner', 'caffeine', 'preworkout']);
/** Слотове, при които описанието се проверява за скрит кофеин/синефрин. */
const STIM_CHECK_SLOTS = new Set(['fat_burner', 'fat_burner_nonstim', 'caffeine', 'preworkout', 'pump', 'appetite', 'glucose', 'carnitine', 'cla', 'other', 'herbal', 'cognition', 'aminos', 'electrolytes']);

/**
 * @typedef {{ kind?: string, slot?: string, stim?: boolean, gender?: 'male'|'female', animal?: string[], generic?: boolean }} FactRule
 */

/**
 * Категория (нормализиран път „Горна > Под > Под“) → слот или вид. По-специфичните първо.
 * Съвпадение по подниз в нормализирания път.
 */
/** @type {Array<[string, FactRule]>} */
const CATEGORY_RULES = [
  // Не са добавки
  ['аксесоари за бокс', { kind: 'gear' }],
  ['спортни аксесоари', { kind: 'gear' }],
  ['тениски и облекло', { kind: 'gear' }],
  ['уреди за дома', { kind: 'gear' }],
  ['козметика', { kind: 'gear' }],
  ['гелове и балсами', { kind: 'gear' }],
  ['детски', { kind: 'kids' }],
  ['детско здраве', { kind: 'kids' }],
  ['добавки за деца', { kind: 'kids' }],
  ['заместители на хранене', { slot: 'meal' }],
  ['функционални храни', { kind: 'food' }],
  ['здравословни и спортни храни', { kind: 'food' }],
  // Отслабване
  ['фетбърнъри без стимуланти', { slot: 'fat_burner_nonstim' }],
  ['липотропни', { slot: 'fat_burner_nonstim' }],
  ['термогенни', { slot: 'fat_burner', stim: true }],
  ['синефрин', { slot: 'caffeine', stim: true }],
  ['кофеин', { slot: 'caffeine', stim: true }],
  ['зелено кафе', { slot: 'caffeine', stim: true }],
  ['l карнитин', { slot: 'carnitine' }],
  ['л карнитин', { slot: 'carnitine' }],
  ['ацетил л карнитин', { slot: 'carnitine' }],
  ['л тартрат', { slot: 'carnitine' }],
  ['отслабване и контрол на теглото cla', { slot: 'cla' }],
  [' cla', { slot: 'cla' }],
  ['потискане на апетита', { slot: 'appetite' }],
  ['гарциния', { slot: 'appetite' }],
  ['блокер', { slot: 'appetite' }],
  ['фибри', { slot: 'appetite' }],
  ['африканско манго', { slot: 'appetite' }],
  ['диуретици', { slot: 'diuretic' }],
  ['water out', { slot: 'diuretic' }],
  ['инсулинови имитатори', { slot: 'glucose' }],
  ['въглехидратния метаболизъм', { slot: 'glucose' }],
  ['берберин', { slot: 'glucose' }],
  ['минерали хром', { slot: 'glucose' }],
  ['естроген блокъри', { slot: 'hormone_male' }],
  ['отслабване', { slot: 'fat_burner_nonstim', generic: true }],
  ['изгаряне на мазнини', { slot: 'fat_burner_nonstim', generic: true }],
  // Тренировка
  ['азотни бустери без стимуланти', { slot: 'pump' }],
  ['напомпващи без стимуланти', { slot: 'pump' }],
  ['енергийни шотове', { slot: 'caffeine', stim: true }],
  ['енергетици', { slot: 'caffeine', stim: true }],
  ['предтренировъчни добавки енергийни', { slot: 'caffeine', stim: true }],
  ['предтренировъчни', { slot: 'preworkout', stim: true }],
  ['гейнъри', { slot: 'gainer' }],
  ['all in one', { slot: 'gainer' }],
  ['въглехидрат', { slot: 'carbs' }],
  ['vitargo', { slot: 'carbs' }],
  ['интратренировъчни', { slot: 'carbs' }],
  ['следтренировъчни', { slot: 'aminos' }],
  ['инозин', { slot: 'aminos' }],
  ['качване на маса', { slot: 'gainer' }],
  ['креатин без креатин', { slot: 'pump' }],
  ['креатин', { slot: 'creatine' }],
  ['протеини', { slot: 'protein' }],
  ['аминокиселини триптофан', { slot: 'sleep' }],
  ['аминокиселини тирозин', { slot: 'cognition' }],
  ['аминокиселини аргинин', { slot: 'pump' }],
  ['аминокиселини цитрулин', { slot: 'pump' }],
  ['аминокиселини бета аланин', { slot: 'pump' }],
  ['аминокиселини таурин', { slot: 'aminos' }],
  ['аминокиселини', { slot: 'aminos' }],
  ['хидратация', { slot: 'electrolytes' }],
  ['електролити', { slot: 'electrolytes' }],
  // Хормони и пол
  ['хардкор продукти', { slot: 'hormone_male', gender: 'male' }],
  ['стимулатори на тестостерона', { slot: 'hormone_male', gender: 'male' }],
  ['мъжко здраве', { slot: 'mens', gender: 'male' }],
  ['простата', { slot: 'mens', gender: 'male' }],
  ['сао палмето', { slot: 'mens', gender: 'male' }],
  ['женско здраве', { slot: 'womens', gender: 'female' }],
  ['менопауза', { slot: 'womens', gender: 'female' }],
  ['витамини за жени', { slot: 'multivitamin', gender: 'female' }],
  ['суплементи за жени', { slot: 'multivitamin', gender: 'female' }],
  ['формули за жени', { slot: 'multivitamin', gender: 'female' }],
  ['витамини за мъже', { slot: 'multivitamin', gender: 'male' }],
  ['формули за мъже', { slot: 'multivitamin', gender: 'male' }],
  // Витамини и минерали
  ['мултивитамини', { slot: 'multivitamin' }],
  ['мултиминерали', { slot: 'minerals' }],
  ['витамини витамин d', { slot: 'vitamin_d' }],
  ['витамини витамин c', { slot: 'vitamin_c' }],
  ['витамини б', { slot: 'b_complex' }],
  ['б комплекс', { slot: 'b_complex' }],
  ['биотин', { slot: 'beauty' }],
  ['витамини и минерали', { slot: 'multivitamin' }],
  ['витамини', { slot: 'vitamins' }],
  ['zma', { slot: 'magnesium' }],
  ['магнезий', { slot: 'magnesium' }],
  ['желязо', { slot: 'iron' }],
  ['минерали', { slot: 'minerals' }],
  // Масла
  ['mct', { slot: 'mct' }],
  ['крилово', { slot: 'omega3', animal: ['krill'] }],
  ['рибено масло', { slot: 'omega3', animal: ['fish'] }],
  ['омега 3 от водорасли', { slot: 'omega3' }],
  ['ленено', { slot: 'omega3' }],
  ['лецитин', { slot: 'heart' }],
  ['масло от тиква', { slot: 'mens', gender: 'male' }],
  ['омега', { slot: 'omega3' }],
  ['мастни киселини', { slot: 'omega3' }],
  // Красота, стави, дълголетие
  ['колаген', { slot: 'collagen' }],
  ['хиалуронова', { slot: 'beauty' }],
  ['коса кожа и нокти', { slot: 'beauty' }],
  ['кератин', { slot: 'beauty' }],
  ['красота', { slot: 'beauty' }],
  ['стави', { slot: 'joint' }],
  ['коензим q10', { slot: 'coq10' }],
  ['дълголетие', { slot: 'longevity' }],
  ['anti aging', { slot: 'longevity' }],
  ['антиоксиданти', { slot: 'antioxidant' }],
  // Билки и здравни цели
  ['адаптогени', { slot: 'adaptogen' }],
  ['шиладжит', { slot: 'adaptogen' }],
  ['сън стрес', { slot: 'sleep' }],
  ['подпомагащи съня', { slot: 'sleep' }],
  ['мелатонин', { slot: 'sleep' }],
  ['валериан', { slot: 'sleep' }],
  ['пасифлора', { slot: 'sleep' }],
  ['маточина', { slot: 'sleep' }],
  ['лайка', { slot: 'sleep' }],
  ['мисловната', { slot: 'cognition' }],
  ['фокус и концентрация', { slot: 'cognition' }],
  ['бакопа', { slot: 'cognition' }],
  ['гинкго', { slot: 'cognition' }],
  ['микробиом', { slot: 'gut' }],
  ['пробиотици', { slot: 'gut' }],
  ['ензими', { slot: 'gut' }],
  ['имун', { slot: 'immune' }],
  ['гъби', { slot: 'immune' }],
  ['ехинацея', { slot: 'immune' }],
  ['черния дроб', { slot: 'liver' }],
  ['магарешки бодил', { slot: 'liver' }],
  ['детоксикация', { slot: 'liver' }],
  ['артишок', { slot: 'liver' }],
  ['сърцето', { slot: 'heart' }],
  ['кръвоносните', { slot: 'heart' }],
  ['червен ориз', { slot: 'heart' }],
  ['зелени храни', { slot: 'herbal' }],
  ['куркума', { slot: 'antioxidant' }],
  ['здраве 50', { slot: 'multivitamin' }],
  ['билки', { slot: 'herbal' }],
  ['здраве и тонус', { slot: 'herbal' }],
];

/** Името (и съставките) — за продукти без категория (ръчно добавени) и за „Други“. По-специфичните първо. */
/** @type {Array<[string[], FactRule]>} */
const NAME_RULES = [
  [['shaker', 'шейкър', 'bottle', 'бутилка', 't shirt', 'тениска', 'ръкавиц', 'gloves', 'belt$', 'колан', 'ластик', 'towel', 'кърпа', 'sauce', 'сос$', 'syrup', 'сироп', 'спрей за готвене'], { kind: 'gear' }],
  [['essential oil', 'етерично масло'], { kind: 'gear' }],
  [['protein bar', 'протеинов бар', 'cookie', 'бисквит', 'pancake', 'палачинк', 'peanut butter', 'фъстъчено масло', 'паста$'], { kind: 'food' }],
  [['stim free', 'stimulant free', 'non stim', 'без стимуланти', 'caffeine free', 'lipotropic', 'липотроп'], { slot: 'fat_burner_nonstim' }],
  [['thermo', 'термоген', 'fat burn', 'fatburn', 'фетбърн', 'lipo 6', 'hardcore', 'хардкор', 'shred', 'lida', 'лида'], { slot: 'fat_burner', stim: true }],
  [['l carnitine', 'l карнитин', 'карнитин', 'carnitine'], { slot: 'carnitine' }],
  [[' cla'], { slot: 'cla' }],
  [['glucomannan', 'глюкоманан', 'garcinia', 'гарциния', 'appetite', 'апетит', 'fiber', 'фибри', 'psyllium', 'псилиум'], { slot: 'appetite' }],
  [['birch', 'бреза', 'diuretic', 'диуретик', 'water away', 'отводн'], { slot: 'diuretic' }],
  [['berberine', 'берберин', 'chromium', 'хром$'], { slot: 'glucose' }],
  [['cayenne', 'лют червен пипер', 'slim', 'слим', 'отслаб'], { slot: 'fat_burner_nonstim' }],
  [['pre workout', 'preworkout', 'предтрен'], { slot: 'preworkout', stim: true }],
  [['caffeine', 'кофеин', 'energy shot', 'energy drink'], { slot: 'caffeine', stim: true }],
  [['gainer', 'гейнър'], { slot: 'gainer' }],
  [['creatine', 'креатин'], { slot: 'creatine' }],
  [['whey', 'суроватъч', 'protein', 'протеин', 'isolate', 'казеин', 'casein'], { slot: 'protein' }],
  [['bcaa', 'eaa', 'glutamine', 'глутамин', 'amino', 'амино'], { slot: 'aminos' }],
  [['electrolyte', 'електролит', 'isotonic', 'изотон'], { slot: 'electrolytes' }],
  [['for women', 'за жени', 'women s'], { slot: 'multivitamin', gender: 'female' }],
  [['for men', 'за мъже', 'men s', ' man '], { slot: 'multivitamin', gender: 'male' }],
  [['multivitamin', 'мултивитамин', 'multi vitamin', 'мулти витамин'], { slot: 'multivitamin' }],
  [['vitamin d', 'витамин d', 'витамин д', 'd3'], { slot: 'vitamin_d' }],
  [['vitamin c', 'витамин c', 'витамин ц'], { slot: 'vitamin_c' }],
  [['b complex', 'b 50', 'b 100', 'б комплекс', 'b12', 'b 12'], { slot: 'b_complex' }],
  [['magnesium', 'магнезий', 'zma'], { slot: 'magnesium' }],
  [['iron', 'желязо'], { slot: 'iron' }],
  [['zinc', 'цинк', 'selenium', 'селен', 'calcium', 'калций', 'potassium', 'калий'], { slot: 'minerals' }],
  [['krill', 'крил'], { slot: 'omega3', animal: ['krill'] }],
  [['fish oil', 'рибено масло', 'salmon', 'сьомга', 'cod liver', 'черен дроб на треска'], { slot: 'omega3', animal: ['fish'] }],
  [['omega', 'омега', 'dha', 'epa'], { slot: 'omega3' }],
  [['mct'], { slot: 'mct' }],
  [['collagen', 'колаген'], { slot: 'collagen' }],
  [['biotin', 'биотин', 'hair skin', 'hyaluronic', 'хиалурон', 'keratin'], { slot: 'beauty' }],
  [['glucosamine', 'глюкозамин', 'chondroitin', 'хондроитин', 'msm', 'joint', 'став', 'boswellia', 'босвелия'], { slot: 'joint' }],
  [['coq10', 'co q10', 'коензим', 'ubiquinol', 'убихинол'], { slot: 'coq10' }],
  [['nad', 'nmn', 'pqq', 'glutathione', 'глутатион', 'spermidine', 'спермидин', 'resveratrol', 'ресвератрол'], { slot: 'longevity' }],
  [['melatonin', 'мелатонин', 'sleep', 'сън$', 'valerian', 'валериан', '5 htp', 'gaba', 'theanine', 'теанин', 'glycine', 'глицин'], { slot: 'sleep' }],
  [['red yeast rice', 'червен ориз', 'lecithin', 'лецитин', 'omega 7'], { slot: 'heart' }],
  [['evening primrose', 'вечерна иглика', 'shatavari', 'шатавари'], { slot: 'womens', gender: 'female' }],
  [['egg pro', 'egg protein', 'яйчен протеин'], { slot: 'protein', animal: ['egg'] }],
  [['dextrin', 'декстрин', 'carbo', 'карбо', 'maltodextrin', 'малтодекстрин'], { slot: 'carbs' }],
  [['pudding', 'пудинг'], { kind: 'food' }],
  [['ashwagandha', 'ashvagandha', 'ашваганда', 'rhodiola', 'родиола', 'shilajit', 'шиладжит', 'adaptogen', 'адаптоген', 'ginseng', 'женшен', 'maca', 'мака$'], { slot: 'adaptogen' }],
  [['ginkgo', 'гинкго', 'bacopa', 'бакопа', 'lion s mane', 'nootropic', 'ноотроп', 'focus', 'фокус', 'memory', 'памет'], { slot: 'cognition' }],
  [['probiotic', 'пробиот', 'enzyme', 'ензим', 'digest', 'храносмил'], { slot: 'gut' }],
  [['immune', 'имун', 'echinacea', 'ехинацея', 'ahcc', 'beta glucan', 'бета глюкан'], { slot: 'immune' }],
  [['milk thistle', 'магарешки бодил', 'silymarin', 'силимарин', 'liver', 'detox', 'детокс'], { slot: 'liver' }],
  [['testosterone', 'тестостерон', 'tribulus', 'трибулус', 'prostate', 'простат', 'saw palmetto'], { slot: 'mens', gender: 'male' }],
  [['menopause', 'менопауза'], { slot: 'womens', gender: 'female' }],
  [['antioxidant', 'антиоксидант', 'alpha lipoic', 'алфа липоева', 'quercetin', 'кверцетин', 'curcumin', 'куркум', 'apigenin', 'апигенин', 'astaxanthin'], { slot: 'antioxidant' }],
  [['vitamin', 'витамин'], { slot: 'vitamins' }],
];

/** Недвусмислено име печели срещу грешна категория при доставчика (напр. гейнър в „Креатин > Без креатин“). */
/** @type {Array<[string[], FactRule]>} */
const STRONG_NAME_RULES = [
  [['gainer', 'гейнър', 'mass gainer'], { slot: 'gainer' }],
  [['fish oil', 'рибено масло', 'krill oil', 'крилово масло'], { slot: 'omega3' }],
  [['melatonin', 'мелатонин'], { slot: 'sleep' }],
  [['coq10', 'co q10', 'ubiquinol', 'убихинол', 'коензим q10'], { slot: 'coq10' }],
];

/** Храни в категории на добавки (протеинови барове, каши, чашки) — по името. */
const FOOD_NAME = ['bar$', 'bars$', 'бар$', 'барове', 'porridge', 'каша$', 'cups$', 'pancake', 'cookie', 'crunchy'];

/** Една ампула / саше / бар като отделен продукт. */
const SINGLE_DOSE_NAME = ['1 amp', '1 ампула', '1 бр$', '1 sachet', '1 саше', '1 serving', '1 доза', '1 shot', '1 stick', 'shot$', 'шот$', 'energy gel', 'енергиен гел'];

/** Конкретни стимулантни активни вещества (търсят се и в описанието при STIM_CHECK_SLOTS). */
const STIMULANT_ACTIVES = [
  'кофеин', 'caffeine', 'гуарана', 'guarana', 'синефрин', 'synephrine', 'йохимбин', 'yohimbine',
  'ефедр', 'ephedr', 'dmaa', 'dmha', 'теакрин', 'teacrine', 'паулиния', 'paullinia',
  'зелено кафе', 'green coffee', 'кола нут', 'kola nut', 'теобромин', 'theobromine',
];
const STIM_NEGATIONS = [
  'без кофеин', 'caffeine free', 'stim free', 'stimulant free', 'non stim', 'без стимуланти',
  'нестимулант', 'decaf', 'безкофеин', 'не съдържа кофеин', 'не съдържа стимуланти',
];

const ANIMAL_KEYWORDS = {
  fish: ['fish oil', 'рибено', 'сьомга', 'salmon', 'cod liver', 'треска', 'риба$', 'рибен', 'anchov', 'sardin'],
  krill: ['krill', 'крил'],
  collagen: ['collagen', 'колаген'],
  dairy: ['whey', 'суроват', 'казеин', 'casein', 'млечн', 'milk protein', 'colostrum', 'коластра', 'lactose', 'лактоза'],
  egg: ['яйчен', 'egg protein', 'egg white'],
  beef: ['телешк', 'beef', 'говежд'],
  gelatin: ['желатин', 'gelatin'],
  honey: ['пчелен', 'honey', 'мед$', 'прополис', 'propolis', 'royal jelly', 'пчелно млечице'],
};
const VEGAN_MARKERS = ['vegan', 'веган', 'plant based', 'растителен', 'растителни', 'водорасли', 'algae', 'algal', 'ленено', 'flax'];

const NEGATION_PATTERNS = STIM_NEGATIONS.map((n) => normalizeMatchText(n));
/** Нормализиран текст без фразите-отрицания („без кофеин“ → махнато). */
function stripNegations(text) {
  let out = normalizeMatchText(text);
  for (const neg of NEGATION_PATTERNS) out = out.split(neg).join(' ');
  return out.replace(/\s+/g, ' ').trim();
}

const SAMPLE_LABEL_RE = /^(1\s*(бр\.?|pcs?|pc|x\b|порц|доз|dose|serving|shot|stick|сашe|саше)|мостра|sample|проба|trial|tester|single)/i;
const UNIT_RE = /(\d{1,4})\s*(?:бр\.?\s*)?(капсул|caps|vcaps|softgel|софтгел|таблет|tabs?|драже|дъвчащ|gummies|желир|ампул|amp|сашет|sachet|stick|флакон|дози|порции|servings)/i;
const MASS_RE = /(\d{2,5}(?:[.,]\d+)?)\s*(кг|kg|грам|гр\.?|g\b|gr\b|мл|ml|л\b|l\b)/i;

function categoryText(product) {
  const portfolio = product.system_data?.portfolio || {};
  return [portfolio.category, portfolio.category_top, ...(portfolio.category_path || []), product.system_data?.category]
    .filter(Boolean).join(' > ');
}

function nameText(product) {
  const pd = product.public_data || {};
  return [pd.name, pd.tagline, ...(pd.ingredients || []).map((i) => i?.name)].filter(Boolean).join(' ');
}

function descriptionText(product) {
  const pd = product.public_data || {};
  return [pd.description, pd.about_content, ...(pd.ingredients || []).map((i) => i?.description)].filter(Boolean).join(' ');
}

/** @type {Array<[string, FactRule]>} */
const CATEGORY_RULES_NORMALIZED = CATEGORY_RULES.map(([pattern, rule]) => [` ${normalizeMatchText(pattern)}`, rule]);
const categoryRuleCache = new Map();

/** @returns {FactRule|null} */
function matchCategory(product) {
  const raw = categoryText(product);
  if (!raw) return null;
  if (categoryRuleCache.has(raw)) return categoryRuleCache.get(raw);
  const path = ` ${normalizeMatchText(raw)} `;
  let hit = null;
  for (const [pattern, rule] of CATEGORY_RULES_NORMALIZED) {
    if (path.includes(pattern)) {
      hit = rule;
      break;
    }
  }
  if (categoryRuleCache.size > 3000) categoryRuleCache.clear();
  categoryRuleCache.set(raw, hit);
  return hit;
}

/** @returns {FactRule|null} */
function matchName(product) {
  const text = nameText(product);
  for (const [keywords, rule] of NAME_RULES) {
    if (productMatchesAnyKeyword(text, keywords)) return rule;
  }
  return null;
}

function parsePrice(v) {
  const n = Number(v?.price);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Мостра / единична доза — не се препоръчва и не определя цената на продукта. */
export function isSampleVariantLabel(label) {
  const text = String(label || '').trim();
  if (!text) return false;
  if (SAMPLE_LABEL_RE.test(text)) return true;
  if (/\d+\s*[xх×]\s*\d+/i.test(text)) return false; // „12 x 60 г“ — кутия, не мостра
  const mass = text.match(MASS_RE);
  if (mass) {
    const value = Number(mass[1].replace(',', '.'));
    const unit = mass[2].toLowerCase();
    // 30 г / 55 г — една порция прах или бар. Милилитрите не са критерий: спрейовете и капките са 25–50 мл за месеци.
    if (/^(грам|гр\.?|g|gr)$/.test(unit) && value > 0 && value <= 70) return true;
  }
  return false;
}

/**
 * Основната разфасовка: най-евтината налична, която не е мостра (ако всички са мостри — най-евтината).
 * @returns {{ variant: object|null, price: number }}
 */
export function pickMainVariant(product) {
  const variants = (product?.public_data?.variants || []).filter((v) => v.available !== false && parsePrice(v) > 0);
  if (!variants.length) {
    const pd = product?.public_data || {};
    const price = Number(pd.sale_price) > 0 ? Number(pd.sale_price) : Number(pd.price) || 0;
    return { variant: null, price };
  }
  const regular = variants.filter((v) => !isSampleVariantLabel(v.option_name));
  const pool = regular.length ? regular : variants;
  const variant = pool.reduce((min, v) => (parsePrice(v) < parsePrice(min) ? v : min));
  return { variant, price: parsePrice(variant) };
}

/** Порция по подразбиране за прахове (г), когато етикетът не е наличен. */
const DEFAULT_SERVING_G = {
  protein: 30, meal: 50, gainer: 100, carbs: 50, creatine: 5, aminos: 10, preworkout: 10, pump: 8,
  electrolytes: 10, collagen: 10, appetite: 5, fat_burner: 5, fat_burner_nonstim: 5, beauty: 10,
};
/** Капсули/таблетки на ден по подразбиране, когато етикетът не е наличен. */
const DEFAULT_UNITS_PER_DAY = {
  multivitamin: 1, vitamin_d: 1, vitamin_c: 1, b_complex: 1, iron: 1, coq10: 1, longevity: 1, sleep: 1,
  omega3: 2, magnesium: 2, joint: 2, fat_burner: 2, fat_burner_nonstim: 2, carnitine: 2, cla: 3,
  creatine: 4, aminos: 4, collagen: 4, appetite: 3,
};

/**
 * Приблизително за колко дни стига разфасовката — само за вътрешно сравнение на цени (не се показва).
 * Показваната месечна цена остава getPackDaysSupply (само при известна доза).
 */
export function estimateDaysSupply(product, variant, slot) {
  const label = [variant?.option_name, product?.public_data?.packaging?.capsules_or_grams, product?.public_data?.name]
    .filter(Boolean).join(' ');
  const doses = label.match(/(\d{1,3})\s*(?:дози|порции|servings|doses)/i);
  if (doses) return Math.max(7, Math.min(365, Number(doses[1])));
  const units = label.match(UNIT_RE);
  if (units) {
    const perDay = DEFAULT_UNITS_PER_DAY[slot] || 2;
    return Math.max(7, Math.min(365, Math.floor(Number(units[1]) / perDay)));
  }
  const mass = label.match(MASS_RE);
  if (mass) {
    const value = Number(mass[1].replace(',', '.'));
    const unit = mass[2].toLowerCase();
    const grams = /^(кг|kg|л|l)$/.test(unit) ? value * 1000 : value;
    const serving = DEFAULT_SERVING_G[slot] || 10;
    return Math.max(7, Math.min(365, Math.floor(grams / serving)));
  }
  return 30;
}

function detectAnimal(product, slot, ruleAnimal = []) {
  const name = nameText(product);
  const cat = categoryText(product);
  const both = `${name} ${cat}`;
  const vegan = productMatchesAnyKeyword(both, VEGAN_MARKERS);
  const found = new Set(ruleAnimal);
  for (const [kind, keywords] of Object.entries(ANIMAL_KEYWORDS)) {
    if (kind === 'gelatin' || kind === 'honey') {
      // Желатин/мед често са само в съставките/описанието.
      if (productMatchesAnyKeyword(`${both} ${descriptionText(product)}`, keywords)) found.add(kind);
      continue;
    }
    if (productMatchesAnyKeyword(both, keywords)) found.add(kind);
  }
  if (slot === 'collagen' && !vegan) found.add('collagen');
  if (slot === 'protein' && !vegan && !found.size) found.add('dairy');
  if (slot === 'omega3' && !vegan && !found.has('krill')) found.add('fish');
  if (vegan) {
    found.delete('dairy');
    found.delete('fish');
    if (slot !== 'collagen') found.delete('collagen');
  }
  return [...found];
}

function detectGender(product, ruleGender) {
  if (ruleGender) return ruleGender;
  const text = `${nameText(product)} ${categoryText(product)}`;
  const female = productMatchesAnyKeyword(text, ['for women', 'за жени', 'women s', 'woman', 'дамск', 'for her', 'female', 'менопауза']);
  const male = productMatchesAnyKeyword(text, ['for men', 'за мъже', 'men s', ' man ', 'мъжк', 'for him', 'male', 'prostate', 'простат', 'тестостерон', 'testosterone']);
  if (female && !male) return 'female';
  if (male && !female) return 'male';
  return null;
}

/** Ръчно добавени продукти без категория: целите от админа (weight-loss, appetite-control…). */
/** @returns {FactRule} */
function goalsRule(product) {
  const goals = (product.system_data?.goals || []).map((g) => String(g).toLowerCase());
  if (goals.some((g) => ['appetite-control', 'satiety'].includes(g)) && !goals.includes('weight-loss')) return { slot: 'appetite' };
  if (goals.some((g) => ['weight-loss', 'fat-burning', 'thermogenesis', 'fat-metabolism', 'metabolism-boost'].includes(g))) return { slot: 'fat_burner_nonstim' };
  if (goals.some((g) => ['water-retention', 'cellulite-reduction'].includes(g))) return { slot: 'diuretic' };
  if (goals.some((g) => ['sleep-support', 'sleep-improvement'].includes(g))) return { slot: 'sleep' };
  return {};
}

const factsCache = new WeakMap();

/**
 * kind: supplement | food | gear | kids | sample; source: category | name | none.
 * @returns {{ kind: string, slot: string, group: string|null, stimulant: boolean,
 *   thermogenic: boolean, animal: string[], gender: string|null, variant: any, price: number,
 *   est_days: number, est_monthly_eur: number, source: string }}
 */
export function getProductFacts(product) {
  if (product && typeof product === 'object' && factsCache.has(product)) return factsCache.get(product);

  const byCategory = matchCategory(product);
  const byName = matchName(product);
  // Категорията печели; „Други“ и общите категории се уточняват по име.
  const generic = !byCategory || byCategory.generic || (!byCategory.kind && ['herbal', 'vitamins', 'other', 'antioxidant', 'minerals'].includes(byCategory.slot));
  /** @type {FactRule} */
  let rule = byCategory || byName || {};
  if (generic && byName) rule = byName.kind && byCategory?.slot ? byCategory : byName;
  if (byCategory?.slot && !byCategory.kind) {
    const strong = STRONG_NAME_RULES.find(([keywords]) => productMatchesAnyKeyword(nameText(product), keywords));
    if (strong && strong[1].slot !== byCategory.slot) rule = { ...byCategory, ...strong[1] };
  }
  if (!rule.kind && (!rule.slot || rule.slot === 'other')) rule = { ...rule, ...goalsRule(product) };
  if (!rule.kind && productMatchesAnyKeyword(String(product.public_data?.name || ''), FOOD_NAME)) rule = { ...rule, kind: 'food' };

  const { variant, price } = pickMainVariant(product);
  const productName = String(product.public_data?.name || '');
  const multipack = productMatchesAnyKeyword(productName, ['box', 'кутия', 'pack$', 'пакет$', 'variety']);
  const ruleSlot = rule.slot || 'other';
  // Граматурата като критерий за мостра важи само за прахове с голяма порция (протеин, гейнър, предтренировъчни…).
  const portionPowder = Boolean(DEFAULT_SERVING_G[ruleSlot]) && DEFAULT_SERVING_G[ruleSlot] >= 8;
  const singleDose = (!multipack && productMatchesAnyKeyword(productName, SINGLE_DOSE_NAME))
    || (variant && SAMPLE_LABEL_RE.test(String(variant.option_name || '').trim()))
    || (variant && portionPowder && isSampleVariantLabel(variant.option_name))
    || (price > 0 && price < 3);
  const kind = rule.kind || (singleDose ? 'sample' : 'supplement');
  const slot = rule.slot || (kind === 'supplement' ? 'other' : kind);
  // Категорията на доставчика („без стимуланти“) не е надеждна: решават името и описанието.
  // Отрицанията („без кофеин“, „caffeine free“) се махат от текста, преди да се търсят активните вещества.
  const nameNoNeg = stripNegations(nameText(product));
  const nameSaysStimFree = nameNoNeg !== normalizeMatchText(nameText(product));
  let stimulant = (!!rule.stim && !nameSaysStimFree) || productMatchesAnyKeyword(nameNoNeg, STIMULANT_ACTIVES);
  if (!stimulant && STIM_CHECK_SLOTS.has(slot)) {
    stimulant = productMatchesAnyKeyword(stripNegations(descriptionText(product)), STIMULANT_ACTIVES);
  }
  const effectiveSlot = slot === 'fat_burner' && !stimulant ? 'fat_burner_nonstim'
    : slot === 'fat_burner_nonstim' && stimulant ? 'fat_burner'
      : slot;

  const estDays = estimateDaysSupply(product, variant, effectiveSlot);
  const facts = {
    kind,
    slot: effectiveSlot,
    group: SLOT_META[effectiveSlot]?.group ?? null,
    stimulant,
    thermogenic: stimulant || effectiveSlot === 'fat_burner',
    animal: detectAnimal(product, effectiveSlot, rule.animal),
    gender: detectGender(product, rule.gender),
    variant,
    price,
    est_days: estDays,
    est_monthly_eur: price > 0 ? Math.round((price * 30 / estDays) * 100) / 100 : 0,
    source: byCategory ? 'category' : (byName ? 'name' : 'none'),
  };
  if (product && typeof product === 'object') factsCache.set(product, facts);
  return facts;
}

export function isAdvisorSupplement(product) {
  return getProductFacts(product).kind === 'supplement';
}

/** Два продукта не бива да са в един пакет: същата група или два стимуланта, или стимулант + сън. */
export function factsConflict(a, b) {
  const fa = getProductFacts(a);
  const fb = getProductFacts(b);
  if (fa.group && fa.group === fb.group) return true;
  if (fa.stimulant && fb.stimulant) return true;
  if ((fa.stimulant && fb.slot === 'sleep') || (fb.stimulant && fa.slot === 'sleep')) return true;
  if (fa.slot === 'fat_burner_nonstim' && fb.slot === 'fat_burner') return true;
  if (fb.slot === 'fat_burner_nonstim' && fa.slot === 'fat_burner') return true;
  return false;
}
