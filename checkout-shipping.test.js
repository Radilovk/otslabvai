import { calculateCheckoutShipping, formatShippingLabel } from './checkout-shipping.js';

describe('checkout-shipping', () => {
  test('free shipping at 100 EUR', () => {
    expect(calculateCheckoutShipping(100, { deliveryMethod: 'courier', courierCompany: 'Speedy' })).toBe(0);
  });

  test('Speedy office rate', () => {
    const ship = calculateCheckoutShipping(50, { deliveryMethod: 'courier', courierCompany: 'Speedy' });
    expect(ship).toBeCloseTo(1.52 + 50 * 0.0096, 2);
  });

  test('Econt office rate', () => {
    const ship = calculateCheckoutShipping(50, { deliveryMethod: 'courier', courierCompany: 'Econt' });
    expect(ship).toBeCloseTo(3.1 + 50 * 0.0298, 2);
  });

  test('formatShippingLabel', () => {
    expect(formatShippingLabel(0)).toBe('Безплатна');
    expect(formatShippingLabel(5.5)).toBe('5.50 €');
  });
});
