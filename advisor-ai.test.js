import { sanitizeProfileForAI, buildProductCard, repairAiTiers, buildReviewCandidates } from './advisor-ai.js';
import { composeAdvisorStacks } from './advisor-composer.js';

const product = (id, name, price, extra = {}) => ({
  product_id: id,
  public_data: { name, price, variants: [{ price, available: true, option_name: '60 капсули' }], ...extra },
  system_data: { application_type: 'Oral', inventory: 5, goals: [] },
});
const LIMITS = {
  basic: { min: 1, max: 2, budgetEur: 60 },
  optimal: { min: 2, max: 3, budgetEur: 100 },
  premium: { min: 3, max: 4, budgetEur: 150 },
};

describe('advisor-ai', () => {
  test('профилът към AI е без лични данни и празни полета', () => {
    const out = sanitizeProfileForAI({
      email: 'a@b.cc', name: 'Иван', height_cm: 180, sex: 'male', conditions: ['none'], medications: ['statins'], diet: 'omnivore',
    });
    expect(out).toEqual({ sex: 'male', medications: ['statins'], diet: 'omnivore' });
  });

  test('картата носи роля, стимулант и прием', () => {
    const card = buildProductCard(product('b', 'Thermo Fat Burner', 25, { recommended_intake: '2 капсули сутрин' }));
    expect(card).toMatchObject({ id: 'b', role: 'термогенен фетбърнър', eur: 25, stimulant: true, intake: '2 капсули сутрин' });
  });

  test('поправка: непознат, повторен и конфликтен продукт отпадат; липсващото идва от алгоритъма', () => {
    const ranked = [
      product('burn', 'Thermo Fat Burner', 25),
      product('burn2', 'Thermo Burner X', 20),
      product('app', 'Glucomannan Appetite', 15),
      product('carn', 'L-Carnitine', 12),
      product('multi', 'Multivitamin', 10),
    ].map((p, i) => ({ product: p, score: 10 - i }));
    const composed = composeAdvisorStacks({ priority: 'otshalvane' }, ranked, { tierLimits: LIMITS, goal: 'otshalvane' });
    const candidates = buildReviewCandidates(composed, ranked);
    const map = new Map(candidates.map((p) => [p.product_id, p]));
    expect(map.has('burn2')).toBe(true); // алтернатива на основния слот

    const ai = {
      tiers: {
        basic: { products: [{ product_id: 'burn2' }, { product_id: 'burn' }] },
        optimal: { products: [{ product_id: 'hack' }] },
        premium: { products: [{ product_id: 'burn' }, { product_id: 'burn' }, { product_id: 'app', why_for_you: 'апетит' }] },
      },
    };
    const { response, changes } = repairAiTiers(ai, composed, map, LIMITS);
    expect(response.tiers.basic.products.map((p) => p.product_id)).toEqual(['burn2']);
    expect(response.tiers.optimal.products.length).toBeGreaterThanOrEqual(2);
    expect(response.tiers.optimal.products.map((p) => p.product_id)).not.toContain('hack');
    const premium = response.tiers.premium.products.map((p) => p.product_id);
    expect(premium.filter((id) => id === 'burn')).toHaveLength(1);
    expect(response.tiers.premium.products.find((p) => p.product_id === 'app').why_for_you).toBe('апетит');
    expect(changes.some((c) => c.includes('hack'))).toBe(true);
  });
});
