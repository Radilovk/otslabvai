/**
 * Simple per-IP order rate limiting via KV.
 */

const DEFAULT_LIMIT = 8;
const WINDOW_MS = 60 * 60 * 1000;
const KV_PREFIX = 'rate_order_';

export function getClientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'unknown'
  );
}

export async function assertOrderRateLimit(request, env, { limit = DEFAULT_LIMIT } = {}) {
  const ip = getClientIp(request);
  const key = `${KV_PREFIX}${ip}`;
  const now = Date.now();
  let bucket = { count: 0, resetAt: now + WINDOW_MS };

  try {
    const raw = await env.PAGE_CONTENT.get(key);
    if (raw) bucket = JSON.parse(raw);
  } catch {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
  }

  if (now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
  }

  if (bucket.count >= limit) {
    /** @type {Error & { status?: number; name?: string }} */
    const err = new Error('Твърде много поръчки за кратко време. Опитайте след час.');
    err.name = 'RateLimitError';
    err.status = 429;
    throw err;
  }

  bucket.count += 1;
  await env.PAGE_CONTENT.put(key, JSON.stringify(bucket), { expirationTtl: Math.ceil(WINDOW_MS / 1000) + 60 });
}
