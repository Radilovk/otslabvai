import { resolveHeroImageUrl, canonicalHeroImageUrl, GITHUB_RAW_BASE } from './hero-image-url.js';

describe('hero-image-url', () => {
  test('resolveHeroImageUrl keeps absolute URLs', () => {
    expect(resolveHeroImageUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
  });

  test('resolveHeroImageUrl maps repo images to raw GitHub', () => {
    expect(resolveHeroImageUrl('images/hero-1.jpg')).toBe(`${GITHUB_RAW_BASE}/images/hero-1.jpg`);
    expect(resolveHeroImageUrl('/images/hero-1.jpg')).toBe(`${GITHUB_RAW_BASE}/images/hero-1.jpg`);
  });

  test('canonicalHeroImageUrl matches resolve for repo paths', () => {
    expect(canonicalHeroImageUrl('images/banner.jpg')).toContain('raw.githubusercontent.com');
  });
});
