#!/usr/bin/env node
/**
 * Apply Cloudflare Dashboard settings required for AEO/GEO (AI crawler access).
 * Idempotent — safe to run after each deploy. Reports manual steps when bot APIs unavailable.
 * Re-run after rotating CLOUDFLARE_API_TOKEN with full zone permissions.
 * Last token rotation: 2026-09-15 (corrected ~40 char API token).
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node scripts/apply-cloudflare-aeo.mjs
 *   CLOUDFLARE_API_TOKEN1=... (fallback alias) also accepted
 *   node scripts/apply-cloudflare-aeo.mjs --dry-run
 */
import { pathToFileURL } from 'node:url';
import { SITE_HOSTS } from '../hostname-routing-contract.js';
import { AI_CRAWLER_AGENTS } from '../seo-aeo-inject.js';

const API = 'https://api.cloudflare.com/client/v4';

function normalizeToken(raw) {
  return String(raw || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/[\r\n]+/g, '');
}

const TOKEN = normalizeToken(process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN1);
const TOKEN_SOURCE = process.env.CLOUDFLARE_API_TOKEN ? 'CLOUDFLARE_API_TOKEN' : 'CLOUDFLARE_API_TOKEN1';
const ACCOUNT_ID = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
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
  'Bot Management Write',
  'Zone WAF Write',
];

const WAF_CUSTOM_PHASE = 'http_request_firewall_custom';
const WAF_MANAGED_PHASE = 'http_request_firewall_managed';
const CF_MANAGED_RULESET_ID = 'efb7b8c949ac4650a09736fc376e9aee';
const WAF_AI_SKIP_RULE_DESC = 'AEO: allow AI search crawlers (otslabvai)';
const WAF_AI_MANAGED_EXCEPTION_DESC = 'AEO: skip managed AI bot blocks (otslabvai)';
const AI_MANAGED_RULE_DESC = /\b(AI bot|AI crawler|AI scraper|GPTBot|ClaudeBot|Bytespider|Block AI)\b/i;

/** Build WAF expression matching AI crawler User-Agents from Worker robots.txt list. */
export function buildAiCrawlerUaExpression(agents = AI_CRAWLER_AGENTS) {
  const parts = agents.map(
    (agent) => `http.user_agent contains "${String(agent).replace(/"/g, '\\"')}"`
  );
  return `(${parts.join(' or ')})`;
}

function buildAiCrawlerSkipRule() {
  return {
    description: WAF_AI_SKIP_RULE_DESC,
    expression: buildAiCrawlerUaExpression(),
    action: 'skip',
    action_parameters: {
      phases: ['http_request_sbfm', 'http_request_firewall_managed', 'http_ratelimit'],
      products: ['bic', 'securityLevel', 'uaBlock', 'waf'],
      ruleset: 'current',
    },
    enabled: true,
  };
}

function ruleNeedsUpdate(existingRule, desiredRule) {
  return (
    existingRule.expression !== desiredRule.expression ||
    existingRule.action !== desiredRule.action ||
    JSON.stringify(existingRule.action_parameters || {}) !==
      JSON.stringify(desiredRule.action_parameters || {}) ||
    existingRule.enabled !== desiredRule.enabled
  );
}

