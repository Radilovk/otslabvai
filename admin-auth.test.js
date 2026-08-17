import {
  verifyPassword,
  issueAdminToken,
  verifyAdminToken,
  routeRequiresAdmin
} from './admin-auth.js';

const env = { ADMIN_PASSWORD: 'kakadu1234' };

describe('admin-auth', () => {
  test('verifyPassword accepts correct password', async () => {
    expect(await verifyPassword('kakadu1234', env)).toBe(true);
    expect(await verifyPassword('wrong', env)).toBe(false);
  });

  test('issue and verify admin token', async () => {
    const token = await issueAdminToken(env);
    expect(await verifyAdminToken(token, env)).toBe(true);
    expect(await verifyAdminToken('bad.token', env)).toBe(false);
  });

  test('routeRequiresAdmin protects orders list but not create', () => {
    expect(routeRequiresAdmin('/portfolio/orders', 'GET')).toBe(true);
    expect(routeRequiresAdmin('/portfolio/orders', 'POST')).toBe(false);
    expect(routeRequiresAdmin('/portfolio/validate-cart', 'POST')).toBe(false);
    expect(routeRequiresAdmin('/admin/login', 'POST')).toBe(false);
    expect(routeRequiresAdmin('/api-token', 'GET')).toBe(true);
  });
});
