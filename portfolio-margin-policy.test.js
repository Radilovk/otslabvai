import {
  MIN_CATALOG_MARGIN_PCT,
  variantMarginPct,
  variantHasMargin,
  groupHasMargin,
  isCatalogListed,
} from './portfolio-margin-policy.js';

describe('portfolio-margin-policy', () => {
  test('user example: 40% dist discount, 30% F1 client sale → hidden (<25%)', () => {
    const regular = 100;
    const b2b = regular * 0.6;
    const retail = regular * 0.7;
    expect(variantMarginPct({ b2b_price: b2b, retail_price: retail })).toBeCloseTo(14.29, 1);
    expect(variantHasMargin({ b2b_price: b2b, retail_price: retail })).toBe(false);
  });

  test('user example: 40% dist discount, 10% F1 client sale → visible (>=25%)', () => {
    const regular = 100;
    const b2b = regular * 0.6;
    const retail = regular * 0.9;
    expect(variantMarginPct({ b2b_price: b2b, retail_price: retail })).toBeCloseTo(33.33, 1);
    expect(variantHasMargin({ b2b_price: b2b, retail_price: retail })).toBe(true);
  });

  test('threshold is 25%', () => {
    expect(MIN_CATALOG_MARGIN_PCT).toBe(25);
    expect(variantHasMargin({ b2b_price: 60, retail_price: 80 })).toBe(true);
    expect(variantHasMargin({ b2b_price: 60, retail_price: 79 })).toBe(false);
  });

  test('groupHasMargin if any variant qualifies', () => {
    const group = {
      variants: [
        { available: true, b2b_price: 60, retail_price: 70 },
        { available: true, b2b_price: 60, retail_price: 90 },
      ],
    };
    expect(groupHasMargin(group)).toBe(true);
  });

  test('isCatalogListed respects margin_eligible flag', () => {
    expect(isCatalogListed({ margin_eligible: true })).toBe(true);
    expect(isCatalogListed({ margin_eligible: false })).toBe(false);
    expect(isCatalogListed({ system_data: { margin_eligible: false } })).toBe(false);
    expect(isCatalogListed({ margin_eligible: false }, true)).toBe(true);
  });
});
