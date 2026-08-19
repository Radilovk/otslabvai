import {
  isDirectSaleProductLine,
  orderHasDirectSaleProducts,
  orderHasB2bProducts,
  orderIsDirectSaleOnly,
  splitOrderProducts,
} from './portfolio-order-fulfillment.js';

describe('portfolio-order-fulfillment', () => {
  test('detects direct sale products by id and name', () => {
    expect(isDirectSaleProductLine({ sku_id: 'prod-lida-green', name: 'Lida Green' })).toBe(true);
    expect(isDirectSaleProductLine({ sku_id: 'prod-meizimax', name: 'MeiziMax' })).toBe(true);
    expect(isDirectSaleProductLine({ sku_id: '40337', name: 'Slender Cellu' })).toBe(false);
    expect(isDirectSaleProductLine({ sku_id: 'x', name: 'Eveslim Birch Bark' })).toBe(true);
  });

  test('splitOrderProducts separates mixed carts', () => {
    const products = [
      { sku_id: 'prod-lida-green', name: 'Lida Green' },
      { sku_id: '40337', name: 'Slender' },
    ];
    const { direct, b2b } = splitOrderProducts(products);
    expect(direct).toHaveLength(1);
    expect(b2b).toHaveLength(1);
  });

  test('order flags for admin grouping', () => {
    const mixed = { products: [{ sku_id: 'prod-lida-green' }, { sku_id: '40337' }] };
    const directOnly = { products: [{ sku_id: 'prod-meizimax' }] };
    expect(orderHasDirectSaleProducts(mixed)).toBe(true);
    expect(orderHasB2bProducts(mixed)).toBe(true);
    expect(orderIsDirectSaleOnly(mixed)).toBe(false);
    expect(orderIsDirectSaleOnly(directOnly)).toBe(true);
  });
});
