export const HERO_BRANDING_CACHE_KEY = 'portfolio_hero_branding_v1';

function heroCacheBust(settings) {
  if (settings?.branding_updated_at) {
    return `v=${encodeURIComponent(settings.branding_updated_at)}`;
  }
  if (settings?.last_sync) {
    return `v=${encodeURIComponent(settings.last_sync)}`;
  }
  return null;
}

export function buildHeroImageSrc(settings) {
  const raw = String(settings?.hero_image || '');
  if (!raw) return '';
  const bust = heroCacheBust(settings);
  if (!bust) return raw;
  return raw.includes('?') ? `${raw}&${bust}` : `${raw}?${bust}`;
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
