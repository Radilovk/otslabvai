#!/usr/bin/env node
/**
 * Add <link rel="canonical"> to storefront HTML files that lack one.
 * Skips 404.html (error pages should not declare a canonical target).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const ORIGINS = {
  main: 'https://daotslabna.com',
  life: 'https://life-protocols.com',
  portfolio: 'https://biocode-bg.com',
};

/** @param {string} relPath */
function siteForFile(relPath) {
  const base = path.basename(relPath);
  if (base.startsWith('life-') || base === 'life.html') return 'life';
  if (base.startsWith('portfolio-') || base === 'portfolio.html') return 'portfolio';
  return 'main';
}

/** @param {string} relPath @param {'main'|'life'|'portfolio'} site */
function canonicalHref(relPath, site) {
  const urlPath = `/${relPath.replace(/\\/g, '/')}`;
  return `${ORIGINS[site]}${urlPath}`;
}

/** @param {string} html @param {string} href */
function insertCanonical(html, href) {
  const tag = `<link rel="canonical" href="${href}">`;
  if (html.includes('rel="canonical"')) return html;

  const robotsRe = /(<meta[^>]+name=["']robots["'][^>]*>)/i;
  if (robotsRe.test(html)) {
    return html.replace(robotsRe, `$1\n    ${tag}`);
  }

  const viewportRe = /(<meta[^>]+name=["']viewport["'][^>]*>)/i;
  if (viewportRe.test(html)) {
    return html.replace(viewportRe, `$1\n    ${tag}`);
  }

  const charsetRe = /(<meta[^>]+charset[^>]*>)/i;
  if (charsetRe.test(html)) {
    return html.replace(charsetRe, `$1\n    ${tag}`);
  }

  return html.replace(/(<head[^>]*>)/i, `$1\n    ${tag}`);
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

let updated = 0;
let skipped = 0;

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (rel === '404.html') {
    skipped += 1;
    continue;
  }

  const html = fs.readFileSync(file, 'utf8');
  if (/rel=["']canonical["']/i.test(html)) {
    skipped += 1;
    continue;
  }

  const site = siteForFile(rel);
  const href = canonicalHref(rel, site);
  const next = insertCanonical(html, href);
  if (next === html) {
    console.warn(`WARN: could not insert canonical in ${rel}`);
    continue;
  }

  fs.writeFileSync(file, next);
  console.log(`+ ${rel} → ${href}`);
  updated += 1;
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped (already had canonical or 404).`);
