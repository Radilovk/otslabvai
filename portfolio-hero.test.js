import { applyHeroSettings, getHeroPreloadImage, heroSrc } from './portfolio-hero.js';

describe('portfolio-hero', () => {
  test('heroSrc uses same-origin static path for repo images', () => {
    expect(heroSrc('images/a.jpg')).toBe('/images/a.jpg');
    expect(heroSrc('/images/a.jpg')).toBe('/images/a.jpg');
  });

  test('heroSrc migrates legacy raw GitHub URLs to repo path', () => {
    expect(heroSrc('https://raw.githubusercontent.com/Radilovk/otslabvai/main/images/x.jpg'))
      .toBe('/images/x.jpg');
  });

  test('getHeroPreloadImage uses first slide path', () => {
    expect(getHeroPreloadImage({
      hero_slides: [{ image: 'images/first.jpg' }, { image: 'images/second.jpg' }]
    })).toBe('/images/first.jpg');
  });

  test('applyHeroSettings is a function', () => {
    expect(typeof applyHeroSettings).toBe('function');
  });
});
