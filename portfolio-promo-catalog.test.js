import {
  promoUnlocksLowMargin,
  formatIndexPriceHtml,
} from './portfolio-promo-catalog.js';

describe('portfolio-promo-catalog', () => {
  test('promoUnlocksLowMargin when any promo code is active', () => {
    expect(promoUnlocksLowMargin(null)).toBe(false);
    expect(promoUnlocksLowMargin({ code: 'WELCOME10', discountType: 'percentage', discount: 10 })).toBe(true);
  });

  test('formatIndexPriceHtml applies cart percent from client final price', () => {
    const html = formatIndexPriceHtml({
      min_price: 85,
      max_price: 85,
      min_client_price: 100,
      max_client_price: 100,
    }, { discountType: 'percentage', discount: 10 });
    expect(html).toContain('85.00');
    expect(html).toContain('100.00');
  });

  test('formatIndexPriceHtml lowers price when client discount beats catalog', () => {
    const html = formatIndexPriceHtml({
      min_price: 95,
      max_price: 95,
      min_client_price: 100,
      max_client_price: 100,
    }, { discountType: 'percentage', discount: 10 });
    expect(html).toContain('90.00');
    expect(html).toContain('100.00');
  });

  test('formatIndexPriceHtml uses promo line stats when present', () => {
    const html = formatIndexPriceHtml({
      min_price: 100,
      max_price: 100,
      promo_min_price: 60,
      promo_max_price: 60,
      promo_compare_at_price: 100,
      promo_has_adjusted_price: true,
    }, { discountType: 'margin_percentage', discount: 50 });
    expect(html).toContain('60.00');
    expect(html).toContain('100.00');
  });
});
