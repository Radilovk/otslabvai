import {
  getF1CustomerPrice,
  isF1PromoActive,
  priceStrictlyBelow,
  resolveVariantPricing,
  summarizeGroupPricing
} from './portfolio-pricing.js';

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
    expect(priceStrictlyBelow(1.05, 0.1)).toBe(0.95);
  });

  test('resolveVariantPricing stays below F1 promo and above b2b', () => {
    const r = resolveVariantPricing({
      b2b: 14,
      regular: 24.9,
      sale: 19.9,
      policy: { undercut_eur: 0.1, min_profit_eur: 0.01 }
    });
    expect(r.retail_price).toBe(19.8);
    expect(r.retail_price).toBeLessThan(19.9);
    expect(r.retail_price).toBeGreaterThan(14);
    expect(r.is_on_promo).toBe(true);
    expect(r.compare_at_price).toBe(24.9);
    expect(r.pricing_mode).toBe('competitive');
  });

  test('resolveVariantPricing undercuts regular when no sale', () => {
    const r = resolveVariantPricing({
      b2b: 10,
      regular: 20,
      sale: 0,
      policy: { undercut_eur: 0.1, min_profit_eur: 0.01 }
    });
    expect(r.retail_price).toBe(19.9);
    expect(r.f1_reference_price).toBe(20);
    expect(r.is_on_promo).toBe(true);
  });

  test('resolveVariantPricing uses floor when undercut would break minimum profit', () => {
    const r = resolveVariantPricing({
      b2b: 19.89,
      regular: 19.92,
      sale: 0,
      policy: { undercut_eur: 0.1, min_profit_eur: 0.01 }
    });
    expect(r.retail_price).toBeGreaterThan(19.89);
    expect(r.retail_price).toBeLessThan(19.92);
    expect(r.pricing_mode).toBe('competitive');
  });

  test('resolveVariantPricing falls back to markup when no F1 reference', () => {
    const r = resolveVariantPricing({
      b2b: 10,
      regular: 0,
      sale: 0,
      markupRetail: () => 12.9
    });
    expect(r.retail_price).toBe(12.9);
    expect(r.pricing_mode).toBe('markup');
  });

  test('summarizeGroupPricing aggregates promo flags', () => {
    const s = summarizeGroupPricing([
      { retail_price: 19.8, compare_at_price: 24.9, is_on_promo: true },
      { retail_price: 21.9, compare_at_price: 0, is_on_promo: false }
    ]);
    expect(s.min_price).toBe(19.8);
    expect(s.has_promo).toBe(true);
    expect(s.compare_at_price).toBe(24.9);
  });
});
