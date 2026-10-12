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
import { readFileSync } from 'fs';

const lifeContent = JSON.parse(readFileSync('./backend/life_page_content.json', 'utf8'));

const sampleProduct = (id, name, price, goals = ['energy']) => ({
  product_id: id,
  public_data: {
    name,
    price,
    image_url: '',
    variants: [{ price, available: true }],
  },
  system_data: {
    application_type: 'Oral',
    inventory: 10,
    goals,
  },
});

describe('compose-then-narrate pipeline', () => {
  test('composeProtocolStacks сканира целия ranked pool', () => {
    const ranked = Array.from({ length: 50 }, (_, i) => ({
      product: sampleProduct(`p${i}`, `Product ${i}`, 10 + (i % 20), [`goal${i % 6}`]),
      score: 50 - i,
    }));

    const profile = { priority: 'energy', symptoms: [], conditions: [], medications: [], allergies: [], diet: 'omnivore' };
    const composed = composeProtocolStacks(profile, ranked);

    expect(composed.tiers.basic.products.length).toBeGreaterThanOrEqual(3);
    expect(composed.tiers.optimal.products.length).toBeGreaterThan(composed.tiers.basic.products.length);
    expect(composed.tiers.premium.products.length).toBeGreaterThanOrEqual(composed.tiers.optimal.products.length);
    expect(composed.meta.ranked_pool_size).toBe(50);
  });

  test('кумулативните нива не натрупват конфликтни продукти (напр. 2+ термогенни)', () => {
    const burners = Array.from({ length: 4 }, (_, i) => ({
      product: sampleProduct(`burn${i}`, `Thermo Fat Burner ${i}`, 20, ['weight-loss']),
      score: 100 - i,
    }));
    const others = ['Магнезий', 'Витамин D3', 'Цинк', 'Пробиотик', 'Фибри', 'Хром', 'Зелен чай екстракт'].map((name, i) => ({
      product: sampleProduct(`o${i}`, name, 10, [`goal${i}`]),
      score: 50 - i,
    }));
    const profile = { priority: 'otshalvane', symptoms: [], conditions: [], medications: [], allergies: [], diet: 'omnivore' };
    const composed = composeProtocolStacks(profile, [...burners, ...others]);

    for (const key of ['basic', 'optimal', 'premium']) {
      const ids = composed.tiers[key].products.map((p) => p.product_id);
      expect(ids.filter((id) => id.startsWith('burn')).length).toBeLessThanOrEqual(1);
    }
  });

  test('end-to-end с реалния life каталог', () => {
    const all = extractProductsFromContent(lifeContent);
    const eligible = filterEligibleProducts(all);
    const profile = {
      sex: 'female',
      age_band: '35-44',
      height_cm: 165,
      weight_kg: 60,
      email: 'test@example.com',
      priority: 'skin',
      conditions: [],
      medications: [],
      allergies: [],
      symptoms: [],
      diet: 'omnivore',
    };

    const { ranked } = rankEligibleProducts(profile, eligible);
    const composed = composeProtocolStacks(profile, ranked);
    const narration = buildMockNarration(composed, profile);
    const productMap = new Map(eligible.map((p) => [p.product_id, p]));
    const { response } = assembleProtocolFromComposition(composed, narration, productMap, []);
    const final = finalizeProtocolResponse(response, eligible, []);

    expect(final.tiers.basic.products[0].price_eur).toBeGreaterThan(0);
    expect(final.tiers.premium.products.length).toBeGreaterThanOrEqual(6);
  });
});

describe('composeCoreSupportStacks (daotslabna)', () => {
  const p = (id, name, price, goals) => ({ product: sampleProduct(id, name, price, goals), score: 0 });

  test('3 различни нива: евтин основен / основен + подкрепа / основен + 2 подкрепи', () => {
    const ranked = [
      p('core-best', 'Fat Burner Pro', 40, ['weight-loss']),
      p('core-cheap', 'Fat Burner Lite', 18, ['weight-loss']),
      p('sup1', 'Глутатион', 30, ['detox']),
      p('sup-exp', 'Скъпа подкрепа', 90, ['detox']),
      p('sup2', 'Спирулина', 15, ['superfood']),
    ].map((e, i) => ({ ...e, score: 100 - i }));
    const profile = { priority: 'otshalvane', symptoms: [], conditions: [], medications: [], allergies: [], diet: 'omnivore' };
    const composed = composeCoreSupportStacks(profile, ranked);
    const ids = (k) => composed.tiers[k].products.map((x) => x.product_id);

    expect(ids('basic')).toEqual(['core-cheap']);
    expect(ids('optimal')).toEqual(['core-best', 'sup1']);
    expect(ids('premium')).toEqual(['core-best', 'sup1', 'sup2']);
  });

  test('без основен продукт → null (ползва се общият композитор)', () => {
    const ranked = [{ product: sampleProduct('a', 'Глутатион', 30, ['detox']), score: 1 }];
    expect(composeCoreSupportStacks({ priority: 'otshalvane' }, ranked)).toBeNull();
  });
});
