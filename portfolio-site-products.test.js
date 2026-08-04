import {
  parseSiteCartRef,
  findSiteProduct,
  isSiteProductAvailable,
  siteProductToOrderLine,
  cartRequiresCatalogMeta,
  isCatalogBackedCartId,
  normalizeSiteProject
} from './portfolio-site-products.js';

const sampleContent = {
  page_content: [{
    type: 'product_category',
    id: 'cat-1',
    products: [
      {
        product_id: 'prod-lida-green',
        public_data: { name: 'Lida Green', price: 38, image_url: 'https://example.com/img.jpg' },
        system_data: { inventory: 5 }
      },
      {
        product_id: 'prod-40337',
        public_data: {
          name: 'Slender',
          price: 39.34,
          variants: [
            { option_name: 'Малина', price: 39.34, sku: '40337', available: true },
            { option_name: 'Ягода', price: 39.34, sku: '40338', available: false }
          ]
        },
        system_data: { inventory: 1 }
      }
    ]
  }]
};

describe('portfolio-site-products', () => {
  test('parseSiteCartRef splits variant suffix', () => {
    expect(parseSiteCartRef('prod-40337_40337')).toEqual({
      productId: 'prod-40337',
      variantSku: '40337'
    });
    expect(parseSiteCartRef('prod-lida-green')).toEqual({
      productId: 'prod-lida-green',
      variantSku: null
    });
    expect(parseSiteCartRef('prod-pf-100_55')).toEqual({
      productId: 'prod-pf-100',
      variantSku: '55'
    });
  });

  test('findSiteProduct locates manual and variant products', () => {
    expect(findSiteProduct(sampleContent, 'prod-lida-green')?.product.product_id).toBe('prod-lida-green');
    expect(findSiteProduct(sampleContent, 'prod-40337_40337')?.variantSku).toBe('40337');
    expect(findSiteProduct(sampleContent, 'prod-missing')).toBeNull();
  });

  test('isSiteProductAvailable respects inventory and variants', () => {
    const manual = findSiteProduct(sampleContent, 'prod-lida-green').product;
    expect(isSiteProductAvailable(manual, null)).toBe(true);
    manual.system_data.inventory = 0;
    expect(isSiteProductAvailable(manual, null)).toBe(false);

    const variantProduct = findSiteProduct(sampleContent, 'prod-40337').product;
    expect(isSiteProductAvailable(variantProduct, '40337')).toBe(true);
    expect(isSiteProductAvailable(variantProduct, '40338')).toBe(false);
  });

  test('siteProductToOrderLine uses variant sku for F1-linked lines', () => {
    const { product, variantSku } = findSiteProduct(sampleContent, 'prod-40337_40337');
    const line = siteProductToOrderLine(product, variantSku, 2);
    expect(line.sku_id).toBe('40337');
    expect(line.retail_price).toBe(39.34);
    expect(line.quantity).toBe(2);
  });

  test('cartRequiresCatalogMeta distinguishes manual vs catalog ids', () => {
    expect(isCatalogBackedCartId('prod-pf-12')).toBe(true);
    expect(isCatalogBackedCartId('prod-40337_40337')).toBe(true);
    expect(isCatalogBackedCartId('prod-lida-green')).toBe(false);
    expect(cartRequiresCatalogMeta([{ id: 'prod-lida-green' }])).toBe(false);
    expect(cartRequiresCatalogMeta([{ id: 'prod-pf-99' }])).toBe(true);
  });

  test('normalizeSiteProject maps main and life', () => {
    expect(normalizeSiteProject('main')).toBe('main');
    expect(normalizeSiteProject('daotslabna')).toBe('main');
    expect(normalizeSiteProject('life')).toBe('life');
    expect(normalizeSiteProject('portfolio')).toBeNull();
  });
});
