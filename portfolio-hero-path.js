/** Hero image paths: repo-relative in KV, same-origin /images/* via Worker ASSETS. */

const RAW_RE = /raw\.githubusercontent\.com\/Radilovk\/otslabvai\/main\/(images\/[^?#]+)/i;

export const HERO_DEFAULT_SRC = '/images/portfolio-hero.jpg';
export const HERO_DEFAULT_PATH = 'images/portfolio-hero.jpg';

/** KV / admin: repo-relative path without leading slash. */
export function normalizeHeroImagePath(url) {
  const p = String(url || '').trim();
  if (!p) return '';
  const raw = p.match(RAW_RE);
  if (raw) return raw[1];
  if (p.startsWith('/images/')) return p.slice(1);
  if (p.startsWith('images/')) return p;
  return p;
}

/** Browser: same-origin static URL for Worker ASSETS. */
export function heroSrc(path) {
  const rel = normalizeHeroImagePath(path);
  if (!rel || !rel.startsWith('images/')) return HERO_DEFAULT_SRC;
  return `/${rel}`;
}
