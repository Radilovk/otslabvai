/**
 * Правила за изключване/задължителни съставки при протоколен въпросник.
 * Структурни правила (вид продукт, стимулант, животински произход, пол) идват от advisor-product-facts.js,
 * а ключовите думи — по цели думи върху име, съставки и описание.
 */
import { productSearchText, productMatchesAnyKeyword } from './text-match.js';
import { getProductFacts } from './advisor-product-facts.js';

/**
 * Ключови думи (активни вещества) по състояние. Стимулантите и термогенните бърнъри се хващат
 * структурно (getProductFacts().stimulant), не по думи от описанието.
 */
export const CONDITION_EXCLUSIONS = {
  hypertension: [
    'йохимбин', 'yohimbine', 'ефедра', 'ephedra', 'синефрин', 'synephrine',
    // Женското биле (глициризин) вдига кръвното.
    'женско биле', 'licorice', 'liquorice', 'glycyrrhiz', 'глициризин',
  ],
  diabetes: ['берберин', 'berberine', 'хром пиколинат', 'chromium'],
  thyroid: ['йод', 'iodine', 'келп', 'kelp', 'благородна ламинария'],
  autoimmune: ['ехинацея', 'echinacea', 'астрагал', 'astragalus', 'спирулина', 'spirulina', 'хлорела', 'chlorella'],
  kidney: [
    'креатин', 'creatine', 'протеин', 'protein', 'whey', 'суроватк', 'казеин', 'casein',
    'mrp', 'meal replacement', 'gainer', 'гейн', 'mass gainer',
  ],
  liver: [
    'ниацин', 'niacin', 'желязо', 'iron',
    // Високодозов екстракт от зелен чай (EGCG) и усинова киселина — описани случаи на чернодробно увреждане.
    'egcg', 'green tea extract', 'екстракт от зелен чай', 'usnic', 'усинов',
  ],
  cardiovascular: [
    'йохимбин', 'yohimbine', 'ефедра', 'ephedra', 'синефрин', 'synephrine',
    'женско биле', 'licorice', 'liquorice', 'glycyrrhiz',
  ],
};

/** Състояния, при които стимулантите (кофеин, синефрин, термогенни бърнъри, предтренировъчни) не се предлагат. */
const STIMULANT_FREE_CONDITIONS = new Set(['hypertension', 'cardiovascular', 'thyroid']);

export const MEDICATION_EXCLUSIONS = {
  anticoagulants: [
    'омега-3', 'omega-3', 'omega 3', 'рибено масло', 'fish oil', 'krill', 'крил', 'скарид',
    'витамин e', 'витамин е', 'vitamin e', 'adek', 'куркумин', 'curcumin', 'куркума', 'turmeric',
    'гинкго', 'ginkgo', 'наттокиназа', 'nattokinase', 'серапептаза', 'serrapeptase',
    // Витамин K противодейства на варфарин.
    'витамин k', 'витамин к', 'vitamin k', 'k2', 'mk 7',
    'чесън', 'garlic', 'донг куай', 'dong quai',
  ],
  ssri: [
    '5-htp', 'триптофан', 'tryptophan',
    // Серотонинов синдром.
    'жълт кантарион', 'st john', 'hypericum', 's adenosyl', 'sam e$',
  ],
  // Жълтият кантарион отслабва хормоналната контрацепция и терапия.
  hormone_therapy: [
    'фитоестроген', 'phytoestrogen', 'изофлавон', 'isoflavone', 'червена детелина', 'red clover',
    'жълт кантарион', 'st john', 'hypericum',
  ],
  thyroid_meds: ['йод', 'iodine', 'келп', 'kelp'],
  // Червеният ориз съдържа монаколин K (същото като ловастатин).
  statins: ['червен ориз', 'red yeast rice', 'монаколин', 'monacolin'],
};

export const MEDICATION_MUST_INCLUDE = {
  statins: ['coq10', 'co-q10', 'убихинол', 'ubiquinol', 'коензим q10'],
};

export const ALLERGY_EXCLUSIONS = {
  shellfish: ['миди', 'скарид', 'ракообраз', 'shellfish', 'krill', 'крил', 'хондроитин'],
  soy: ['соя', 'soy', 'соев'],
  gluten: ['глутен', 'gluten', 'пшеница', 'wheat'],
  lactose: ['лактоз', 'lactose', 'суроватк', 'whey', 'казеин', 'casein'],
  nuts: ['фъстък', 'peanut', 'бадем', 'almond', 'орех', 'walnut', 'лешник', 'hazelnut'],
};

/** Животински произход (от getProductFacts().animal), недопустим при съответния хранителен модел. */
const DIET_ANIMAL_EXCLUSIONS = {
  vegetarian: new Set(['fish', 'krill', 'collagen', 'beef', 'gelatin']),
  vegan: new Set(['fish', 'krill', 'collagen', 'beef', 'gelatin', 'dairy', 'egg', 'honey']),
};

export const DIET_EXCLUSIONS = {
  vegetarian: ['рибено масло', 'fish oil', 'gelatin', 'желатин'],
  vegan: ['рибено масло', 'fish oil', 'желатин', 'gelatin', 'суроватк', 'whey', 'казеин', 'casein', 'мед$', 'honey', 'пчелен'],
  keto: [],
};