async function getPhaseEntrypoint(zoneId, phase) {
  const res = await fetch(`${API}/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`, {
    headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 404 || (json.errors || []).some((e) => /not found/i.test(e.message || ''))) {
    return { ok: false, notFound: true };
  }
  if (!json.success) {
    return { ok: false, error: json.errors?.map((e) => e.message).join('; ') || res.statusText };
  }
  return { ok: true, result: json.result };
}

async function discoverManagedAiBlockRuleIds(zoneId) {
  const { ok, result } = await cfTry(`/zones/${zoneId}/rulesets/${CF_MANAGED_RULESET_ID}`);
  if (!ok || !result?.rules?.length) return [];
  return result.rules
    .filter((rule) => rule.enabled !== false && AI_MANAGED_RULE_DESC.test(rule.description || ''))
    .map((rule) => rule.id);
}

async function upsertEntrypointRule(zoneId, phase, desiredRule, { position } = {}) {
  const entry = await getPhaseEntrypoint(zoneId, phase);
  if (!entry.ok && !entry.notFound) {
    return { ok: false, action: `${phase}.get`, error: entry.error };
  }

  if (entry.notFound) {
    if (DRY_RUN) {
      return { ok: true, dryRun: true, action: `${phase}.create`, rule: desiredRule.description };
    }
    const created = await cfTry(`/zones/${zoneId}/rulesets`, {
      method: 'POST',
      body: { name: `${phase} entry point`, kind: 'zone', phase, rules: [desiredRule] },
    });
    return created.ok
      ? { ok: true, action: `${phase}.create`, changed: true }
      : { ok: false, action: `${phase}.create`, error: created.error };
  }

  const rulesetId = entry.result.id;
  const existing = (entry.result.rules || []).find((r) => r.description === desiredRule.description);
  if (existing) {
    if (!ruleNeedsUpdate(existing, desiredRule)) {
      return { ok: true, action: `${phase}.update`, changed: false, ruleId: existing.id };
    }
    if (DRY_RUN) {
      return { ok: true, dryRun: true, action: `${phase}.update`, ruleId: existing.id };
    }
    const updated = await cfTry(`/zones/${zoneId}/rulesets/${rulesetId}/rules/${existing.id}`, {
      method: 'PATCH',
      body: desiredRule,
    });
    return updated.ok
      ? { ok: true, action: `${phase}.update`, changed: true, ruleId: existing.id }
      : { ok: false, action: `${phase}.update`, error: updated.error, ruleId: existing.id };
  }

  if (DRY_RUN) {
    return { ok: true, dryRun: true, action: `${phase}.add`, rule: desiredRule.description, position };
  }
  const body = position ? { ...desiredRule, position } : desiredRule;
  const added = await cfTry(`/zones/${zoneId}/rulesets/${rulesetId}/rules`, {
    method: 'POST',
    body,
  });
  return added.ok
    ? { ok: true, action: `${phase}.add`, changed: true, position }
    : { ok: false, action: `${phase}.add`, error: added.error, position };
}

async function syncAiCrawlerWafSkipRule(zoneId) {
  const attempts = [];
  if (DRY_RUN) {
    attempts.push({ ok: true, dryRun: true, action: 'waf_custom.skip', rule: WAF_AI_SKIP_RULE_DESC });
    return attempts;
  }

  const skipRule = buildAiCrawlerSkipRule();
  attempts.push(
    await upsertEntrypointRule(zoneId, WAF_CUSTOM_PHASE, skipRule, { position: { index: 1 } })
  );

  const aiRuleIds = await discoverManagedAiBlockRuleIds(zoneId);
  if (!aiRuleIds.length) {
    attempts.push({
      ok: true,
      action: 'waf_managed.exception',
      changed: false,
      note: 'no managed AI block rules discovered',
    });
    return attempts;
  }

  const managedEntry = await getPhaseEntrypoint(zoneId, WAF_MANAGED_PHASE);
  if (!managedEntry.ok) {
    attempts.push({
      ok: managedEntry.notFound === true,
      action: 'waf_managed.entrypoint',
      error: managedEntry.error,
      note: managedEntry.notFound ? 'managed WAF not deployed on zone' : undefined,
    });
    return attempts;
  }

  const executeRule = (managedEntry.result.rules || []).find(
    (rule) => rule.action === 'execute' && rule.action_parameters?.id === CF_MANAGED_RULESET_ID
  );
  const managedExceptionRule = {
    description: WAF_AI_MANAGED_EXCEPTION_DESC,
    expression: buildAiCrawlerUaExpression(),
    action: 'skip',
    action_parameters: { rules: { [CF_MANAGED_RULESET_ID]: aiRuleIds } },
    enabled: true,
  };

  const existingException = (managedEntry.result.rules || []).find(
    (r) => r.description === WAF_AI_MANAGED_EXCEPTION_DESC
  );
  if (existingException && !ruleNeedsUpdate(existingException, managedExceptionRule)) {
    attempts.push({
      ok: true,
      action: 'waf_managed.exception',
      changed: false,
      skippedRules: aiRuleIds.length,
    });
    return attempts;
  }

  const position = executeRule?.id ? { before: executeRule.id } : { index: 1 };
  attempts.push(
    await upsertEntrypointRule(zoneId, WAF_MANAGED_PHASE, managedExceptionRule, { position })
  );
  attempts[attempts.length - 1].skippedRules = aiRuleIds.length;

  return attempts;
}

/** AEO-safe bot_management target (Bot Preference Sync OFF, AI edge block OFF). */
function desiredBotManagementConfig(bmState = {}) {
  const payload = {
    fight_mode: false,
    enable_js: bmState.enable_js === true,
    ai_bots_protection: 'disabled',
    cf_robots_variant: 'off',
    is_robots_txt_managed: false,
    content_bots_protection: 'disabled',
    crawler_protection: 'disabled',
  };
  if (bmState?.stale_zone_configuration) {
    Object.assign(payload, {
      sbfm_likely_automated: 'allow',
      sbfm_definitely_automated: 'allow',
      sbfm_verified_bots: 'allow',
      sbfm_static_resource_protection: false,
      optimize_wordpress: false,
      suppress_session_score: false,
    });
  }
  return payload;
}

function botManagementNeedsUpdate(current = {}, desired = {}) {
  return Object.entries(desired).some(([key, value]) => current[key] !== value);
}

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

async function syncBotManagementConfig(zoneId) {
  const attempts = [];

  if (DRY_RUN) {
    return [{ ok: true, dryRun: true, action: 'bot_management_skipped_in_dry_run' }];
  }

  // Legacy setting — still patch when available (some plans expose both).
  attempts.push({
    action: 'settings.bot_fight_mode=off',
    ...(await cfTry(`/zones/${zoneId}/settings/bot_fight_mode`, {
      method: 'PATCH',
      body: { value: 'off' },
    })),
  });

  const { ok: gotBm, result: bmState, error: bmGetError } = await cfTry(
    `/zones/${zoneId}/bot_management`
  );
  if (!gotBm) {
    attempts.push({
      action: 'bot_management.get',
      ok: false,
      error: bmGetError || 'unavailable on plan or missing Bot Management Write',
    });
    return attempts;
  }

  const desired = desiredBotManagementConfig(bmState);
  const needsUpdate = botManagementNeedsUpdate(bmState, desired);
  attempts.push({
    action: 'bot_management.audit',
    ok: true,
    before: {
      fight_mode: bmState.fight_mode,
      ai_bots_protection: bmState.ai_bots_protection,
      cf_robots_variant: bmState.cf_robots_variant,
      is_robots_txt_managed: bmState.is_robots_txt_managed,
      content_bots_protection: bmState.content_bots_protection,
      crawler_protection: bmState.crawler_protection,
    },
    desired,
    needsUpdate,
  });

  if (!needsUpdate) {
    attempts.push({ action: 'bot_management.put', ok: true, changed: false, note: 'already aligned' });
    return attempts;
  }

  attempts.push({
    action: 'bot_management.put',
    changed: true,
    ...(await cfTry(`/zones/${zoneId}/bot_management`, { method: 'PUT', body: desired })),
  });

  const verify = await cfTry(`/zones/${zoneId}/bot_management`);
  if (verify.ok) {
    attempts.push({
      action: 'bot_management.verify',
      ok:
        verify.result?.cf_robots_variant === 'off' &&
        verify.result?.is_robots_txt_managed === false &&
        verify.result?.fight_mode === false,
      after: {
        fight_mode: verify.result?.fight_mode,
        ai_bots_protection: verify.result?.ai_bots_protection,
        cf_robots_variant: verify.result?.cf_robots_variant,
        is_robots_txt_managed: verify.result?.is_robots_txt_managed,
      },
    });
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
    const gptBotHome = await fetch(`https://${host}/`, {
      headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'GPTBot' },
    });
    checks.push({
      site,
      host,
      robotsOk: robots.ok && robotsText.includes('OAI-SearchBot'),
      sitemapOk: robotsText.includes(`Sitemap: https://${host}/sitemap.xml`),
      noManagedRobotsBlock: !robotsText.includes('# BEGIN Cloudflare Managed content'),
      gptBotHomeOk: gptBotHome.status === 200,
      llmsStatus: (await fetch(`https://${host}/llms.txt`)).status,
      noSeoCatalogLeak: !homeHtml.includes('id="seo-catalog"'),
    });
  }
  return checks;
}

