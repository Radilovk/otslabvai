#!/usr/bin/env node
/**
 * Production smoke: multi-domain HTML routing + Worker API boundaries.
 *
 * Usage:
 *   node scripts/verify-platform-production.mjs
 *   PLATFORM_API_BASE=https://port.radilov-k.workers.dev node scripts/verify-platform-production.mjs
 */
import {
  PRODUCTION_API_CASES,
  PRODUCTION_PAGE_CASES,
  SITE_HOSTS,
  WORKER_API_BASE,
  expandProductionPageUrls,
} from '../hostname-routing-contract.js';

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : '';
}

/**
 * @param {object} spec
 */
async function checkPage(spec) {
  const res = await fetch(spec.url, {
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    redirect: 'follow',
  });
  const html = await res.text();
  const title = extractTitle(html);
  const errors = [];

  const expectedStatus = spec.status ?? 200;
  if (res.status !== expectedStatus) {
    errors.push(`HTTP ${res.status} (expected ${expectedStatus})`);
  }

  for (const needle of spec.titleIncludes || []) {
    if (!html.includes(needle)) errors.push(`missing title/content "${needle}" (title: ${title || '—'})`);
  }
  for (const needle of spec.titleExcludes || []) {
    if (html.includes(needle)) errors.push(`must not include "${needle}" (title: ${title || '—'})`);
  }
  for (const needle of spec.cssIncludes || []) {
    if (!html.includes(needle)) errors.push(`missing stylesheet reference "${needle}"`);
  }

  return { ...spec, title, ok: errors.length === 0, errors };
}

/**
 * @param {object} spec
 */
async function checkApi(spec) {
  const url = `${WORKER_API_BASE}${spec.path}`;
  const res = await fetch(url, {
    method: spec.method || 'GET',
    headers: { 'Cache-Control': 'no-cache' },
  });
  const body = await res.text();
  const errors = [];

  if (res.status !== spec.status) {
    errors.push(`HTTP ${res.status} (expected ${spec.status})`);
  }
  for (const needle of spec.bodyIncludes || []) {
    if (!body.includes(needle)) errors.push(`body missing "${needle}"`);
  }

  return { id: spec.id, url, ok: errors.length === 0, errors, status: res.status };
}

/** www mirror checks for homepages only */
function wwwMirrorCases() {
  return (['main', 'life', 'portfolio']).map((site) => {
    const base = PRODUCTION_PAGE_CASES.find((c) => c.path === '/' && c.site === site);
    if (!base) return null;
    const wwwHost = SITE_HOSTS[site][1];
    return {
      ...base,
      id: `${base.id}-www`,
      url: `https://${wwwHost}/`,
    };
  }).filter(Boolean);
}

let failed = 0;

console.log('=== Platform production smoke ===\n');

console.log('--- HTML routing ---');
for (const spec of [...expandProductionPageUrls(), ...wwwMirrorCases()]) {
  try {
    const result = await checkPage(spec);
    if (result.ok) {
      console.log(`OK  [${result.id}] ${result.url}`);
      console.log(`     → ${result.title || '(no title)'}`);
    } else {
      failed += 1;
      console.error(`FAIL [${result.id}] ${result.url}`);
      for (const err of result.errors) console.error(`     - ${err}`);
    }
  } catch (e) {
    failed += 1;
    console.error(`FAIL [${spec.id}] ${spec.url}: ${e.message}`);
  }
}

console.log('\n--- Worker API ---');
for (const spec of PRODUCTION_API_CASES) {
  try {
    const result = await checkApi(spec);
    if (result.ok) {
      console.log(`OK  [${result.id}] ${result.url} → HTTP ${result.status}`);
    } else {
      failed += 1;
      console.error(`FAIL [${result.id}] ${result.url}`);
      for (const err of result.errors) console.error(`     - ${err}`);
    }
  } catch (e) {
    failed += 1;
    console.error(`FAIL [${spec.id}]: ${e.message}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} production check(s) failed.`);
  process.exit(1);
}

console.log('\nAll platform production checks passed.');
