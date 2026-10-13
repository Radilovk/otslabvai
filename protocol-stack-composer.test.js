import {
  composeProtocolStacks,
  composeCoreSupportStacks,
  buildMockNarration,
  assembleProtocolFromComposition,
} from './protocol-stack-composer.js';
import {
  rankEligibleProducts,
  finalizeProtocolResponse,
  filterEligibleProducts,
  extractProductsFromContent,
} from './protocol-quiz-engine.js';
import { classifyProductSlot } from './portfolio-stack-slots.js';
import { readFileSync } from 'fs';

const lifeContent = JSON.parse(readFileSync('./backend/life_page_content.json', 'utf8'));

const sampleProduct = (id, name, price, goals = []) => ({
  product_id: id,
  public_data: { name, price, image_url: '', variants: [{ price, available: true }] },
  system_data: { application_type: 'Oral', inventory: 10, goals },
});
const entry = (id, name, price, score, goals) => ({ product: sampleProduct(id, name, price, goals), score });
const ids = (composed, k) => composed.tiers[k].products.map((x) => x.product_id);
const baseProfile = { symptoms: [], conditions: [], medications: [], allergies: [], diet: 'omnivore' };

describe('compose-then-narrate (life)', () => {
  const ranked = [
    entry('nad', 'NAD+ 500 mg', 30, 90),
    entry('res', 'Resveratrol 250 mg', 20, 85),
    entry('om', 'Omega 3 Fish Oil', 15, 80),
    entry('col', 'Marine Collagen', 25, 75),
    entry('d3', 'Vitamin D3 2000 IU', 8, 70),
    entry('mg', 'Magnesium Bisglycinate', 12, 65),
    entry('ash', 'Ashwagandha KSM-66', 14, 60),
    entry('pre', 'Pre-Workout Caffeine', 25, 95),
  ];

  test('дълголетие: вложени нива по плана, без предтренировъчни', () => {
    const composed = composeProtocolStacks({ ...baseProfile, priority: 'longevity' }, ranked);
    expect(ids(composed, 'basic').length).toBeLessThan(ids(composed, 'optimal').length);
    expect(ids(composed, 'optimal').length).toBeLessThan(ids(composed, 'premium').length);
    expect(ids(composed, 'premium').slice(0, ids(composed, 'optimal').length)).toEqual(ids(composed, 'optimal'));
    expect(ids(composed, 'basic')[0]).toBe('nad');
    expect(ids(composed, 'premium')).not.toContain('pre');
  });

  test('сън: сънят е основен, магнезий вечер', () => {
    const sleepRanked = [entry('mel', 'Melatonin 1 mg', 6, 50), ...ranked];
    const composed = composeProtocolStacks({ ...baseProfile, priority: 'sleep' }, sleepRanked);
    expect(ids(composed, 'basic')[0]).toBe('mel');
    const mg = composed.tiers.premium.products.find((p) => p.product_id === 'mg');
    expect(mg?.timing).toMatch(/вечер/);
  });

  test('статини → CoQ10 влиза веднага след основния продукт', () => {
    const withCoq = [...ranked, entry('coq', 'CoQ10 100 mg', 18, 10)];
    const composed = composeProtocolStacks({ ...baseProfile, priority: 'skin', medications: ['statins'] }, withCoq);
    expect(ids(composed, 'basic')).toContain('coq');
  });

  test('реалната структура на life каталога минава целия път до финален отговор', () => {
    // Наличностите/маржовете в снимката остаряват — тук се проверява логиката, не складът.
    const all = extractProductsFromContent(lifeContent).map((p) => ({
      ...p,
      system_data: { ...p.system_data, inventory: 10, margin_eligible: true },
      public_data: { ...p.public_data, variants: (p.public_data.variants || []).map((v) => ({ ...v, available: true })) },
    }));
    const eligible = filterEligibleProducts(all);
    const profile = { ...baseProfile, sex: 'female', age_band: '45-54', priority: 'skin', menopause_context: true };
    const { ranked: lifeRanked } = rankEligibleProducts(profile, eligible);
    const composed = composeProtocolStacks(profile, lifeRanked);
    const productMap = new Map(eligible.map((p) => [p.product_id, p]));
    const narration = buildMockNarration(composed, profile, productMap);
    const { response } = assembleProtocolFromComposition(composed, narration, productMap, []);
    const final = finalizeProtocolResponse(response, eligible, []);

    expect(eligible.length).toBeGreaterThanOrEqual(8);
    expect(final.tiers.basic.products[0].price_eur).toBeGreaterThan(0);
    expect(final.tiers.premium.products.length).toBeGreaterThan(final.tiers.basic.products.length);
    // Мъжки продукти не стигат до жена.
    const premiumIds = new Set(final.tiers.premium.products.map((p) => p.product_id));
    const male = eligible.filter((p) => /TRT|Testosterone/i.test(p.public_data.name));
    for (const p of male) expect(premiumIds.has(p.product_id)).toBe(false);
  });
});

describe('composeCoreSupportStacks (daotslabna)', () => {
  test('основен бърнър + подкрепа по плана „отслабване“; един бърнър на пакет', () => {
    const ranked = [
      entry('core-best', 'Thermo Fat Burner Pro', 30, 100),
      entry('core-2', 'Thermo Fat Burner Lite', 18, 99),
      entry('app', 'Glucomannan Appetite Control', 15, 90),
      entry('carn', 'L-Carnitine 1000', 12, 85),
      entry('whey', 'Whey Protein', 30, 80),
      entry('multi', 'Multivitamin Daily', 10, 70),
    ];
    const composed = composeCoreSupportStacks({ ...baseProfile, priority: 'otshalvane' }, ranked);
    const premium = ids(composed, 'premium');
    expect(premium[0]).toBe('core-best');
    expect(premium).not.toContain('core-2');
    expect(premium.indexOf('app')).toBeLessThan(premium.indexOf('multi'));
    expect(composed.meta.mode).toBe('slot_plan');
  });

  test('само бърнъри в каталога → 3 алтернативи (икономичен / препоръчан / премиум)', () => {
    const ranked = [
      entry('b1', 'Thermo Fat Burner A', 27, 100),
      entry('b2', 'Thermo Fat Burner B', 16, 99),
      entry('b3', 'Thermo Fat Burner C', 38, 98),
    ];
    const composed = composeCoreSupportStacks({ ...baseProfile, priority: 'otshalvane' }, ranked);
    expect(composed.meta.mode).toBe('alternatives');
    expect(['basic', 'optimal', 'premium'].map((k) => ids(composed, k)[0])).toEqual(['b2', 'b1', 'b3']);
  });

  test('без продукт за отслабване → null (общият композитор)', () => {
    const ranked = [entry('a', 'Магнезий', 30, 1)];
    expect(composeCoreSupportStacks({ priority: 'otshalvane' }, ranked)).toBeNull();
  });

  test('слотовете на продуктите се виждат в елементите на пакета', () => {
    const composed = composeProtocolStacks({ ...baseProfile, priority: 'joints' }, [
      entry('j', 'Glucosamine Chondroitin MSM', 20, 10),
      entry('c', 'Collagen Peptides', 25, 9),
      entry('o', 'Omega 3', 15, 8),
    ]);
    expect(composed.tiers.premium.products.map((p) => p.slot)).toEqual(['joint', 'collagen', 'omega3']);
    expect(classifyProductSlot(sampleProduct('x', 'Glucosamine', 10))).toBe('joint');
  });
});
