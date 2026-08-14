import { buildPublicSiteSettings } from './portfolio-api.js';
import {
  applyHeroImageElement,
  buildHeroImageSrc,
  heroImageBase
} from './portfolio-branding.js';

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

  test('buildHeroImageSrc returns raw URL without cache bust', () => {
    const src = buildHeroImageSrc({
      hero_image: 'https://cdn.example/hero.jpg',
      branding_updated_at: '2026-08-14T12:00:00.000Z'
    });
    expect(src).toBe('https://cdn.example/hero.jpg');
  });

  test('heroImageBase strips query string', () => {
    expect(heroImageBase('images/hero.jpg?w=800&v=abc')).toBe('https://example.com/images/hero.jpg');
  });

  test('applyHeroImageElement skips src swap when base URL unchanged', () => {
    const img = {
      dataset: { heroBase: 'https://cdn.example/hero.jpg' },
      currentSrc: 'https://cdn.example/hero.jpg?old=1',
      getAttribute: () => 'https://cdn.example/hero.jpg?old=1',
      src: 'https://cdn.example/hero.jpg?old=1'
    };
    const changed = applyHeroImageElement(img, {
      hero_image: 'https://cdn.example/hero.jpg?new=2'
    });
    expect(changed).toBe(false);
    expect(img.src).toBe('https://cdn.example/hero.jpg?old=1');
  });

  test('applyHeroImageElement updates when base URL changes', () => {
    const img = {
      dataset: {},
      currentSrc: '',
      getAttribute: () => '',
      src: ''
    };
    const changed = applyHeroImageElement(img, {
      hero_image: 'https://cdn.example/new-hero.jpg'
    });
    expect(changed).toBe(true);
    expect(img.src).toBe('https://cdn.example/new-hero.jpg');
    expect(img.dataset.heroBase).toBe('https://cdn.example/new-hero.jpg');
  });
});
