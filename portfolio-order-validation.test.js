import {
  validatePortfolioCustomer,
  sanitizePortfolioCustomer,
  validateCartHasSku,
  isValidBgPhone
} from './portfolio-order-validation.js';
import { handlePortfolioRoute } from './portfolio-api.js';

describe('Portfolio order validation', () => {
  const validCustomer = {
    firstName: 'Иван',
    lastName: 'Петров',
    phone: '+359888123456',
    email: '',
    deliveryMethod: 'courier',
    courierCompany: 'Speedy',
    courierOfficeId: '123',
    courierOfficeName: 'София офис',
    courierOfficeAddress: 'ул. Тест 1',
    policyConsent: true,
    terms: true
  };

  test('accepts valid courier customer', () => {
    expect(validatePortfolioCustomer(validCustomer).valid).toBe(true);
  });

  test('rejects missing office name', () => {
    const result = validatePortfolioCustomer({ ...validCustomer, courierOfficeName: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('офис'))).toBe(true);
  });

  test('rejects invalid phone', () => {
    expect(isValidBgPhone('123')).toBe(false);
    expect(validatePortfolioCustomer({ ...validCustomer, phone: 'abc' }).valid).toBe(false);
  });

  test('rejects without terms consent', () => {
    expect(validatePortfolioCustomer({ ...validCustomer, terms: false }).valid).toBe(false);
  });

  test('rejects address delivery without postcode', () => {
    const result = validatePortfolioCustomer({
      ...validCustomer,
      deliveryMethod: 'address',
      address: 'ул. Тест 1',
      city: 'София',
      postcode: ''
    });
    expect(result.valid).toBe(false);
  });

  test('sanitizePortfolioCustomer normalizes phone', () => {
    const sanitized = sanitizePortfolioCustomer({ ...validCustomer, phone: '+359 888 123 456' });
    expect(sanitized.phone).toBe('+359888123456');
  });

  test('validateCartHasSku requires sku_id', () => {
    expect(validateCartHasSku([{ name: 'X', quantity: 1 }]).valid).toBe(false);
    expect(validateCartHasSku([{ sku_id: '1', quantity: 2 }]).valid).toBe(true);
  });
});

describe('Portfolio order creation rejects invalid orders', () => {
  const catalogChunk = [{
    group_id: '100',
    name: 'Test Protein',
    brand: 'TestBrand',
    image: '',
    variants: [{
      sku_id: '1',
      barcode: '1234567890',
      pack: '1 кг',
      option: 'Шоколад',
      available: true,
      b2b_price: 10,
      retail_price: 13
    }]
  }];

  const env = {
    PAGE_CONTENT: {
      data: new Map([
        ['portfolio_meta', JSON.stringify({ chunk_count: 1, total_groups: 1, index: [], lookup: {} })],
        ['portfolio_chunk_0', JSON.stringify(catalogChunk)],
        ['portfolio_orders', '[]']
      ]),
      get: async (key) => env.PAGE_CONTENT.data.get(key) ?? null,
      put: async (key, value) => { env.PAGE_CONTENT.data.set(key, value); }
    }
  };

  const validBody = {
    customer: {
      firstName: 'Иван',
      lastName: 'Петров',
      phone: '+359888123456',
      deliveryMethod: 'courier',
      courierCompany: 'Speedy',
      courierOfficeId: '99',
      courierOfficeName: 'Тест офис',
      policyConsent: true,
      terms: true
    },
    products: [{ sku_id: '1', quantity: 1 }]
  };

  test('POST /portfolio/orders rejects incomplete customer', async () => {
    const request = new Request('https://example.com/portfolio/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        customer: { ...validBody.customer, courierOfficeName: '' }
      })
    });
    const res = await handlePortfolioRoute(request, env, new URL(request.url));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/офис/i);

    const orders = JSON.parse(env.PAGE_CONTENT.data.get('portfolio_orders'));
    expect(orders).toHaveLength(0);
  });

  test('POST /portfolio/orders accepts valid order with 201', async () => {
    const request = new Request('https://example.com/portfolio/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody)
    });
    const res = await handlePortfolioRoute(request, env, new URL(request.url));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.order.id).toMatch(/^pf-/);
    expect(data.order.customer.phone).toBe('+359888123456');
  });

  test('GET /portfolio/order returns saved order', async () => {
    const orders = JSON.parse(env.PAGE_CONTENT.data.get('portfolio_orders'));
    const id = orders[0].id;
    const request = new Request(`https://example.com/portfolio/order?id=${id}`, { method: 'GET' });
    const res = await handlePortfolioRoute(request, env, new URL(request.url));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(id);
  });
});
