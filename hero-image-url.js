/**
 * Hero/banner image URLs — single resolver for admin + public site.
 * Uploaded images live in GitHub; serve via raw.githubusercontent.com immediately
 * (no Worker deploy required for new banners).
 */

export const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/Radilovk/otslabvai/main';

/** @param {string} path */
export function resolveHeroImageUrl(path) {
  const p = String(path || '').trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  const rel = p.replace(/^\//, '');
  if (rel.startsWith('images/')) return `${GITHUB_RAW_BASE}/${rel}`;
  return p;
}

/** Canonical URL to store in KV after upload (always absolute). */
export function canonicalHeroImageUrl(path) {
  return resolveHeroImageUrl(path);
}
