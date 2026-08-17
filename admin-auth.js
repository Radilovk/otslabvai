/**
 * Admin authentication for Cloudflare Worker + admin panel.
 * Password via env.ADMIN_PASSWORD; issues HMAC-signed bearer tokens.
 */

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function timingSafeEqual(a, b) {
  const sa = String(a ?? '');
  const sb = String(b ?? '');
  if (sa.length !== sb.length) return false;
  let out = 0;
  for (let i = 0; i < sa.length; i += 1) out |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  return out === 0;
}

function getAdminPassword(env) {
  return String(env?.ADMIN_PASSWORD || '').trim();
}

async function signingKey(env) {
  const secret = getAdminPassword(env) || 'admin-signing-fallback';
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function signPayload(payloadB64, env) {
  const key = await signingKey(env);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return bytesToHex(sig);
}

export async function verifyPassword(password, env) {
  const expected = getAdminPassword(env);
  if (!expected) return false;
  return timingSafeEqual(String(password ?? '').trim(), expected);
}

export async function issueAdminToken(env) {
  const payload = { exp: Date.now() + TOKEN_TTL_MS, iat: Date.now() };
  const payloadB64 = btoa(JSON.stringify(payload));
  const sig = await signPayload(payloadB64, env);
  return `${payloadB64}.${sig}`;
}

export async function verifyAdminToken(token, env) {
  if (!token || !getAdminPassword(env)) return false;
  const parts = String(token).split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expected = await signPayload(payloadB64, env);
  if (!timingSafeEqual(sig, expected)) return false;
  try {
    const payload = JSON.parse(atob(payloadB64));
    return Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

export function getBearerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return (request.headers.get('X-Admin-Token') || '').trim();
}

export async function isAdminAuthorized(request, env) {
  return verifyAdminToken(getBearerToken(request), env);
}

export async function assertAdminAuthorized(request, env) {
  if (!(await isAdminAuthorized(request, env))) {
    /** @type {Error & { status?: number }} */
    const err = new Error('Неоторизиран достъп. Влезте в админ панела.');
    err.status = 401;
    throw err;
  }
}

/** Routes that require admin bearer token. */
export function routeRequiresAdmin(pathname, method) {
  const path = pathname.split('?')[0];
  const m = method.toUpperCase();

  if (path === '/admin/login' || path === '/admin/session') return false;

  if (path === '/portfolio/orders' && m === 'POST') return false;
  if (path === '/portfolio/validate-cart' && m === 'POST') return false;
  if (path === '/portfolio/validate-promo' && m === 'POST') return false;
  if (path === '/portfolio/order' && m === 'GET') return false;

  const adminExact = new Set([
    '/portfolio/orders',
    '/portfolio/orders/summary',
    '/portfolio/orders/approve',
    '/portfolio/orders/approve-batch',
    '/portfolio/settings',
    '/portfolio/fitness1-key-status',
    '/portfolio/promo-codes',
    '/orders',
    '/contacts',
    '/api/biocode-inquiries',
    '/ai-settings',
    '/api-token',
    '/bio_content.json',
    '/bio_rebake',
    '/life-protocol/settings',
    '/life-protocol/leads',
    '/life-protocol/results',
    '/portfolio-advisor/settings',
    '/portfolio-advisor/leads',
    '/portfolio-advisor/results',
  ]);

  if (adminExact.has(path) && m === 'GET') return true;
  if (path === '/portfolio/sync' && m === 'POST') return true;

  if (path === '/page_content.json' && m === 'POST') return true;
  if (path === '/life_page_content.json' && m === 'POST') return true;
  if (path === '/orders' && (m === 'PUT' || m === 'GET')) return true;
  if (path === '/portfolio/orders' && m === 'PUT') return true;
  if (path === '/portfolio/promo-codes' && (m === 'POST' || m === 'PUT' || m === 'DELETE')) return true;
  if (path === '/portfolio/settings' && m === 'POST') return true;
  if (path === '/portfolio/upload-image' && m === 'POST') return true;
  if (path === '/contacts' && m === 'GET') return true;
  if (path === '/api/biocode-inquiries' && m === 'GET') return true;
  if (path === '/ai-settings' && (m === 'GET' || m === 'POST')) return true;
  if (path === '/bio_content.json' && m === 'POST') return true;
  if (path === '/bio_rebake' && m === 'POST') return true;
  if (path.startsWith('/life-protocol/') && m !== 'GET' && path !== '/life-protocol-submit') return true;
  if (path.startsWith('/portfolio-advisor/') && path.includes('/settings') && (m === 'GET' || m === 'POST')) return true;
  if (path.startsWith('/portfolio-advisor/') && (path.endsWith('/leads') || path.endsWith('/results')) && m === 'GET') return true;
  if (path.startsWith('/portfolio/import/')) return true;
  if (path === '/promo-codes' && m !== 'GET') return true;
  if (path === '/promo-codes' && m === 'GET') return true;
  if (path === '/ai-assistant' && m === 'POST') return true;
  if (path === '/life-protocol/simulate' && m === 'POST') return true;
  if (path === '/portfolio-advisor/simulate' && m === 'POST') return true;
  if (path === '/life-protocol/settings' && m === 'POST') return true;
  if (path === '/portfolio-advisor/settings' && m === 'POST') return true;

  return false;
}

export async function handleAdminLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonAuth({ error: 'Невалиден JSON.' }, 400);
  }
  if (!getAdminPassword(env)) {
    return jsonAuth({ error: 'ADMIN_PASSWORD не е конфигуриран на сървъра.' }, 503);
  }
  if (!(await verifyPassword(body?.password, env))) {
    return jsonAuth({ error: 'Грешна парола.' }, 401);
  }
  const token = await issueAdminToken(env);
  return jsonAuth({ success: true, token });
}

export async function handleAdminSession(request, env) {
  const ok = await isAdminAuthorized(request, env);
  if (!ok) return jsonAuth({ valid: false }, 401);
  return jsonAuth({ valid: true });
}

function jsonAuth(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
