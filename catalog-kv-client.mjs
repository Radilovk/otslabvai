/**
 * Cloudflare KV helpers for GHA catalog sync scripts (with transient network retries).
 */

const KV_NS = process.env.CLOUDFLARE_KV_NAMESPACE_ID || 'd220db696e414b7cb3da2b19abd53d0f';

function kvUrl(key) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  return `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${KV_NS}/values/${encodeURIComponent(key)}`;
}

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, ...extra };
}

async function fetchWithRetry(url, init, label = 'KV request') {
  const maxAttempts = 5;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) break;
      const delayMs = 1000 * (2 ** (attempt - 1));
      console.warn(`${label} failed (${attempt}/${maxAttempts}): ${err.message}; retry in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

export async function kvGet(key) {
  const res = await fetchWithRetry(kvUrl(key), { headers: authHeaders() }, `KV get ${key}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KV get ${key}: ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

export async function kvPut(key, body, contentType = 'application/json') {
  const res = await fetchWithRetry(kvUrl(key), {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': contentType }),
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }, `KV put ${key}`);
  const data = await res.json();
  if (!data.success) throw new Error(`KV put ${key} failed: ${JSON.stringify(data.errors)}`);
}

export async function kvDelete(key) {
  await fetchWithRetry(kvUrl(key), {
    method: 'DELETE',
    headers: authHeaders(),
  }, `KV delete ${key}`);
}
