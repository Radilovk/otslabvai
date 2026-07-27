import {
  getF1CustomerPrice,
  isF1PromoActive,
  priceStrictlyBelow,
  resolveVariantPricing,
  summarizeGroupPricing,
  applyPromoCodePrice,
  normalizePricingPolicy
} from './portfolio-pricing.js';

const policy = {
  min_profit_eur: 0.01,
  f1_promo_undercut_eur: 0.10,
  standard_mode: 'below_regular',
  below_regular_percent: 3,
  above_b2b_percent: 30
};

describe('portfolio-pricing', () => {
  test('getF1CustomerPrice prefers active sale', () => {
    expect(getF1CustomerPrice(24.9, 19.9)).toBe(19.9);
    expect(getF1CustomerPrice(20, 0)).toBe(20);
    expect(getF1CustomerPrice(0, 0)).toBe(0);
  });

  test('isF1PromoActive detects sale below regular', () => {
    expect(isF1PromoActive(24.9, 19.9)).toBe(true);
    expect(isF1PromoActive(20, 20)).toBe(false);
    expect(isF1PromoActive(20, 0)).toBe(false);
  });

  test('priceStrictlyBelow undercuts reference', () => {
    expect(priceStrictlyBelow(19.9, 0.1)).toBe(19.8);
    expect(priceStrictlyBelow(10, 0.1)).toBe(9.9);
  });

  test('resolveVariantPricing undercuts F1 promo sale', () => {
    const r = resolveVariantPricing({
      b2b: 14,
      regular: 24.9,
      sale: 19.9,
      policy
    });
    expect(r.retail_price).toBe(19.8);
    expect(r.pricing_mode).toBe('f1_promo');
    expect(r.compare_at_price).toBe(24.9);
  });

  test('resolveVariantPricing uses percent below regular for standard products', () => {
    const r = resolveVariantPricing({
      b2b: 10,
      regular: 20,
      sale: 0,
      policy
    });
    expect(r.retail_price).toBe(19.4);
    expect(r.pricing_mode).toBe('below_regular');
    expect(r.compare_at_price).toBe(20);
  });

  test('resolveVariantPricing uses percent above b2b when configured', () => {
    const r = resolveVariantPricing({
      b2b: 10,
      regular: 0,
      sale: 0,
      policy: { ...policy, standard_mode: 'above_b2b', above_b2b_percent: 25 },
      markupRetail: () => 12.5
    });
    expect(r.retail_price).toBe(12.5);
    expect(r.pricing_mode).toBe('above_b2b');
  });

  test('applyPromoCodePrice applies personal below_regular pricing', () => {
    const variant = { b2b_price: 10, regular_price: 20, retail_price: 19.4 };
    const price = applyPromoCodePrice(variant, { pricing_mode: 'below_regular', pricing_percent: 10 }, policy);
    expect(price).toBe(18);
  });

  test('normalizePricingPolicy falls back to global markup', () => {
    const p = normalizePricingPolicy({}, { global_markup_percent: 22 });
    expect(p.above_b2b_percent).toBe(22);
  });

  test('summarizeGroupPricing aggregates promo flags', () => {
    const s = summarizeGroupPricing([
      { retail_price: 19.8, compare_at_price: 24.9, is_on_promo: true, pricing_mode: 'f1_promo' },
      { retail_price: 21.9, compare_at_price: 0, is_on_promo: false }
    ]);
    expect(s.has_promo).toBe(true);
    expect(s.compare_at_price).toBe(24.9);
  });
});
