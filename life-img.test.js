import { resolveImageUrl, localizeOwnAsset, rewriteAllProductImages, CARD_IMAGE_WIDTH } from './life-img.js';

beforeAll(() => {
  global.window = { location: { href: 'https://life-protocols.com/life.html', origin: 'https://life-protocols.com' } };
});

describe('life-img', () => {
  test('външните снимки минават през CDN — смалени и в WebP', () => {
    const url = resolveImageUrl('https://distro.silabg.com/uf/product/a.jpg', 480);
    expect(url).toContain('wsrv.nl');
    expect(url).toContain('w=480');
    expect(url).toContain('output=webp');
  });

  test('собствените иконки от GitHub се сервират локално като .webp', () => {
    const raw = 'https://raw.githubusercontent.com/Radilovk/otslabvai/main/images/life-icons/logo.png';
    expect(localizeOwnAsset(raw)).toBe('images/life-icons/logo.webp');
    expect(resolveImageUrl(raw)).toBe('images/life-icons/logo.webp');
  });

  test('същия домейн, data: и вече проксирани URL-и не се пипат', () => {
    expect(resolveImageUrl('images/x.png')).toBe('images/x.png');
    expect(resolveImageUrl('data:image/png;base64,AA')).toBe('data:image/png;base64,AA');
    const proxied = 'https://wsrv.nl/?url=a.com%2Fb.jpg&w=100';
    expect(resolveImageUrl(proxied)).toBe(proxied);
  });

  test('картите на началната страница получават малки снимки', () => {
    const pc = [{ type: 'product_category', products: [{ public_data: { image_url: 'https://fitness1.bg/p/x.jpg' } }] }];
    rewriteAllProductImages(pc);
    expect(pc[0].products[0].public_data.image_url).toContain(`w=${CARD_IMAGE_WIDTH}`);
  });
});
