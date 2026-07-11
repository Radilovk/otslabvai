import {
  buildClientProfile,
  filterEligibleProducts,
  buildCandidatePool,
  isOralSupplement,
  isProductAvailable,
  isPeptideOrInjectable,
  getProductPriceEur,
  scoreProduct,
} from './protocol-quiz-engine.js';
import { getExclusionReasons } from './protocol-safety-rules.js';

const sampleProduct = (overrides = {}) => ({
  product_id: 'prod-pf-1',
  public_data: {
    name: 'CoQ10 100mg',
    price: 29.9,
    ingredients: [{ name: 'Coenzyme Q10', amount: '100mg' }],
    effects: [{ label: 'Дава повече енергия', value: 80 }],
    variants: [{ price: 29.9, available: true }],
  },
  system_data: {
    application_type: 'Oral',
    inventory: 10,
    goals: ['energy', 'anti-aging'],
    source: 'portfolio',
  },
  ...overrides,
});

describe('protocol quiz product filters', () => {
  test('изключва пептиди и инжектируеми', () => {
    expect(isPeptideOrInjectable(sampleProduct())).toBe(false);
    expect(isPeptideOrInjectable(sampleProduct({
      public_data: { name: 'BPC-157 Peptide', price: 50, variants: [{ price: 50, available: true }] },
    }))).toBe(true);
    expect(isOralSupplement(sampleProduct({
      system_data: { application_type: 'Injectable', inventory: 5 },
    }))).toBe(false);
  });

  test('наличен продукт има inventory и available variant', () => {
    expect(isProductAvailable(sampleProduct())).toBe(true);
    expect(isProductAvailable(sampleProduct({
      system_data: { application_type: 'Oral', inventory: 0 },
    }))).toBe(false);
  });

  test('filterEligibleProducts връща само oral налични', () => {
    const list = [
      sampleProduct(),
      sampleProduct({ product_id: 'p2', system_data: { application_type: 'Injectable', inventory: 5 } }),
      sampleProduct({ product_id: 'p3', system_data: { application_type: 'Oral', inventory: 0 } }),
    ];
    const eligible = filterEligibleProducts(list);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].product_id).toBe('prod-pf-1');
  });
});

describe('buildClientProfile', () => {
  test('изчислява BMI и menopause_context', () => {
    const p = buildClientProfile({
      sex: 'female',
      age_band: '45-54',
      height_cm: 170,
      weight_kg: 68,
      email: 'test@example.com',
      priority: 'skin',
    });
    expect(p.bmi).toBeCloseTo(23.5, 0);
    expect(p.menopause_context).toBe(true);
  });
});

describe('buildCandidatePool', () => {
  test('изключва 5-HTP при SSRI и включва CoQ10 при статини', () => {
    const htp = sampleProduct({
      product_id: 'htp',
      public_data: {
        name: '5-HTP Mood Support',
        price: 18,
        ingredients: [{ name: '5-HTP' }],
        variants: [{ price: 18, available: true }],
      },
    });
    const coq10 = sampleProduct({ product_id: 'coq10' });
    const profile = buildClientProfile({
      sex: 'male',
      age_band: '35-44',
      height_cm: 180,
      weight_kg: 80,
      email: 'a@b.com',
      priority: 'energy',
      medications: ['ssri', 'statins'],
      conditions: [],
      allergies: [],
      symptoms: [],
    });

    const { candidates } = buildCandidatePool(profile, [htp, coq10]);
    expect(candidates.find((p) => p.product_id === 'htp')).toBeUndefined();
    expect(candidates.find((p) => p.product_id === 'coq10')).toBeTruthy();
  });
});

describe('getProductPriceEur', () => {
  test('взима минималната налична variant цена в EUR', () => {
    const p = sampleProduct({
      public_data: {
        price: 40,
        variants: [
          { price: 35, available: true },
          { price: 30, available: false },
        ],
      },
    });
    expect(getProductPriceEur(p)).toBe(35);
  });
});

describe('scoreProduct', () => {
  test('по-висок score при съвпадение с приоритет', () => {
    const skinProd = sampleProduct({
      public_data: {
        name: 'Collagen Beauty',
        price: 25,
        effects: [{ label: 'Подобрява кожата', value: 90 }],
        variants: [{ price: 25, available: true }],
      },
      system_data: { application_type: 'Oral', inventory: 10, goals: ['skin'] },
    });
    const profile = buildClientProfile({
      sex: 'female', age_band: '35-44', height_cm: 165, weight_kg: 60,
      email: 'x@y.com', priority: 'skin',
    });
    expect(scoreProduct(skinProd, profile)).toBeGreaterThan(scoreProduct(sampleProduct(), profile));
  });
});

describe('safety exclusions', () => {
  test('антикоагуланти изключват omega-3', () => {
    const omega = sampleProduct({
      public_data: { name: 'Omega 3 Premium', price: 20, variants: [{ price: 20, available: true }] },
    });
    const reasons = getExclusionReasons({
      medications: ['anticoagulants'],
      conditions: [],
      allergies: [],
      diet: 'omnivore',
      pregnancy: 'no',
    }, omega);
    expect(reasons.length).toBeGreaterThan(0);
  });
});
