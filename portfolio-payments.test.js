import {
  resolveReturnOrigin,
  buildReturnUrls,
  buildCheckoutSessionParams,
  encodeStripeForm,
  toMinorUnits,
  isSessionPaidForOrder,
  isOrderPaid,
  verifyStripeSignature,
  computeStripeSignature,
} from './portfolio-payments.js';

const order = {
  id: 'pf-1-abc',
  project: 'portfolio',
  customer: { email: 'a@b.bg' },
  products: [{ name: 'Whey', quantity: 2 }],
  payment: { status: 'pending', amount: 49.9 },
};

describe('portfolio-payments', () => {
  test('return origin accepts only our domains', () => {
    expect(resolveReturnOrigin('https://www.life-protocols.com', 'life')).toBe('https://www.life-protocols.com');
    expect(resolveReturnOrigin('https://evil.example', 'life')).toBe('https://life-protocols.com');
    expect(resolveReturnOrigin(null, 'main')).toBe('https://daotslabna.com');
    expect(resolveReturnOrigin('http://localhost:8787', 'portfolio')).toBe('http://localhost:8787');
  });

  test('return urls per site', () => {
    expect(buildReturnUrls('https://daotslabna.com', 'main', 'm-1').success_url)
      .toBe('https://daotslabna.com/checkout.html?id=m-1&paid=1');
    expect(buildReturnUrls('https://biocode-bg.com', 'portfolio', 'pf-1').cancel_url)
      .toBe('https://biocode-bg.com/portfolio-checkout.html?cancelled=pf-1');
  });

  test('minor units round correctly', () => {
    expect(toMinorUnits(14.64)).toBe(1464);
    expect(toMinorUnits(0.29)).toBe(29);
  });

  test('checkout session params encode as Stripe form fields', () => {
    const form = encodeStripeForm(buildCheckoutSessionParams(order, { origin: 'https://biocode-bg.com', nowSec: 1000 }));
    expect(form.get('line_items[0][price_data][unit_amount]')).toBe('4990');
    expect(form.get('line_items[0][quantity]')).toBe('1');
    expect(form.get('customer_email')).toBe('a@b.bg');
    expect(form.get('expires_at')).toBe(String(1000 + 1800));
    expect(form.get('client_reference_id')).toBe('pf-1-abc');
    expect(form.get('payment_intent_data[metadata][order_id]')).toBe('pf-1-abc');
  });

  test('session paid check requires matching order, currency and amount', () => {
    const s = { payment_status: 'paid', currency: 'eur', amount_total: 4990, metadata: { order_id: 'pf-1-abc' } };
    expect(isSessionPaidForOrder(s, order)).toBe(true);
    expect(isSessionPaidForOrder({ ...s, amount_total: 4989 }, order)).toBe(false);
    expect(isSessionPaidForOrder({ ...s, payment_status: 'unpaid' }, order)).toBe(false);
    expect(isSessionPaidForOrder({ ...s, metadata: { order_id: 'other' } }, order)).toBe(false);
  });

  test('legacy orders without payment are treated as paid', () => {
    expect(isOrderPaid({ id: 'old' })).toBe(true);
    expect(isOrderPaid(order)).toBe(false);
  });

  test('webhook signature verification', async () => {
    const body = '{"a":1}';
    const sig = await computeStripeSignature('whsec_x', 1000, body);
    expect(await verifyStripeSignature(body, `t=1000,v1=${sig}`, 'whsec_x', { nowSec: 1010 })).toBe(true);
    expect(await verifyStripeSignature(body, `t=1000,v1=${sig}`, 'whsec_y', { nowSec: 1010 })).toBe(false);
    expect(await verifyStripeSignature('{"a":2}', `t=1000,v1=${sig}`, 'whsec_x', { nowSec: 1010 })).toBe(false);
    expect(await verifyStripeSignature(body, `t=1000,v1=${sig}`, 'whsec_x', { nowSec: 2000 })).toBe(false);
  });
});
