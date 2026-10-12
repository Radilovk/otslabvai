import { jest } from '@jest/globals';
import {
  promoUnlocksLowMargin,
  formatIndexPriceHtml,
  fetchPromoPrices,
  variantDisplayPrice,
} from './portfolio-promo-catalog.js';
import { promoIndexStats } from './portfolio-promo-pricing.js';
import { sanitizeIndexEntryForClient, sanitizeVariantForClient } from './portfolio-api.js';

describe('portfolio-promo-catalog', () => {
  test('promoUnlocksLowMargin when any promo code is active', () => {
    expect(promoUnlocksLowMargin(null)).toBe(false);
    expect(promoUnlocksLowMargin({ code: 'WELCOME10', discountType: 'percentage', discount: 10 })).toBe(true);
  });

  test('server promoIndexStats applies cart percent from client final price', () => {
    const stats = promoIndexStats({
      min_price: 85, max_price: 85, min_client_price: 100, max_client_price: 100,
    }, { discountType: 'percentage', discount: 10 });
    expect(stats.min_price).toBe(85);
    expect(stats.compare_at_price).toBe(100);
  });

  test('server promoIndexStats lowers price when client discount beats catalog', () => {
    const stats = promoIndexStats({
      min_price: 95, max_price: 95, min_client_price: 100, max_client_price: 100,
    }, { discountType: 'percentage', discount: 10 });
    expect(stats.min_price).toBe(90);
    expect(stats.compare_at_price).toBe(100);
  });

  test('server promoIndexStats computes line pricing from internal vp (with margin)', () => {
    const stats = promoIndexStats({ min_price: 85, max_price: 85, vp: [[85, 100, 80]] },
      { discountType: 'margin_percentage', discount: 50 });
    expect(stats.min_price).toBe(60);
  });

  test('client sanitizers strip wholesale and margin', () => {
    const entry = sanitizeIndexEntryForClient({ group_id: 'g', max_margin: 5, max_margin_pct: 30, vp: [[85, 100, 80]] });
    expect(entry.vp).toEqual([[85, 100]]);
    expect(entry.max_margin).toBeUndefined();
    const v = sanitizeVariantForClient({ sku_id: '1', retail_price: 10, b2b_price: 6, margin_eur: 4, distributor: 'sila' });
    expect(v).toEqual({ sku_id: '1', retail_price: 10 });
  });

  test('formatIndexPriceHtml shows normal price until server promo prices arrive', async () => {
    const promo = { code: 'TESTX', discountType: 'margin_percentage', discount: 50 };
    const item = { group_id: 'g1', min_price: 85, max_price: 85 };
    expect(formatIndexPriceHtml(item, promo)).toContain('85.00');

    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        groups: { g1: { min_price: 60, max_price: 60, compare_at_price: 100, has_promo: true } },
        variants: { s1: { retail_price: 60, compare_at_price: 100, is_on_promo: true } },
      }),
    }));
    expect(await fetchPromoPrices(promo, { groupIds: ['g1'], skuIds: ['s1'] }, fetchImpl)).toBe(true);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).toEqual({ code: 'TESTX', group_ids: ['g1'], sku_ids: ['s1'] });

    const html = formatIndexPriceHtml(item, promo);
    expect(html).toContain('60.00');
    expect(html).toContain('100.00');
    expect(variantDisplayPrice({ sku_id: 's1', retail_price: 85 }, promo).retail_price).toBe(60);

    // кеширано — без втора заявка
    expect(await fetchPromoPrices(promo, { groupIds: ['g1'] }, fetchImpl)).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
