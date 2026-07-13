#!/usr/bin/env node
/**
 * Merges logo URLs from backend/life_page_content.json into live KV
 * without overwriting other admin-edited CMS fields.
 */
import { readFileSync } from 'node:fs';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const ns = 'd220db696e414b7cb3da2b19abd53d0f';
const kvBase = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${ns}/values`;

if (!accountId || !token) {
  console.log('Skipping logo KV merge — Cloudflare credentials not set');
  process.exit(0);
}

const repo = JSON.parse(readFileSync('backend/life_page_content.json', 'utf8'));
const repoLogos = {
  logo_url: repo.settings?.logo_url,
  logo_url_light: repo.settings?.logo_url_light,
  logo_url_dark: repo.settings?.logo_url_dark,
};

const headers = { Authorization: `Bearer ${token}` };
const getRes = await fetch(`${kvBase}/life_page_content`, { headers });
if (!getRes.ok) {
  console.log('life_page_content KV missing — seeding from repo');
  const putRes = await fetch(`${kvBase}/life_page_content`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: readFileSync('backend/life_page_content.json'),
  });
  const putJson = await putRes.json();
  console.log('life_page_content KV seed:', putJson.success ? 'OK' : putJson);
  process.exit(putJson.success ? 0 : 1);
}

const live = JSON.parse(await getRes.text());
live.settings = live.settings || {};
let changed = false;
for (const [key, value] of Object.entries(repoLogos)) {
  if (value && live.settings[key] !== value) {
    console.log(`Updating settings.${key}`);
    live.settings[key] = value;
    changed = true;
  }
}

if (!changed) {
  console.log('Logo URLs in KV already match repo — no merge needed');
  process.exit(0);
}

const putRes = await fetch(`${kvBase}/life_page_content`, {
  method: 'PUT',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify(live),
});
const putJson = await putRes.json();
console.log('life_page_content logo merge:', putJson.success ? 'OK' : putJson);
process.exit(putJson.success ? 0 : 1);
