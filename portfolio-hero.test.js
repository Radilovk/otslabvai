import { applyHeroSettings, getHeroPreloadImage, heroImgUrl } from './portfolio-hero.js';

describe('portfolio-hero', () => {
  test('heroImgUrl maps repo paths to raw GitHub', () => {
    expect(heroImgUrl('images/a.jpg')).toContain('raw.githubusercontent.com');
    expect(heroImgUrl('https://x.com/a.jpg')).toBe('https://x.com/a.jpg');
  });

  test('getHeroPreloadImage uses first slide', () => {
    const url = getHeroPreloadImage({
      hero_slides: [{ image: 'images/first.jpg' }, { image: 'images/second.jpg' }]
    });
    expect(url).toContain('images/first.jpg');
  });

  test('getHeroPreloadImage falls back to hero_image', () => {
    expect(getHeroPreloadImage({ hero_image: 'images/fallback.jpg' })).toContain('fallback.jpg');
  });

  test('applyHeroSettings is a function', () => {
    expect(typeof applyHeroSettings).toBe('function');
  });
});
