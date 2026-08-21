import {
  getF1CustomerPrice,
  isF1PromoActive,
  priceStrictlyBelow,
  resolveVariantPricing,
  summarizeGroupPricing,
  applyPromoCodePrice,
  applyMarginSharePrice,
  applyCartPercentPromoPrice,
  computePromoStatsFromVp,
  buildIndexVariantPricing,
  deliveryPrice,
  promoUsesLinePricing,
  resolvePromoLinePrice,
  sumLinePricingSavings,
  normalizePricingPolicy,
  formatGroupPriceHtml,
  formatVariantPriceHtml,
  formatPacksDisplay,
  ceilRetailPrice,
  shouldDisplayPromoPrice,
  promoDisplayStats,
} from './portfolio-pricing.js';

const policy = {
  min_profit_eur: 0.01,
  f1_promo_undercut_eur: 0.10,
  standard_mode: 'below_regular',
  below_regular_percent: 3,
  above_b2b_percent: 30
};

describe('portfolio-pricing', () => {
  test('ceilRetailPrice rounds up to first decimal', () => {
    expect(ceilRetailPrice(14.52)).toBe(14.6);
    expect(ceilRetailPrice(14.56)).toBe(14.6);
    expect(ceilRetailPrice(14.5)).toBe(14.5);
    expect(ceilRetailPrice(0)).toBe(0);
  });

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

  test('applyMarginSharePrice gives full margin at 100%', () => {
    expect(applyMarginSharePrice(50, 20, 100)).toBe(20);
  });

  test('applyMarginSharePrice gives half margin at 50%', () => {
    expect(applyMarginSharePrice(50, 20, 50)).toBe(35);
  });

  test('applyMarginSharePrice uses client final price and caps at catalog retail', () => {
    expect(applyMarginSharePrice(100, 20, 50, 85)).toBe(60);
    expect(applyMarginSharePrice(100, 20, 100, 85)).toBe(20);
    expect(applyMarginSharePrice(20, 20, 100, 20)).toBe(20);
    expect(applyMarginSharePrice(50, 0, 100, 50)).toBe(50);
  });

  test('applyCartPercentPromoPrice discounts from client final price', () => {
    const variant = { b2b_price: 20, regular_price: 100, retail_price: 95 };
    const r = applyCartPercentPromoPrice(variant, { discountType: 'percentage', discount: 10 });
    expect(r.price).toBe(90);
    expect(r.compareAt).toBe(100);
    expect(r.isOnPromo).toBe(true);
  });

  test('applyCartPercentPromoPrice never raises above catalog retail', () => {
    const variant = { margin_eur: 80, regular_price: 100, retail_price: 85 };
    const r = applyCartPercentPromoPrice(variant, { discountType: 'percentage', discount: 10 });
    expect(r.price).toBe(85);
    expect(r.compareAt).toBe(100);
  });

  test('deliveryPrice derives from margin_eur on client variants', () => {
    expect(deliveryPrice({ regular_price: 100, margin_eur: 80 })).toBe(20);
  });

  test('computePromoStatsFromVp handles margin share from vp dots', () => {
    const stats = computePromoStatsFromVp([[85, 100, 80]], { discountType: 'margin_percentage', discount: 50 });
    expect(stats.min_price).toBe(60);
    expect(stats.compare_at_price).toBe(100);
  });

  test('buildIndexVariantPricing stores vp without raw b2b', () => {
    const p = buildIndexVariantPricing([
      { retail_price: 85, regular_price: 100, b2b_price: 20, available: true },
    ]);
    expect(p.min_client_price).toBe(100);
    expect(p.vp).toEqual([[85, 100, 80]]);
  });

  test('promoUsesLinePricing detects margin_percentage', () => {
    expect(promoUsesLinePricing({ discountType: 'margin_percentage' })).toBe(true);
    expect(promoUsesLinePricing({ discountType: 'percentage' })).toBe(false);
    expect(promoUsesLinePricing({ pricing_mode: 'above_b2b' })).toBe(true);
  });

  test('resolvePromoLinePrice applies margin share from client final price', () => {
    const variant = { b2b_price: 20, regular_price: 100, retail_price: 85 };
    const price = resolvePromoLinePrice(variant, { discountType: 'margin_percentage', discount: 50 });
    expect(price).toBe(60);
  });

  test('resolvePromoLinePrice applies margin share', () => {
    const variant = { b2b_price: 20, retail_price: 50 };
    const price = resolvePromoLinePrice(variant, { discountType: 'margin_percentage', discount: 100 });
    expect(price).toBe(20);
  });

  test('sumLinePricingSavings totals catalog vs promo line prices', () => {
    const savings = sumLinePricingSavings([
      { catalog_retail_price: 50, retail_price: 20, quantity: 2 },
      { catalog_retail_price: 30, retail_price: 30, quantity: 1 }
    ]);
    expect(savings).toBe(60);
  });

  test('normalizePricingPolicy falls back to global markup', () => {
    const p = normalizePricingPolicy({}, { global_markup_percent: 22 });
    expect(p.above_b2b_percent).toBe(22);
  });

  test('summarizeGroupPricing aggregates promo flags', () => {
    const s = summarizeGroupPricing([
      { retail_price: 19.8, compare_at_price: 24.9, is_on_promo: true, pricing_mode: 'f1_promo', available: true },
      { retail_price: 21.9, compare_at_price: 0, is_on_promo: false, available: true }
    ]);
    expect(s.has_promo).toBe(true);
    expect(s.compare_at_price).toBe(24.9);
    expect(s.min_price).toBe(19.8);
  });

  test('summarizeGroupPricing ignores unavailable variants', () => {
    const s = summarizeGroupPricing([
      { retail_price: 5, compare_at_price: 0, available: false, is_on_promo: false },
      { retail_price: 19.8, compare_at_price: 24.9, available: true, is_on_promo: true, pricing_mode: 'f1_promo' },
      { retail_price: 21.9, compare_at_price: 0, available: true, is_on_promo: false }
    ]);
    expect(s.min_price).toBe(19.8);
    expect(s.compare_at_price).toBe(24.9);
  });

  test('summarizeGroupPricing does not attach expensive variant compare to cheap min', () => {
    const s = summarizeGroupPricing([
      { retail_price: 10, compare_at_price: 0, available: true, is_on_promo: false },
      { retail_price: 50, compare_at_price: 60, available: true, is_on_promo: true, pricing_mode: 'f1_promo' }
    ]);
    expect(s.min_price).toBe(10);
    expect(s.compare_at_price).toBe(0);
    expect(s.has_promo).toBe(true);
  });

  test('formatGroupPriceHtml matches formatVariantPriceHtml for single variant', () => {
    const variant = {
      retail_price: 19.8,
      compare_at_price: 24.9,
      is_on_promo: true,
      available: true,
      pricing_mode: 'f1_promo'
    };
    const stats = summarizeGroupPricing([variant]);
    expect(formatGroupPriceHtml(stats)).toBe(formatVariantPriceHtml(variant));
  });

  test('formatGroupPriceHtml hides strikethrough below 5% discount', () => {
    const html = formatGroupPriceHtml({
      min_price: 96,
      max_price: 96,
      has_promo: true,
      compare_at_price: 100,
    });
    expect(html).toBe('96.00 €');
    expect(html).not.toContain('pf-price-compare');
  });

  test('formatGroupPriceHtml shows strikethrough at 5% discount or more', () => {
    const html = formatGroupPriceHtml({
      min_price: 95,
      max_price: 95,
      has_promo: true,
      compare_at_price: 100,
    });
    expect(html).toContain('pf-price-compare');
    expect(html).toContain('100.00');
    expect(html).toContain('95.00');
  });

  test('formatVariantPriceHtml hides small discounts', () => {
    const html = formatVariantPriceHtml({
      retail_price: 19.2,
      compare_at_price: 20,
      is_on_promo: true,
    });
    expect(html).toBe('19.20 €');
  });

  test('formatGroupPriceHtml shows range without wrong strikethrough', () => {
    const html = formatGroupPriceHtml({
      min_price: 10,
      max_price: 50,
      has_promo: true,
      compare_at_price: 0
    });
    expect(html).toContain('от');
    expect(html).toContain('10.00 €');
    expect(html).not.toContain('pf-price-compare');
  });

  test('formatPacksDisplay compacts same-unit packs', () => {
    expect(formatPacksDisplay(['0.9 кг', '2.3 кг'])).toBe('0.9 / 2.3 кг');
    expect(formatPacksDisplay(['60 капс', '90 капс'])).toBe('60 / 90 капс');
    expect(formatPacksDisplay(['500 ml', '1 кг'])).toBe('500 ml / 1 кг');
    expect(formatPacksDisplay(['1 кг'])).toBe('1 кг');
  });

  test('summarizeGroupPricing returns default_sku_id for cheapest variant', () => {
    const s = summarizeGroupPricing([
      { sku_id: 'cheap', retail_price: 10, available: true, is_on_promo: false },
      { sku_id: 'big', retail_price: 50, available: true, is_on_promo: true, compare_at_price: 60, pricing_mode: 'f1_promo' }
    ]);
    expect(s.default_sku_id).toBe('cheap');
    expect(s.min_price).toBe(10);
  });
});
