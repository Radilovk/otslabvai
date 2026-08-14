import { buildPublicSiteSettings } from './portfolio-api.js';
import { buildHeroImageSrc } from './portfolio-branding.js';

describe('portfolio hero branding', () => {
  test('buildPublicSiteSettings exposes branding_updated_at', () => {
    const out = buildPublicSiteSettings({
      site_name: 'Test',
      hero_image: 'https://cdn.example/hero.jpg',
      branding_updated_at: '2026-08-14T12:00:00.000Z'
    });
    expect(out.branding_updated_at).toBe('2026-08-14T12:00:00.000Z');
    expect(out.hero_image).toBe('https://cdn.example/hero.jpg');
  });

  test('buildHeroImageSrc uses branding_updated_at for cache bust', () => {
    const src = buildHeroImageSrc({
      hero_image: 'https://cdn.example/hero.jpg',
      branding_updated_at: '2026-08-14T12:00:00.000Z'
    });
    expect(src).toBe('https://cdn.example/hero.jpg?v=2026-08-14T12%3A00%3A00.000Z');
  });

  test('buildHeroImageSrc appends bust to existing query string', () => {
    const src = buildHeroImageSrc({
      hero_image: 'images/hero.jpg?w=800',
      branding_updated_at: 'abc'
    });
    expect(src).toBe('images/hero.jpg?w=800&v=abc');
  });
});
