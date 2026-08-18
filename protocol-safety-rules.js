/**
 * Правила за изключване/задължителни съставки при протоколен въпросник.
 * Keyword-based върху име, съставки и описание на продукта.
 */

export const CONDITION_EXCLUSIONS = {
  hypertension: [
    'йохимбин', 'yohimbine', 'ефедра', 'ephedra',
    'thermogenic', 'термоген', 'fat burn', 'fat burner', 'изгар', 'бърн', 'burner',
    'preworkout', 'pre-workout', 'предтрен', 'синефрин', 'synephrine',
  ],
  diabetes: ['берберин', 'berberine', 'хром пиколинат', 'chromium'],
  thyroid: ['йод', 'iodine', 'келп', 'kelp', 'благородна ламинария'],
  autoimmune: ['ехинацея', 'echinacea', 'астрагал', 'astragalus'],
  kidney: [
    'креатин', 'creatine', 'протеин', 'protein', 'whey', 'суроватк', 'казеин', 'casein',
    'mrp', 'meal replacement', 'gainer', 'гейн', 'mass gainer',
  ],
  liver: ['ниацин', 'niacin', 'желязо', 'iron'],
  cardiovascular: [
    'йохимбин', 'yohimbine', 'ефедра', 'ephedra',
    'thermogenic', 'термоген', 'fat burn', 'fat burner', 'изгар', 'бърн', 'burner',
    'preworkout', 'pre-workout', 'предтрен',
  ],
};

export const MEDICATION_EXCLUSIONS = {
  anticoagulants: [
    'омега-3', 'omega-3', 'omega 3', 'рибено масло', 'fish oil', 'krill', 'скарид',
    'витамин e', 'vitamin e', 'куркумин', 'curcumin',
  ],
  ssri: ['5-htp', 'триптофан', 'tryptophan'],
  hormone_therapy: ['фитоестроген', 'phytoestrogen', 'изофлавон', 'isoflavone', 'червена детелина', 'red clover'],
  thyroid_meds: ['йод', 'iodine', 'келп', 'kelp'],
};

export const MEDICATION_MUST_INCLUDE = {
  statins: ['coq10', 'co-q10', 'убихинол', 'ubiquinol', 'коензим q10'],
};

export const ALLERGY_EXCLUSIONS = {
  shellfish: ['миди', 'скарид', 'ракообраз', 'shellfish', 'glucosamine shellfish', 'хондроитин'],
  soy: ['соя', 'soy', 'соев'],
  gluten: ['глутен', 'gluten', 'пшеница', 'wheat'],
  lactose: ['лактоз', 'lactose', 'суроватк', 'whey', 'казеин', 'casein'],
  nuts: ['фъстък', 'peanut', 'бадем', 'almond', 'орех', 'walnut', 'лешник', 'hazelnut'],
};

export const DIET_EXCLUSIONS = {
  vegetarian: ['рибено масло', 'fish oil', 'омега-3 риба', 'gelatin', 'желатин'],
  vegan: ['рибено масло', 'fish oil', 'желатин', 'gelatin', 'суроватк', 'whey', 'казеин', 'casein', 'мед', 'honey', 'пчелен'],
  keto: [],
};

/** Текстов пул от продукт за keyword matching */
export function productSearchText(product) {
  const pd = product.public_data || {};
  const parts = [
    pd.name,
    pd.tagline,
    pd.description,
    product.system_data?.target_profile,
    product.system_data?.portfolio?.category,
    ...(pd.ingredients || []).map((i) => `${i.name} ${i.description || ''}`),
    ...(product.system_data?.goals || []),
    ...(pd.effects || []).map((e) => e.label),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function productMatchesAnyKeyword(text, keywords) {
  const normalized = text.replace(/[-_]/g, ' ');
  return keywords.some((kw) => {
    const k = kw.toLowerCase().replace(/[-_]/g, ' ');
    return normalized.includes(k) || text.includes(kw.toLowerCase());
  });
}

const PREGNANCY_EXCLUSIONS = [
  'мелатонин', 'melatonin', 'ашваганда', 'ashwagandha', 'фитоестроген', 'берберин', 'berberine',
  'ехинацея', 'echinacea', 'saw palmetto', 'palmetto', 'триптофан', 'tryptophan', '5-htp',
  'for men', 'for man', ' men ', ' man ', 'за мъже', 'ecdysterone', 'екдистерон',
  'retinol', 'vitamin a', 'витамин а',
];

export function getExclusionReasons(profile, product) {
  const text = productSearchText(product);
  const reasons = [];

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
  const dietKws = DIET_EXCLUSIONS[profile.diet];
  if (dietKws?.length && productMatchesAnyKeyword(text, dietKws)) {
    reasons.push(`изключен поради хранителен модел: ${profile.diet}`);
  }
  if (profileHasPregnancyOrBreastfeeding(profile)) {
    if (productMatchesAnyKeyword(text, PREGNANCY_EXCLUSIONS)) {
      reasons.push('изключен при бременност/кърмене');
    }
  }
  if (profile.sex === 'female' && profileHasPregnancyOrBreastfeeding(profile)) {
    if (productMatchesAnyKeyword(text, ['for men', 'for man', ' men ', ' man ', 'за мъже', 'multivitamins & minerals man'])) {
      reasons.push('изключен при бременност — не е за жени');
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