async function ensureDnsAidRecords(zoneId, domain) {
  const targets = [
    { name: `_index._agents.${domain}`, comment: 'DNS-AID index entrypoint' },
    { name: `_mcp._agents.${domain}`, comment: 'DNS-AID MCP discovery' },
    { name: `_a2a._agents.${domain}`, comment: 'DNS-AID A2A discovery' },
  ];
  const results = [];
  for (const { name, comment } of targets) {
    const shortName = name.replace(`.${domain}`, '');
    const body = {
      type: 'HTTPS',
      name: shortName,
      content: `1 ${domain} alpn=h2,h3 ipv4hint=`,
      proxied: false,
      comment,
    };
    if (DRY_RUN) {
      results.push({ name: shortName, action: 'dry-run', content: body.content });
      continue;
    }
    const existing = await cfTry(`/zones/${zoneId}/dns_records?type=HTTPS&name=${encodeURIComponent(name)}`);
    if (existing.ok && existing.result?.length) {
      results.push({ name: shortName, action: 'exists' });
      continue;
    }
    const created = await cfTry(`/zones/${zoneId}/dns_records`, { method: 'POST', body });
    results.push({
      name: shortName,
      action: created.ok ? 'created' : 'failed',
      error: created.ok ? undefined : created.error,
    });
  }
  return results;
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
  changes.bot_management = await syncBotManagementConfig(zoneId);
  changes.waf_ai_crawler_allow = await syncAiCrawlerWafSkipRule(zoneId);

  let dns = [];
  try {
    dns = await auditDnsProxy(zoneId, domain);
  } catch (err) {
    dns = [{ error: err.message }];
  }

  const purge = await purgeZone(zoneId, domain);
  let dnsAid = [];
  try {
    dnsAid = await ensureDnsAidRecords(zoneId, domain);
  } catch (err) {
    dnsAid = [{ error: err.message }];
  }
  console.log('Changes:', changes);
  console.log('DNS (apex/www):', dns);
  console.log('DNS-AID (_agents):', dnsAid);
  console.log('Purge:', purge);

  return { domain, zoneId, audit, changes, dns, dnsAid, purge };
}

