import { selectCurationCandidates, curatedGroupToSiteProduct, entryProfit, MAIN_SLOTS } from './catalog-auto-curate.js';

const entry = (id, name, path, extra = {}) => ({
  group_id: id,
  name,
  brand: extra.brand || `Brand${id}`,
  category_path: path.split(' > '),
  category_top: path.split(' > ')[0],
  min_client_price: 20,
  available: true,
  margin_eligible: true,
  has_promo: false,
  max_margin: 5,
  max_margin_pct: 40,
  default_sku_id: `sku${id}`,
  ...extra,
});

const STIM_FREE = 'Отслабване и контрол на теглото > Фетбърнъри без стимуланти > Липотропни фетбърнъри';
const emptySite = { page_content: [{ type: 'product_category', products: [] }] };

describe('catalog-auto-curate', () => {
  test('избира по печалба €, отхвърля промо, нисък марж, неналични и стимуланти', () => {
    const index = [
      entry('1', 'Lipo A', STIM_FREE, { max_margin: 4 }),
      entry('2', 'Lipo B', STIM_FREE, { max_margin: 9 }),
      entry('3', 'Lipo Promo', STIM_FREE, { max_margin: 20, has_promo: true }),
      entry('4', 'Lipo Low', STIM_FREE, { max_margin: 20, margin_eligible: false }),
      entry('5', 'Lipo Gone', STIM_FREE, { max_margin: 20, available: false }),
      entry('6', 'Diet Support with Guarana', STIM_FREE, { max_margin: 30 }),
      entry('7', 'Lipo Expensive', STIM_FREE, { max_margin: 50, min_client_price: 120 }),
    ];
    const slots = [MAIN_SLOTS.find((s) => s.key === 'stim_free_burner')];
    const picks = selectCurationCandidates(index, 'main', emptySite, { slots });
    expect(picks.map((p) => p.entry.group_id)).toEqual(['2', '1']);
  });

  test('не добавя продукти, които вече са на сайта, и допълва само до целевия брой', () => {
    const index = [entry('1', 'Lipo A', STIM_FREE), entry('2', 'Lipo B', STIM_FREE), entry('3', 'Lipo C', STIM_FREE)];
    const site = {
      page_content: [{
        type: 'product_category',
        products: [
          { public_data: { name: 'x', variants: [] }, system_data: { inventory: 5, portfolio: { group_id: '1' }, curation: { slot: 'stim_free_burner' } } },
          { public_data: { name: 'Lipo B', variants: [] }, system_data: { inventory: 5 } },
        ],
      }],
    };
    const slot = { ...MAIN_SLOTS.find((s) => s.key === 'stim_free_burner'), target: 2 };
    const picks = selectCurationCandidates(index, 'main', site, { slots: [slot] });
    expect(picks.map((p) => p.entry.group_id)).toEqual(['3']);
  });

  test('до 2 продукта от марка в слот', () => {
    const index = ['1', '2', '3', '4'].map((id) => entry(id, `Lipo ${id}`, STIM_FREE, { brand: 'Same', max_margin: 10 - Number(id) }));
    index.push(entry('9', 'Other', STIM_FREE, { brand: 'Other', max_margin: 1 }));
    const picks = selectCurationCandidates(index, 'main', emptySite, { slots: [MAIN_SLOTS[0]] });
    expect(picks.map((p) => p.entry.group_id)).toEqual(['1', '2', '9']);
  });

  test('печалбата % е от продажната цена; продуктът носи цели за консултанта', () => {
    expect(entryProfit({ max_margin: 10, max_margin_pct: 50 }).pct).toBeCloseTo(33.3, 1);
    const group = { group_id: '1', name: 'Lipo', brand: 'B', variants: [{ sku_id: 's', retail_price: 20, b2b_price: 10, available: true }] };
    const product = curatedGroupToSiteProduct(group, MAIN_SLOTS[0]);
    expect(product.system_data.goals).toContain('stimulant-free');
    expect(product.system_data.curation.slot).toBe('stim_free_burner');
    expect(product.system_data.portfolio.group_id).toBe('1');
  });
});
