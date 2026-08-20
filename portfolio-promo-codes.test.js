import { promoCodeKey, promoRecordId, removePromoFromLegacy } from './portfolio-api.js';

describe('portfolio promo codes admin', () => {
  test('promoCodeKey normalizes codes', () => {
    expect(promoCodeKey('  welcome10 ')).toBe('WELCOME10');
    expect(promoCodeKey('')).toBe('');
  });

  test('promoRecordId is stable for legacy rows', () => {
    expect(promoRecordId({ code: 'FITNESS1' })).toBe('pf-promo-mig-FITNESS1');
    expect(promoRecordId({ id: 'pf-promo-123', code: 'X' })).toBe('pf-promo-123');
  });

  test('removePromoFromLegacy deletes by id and code', async () => {
    const store = {
      promo_codes: JSON.stringify([
        { id: 'legacy-1', code: 'OLD10', discount: 5 },
        { id: 'legacy-2', code: 'KEEP', discount: 10 },
      ]),
    };
    const env = {
      PAGE_CONTENT: {
        get: async (key) => store[key] || null,
        put: async (key, value) => { store[key] = value; },
      },
    };

    await removePromoFromLegacy(env, { id: 'legacy-1', code: 'OLD10' });
    const remaining = JSON.parse(store.promo_codes);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].code).toBe('KEEP');
  });
});
