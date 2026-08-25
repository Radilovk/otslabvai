import {
  saveActivePromo,
  loadActivePromo,
  promoSuccessMessage,
  clearPortfolioPromo,
  PROMO_CODE_SESSION_KEY,
} from './portfolio-promo-ui.js';

describe('portfolio-promo-ui', () => {
  beforeEach(() => {
    const store = {};
    global.sessionStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    };
  });

  test('promoSuccessMessage for cart percentage', () => {
    const msg = promoSuccessMessage({ code: 'WELCOME', discountType: 'percentage', discount: 10 });
    expect(msg).toContain('WELCOME');
    expect(msg).toContain('10%');
  });

  test('promoSuccessMessage for line pricing below regular', () => {
    const msg = promoSuccessMessage({
      code: 'FIT',
      pricing_mode: 'below_regular',
      pricing_percent: 15,
      discountType: 'percentage',
      discount: 0,
    });
    expect(msg).toContain('FIT');
    expect(msg).toContain('15%');
    expect(msg).toContain('клиентска');
  });

  test('promoSuccessMessage for margin share', () => {
    const msg = promoSuccessMessage({
      code: 'MARGIN50',
      discountType: 'margin_percentage',
      discount: 50,
    });
    expect(msg).toContain('MARGIN50');
    expect(msg).toContain('50%');
    expect(msg).toContain('маржа');
  });

  test('persists and clears promo in session storage', () => {
    expect(loadActivePromo()).toBeNull();
    saveActivePromo({ code: 'TEST', discountType: 'percentage', discount: 5 });
    expect(loadActivePromo().code).toBe('TEST');
    expect(sessionStorage.getItem(PROMO_CODE_SESSION_KEY)).toContain('TEST');
    clearPortfolioPromo();
    expect(loadActivePromo()).toBeNull();
  });
});
