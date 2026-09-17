#!/usr/bin/env node
/**
 * Ping IndexNow after deploy — notifies Bing/Yandex of URL updates (ChatGPT Search corpus).
 * Set INDEXNOW_KEY in GitHub/Cursor secrets (32+ hex chars) and host key file at /{key}.txt on each domain.
 *
 * Usage:
 *   INDEXNOW_KEY=... node scripts/ping-indexnow.mjs
 *   node scripts/ping-indexnow.mjs --dry-run
 */
const DRY_RUN = process.argv.includes('--dry-run');
const KEY = String(process.env.INDEXNOW_KEY || '').trim();

const SITES = [
  {
    host: 'daotslabna.com',
    urls: ['/', '/faq.html', '/llms.txt', '/sitemap.xml', '/about-us.html'],
  },
  {
    host: 'life-protocols.com',
    urls: ['/', '/faq.html', '/llms.txt', '/sitemap.xml', '/life-about.html'],
  },
  {
    host: 'biocode-bg.com',
    urls: ['/', '/faq.html', '/llms.txt', '/sitemap.xml', '/portfolio-advisor-quiz.html'],
  },
];

async function pingHost({ host, urls }) {
  const urlList = urls.map((p) => `https://${host}${p.startsWith('/') ? p : `/${p}`}`);
  const body = {
    host,
    key: KEY,
    keyLocation: `https://${host}/${KEY}.txt`,
    urlList,
  };
  if (DRY_RUN) {
    console.log(`DRY RUN ${host}:`, urlList.length, 'URLs');
    return { host, ok: true, dryRun: true, count: urlList.length };
  }
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const ok = res.status === 200 || res.status === 202;
  return { host, ok, status: res.status, body: text.slice(0, 200) };
}

async function main() {
  if (!KEY) {
    console.log('INDEXNOW_KEY not set — skipping (optional). Add secret to enable IndexNow pings.');
    return;
  }
  if (KEY.length < 8) {
    console.error('INDEXNOW_KEY looks too short — check secret value');
    process.exit(1);
  }
  console.log(`IndexNow ping ${DRY_RUN ? '(dry run)' : ''} key length=${KEY.length}`);
  let failed = 0;
  for (const site of SITES) {
    const result = await pingHost(site);
    console.log(result.ok ? 'OK' : 'FAIL', result);
    if (!result.ok) failed += 1;
  }
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
