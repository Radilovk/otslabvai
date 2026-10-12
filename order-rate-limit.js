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

export async function assertOrderRateLimit(request, env, { limit = DEFAULT_LIMIT, prefix = KV_PREFIX, message = null } = {}) {
  const ip = getClientIp(request);
  const key = `${prefix}${ip}`;
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
    const err = new Error(message || 'Твърде много поръчки за кратко време. Опитайте след час.');
    err.name = 'RateLimitError';
    err.status = 429;
    throw err;
  }

  bucket.count += 1;
  await env.PAGE_CONTENT.put(key, JSON.stringify(bucket), { expirationTtl: Math.ceil(WINDOW_MS / 1000) + 60 });
}

/** AI консултантите правят платено AI извикване на всяка заявка — лимит на IP на час. */
export const ADVISOR_RATE_LIMIT = 6;

export async function assertAdvisorRateLimit(request, env) {
  return assertOrderRateLimit(request, env, {
    limit: ADVISOR_RATE_LIMIT,
    prefix: 'rate_advisor_',
    message: 'Достигнахте лимита за персонални препоръки. Опитайте отново след час.',
  });
}
