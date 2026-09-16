#!/usr/bin/env node
/**
 * Ensure static <link rel="canonical"> uses the public URL path (not internal asset filename).
 * Worker also rewrites at edge; this keeps static HTML aligned with publicCanonical().
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const ORIGINS = {
  main: 'https://daotslabna.com',
  life: 'https://life-protocols.com',
  portfolio: 'https://biocode-bg.com',
};

/** Internal asset file → public pathname on that site */
const PUBLIC_PATH = {
  'index.html': '/',
  'life.html': '/',
  'portfolio.html': '/',
  'life-about.html': '/about-us.html',
  'life-checkout.html': '/checkout.html',
  'life-contact.html': '/contact.html',
  'life-product.html': '/product.html',
  'life-shipping.html': '/shipping.html',
  'life-policy.html': '/policy.html',
  'life-terms.html': '/terms.html',
  'life-faq.html': '/faq.html',
  'life-category.html': '/category.html',
  'portfolio-checkout.html': '/checkout.html',
  'portfolio-product.html': '/product.html',
  'portfolio-shipping.html': '/shipping.html',
  'portfolio-policy.html': '/policy.html',
  'portfolio-terms.html': '/terms.html',
  'portfolio-faq.html': '/faq.html',
  'quest.html': '/main-advisor-quiz.html',
};

function siteForFile(relPath) {
  const base = path.basename(relPath);
  if (base.startsWith('life-') || base === 'life.html') return 'life';
  if (base.startsWith('portfolio-') || base === 'portfolio.html') return 'portfolio';
  return 'main';
}

function expectedHref(relPath) {
  const base = path.basename(relPath);
  const publicPath = PUBLIC_PATH[base] || `/${relPath.replace(/\\/g, '/')}`;
  const site = siteForFile(relPath);
  const origin = ORIGINS[site];
  if (publicPath === '/') return `${origin}/`;
  return `${origin}${publicPath.startsWith('/') ? publicPath : `/${publicPath}`}`;
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full);
    if (rel.startsWith(`biocode${path.sep}`)) continue;
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

let fixed = 0;

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (rel === '404.html') continue;

  let html = fs.readFileSync(file, 'utf8');
  const href = expectedHref(rel);
  const re = /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*>/i;
  if (!re.test(html)) continue;

  const next = html.replace(re, `<link rel="canonical" href="${href}">`);
  if (next !== html) {
    fs.writeFileSync(file, next);
    console.log(`↻ ${rel} → ${href}`);
    fixed += 1;
  }
}

console.log(`\nFixed ${fixed} canonical href(s).`);
