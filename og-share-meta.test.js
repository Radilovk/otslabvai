import {
  resolveOgImageUrl,
  absoluteUrl,
  injectProductOgMeta,
  OG_IMAGE_WIDTH,
} from './og-share-meta.js';

describe('og-share-meta', () => {
  test('resolveOgImageUrl proxies fitness1 images at high width', () => {
    const url = resolveOgImageUrl(
      'https://fitness1.bg/products/v3/p31946/test.jpg',
      OG_IMAGE_WIDTH,
      'https://biocode-bg.com'
    );
    expect(url).toContain('wsrv.nl');
    expect(url).toContain(`w=${OG_IMAGE_WIDTH}`);
    expect(url).toContain('q=90');
  });

  test('resolveOgImageUrl keeps public CDN URLs unchanged', () => {
    const src = 'https://cdn.example.com/product-large.jpg';
    expect(resolveOgImageUrl(src, OG_IMAGE_WIDTH, 'https://biocode-bg.com')).toBe(src);
  });

  test('absoluteUrl resolves relative product paths', () => {
    expect(absoluteUrl('portfolio-product.html?group_id=1', 'https://biocode-bg.com'))
      .toBe('https://biocode-bg.com/portfolio-product.html?group_id=1');
  });

  test('injectProductOgMeta replaces og:image and title', () => {
    const html = `<!DOCTYPE html><html><head>
      <title>Old</title>
      <meta property="og:image" content="images/favicon.png">
    </head><body></body></html>`;
    const out = injectProductOgMeta(html, {
      title: 'Whey Protein – BIOCODE',
      description: 'Test product',
      image: 'https://wsrv.nl/?url=fitness1.bg%2Fimg.jpg&w=1200',
      url: 'https://biocode-bg.com/portfolio-product.html?group_id=1',
    });
    expect(out).toContain('<title>Whey Protein – BIOCODE</title>');
    expect(out).toContain('property="og:image" content="https://wsrv.nl/?url=fitness1.bg%2Fimg.jpg&amp;w=1200"');
    expect(out).toContain('name="twitter:card" content="summary_large_image"');
    expect(out).not.toContain('favicon.png');
  });
});
