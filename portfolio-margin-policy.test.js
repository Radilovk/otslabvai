import {
  MIN_CATALOG_MARGIN_PCT,
  variantMarginPct,
  variantHasMargin,
  groupHasMargin,
  isCatalogListed,
} from './portfolio-margin-policy.js';
import { resolveVariantPricing } from './portfolio-pricing.js';

describe('portfolio-margin-policy', () => {
  test('Fitness1 example: 40% dist discount, 30% client promo → hidden (<25%)', () => {
    const regular = 100;
    const b2b = regular * 0.6;
    const retail = regular * 0.7;
    expect(variantMarginPct({ b2b_price: b2b, retail_price: retail })).toBeCloseTo(14.29, 1);
    expect(variantHasMargin({ b2b_price: b2b, retail_price: retail })).toBe(false);
  });

  test('Fitness1 example: 40% dist discount, 10% client promo → visible (>=25%)', () => {
    const regular = 100;
    const b2b = regular * 0.6;
    const retail = regular * 0.9;
    expect(variantMarginPct({ b2b_price: b2b, retail_price: retail })).toBeCloseTo(33.33, 1);
    expect(variantHasMargin({ b2b_price: b2b, retail_price: retail })).toBe(true);
  });

  test('Sila: deep silabg.com promo erodes margin below 25%', () => {
    const resolved = resolveVariantPricing({
      b2b: 60,
      regular: 100,
      sale: 70,
      policy: { min_profit_eur: 0.01, f1_promo_undercut_eur: 0.1 },
    });
    const variant = { b2b_price: 60, retail_price: resolved.retail_price };
    expect(variantHasMargin(variant)).toBe(false);
  });

  test('Sila: shallow promo keeps margin at or above 25%', () => {
    const resolved = resolveVariantPricing({
      b2b: 60,
      regular: 100,
      sale: 90,
      policy: { min_profit_eur: 0.01, f1_promo_undercut_eur: 0.1 },
    });
    const variant = { b2b_price: 60, retail_price: resolved.retail_price };
    expect(variantHasMargin(variant)).toBe(true);
  });

  test('threshold is 25%', () => {
    expect(MIN_CATALOG_MARGIN_PCT).toBe(25);
    expect(variantHasMargin({ b2b_price: 60, retail_price: 80 })).toBe(true);
    expect(variantHasMargin({ b2b_price: 60, retail_price: 79 })).toBe(false);
  });

  test('groupHasMargin if any available variant qualifies (any distributor)', () => {
    const group = {
      distributor: 'sila',
      variants: [
        { available: true, b2b_price: 60, retail_price: 70, distributor: 'sila' },
        { available: true, b2b_price: 60, retail_price: 90, distributor: 'sila' },
      ],
    };
    expect(groupHasMargin(group)).toBe(true);
  });

  test('isCatalogListed respects margin_eligible on index and site products', () => {
    expect(isCatalogListed({ margin_eligible: true })).toBe(true);
    expect(isCatalogListed({ margin_eligible: false })).toBe(false);
    expect(isCatalogListed({ system_data: { margin_eligible: false } })).toBe(false);
    expect(isCatalogListed({ margin_eligible: false }, true)).toBe(true);
  });
});