export { productSearchText, normalizeMatchText, productMatchesAnyKeyword, firstMatchingKeyword } from './text-match.js';

const PREGNANCY_EXCLUSIONS = [
  'мелатонин', 'melatonin', 'ашваганда', 'ashwagandha', 'фитоестроген', 'берберин', 'berberine',
  'ехинацея', 'echinacea', 'saw palmetto', 'palmetto', 'триптофан', 'tryptophan', '5-htp',
  'ecdysterone', 'екдистерон', 'retinol', 'ретинол', 'vitamin a', 'витамин а', 'витамин a',
  'жълт кантарион', 'st john', 'женско биле', 'licorice', 'green tea extract', 'екстракт от зелен чай',
];
/** При бременност/кърмене не се предлагат продукти за отслабване, хормони и тренировъчни стимуланти. */
const PREGNANCY_EXCLUDED_SLOTS = new Set([
  'fat_burner', 'fat_burner_nonstim', 'appetite', 'diuretic', 'glucose', 'cla', 'caffeine', 'preworkout',
  'hormone_male', 'creatine', 'gainer',
]);

/** Причина продуктът изобщо да не е за консултанта (не е добавка за възрастен). */
export function getProductKindExclusion(product) {
  const { kind } = getProductFacts(product);
  if (kind === 'gear') return 'не е хранителна добавка';
  if (kind === 'food') return 'храна, не добавка';
  if (kind === 'kids') return 'продукт за деца';
  if (kind === 'sample') return 'мостра / единична доза';
  return null;
}

/** Профилът изключва стимуланти (отговор „без стимуланти“/чувствителност, състояние, бременност). */
export function profileExcludesStimulants(profile = {}) {
  if (profile.stimulant_tolerance === 'avoid' || profile.stimulant_tolerance === 'sensitive') return true;
  if ((profile.conditions || []).some((c) => STIMULANT_FREE_CONDITIONS.has(c))) return true;
  return profileHasPregnancyOrBreastfeeding(profile);
}

export function getExclusionReasons(profile, product) {
  const text = productSearchText(product);
  const facts = getProductFacts(product);
  const reasons = [];

  const kindReason = getProductKindExclusion(product);
  if (kindReason) reasons.push(kindReason);

  if (facts.gender && (profile.sex === 'male' || profile.sex === 'female') && facts.gender !== profile.sex) {
    reasons.push(facts.gender === 'male' ? 'продукт за мъже' : 'продукт за жени');
  }

  if (facts.stimulant && profileExcludesStimulants(profile)) {
    const cond = (profile.conditions || []).find((c) => STIMULANT_FREE_CONDITIONS.has(c));
    reasons.push(cond ? `стимулант — изключен поради състояние: ${cond}` : 'стимулант — изключен по профила');
  }

  for (const cond of profile.conditions || []) {
    const kws = CONDITION_EXCLUSIONS[cond];
    if (kws && productMatchesAnyKeyword(text, kws)) {
      reasons.push(`изключен поради състояние: ${cond}`);
    }
  }
  for (const med of profile.medications || []) {
    const kws = MEDICATION_EXCLUSIONS[med];
    if (kws && productMatchesAnyKeyword(text, kws)) {
      reasons.push(`изключен поради медикамент: ${med}`);
    }
  }
  for (const allergy of profile.allergies || []) {
    const kws = ALLERGY_EXCLUSIONS[allergy];
    if (kws && productMatchesAnyKeyword(text, kws)) {
      reasons.push(`изключен поради алергия: ${allergy}`);
    }
  }
  if ((profile.allergies || []).includes('lactose') && facts.animal.includes('dairy') && !reasons.some((r) => r.includes('lactose'))) {
    reasons.push('изключен поради алергия: lactose');
  }

  const animalBan = DIET_ANIMAL_EXCLUSIONS[profile.diet];
  const dietKws = DIET_EXCLUSIONS[profile.diet];
  if ((animalBan && facts.animal.some((a) => animalBan.has(a)))
    || (dietKws?.length && productMatchesAnyKeyword(text, dietKws))) {
    reasons.push(`изключен поради хранителен модел: ${profile.diet}`);
  }

  if (profileHasPregnancyOrBreastfeeding(profile)) {
    if (productMatchesAnyKeyword(text, PREGNANCY_EXCLUSIONS) || PREGNANCY_EXCLUDED_SLOTS.has(facts.slot)) {
      reasons.push('изключен при бременност/кърмене');
    }
  }
  return reasons;
}

export function profileHasPregnancyOrBreastfeeding(profile) {
  const conditions = profile.conditions || [];
  return conditions.includes('pregnancy')
    || conditions.includes('breastfeeding')
    || profile.pregnancy === 'yes';
}

export function getMustIncludeKeywords(profile) {
  const keywords = [];
  for (const med of profile.medications || []) {
    const kws = MEDICATION_MUST_INCLUDE[med];
    if (kws) keywords.push(...kws);
  }
  return keywords;
}
