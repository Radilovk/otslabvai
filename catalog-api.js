/**
 * Cost-constant catalog delivery – /c/now pointer + immutable KV artifacts.
 */
import { CATALOG_KV } from './catalog-kv-keys.js';
import { CATALOG_SYNC_POLICY } from './catalog-sync-policy.js';

const GITHUB_CATALOG_DISPATCH = {
  owner: 'Radilovk',
  repo: 'otslabvai'
};

const IMMUTABLE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=31536000, immutable'
};

const POINTER_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=0, s-maxage=60'
};

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

async function readJson(env, key) {
  const raw = await env.PAGE_CONTENT.get(key);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Fire-and-forget GHA catalog-light-sync via repository_dispatch.
 * @returns {Promise<{ triggered: boolean, reason?: string }>}
 */
export async function requestCatalogLightSync(env) {
  const token = env.GITHUB_API_TOKEN || await env.PAGE_CONTENT?.get('api_token');
  if (!token) return { triggered: false, reason: 'no_github_token' };

  const pointer = await readJson(env, CATALOG_KV.POINTER);
  const nowMs = Date.now();
  if (pointer?.dispatchedAt) {
    const dispatchedMs = pointer.dispatchedAt * 1000;
    if (nowMs - dispatchedMs < CATALOG_SYNC_POLICY.DISPATCH_DEBOUNCE_MS) {
      return { triggered: false, reason: 'debounced' };
    }
  }

  const { owner, repo } = GITHUB_CATALOG_DISPATCH;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Cloudflare-Worker'
    },
    body: JSON.stringify({ event_type: 'catalog-light-sync' })
  });

  if (!res.ok) {
    console.error('Catalog light sync dispatch failed:', res.status, await res.text());
    return { triggered: false, reason: `http_${res.status}` };
  }

  const updated = {
    ...(pointer || {}),
    dispatchedAt: Math.floor(nowMs / 1000)
  };
  await env.PAGE_CONTENT.put(CATALOG_KV.POINTER, JSON.stringify(updated));
  return { triggered: true };
}

async function maybeDispatchRefresh(env, pointer, ctx) {
  if (!pointer?.t) return;
  const ageMs = Date.now() - pointer.t * 1000;
  if (ageMs < CATALOG_SYNC_POLICY.REFRESH_WINDOW_MS) return;
  if (ctx?.waitUntil) {
    ctx.waitUntil(requestCatalogLightSync(env));
  } else {
    await requestCatalogLightSync(env);
  }
}

async function handleCatalogNow(env, ctx) {
  const pointer = await readJson(env, CATALOG_KV.POINTER);
  if (!pointer?.i || !pointer?.s) {
    return jsonResponse({ error: 'Каталогът не е синхронизиран.' }, 404, POINTER_HEADERS);
  }
  await maybeDispatchRefresh(env, pointer, ctx);
  return jsonResponse({ i: pointer.i, s: pointer.s, t: pointer.t }, 200, POINTER_HEADERS);
}

async function serveArtifact(env, key) {
  const raw = await env.PAGE_CONTENT.get(key);
  if (!raw) return jsonResponse({ error: 'Not found' }, 404, IMMUTABLE_HEADERS);
  return new Response(raw, { status: 200, headers: IMMUTABLE_HEADERS });
}

/**
 * @param {Request} request
 * @param {object} env
 * @param {URL} url
 * @param {object} [ctx]
 */
export async function handleCatalogRoute(request, env, url, ctx) {
  const path = url.pathname;

  if (path === '/c/now' && request.method === 'GET') {
    return handleCatalogNow(env, ctx);
  }

  const indexMatch = path.match(/^\/c\/index-([a-f0-9]+)\.json$/);
  if (indexMatch && request.method === 'GET') {
    return serveArtifact(env, CATALOG_KV.index(indexMatch[1]));
  }

  const stockMatch = path.match(/^\/c\/stock-([a-f0-9]+)\.json$/);
  if (stockMatch && request.method === 'GET') {
    return serveArtifact(env, CATALOG_KV.stock(stockMatch[1]));
  }

  const groupsMatch = path.match(/^\/c\/groups-([a-f0-9]+)-(\d+)\.json$/);
  if (groupsMatch && request.method === 'GET') {
    return serveArtifact(env, CATALOG_KV.groups(groupsMatch[1], Number(groupsMatch[2])));
  }

  return null;
}
