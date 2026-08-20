import {
  absoluteProductUrl,
  copyTextToClipboard,
  shareProductLink,
} from './product-share.js';

describe('product-share', () => {
  test('absoluteProductUrl resolves relative paths', () => {
    expect(absoluteProductUrl('product.html?id=1', 'https://daotslabna.com'))
      .toBe('https://daotslabna.com/product.html?id=1');
    expect(absoluteProductUrl('https://life-protocols.com/life-product.html?id=2'))
      .toBe('https://life-protocols.com/life-product.html?id=2');
  });

  test('copyTextToClipboard uses navigator.clipboard', async () => {
    const writes = [];
    global.navigator = {
      clipboard: {
        writeText: async (t) => { writes.push(t); },
      },
    };
    const ok = await copyTextToClipboard('https://biocode-bg.com/portfolio-product.html?group_id=1');
    expect(ok).toBe(true);
    expect(writes[0]).toContain('portfolio-product.html');
  });

  test('shareProductLink falls back to clipboard when share unavailable', async () => {
    const writes = [];
    global.navigator = {
      clipboard: {
        writeText: async (t) => { writes.push(t); },
      },
    };
    const result = await shareProductLink({
      url: 'portfolio-product.html?group_id=abc&sku=sku1',
      title: 'Test product',
    });
    expect(result.ok).toBe(true);
    expect(result.method).toBe('clipboard');
    expect(writes[0]).toContain('group_id=abc');
  });
});
