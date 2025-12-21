import worker from './worker.js';
import { jest } from '@jest/globals';

describe('/orders endpoint', () => {
  test('reads orders from ORDERS binding', async () => {
    const env = {
      ORDERS: { get: jest.fn().mockResolvedValue(JSON.stringify([{ id: 'o1', status: 'Нова' }])) },
      PAGE_CONTENT: { get: jest.fn(), put: jest.fn() }
    };
    const ctx = { waitUntil: jest.fn() };

    const response = await worker.fetch(new Request('http://example.com/orders'), env, ctx);
    const data = await response.json();

    expect(env.ORDERS.get).toHaveBeenCalledWith('orders');
    expect(env.PAGE_CONTENT.get).not.toHaveBeenCalled();
    expect(data).toEqual([{ id: 'o1', status: 'Нова' }]);
  });

  test('updates order status via ORDERS binding', async () => {
    const storedOrders = [{ id: 'o1', status: 'Нова' }];
    const env = {
      ORDERS: {
        get: jest.fn().mockResolvedValue(JSON.stringify(storedOrders)),
        put: jest.fn().mockResolvedValue()
      },
      PAGE_CONTENT: { get: jest.fn(), put: jest.fn() }
    };
    const waitUntil = jest.fn();
    const ctx = { waitUntil };

    const request = new Request('http://example.com/orders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'o1', status: 'Приключена' })
    });

    const response = await worker.fetch(request, env, ctx);
    const body = await response.json();

    expect(env.ORDERS.get).toHaveBeenCalledWith('orders');
    expect(env.ORDERS.put).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
    const [, putPayload] = env.ORDERS.put.mock.calls[0];
    expect(JSON.parse(putPayload)).toEqual([{ id: 'o1', status: 'Приключена' }]);
    expect(body.updatedOrder.status).toBe('Приключена');
    expect(env.PAGE_CONTENT.get).not.toHaveBeenCalled();
  });
});
