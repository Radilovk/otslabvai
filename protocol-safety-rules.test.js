import {
  getExclusionReasons,
  productMatchesAnyKeyword,
  CONDITION_EXCLUSIONS,
} from './protocol-safety-rules.js';

describe('protocol-safety-rules', () => {
  test('kidney изключва английски protein в името', () => {
    const product = {
      public_data: { name: 'Critical Oats | Protein Porridge Powder' },
      system_data: { portfolio: {} },
    };
    const profile = { conditions: ['kidney'], medications: [], allergies: [], diet: 'omnivore' };
    expect(getExclusionReasons(profile, product).length).toBeGreaterThan(0);
  });

  test('hypertension изключва thermogenic fat burner', () => {
    const product = {
      public_data: { name: 'The Omen Thermogenic Fat Burner' },
      system_data: { portfolio: {} },
    };
    const profile = { conditions: ['hypertension'], medications: [], allergies: [], diet: 'omnivore' };
    expect(getExclusionReasons(profile, product).length).toBeGreaterThan(0);
  });

  test('pregnancy изключва saw palmetto и мъжки мултивитамин', () => {
    const profile = {
      conditions: ['pregnancy'],
      pregnancy: 'yes',
      sex: 'female',
      medications: [],
      allergies: [],
      diet: 'vegetarian',
    };
    const palmetto = { public_data: { name: 'Saw Palmetto Extract' }, system_data: {} };
    const manMulti = { public_data: { name: 'Multivitamins & Minerals Man' }, system_data: {} };
    expect(getExclusionReasons(profile, palmetto).length).toBeGreaterThan(0);
    expect(getExclusionReasons(profile, manMulti).length).toBeGreaterThan(0);
  });

  test('anticoagulants изключват krill oil', () => {
    const product = { public_data: { name: 'Super Krill Oil 1180 mg' }, system_data: {} };
    const profile = { conditions: [], medications: ['anticoagulants'], allergies: [], diet: 'omnivore' };
    expect(getExclusionReasons(profile, product).length).toBeGreaterThan(0);
  });
});

describe('правила по цели думи и факти за продукта', () => {
  const p = (name, extra = {}, cat = '') => ({
    product_id: name,
    public_data: { name, variants: [{ price: 20, available: true, option_name: '60 капсули' }], ...extra },
    system_data: { portfolio: { category: cat } },
  });
  const base = { conditions: [], medications: [], allergies: [], diet: 'omnivore' };

  test('думите се търсят като думи: fat ≠ fatigue, epa ≠ repair, стимулант ≠ стимулира', () => {
    expect(productMatchesAnyKeyword('reduces fatigue', ['fat'])).toBe(false);
    expect(productMatchesAnyKeyword('cell repair', ['epa'])).toBe(false);
    expect(productMatchesAnyKeyword('стимулира имунитета', ['стимулант'])).toBe(false);
    expect(productMatchesAnyKeyword('болки в ставите', ['став'])).toBe(true);
    expect(productMatchesAnyKeyword('Йохимбин HCL', ['йохимбин'])).toBe(true);
  });

  test('веган: без крил, морски колаген и суроватка; вегетарианец може суроватка', () => {
    const vegan = { ...base, diet: 'vegan' };
    const veg = { ...base, diet: 'vegetarian' };
    expect(getExclusionReasons(vegan, p('Super Krill Oil')).length).toBeGreaterThan(0);
    expect(getExclusionReasons(vegan, p('Marine Collagen Peptides')).length).toBeGreaterThan(0);
    expect(getExclusionReasons(vegan, p('Whey Isolate', {}, 'Протеини > Суроватъчен изолат')).length).toBeGreaterThan(0);
    expect(getExclusionReasons(veg, p('Whey Isolate', {}, 'Протеини > Суроватъчен изолат'))).toEqual([]);
    expect(getExclusionReasons(vegan, p('Algae Omega-3 Vegan', {}, 'Мастни киселини > Омега-3 от водорасли и растения'))).toEqual([]);
  });

  test('пол: мъжки продукти не стигат до жена и обратно', () => {
    expect(getExclusionReasons({ ...base, sex: 'female' }, p('Prostate Support for Men')).length).toBeGreaterThan(0);
    expect(getExclusionReasons({ ...base, sex: 'male' }, p('Multivitamin for Women')).length).toBeGreaterThan(0);
    expect(getExclusionReasons({ ...base, sex: 'female' }, p('Multivitamin for Women'))).toEqual([]);
  });

  test('взаимодействия: SSRI + жълт кантарион, антикоагуланти + витамин K/ADEK/гинкго, статини + червен ориз', () => {
    expect(getExclusionReasons({ ...base, medications: ['ssri'] }, p("St. John's Wort 300 mg")).length).toBeGreaterThan(0);
    expect(getExclusionReasons({ ...base, medications: ['hormone_therapy'] }, p('Жълт кантарион')).length).toBeGreaterThan(0);
    expect(getExclusionReasons({ ...base, medications: ['anticoagulants'] }, p('Vitamin K2 MK-7')).length).toBeGreaterThan(0);
    expect(getExclusionReasons({ ...base, medications: ['anticoagulants'] }, p('ADEK Vitamins')).length).toBeGreaterThan(0);
    expect(getExclusionReasons({ ...base, medications: ['anticoagulants'] }, p('Ginkgo Biloba 120 mg')).length).toBeGreaterThan(0);
    expect(getExclusionReasons({ ...base, medications: ['statins'] }, p('Red Yeast Rice 600 mg')).length).toBeGreaterThan(0);
  });

  test('хипертония: кофеинов продукт (от описанието) и женско биле — изключени; CLA — не', () => {
    const hyper = { ...base, conditions: ['hypertension'] };
    expect(getExclusionReasons(hyper, p('Burn XT', { description: 'Съдържа 200 mg кофеин.' }, 'Отслабване и контрол на теглото > Термогенни фетбърнъри')).length).toBeGreaterThan(0);
    expect(getExclusionReasons(hyper, p('Licorice Root 320 mg')).length).toBeGreaterThan(0);
    expect(getExclusionReasons(hyper, p('CLA 1000 mg', { description: 'Подпомага изгарянето на мазнини.' }, 'Отслабване и контрол на теглото > CLA'))).toEqual([]);
  });

  test('аксесоари, храни, детски продукти и мостри не са за консултанта', () => {
    expect(getExclusionReasons(base, p('Shaker 700 ml', {}, 'Спортни аксесоари и уреди > Шейкъри')).length).toBeGreaterThan(0);
    expect(getExclusionReasons(base, p('Protein Bar Box', {}, 'Функционални храни > Барове')).length).toBeGreaterThan(0);
    expect(getExclusionReasons(base, p('Kids Multivitamin', {}, 'Здраве за цялото семейство > Детски витамини')).length).toBeGreaterThan(0);
    expect(getExclusionReasons(base, p('L-Carnitine 3000 / 1 Amp.', { variants: [{ price: 1.8, available: true }] })).length).toBeGreaterThan(0);
  });
});
