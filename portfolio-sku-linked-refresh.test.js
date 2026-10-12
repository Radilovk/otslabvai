import { refreshSkuLinkedProductsInContent } from './portfolio-import.js';

const product = (id, variants, extra = {}) => ({
  product_id: id,
  public_data: { name: id, price: 99, variants },
  system_data: { inventory: 1, ...extra },
});

describe('refreshSkuLinkedProductsInContent', () => {
  const groups = [{
    group_id: '1',
    variants: [
      { sku_id: '10', available: true, b2b_price: 10, retail_price: 20 },
      { sku_id: '11', available: false, b2b_price: 10, retail_price: 20 },
      { sku_id: '12', available: true, b2b_price: 18, retail_price: 20 },
    ],
  }];

  test('цена/наличност/марж от каталога; липсващи SKU стават неналични', () => {
    const content = {
      page_content: [{
        type: 'product_category',
        products: [
          product('ok', [{ sku: '10', price: 39 }]),
          product('soldout', [{ sku: '11', price: 25 }]),
          product('lowmargin', [{ sku: '12', price: 25 }]),
          product('gone', [{ sku: '999', price: 25 }]),
          product('manual', []),
          product('imported', [{ sku: '10', price: 5 }], { portfolio: { group_id: '1' } }),
        ],
      }],
    };
    const stats = refreshSkuLinkedProductsInContent(content, groups);
    const [ok, soldout, lowmargin, gone, manual, imported] = content.page_content[0].products;

    expect(ok.public_data.price).toBe(20);
    expect(ok.public_data.variants[0].price).toBe(20);
    expect(ok.system_data.inventory).toBe(1);
    expect(ok.system_data.margin_eligible).toBe(true);

    expect(soldout.system_data.inventory).toBe(0);
    expect(lowmargin.system_data.margin_eligible).toBe(false);
    expect(gone.system_data.inventory).toBe(0);
    expect(gone.public_data.variants[0].available).toBe(false);

    expect(manual.system_data.inventory).toBe(1);
    expect(imported.public_data.variants[0].price).toBe(5);

    expect(stats).toEqual({ updated: 3, missing: 1, hidden_low_margin: 2 });
  });
});
