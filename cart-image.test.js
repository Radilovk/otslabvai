import {
  pickCartImageRaw,
  resolveCartImageUrl,
  enrichCartImagesFromPageContent,
  syncCartFromServer
} from './cart-image.js';

beforeAll(() => {
  global.window = { location: { href: 'https://daotslabna.com/checkout.html' } };
});

describe('cart-image', () => {
  test('pickCartImageRaw prefers image then image_url', () => {
    expect(pickCartImageRaw({ image: 'a.jpg' })).toBe('a.jpg');
    expect(pickCartImageRaw({ image_url: 'b.jpg' })).toBe('b.jpg');
    expect(pickCartImageRaw({ thumbnail: 'c.jpg' })).toBe('c.jpg');
  });

  test('resolveCartImageUrl proxies fitness1 hosts', () => {
    const url = 'https://fitness1.bg/products/v3/p1/x.jpg';
    expect(resolveCartImageUrl({ image: url }, 120)).toContain('wsrv.nl');
  });

  test('enrichCartImagesFromPageContent fills missing image from page_content', () => {
    const cart = [{ id: 'prod-abc', name: 'Test', price: 10, quantity: 1 }];
    const pageContent = {
      page_content: [{
        type: 'product_category',
        products: [{
          product_id: 'prod-abc',
          public_data: { name: 'Test', price: 10, image_url: 'https://cdn.example/img.jpg' }
        }]
      }]
    };
    expect(enrichCartImagesFromPageContent(cart, pageContent)).toBe(true);
    expect(cart[0].image).toBe('https://cdn.example/img.jpg');
  });

  test('syncCartFromServer updates price and missing image', () => {
    const cart = [{ id: '101', price: 20, quantity: 1 }];
    const changed = syncCartFromServer(cart, [{
      sku_id: '101',
      retail_price: 25,
      image: 'https://fitness1.bg/products/v3/p1/x.jpg'
    }]);
    expect(changed).toBe(true);
    expect(cart[0].price).toBe(25);
    expect(cart[0].image).toContain('fitness1.bg');
  });
});
