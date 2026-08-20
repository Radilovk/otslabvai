import {
  promoUnlocksLowMargin,
  formatIndexPriceHtml,
  enrichCatalogItemsWithPromoPrices,
} from './portfolio-promo-catalog.js';

describe('portfolio-promo-catalog', () => {
  test('promoUnlocksLowMargin when any promo code is active', () => {
    expect(promoUnlocksLowMargin(null)).toBe(false);
    expect(promoUnlocksLowMargin({ code: 'WELCOME10', discountType: 'percentage', discount: 10 })).toBe(true);
    expect(promoUnlocksLowMargin({ code: 'FIT', show_low_margin: true })).toBe(true);
  });

  test('formatIndexPriceHtml applies cart percent discount', () => {
    const html = formatIndexPriceHtml({
      min_price: 100,
      max_price: 100,
      compare_at_price: 0,
      has_promo: false,
    }, { discountType: 'percentage', discount: 10 });
    expect(html).toContain('90.00');
    expect(html).toContain('100.00');
  });

  test('formatIndexPriceHtml uses promo line stats when present', () => {
    const html = formatIndexPriceHtml({
      min_price: 100,
      max_price: 100,
      promo_min_price: 75,
      promo_max_price: 75,
      promo_compare_at_price: 100,
      promo_has_adjusted_price: true,
    }, { discountType: 'margin_percentage', discount: 50 });
    expect(html).toContain('75.00');
    expect(html).toContain('100.00');
  });

  test('enrichCatalogItemsWithPromoPrices skips cart percent promos', async () => {
    const items = [{ group_id: 'g1', min_price: 100 }];
    const promo = { discountType: 'percentage', discount: 10 };
    const out = await enrichCatalogItemsWithPromoPrices(items, promo);
    expect(out).toBe(items);
    expect(out[0].promo_min_price).toBeUndefined();
  });
});
