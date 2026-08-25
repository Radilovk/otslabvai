import {
  extractFirstImageFromHtml,
  resolveCatalogImage,
  applyGroupImageFallbacks,
  groupsWithCatalogImages,
  hasCatalogImage,
} from './catalog-image.js';

describe('catalog-image', () => {
  test('extractFirstImageFromHtml parses img src', () => {
    const html = '<p>text</p><img src="https://fitness1.bg/uploads/foo.webp" alt="">';
    expect(extractFirstImageFromHtml(html)).toBe('https://fitness1.bg/uploads/foo.webp');
  });

  test('resolveCatalogImage prefers explicit image', () => {
    expect(resolveCatalogImage({
      image: 'https://cdn.example/a.jpg',
      description: '<img src="https://cdn.example/b.jpg">',
    })).toBe('https://cdn.example/a.jpg');
  });

  test('resolveCatalogImage falls back to description', () => {
    expect(resolveCatalogImage({
      image: '',
      description: '<img src="https://fitness1.bg/uploads/shaker.webp">',
    })).toBe('https://fitness1.bg/uploads/shaker.webp');
  });

  test('applyGroupImageFallbacks fills group and variants', () => {
    const group = applyGroupImageFallbacks({
      image: '',
      description: '<img src="https://fitness1.bg/uploads/shaker.webp">',
      variants: [{ sku_id: '1759', image: '' }],
    });
    expect(group.image).toBe('https://fitness1.bg/uploads/shaker.webp');
    expect(group.variants[0].image).toBe('https://fitness1.bg/uploads/shaker.webp');
  });

  test('groupsWithCatalogImages drops groups without resolvable image', () => {
    const listed = groupsWithCatalogImages([
      { group_id: '1', image: '', description: '', variants: [] },
      {
        group_id: '2',
        image: '',
        description: '<img src="https://example.com/p.jpg">',
        variants: [{ sku_id: 'a', image: '' }],
      },
    ]);
    expect(listed.map((g) => g.group_id)).toEqual(['2']);
    expect(hasCatalogImage(listed[0].image)).toBe(true);
  });
});
