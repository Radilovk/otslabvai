import {
  CHECKOUT_RETURN_PARAM,
  withCheckoutReturn,
  getCheckoutReturnPath,
  resolveLifeCartProductUrl,
  resolveMainCartProductUrl,
} from './portfolio-checkout-cart-ui.js';

describe('portfolio-checkout-cart-ui', () => {
  test('withCheckoutReturn adds from_checkout param', () => {
    const url = withCheckoutReturn('life-product.html?id=42', 'life-checkout.html');
    expect(url).toContain('from_checkout=life-checkout.html');
    expect(url).toContain('id=42');
  });

  test('getCheckoutReturnPath reads from_checkout', () => {
    expect(getCheckoutReturnPath(`?${CHECKOUT_RETURN_PARAM}=checkout.html`)).toBe('checkout.html');
    expect(getCheckoutReturnPath('')).toBeNull();
  });

  test('resolveLifeCartProductUrl handles life and portfolio ids', () => {
    expect(resolveLifeCartProductUrl({ id: 'prod-abc' })).toBe('life-product.html?id=prod-abc');
    expect(resolveLifeCartProductUrl({ id: 'prod-pf-100_55' })).toBe(
      'portfolio-product.html?group_id=100&sku=55'
    );
  });

  test('resolveMainCartProductUrl maps to product.html', () => {
    expect(resolveMainCartProductUrl({ id: 'prod-xyz' })).toBe('product.html?id=prod-xyz');
    expect(resolveMainCartProductUrl({ id: 'prod-pf-200' })).toBe(
      'portfolio-product.html?group_id=200'
    );
  });
});
