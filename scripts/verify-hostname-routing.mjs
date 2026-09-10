#!/usr/bin/env node
/**
 * Smoke test: each custom domain must serve its own homepage and checkout via Worker hostname routing.
 * Requires run_worker_first = true in wrangler.toml (deployed to production).
 *
 * Usage: node scripts/verify-hostname-routing.mjs
 */

const CHECKS = [
  { url: 'https://daotslabna.com/', mustInclude: ['ДА ОТСЛАБНА'], mustExclude: [] },
  { url: 'https://biocode-bg.com/', mustInclude: ['BIOCODE'], mustExclude: ['ДА ОТСЛАБНА - Мисията'] },
  { url: 'https://life-protocols.com/', mustInclude: ['Life Protocols'], mustExclude: ['ДА ОТСЛАБНА - Мисията'] },
  { url: 'https://biocode-bg.com/checkout.html', mustInclude: ['BIOCODE'], mustExclude: ['ДА ОТСЛАБНА'] },
  { url: 'https://life-protocols.com/checkout.html', mustInclude: ['Life Protocols'], mustExclude: ['ДА ОТСЛАБНА'] },
];

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : '';
}

async function checkOne({ url, mustInclude, mustExclude }) {
  const res = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    redirect: 'follow',
  });
  const html = await res.text();
  const title = extractTitle(html);
  const errors = [];

  if (!res.ok) errors.push(`HTTP ${res.status}`);
  for (const needle of mustInclude) {
    if (!html.includes(needle)) errors.push(`missing "${needle}" (title: ${title || '—'})`);
  }
  for (const needle of mustExclude) {
    if (html.includes(needle)) errors.push(`must not include "${needle}" (title: ${title || '—'})`);
  }

  return { url, title, ok: errors.length === 0, errors };
}

let failed = 0;
for (const spec of CHECKS) {
  try {
    const result = await checkOne(spec);
    if (result.ok) {
      console.log(`OK  ${result.url} → ${result.title}`);
    } else {
      failed += 1;
      console.error(`FAIL ${result.url}`);
      for (const err of result.errors) console.error(`  - ${err}`);
    }
  } catch (e) {
    failed += 1;
    console.error(`FAIL ${spec.url}: ${e.message}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} hostname routing check(s) failed.`);
  console.error('Ensure wrangler.toml has run_worker_first = true and redeploy the Worker.');
  process.exit(1);
}

console.log('\nAll hostname routing checks passed.');
