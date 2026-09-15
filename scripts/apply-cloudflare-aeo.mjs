#!/usr/bin/env node
/**
 * Apply Cloudflare Dashboard settings required for AEO/GEO (AI crawler access).
 * Idempotent — safe to run after each deploy. Reports manual steps when bot APIs unavailable.
 * Re-run after rotating CLOUDFLARE_API_TOKEN with full zone permissions.
 * Last token rotation: 2026-09-15.
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node scripts/apply-cloudflare-aeo.mjs
 *   node scripts/apply-cloudflare-aeo.mjs --dry-run
 */
import { SITE_HOSTS } from '../hostname-routing-contract.js';

const API = 'https://api.cloudflare.com/client/v4';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const DRY_RUN = process.argv.includes('--dry-run');

const ZONES = [
  { site: 'main', domain: 'daotslabna.com' },
  { site: 'life', domain: 'life-protocols.com' },
  { site: 'portfolio', domain: 'biocode-bg.com' },
];

/** @type {Record<string, string>} */
const zoneCache = {};

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function cf(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!json.success) {
    const msg = json.errors?.map((e) => e.message).join('; ') || res.statusText;
    throw new Error(`${method} ${path} failed: ${msg}`);
  }
  return json.result;
}

async function cfTry(path, { method = 'GET', body } = {}) {
  try {
    const result = await cf(path, { method, body });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

const REQUIRED_PERMISSIONS = [
  'Zone Settings Edit',
  'Zone Read',
  'Cache Purge',
  'DNS Read',
  'Workers Scripts Read',
];

async function verifyToken() {
  const { ok, result, error } = await cfTry('/user/tokens/verify');
  if (!ok) {
    return { ok: false, verify_endpoint: false, error };
  }

  const policies = (result?.policies || []).map((p) => ({
    effect: p.effect,
    resources: p.resources,
    permission_groups: (p.permission_groups || []).map((g) => g.name || g.id),
  }));
  const granted = new Set(policies.flatMap((p) => p.permission_groups));
  const missing = REQUIRED_PERMISSIONS.filter((name) => !granted.has(name));

  return {
    ok: true,
    verify_endpoint: true,
    status: result?.status,
    expires_on: result?.expires_on,
    policies,
    granted: [...granted].sort(),
    missing_permissions: missing,
  };
}

async function verifyTokenViaZones() {
  const { ok, result, error } = await cfTry('/zones?status=active&per_page=50');
  if (!ok) return { ok: false, error };
  const names = new Set((result || []).map((z) => z.name));
  const missingZones = ZONES.map((z) => z.domain).filter((d) => !names.has(d));
  return { ok: missingZones.length === 0, zone_count: result?.length || 0, missing_zones: missingZones };
}

async function probeZonePermissions(domain) {
  const zoneId = await getZoneId(domain);
  const dns = await cfTry(`/zones/${zoneId}/dns_records?per_page=1`);
  const purge = await cfTry(`/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    body: { purge_everything: true },
  });
  return {
    domain,
    zoneId,
    dns_read: dns.ok,
    cache_purge: purge.ok,
    dns_error: dns.ok ? undefined : dns.error,
    purge_error: purge.ok ? undefined : purge.error,
  };
}
async function getZoneId(domain) {
  if (zoneCache[domain]) return zoneCache[domain];
  const result = await cf(`/zones?name=${encodeURIComponent(domain)}&status=active&per_page=1`);
  const zone = result?.[0];
  if (!zone?.id) throw new Error(`Zone not found for ${domain}`);
  zoneCache[domain] = zone.id;
  return zone.id;
}

async function getSetting(zoneId, id) {
  const { ok, result, error } = await cfTry(`/zones/${zoneId}/settings/${id}`);
  return ok ? result?.value : `error: ${error}`;
}

async function setSettingSafe(zoneId, id, value) {
  const current = await getSetting(zoneId, id);
  if (current === value) {
    return { ok: true, changed: false, from: current, to: value };
  }
  if (DRY_RUN) {
    return { ok: true, changed: true, dryRun: true, from: current, to: value };
  }
  const { ok, error } = await cfTry(`/zones/${zoneId}/settings/${id}`, {
    method: 'PATCH',
    body: { value },
  });
  return ok
    ? { ok: true, changed: true, from: current, to: value }
    : { ok: false, from: current, to: value, error };
}

async function tryBotProtections(zoneId) {
  const attempts = [];

  if (DRY_RUN) {
    return [{ ok: true, dryRun: true, action: 'bot_protections_skipped_in_dry_run' }];
  }

  // Bot Fight Mode / Super Bot Fight — endpoint varies by plan.
  attempts.push({
    action: 'settings.bot_fight_mode=off',
    ...(await cfTry(`/zones/${zoneId}/settings/bot_fight_mode`, {
      method: 'PATCH',
      body: { value: 'off' },
    })),
  });

  const { ok: gotBm, result: bmState } = await cfTry(`/zones/${zoneId}/bot_management`);
  if (gotBm) {
    const payload = {
      ...bmState,
      fight_mode: false,
      enable_js: bmState?.enable_js ?? false,
    };
    if (bmState && 'ai_bots_protection' in bmState) {
      payload.ai_bots_protection = 'allow';
    }
    attempts.push({
      action: 'bot_management.fight_mode=false',
      ...(await cfTry(`/zones/${zoneId}/bot_management`, { method: 'PUT', body: payload })),
    });
  } else {
    attempts.push({ action: 'bot_management.get', ok: false, error: 'unavailable on plan' });
  }

  return attempts;
}

async function purgeZone(zoneId, domain) {
  if (DRY_RUN) return { purged: true, dryRun: true };
  const { ok, error } = await cfTry(`/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    body: { purge_everything: true },
  });
  return ok ? { purged: true } : { purged: false, error };
}

async function auditDnsProxy(zoneId, domain) {
  const records = await cf(`/zones/${zoneId}/dns_records?per_page=100`);
  const important = records.filter((r) =>
    (r.name === domain || r.name === `www.${domain}`) &&
    (r.type === 'A' || r.type === 'AAAA' || r.type === 'CNAME')
  );
  return important.map((r) => ({
    name: r.name,
    type: r.type,
    proxied: r.proxied,
  }));
}

async function verifyWorkerRoutes() {
  if (!ACCOUNT_ID) return { ok: false, note: 'CLOUDFLARE_ACCOUNT_ID not set' };
  const { ok, result, error } = await cfTry(`/accounts/${ACCOUNT_ID}/workers/scripts/port/routes`);
  if (!ok) return { ok: false, error };
  const patterns = (result || []).map((r) => r.pattern || r.zone_name || JSON.stringify(r));
  const expected = [
    'daotslabna.com',
    'www.daotslabna.com',
    'biocode-bg.com',
    'www.biocode-bg.com',
    'life-protocols.com',
  ];
  const missing = expected.filter((p) => !patterns.some((x) => String(x).includes(p.replace('/*', ''))));
  return { ok: missing.length === 0, patterns, missing };
}

async function httpSmoke() {
  const checks = [];
  for (const [site, hosts] of Object.entries(SITE_HOSTS)) {
    const host = hosts[0];
    const robots = await fetch(`https://${host}/robots.txt`, { headers: { 'Cache-Control': 'no-cache' } });
    const robotsText = await robots.text();
    const home = await fetch(`https://${host}/`, { headers: { 'Cache-Control': 'no-cache' } });
    const homeHtml = await home.text();
    checks.push({
      site,
      host,
      robotsOk: robots.ok && robotsText.includes('OAI-SearchBot'),
      sitemapOk: robotsText.includes(`Sitemap: https://${host}/sitemap.xml`),
      llmsStatus: (await fetch(`https://${host}/llms.txt`)).status,
      noSeoCatalogLeak: !homeHtml.includes('id="seo-catalog"'),
    });
  }
  return checks;
}

async function applyZone(domain) {
  console.log(`\n=== ${domain} ===`);
  const zoneId = await getZoneId(domain);
  const bm = await cfTry(`/zones/${zoneId}/bot_management`);
  const audit = {
    ssl: await getSetting(zoneId, 'ssl'),
    security_level: await getSetting(zoneId, 'security_level'),
    bot_management: bm.ok ? bm.result : 'unavailable',
  };
  console.log('Before:', audit);

  const changes = {};
  changes.ssl = await setSettingSafe(zoneId, 'ssl', 'strict');
  changes.bot_protections = await tryBotProtections(zoneId);

  let dns = [];
  try {
    dns = await auditDnsProxy(zoneId, domain);
  } catch (err) {
    dns = [{ error: err.message }];
  }

  const purge = await purgeZone(zoneId, domain);
  console.log('Changes:', changes);
  console.log('DNS (apex/www):', dns);
  console.log('Purge:', purge);

  return { domain, zoneId, audit, changes, dns, purge };
}

async function main() {
  if (!TOKEN) {
    console.error('Missing CLOUDFLARE_API_TOKEN');
    process.exit(1);
  }

  console.log(`Cloudflare AEO apply ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log(`Account: ${ACCOUNT_ID || '(not set)'}`);

  const tokenInfo = await verifyToken();
  console.log('Token verify:', tokenInfo);
  if (!tokenInfo.ok) {
    console.warn(
      'Token verify endpoint unavailable (needs User->API Tokens->Read). Falling back to zone API probe.'
    );
  } else if (tokenInfo.missing_permissions?.length) {
    console.warn(
      'Token missing permissions (update GitHub secret CLOUDFLARE_API_TOKEN):',
      tokenInfo.missing_permissions.join(', ')
    );
  }

  const zoneAccess = await verifyTokenViaZones();
  console.log('Zone access:', zoneAccess);
  if (!zoneAccess.ok) {
    console.error('Token cannot access required zones — update GitHub secret CLOUDFLARE_API_TOKEN');
    process.exit(1);
  }

  const probe = await probeZonePermissions(ZONES[0].domain);
  console.log('Permission probe:', probe);
  if (!probe.dns_read || !probe.cache_purge) {
    console.warn(
      'DNS purge/audit may fail until token has Cache Purge + DNS Read on all 3 zones.'
    );
  }

  const results = [];
  for (const { domain } of ZONES) {
    results.push(await applyZone(domain));
  }

  console.log('\n=== Worker routes ===');
  const routes = await verifyWorkerRoutes();
  console.log(routes);

  console.log('\n=== HTTP smoke ===');
  const smoke = await httpSmoke();
  for (const row of smoke) {
    const ok = row.robotsOk && row.sitemapOk && row.llmsStatus === 200 && row.noSeoCatalogLeak;
    console.log(`${ok ? 'OK' : 'FAIL'} ${row.host}`, row);
  }

  const allSmokeOk = smoke.every((r) => r.robotsOk && r.sitemapOk && r.llmsStatus === 200 && r.noSeoCatalogLeak);
  if (!allSmokeOk) process.exitCode = 1;

  console.log('\nDone.');
  console.log('Manual if bot API unavailable: Security → Bots → Bot Fight Mode OFF + AI Crawl Control allow.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