async function main() {
  console.log(`Cloudflare AEO apply ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log(`Account: ${ACCOUNT_ID || '(not set)'}`);
  console.log(`Token source: ${TOKEN.length ? TOKEN_SOURCE : '(none)'}`);
  console.log(`Token length: ${TOKEN.length} chars (value not logged)`);
  if (!TOKEN) {
    console.error(
      'CLOUDFLARE_API_TOKEN (or CLOUDFLARE_API_TOKEN1) is empty after trim — check GitHub/Cursor secret'
    );
    process.exit(1);
  }

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
    const ok =
      row.robotsOk &&
      row.sitemapOk &&
      row.noManagedRobotsBlock &&
      row.gptBotHomeOk &&
      row.llmsStatus === 200 &&
      row.noSeoCatalogLeak;
    console.log(`${ok ? 'OK' : 'FAIL'} ${row.host}`, row);
  }

  const allSmokeOk = smoke.every(
    (r) =>
      r.robotsOk &&
      r.sitemapOk &&
      r.noManagedRobotsBlock &&
      r.gptBotHomeOk &&
      r.llmsStatus === 200 &&
      r.noSeoCatalogLeak
  );
  if (!allSmokeOk) process.exitCode = 1;

  console.log('\nDone.');
  console.log(
    'Manual if APIs unavailable: Security → Bots → Bot Fight OFF, Bot Preference Sync OFF, AI Crawl Control allow; WAF → no global bot block.'
  );
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
