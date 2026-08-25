#!/usr/bin/env node
/**
 * Purge Cloudflare edge cache for SEO hostnames after deploy.
 * Requires CLOUDFLARE_API_TOKEN with Zone.Cache Purge permission.
 */
const ZONES = [
  'daotslabna.com',
  'life-protocols.com',
  'biocode-bg.com',
  'biocode-peptides.com',
];

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!token) {
  console.log('purge-seo-cache: skip (CLOUDFLARE_API_TOKEN not set)');
  process.exit(0);
}

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function zoneIdFor(name) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(name)}`, { headers });
  const data = await res.json();
  if (!data.success || !data.result?.length) {
    throw new Error(`Zone not found: ${name}${accountId ? '' : ' (check API token zone access)'}`);
  }
  return data.result[0].id;
}

async function purgeZone(name) {
  const id = await zoneIdFor(name);
  const hosts = [name, `www.${name}`];
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${id}/purge_cache`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ hosts }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`Purge failed for ${name}: ${JSON.stringify(data.errors || data)}`);
  }
  console.log(`purge-seo-cache: purged ${hosts.join(', ')}`);
}

async function main() {
  for (const zone of ZONES) {
    try {
      await purgeZone(zone);
    } catch (e) {
      console.warn(`purge-seo-cache: ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error('purge-seo-cache:', e.message || e);
  process.exit(1);
});
