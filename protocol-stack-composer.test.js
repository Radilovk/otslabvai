import {
  composeProtocolStacks,
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
