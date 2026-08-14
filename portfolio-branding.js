export const HERO_BRANDING_CACHE_KEY = 'portfolio_hero_branding_v1';

export function heroImageBase(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const base = typeof window !== 'undefined' ? window.location.href : 'https://example.com/';
    const u = new URL(raw, base);
    return `${u.origin}${u.pathname}`;
  } catch {
    return raw.split('?')[0].split('#')[0];
  }
}

export function readCachedHeroBranding() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(HERO_BRANDING_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** @deprecated Use hero image URL as-is; cache bust query params caused reload flicker. */
export function buildHeroImageSrc(settings) {
  return String(settings?.hero_image || '');
}

export function applyHeroImageElement(img, settings) {
  if (!img || !settings?.hero_image) return false;
  const nextUrl = String(settings.hero_image);
  const nextBase = heroImageBase(nextUrl);
  const currentBase = img.dataset.heroBase
    || heroImageBase(img.currentSrc || img.getAttribute('src') || '');

  if (currentBase && currentBase === nextBase) {
    persistHeroBranding(settings);
    return false;
  }

  img.dataset.heroBase = nextBase;
  img.src = nextUrl;
  persistHeroBranding(settings);
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('pf-hero-ready');
  }
  return true;
}

export function persistHeroBranding(settings) {
  if (!settings?.hero_image || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(HERO_BRANDING_CACHE_KEY, JSON.stringify({
      hero_image: settings.hero_image,
      hero_title: settings.hero_title,
      site_slogan: settings.site_slogan,
      branding_updated_at: settings.branding_updated_at || null
    }));
  } catch { /* ignore */ }
}
