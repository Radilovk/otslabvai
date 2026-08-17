import { normalizeHeroConfig, getHeroPreloadImage } from './portfolio-hero.js';
import { GITHUB_RAW_BASE } from './hero-image-url.js';

describe('portfolio-hero', () => {
  test('single mode resolves hero_image to raw GitHub URL', () => {
    const cfg = normalizeHeroConfig({
      hero_image: 'images/a.jpg',
      hero_title: 'Test',
      site_slogan: 'Slogan'
    });
    expect(cfg.mode).toBe('single');
    expect(cfg.slides).toHaveLength(1);
    expect(cfg.slides[0].image).toBe(`${GITHUB_RAW_BASE}/images/a.jpg`);
    expect(cfg.primaryImage).toBe(`${GITHUB_RAW_BASE}/images/a.jpg`);
  });

  test('carousel mode requires 2+ slides', () => {
    const cfg = normalizeHeroConfig({
      hero_mode: 'carousel',
      hero_slides: [
        { id: '1', image: 'https://example.com/1.jpg' },
        { id: '2', image: 'https://example.com/2.jpg' }
      ],
      hero_title: 'T',
      site_slogan: 'S'
    });
    expect(cfg.mode).toBe('carousel');
    expect(cfg.slides).toHaveLength(2);
    expect(cfg.interval).toBe(6000);
  });

  test('carousel with one slide falls back to single', () => {
    const cfg = normalizeHeroConfig({
      hero_mode: 'carousel',
      hero_slides: [{ id: '1', image: 'img.jpg' }]
    });
    expect(cfg.mode).toBe('single');
  });

  test('getHeroPreloadImage returns first slide in carousel', () => {
    const url = getHeroPreloadImage({
      hero_mode: 'carousel',
      hero_slides: [
        { image: 'images/first.jpg' },
        { image: 'images/second.jpg' }
      ]
    });
    expect(url).toBe(`${GITHUB_RAW_BASE}/images/first.jpg`);
  });

  test('clamps carousel interval', () => {
    const cfg = normalizeHeroConfig({
      hero_mode: 'carousel',
      hero_carousel_interval: 99999,
      hero_slides: [
        { image: 'a.jpg' },
        { image: 'b.jpg' }
      ]
    });
    expect(cfg.interval).toBe(30000);
  });
});
