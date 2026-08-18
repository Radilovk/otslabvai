import { normalizeHeroImagePath, heroSrc, HERO_DEFAULT_SRC } from './portfolio-hero-path.js';

describe('portfolio-hero-path', () => {
  test('normalizeHeroImagePath keeps repo-relative paths', () => {
    expect(normalizeHeroImagePath('images/a.jpg')).toBe('images/a.jpg');
    expect(normalizeHeroImagePath('/images/a.jpg')).toBe('images/a.jpg');
  });

  test('normalizeHeroImagePath migrates legacy raw GitHub URLs', () => {
    expect(normalizeHeroImagePath('https://raw.githubusercontent.com/Radilovk/otslabvai/main/images/x.jpg'))
      .toBe('images/x.jpg');
  });

  test('heroSrc uses same-origin static path for repo images', () => {
    expect(heroSrc('images/a.jpg')).toBe('/images/a.jpg');
    expect(heroSrc('/images/a.jpg')).toBe('/images/a.jpg');
  });

  test('heroSrc migrates legacy raw GitHub URLs', () => {
    expect(heroSrc('https://raw.githubusercontent.com/Radilovk/otslabvai/main/images/x.jpg'))
      .toBe('/images/x.jpg');
  });

  test('heroSrc ignores external https URLs', () => {
    expect(heroSrc('https://example.com/banner.jpg')).toBe(HERO_DEFAULT_SRC);
  });
});
