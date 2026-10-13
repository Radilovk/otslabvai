import {
  selectCurationCandidates,
  shortlistCurationCandidates,
  finalizeCurationPicks,
  curatedGroupToSiteProduct,
  entryProfit,
  MAIN_SLOTS,
  LIFE_SLOTS,
} from './catalog-auto-curate.js';

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

const APPETITE = 'Отслабване и контрол на теглото > Потискане на апетита';
const STIM_FREE = 'Отслабване и контрол на теглото > Фетбърнъри без стимуланти';
const emptySite = { page_content: [{ type: 'product_category', products: [] }] };
const slot = (list, key, patch = {}) => ({ ...list.find((s) => s.key === key), ...patch });

describe('catalog-auto-curate', () => {
  test('избира по печалба €; отхвърля промо, нисък марж, неналични, скъпи', () => {
    const index = [
      entry('1', 'Glucomannan 500 mg', APPETITE, { max_margin: 4 }),
      entry('2', 'Konjac Glucomannan', APPETITE, { max_margin: 9 }),
      entry('3', 'Glucomannan Promo', APPETITE, { max_margin: 20, has_promo: true }),
      entry('4', 'Glucomannan Low', APPETITE, { max_margin: 20, margin_eligible: false }),
      entry('5', 'Glucomannan Gone', APPETITE, { max_margin: 20, available: false }),
      entry('7', 'Glucomannan Expensive', APPETITE, { max_margin: 50, min_client_price: 120 }),
    ];
    const picks = selectCurationCandidates(index, 'main', emptySite, { slots: [slot(MAIN_SLOTS, 'appetite_fiber')] });
    expect(picks.map((p) => p.entry.group_id)).toEqual(['2', '1']);
  });

  test('без доказано активно вещество (гарциния, малинови кетони) не влиза', () => {
    const index = [
      entry('1', 'Garcinia Cambogia 1000', APPETITE, { max_margin: 30 }),
      entry('2', 'Raspberry Ketone Glucomannan', APPETITE, { max_margin: 25 }),
      entry('3', 'Psyllium Husk', APPETITE, { max_margin: 3 }),
    ];
    const picks = selectCurationCandidates(index, 'main', emptySite, { slots: [slot(MAIN_SLOTS, 'appetite_fiber')] });
    expect(picks.map((p) => p.entry.group_id)).toEqual(['3']);
  });

  test('място „без стимуланти“: продукт с гуарана в името отпада', () => {
    const index = [
      entry('1', 'CLA 1000 mg', 'Отслабване и контрол на теглото > CLA', { max_margin: 4 }),
      entry('6', 'Green Tea Burner with Guarana', STIM_FREE, { max_margin: 30 }),
    ];
    const picks = selectCurationCandidates(index, 'main', emptySite, { slots: [slot(MAIN_SLOTS, 'stim_free_core')] });
    expect(picks.map((p) => p.entry.group_id)).toEqual(['1']);
  });

  test('скрит кофеин в описанието се хваща при окончателната проверка', () => {
    const index = [
      entry('1', 'Green Tea Lean', STIM_FREE, { max_margin: 9 }),
      entry('2', 'Lipotropic Choline', STIM_FREE, { max_margin: 4 }),
    ];
    const shortlist = shortlistCurationCandidates(index, 'main', emptySite, { slots: [slot(MAIN_SLOTS, 'stim_free_core')] });
    const groups = new Map(index.map((e) => [e.group_id, {
      group_id: e.group_id, name: e.name, brand: e.brand, category: e.category_path.join(' > '), category_path: e.category_path,
      description: e.group_id === '1' ? '<p>Съдържа 150 mg кофеин на доза.</p>' : '<p>Холин и инозитол.</p>',
      variants: [{ sku_id: `s${e.group_id}`, retail_price: 20, b2b_price: 10, available: true }],
    }]));
    const { picks, rejected } = finalizeCurationPicks(shortlist, groups);
    expect(picks.map((p) => p.entry.group_id)).toEqual(['2']);
    expect(rejected[0].name).toBe('Green Tea Lean');
    expect(rejected[0].reason).toMatch(/стимулант|fat_burner/);
  });

  test('вече наличните продукти в слота се броят; добавя се само до целта', () => {
    const index = [entry('1', 'Glucomannan A', APPETITE), entry('2', 'Glucomannan B', APPETITE), entry('3', 'Psyllium C', APPETITE)];
    const site = {
      page_content: [{
        type: 'product_category',
        products: [
          { public_data: { name: 'x', variants: [] }, system_data: { inventory: 5, portfolio: { group_id: '1' }, curation: { slot: 'appetite_fiber' } } },
          { public_data: { name: 'Glucomannan B', variants: [] }, system_data: { inventory: 5 } },
        ],
      }],
    };
    const picks = selectCurationCandidates(index, 'main', site, { slots: [slot(MAIN_SLOTS, 'appetite_fiber', { target: 3 })] });
    expect(picks.map((p) => p.entry.group_id)).toEqual(['3']);
  });

  test('по 1 продукт от марка в място', () => {
    const index = ['1', '2', '3'].map((id) => entry(id, `Glucomannan ${id}`, APPETITE, { brand: 'Same', max_margin: 10 - Number(id) }));
    index.push(entry('9', 'Psyllium', APPETITE, { brand: 'Other', max_margin: 1 }));
    const picks = selectCurationCandidates(index, 'main', emptySite, { slots: [slot(MAIN_SLOTS, 'appetite_fiber')] });
    expect(picks.map((p) => p.entry.group_id)).toEqual(['1', '9']);
  });

  test('life: колагенът отива в „колаген“, не в „стави“; аксесоарите не влизат', () => {
    const index = [
      entry('1', 'Marine Collagen Peptan', 'Красота и подмладяване > Колаген > Рибен колаген', { max_margin: 8 }),
      entry('2', 'Collagen Shaker', 'Спортни аксесоари и уреди > Шейкъри', { max_margin: 9 }),
    ];
    const picks = selectCurationCandidates(index, 'life', emptySite, { slots: [slot(LIFE_SLOTS, 'collagen'), slot(LIFE_SLOTS, 'joints')] });
    expect(picks.map((p) => [p.slot.key, p.entry.group_id])).toEqual([['collagen', '1']]);
  });

  test('печалбата % е от продажната цена; продуктът носи цели и ниво на доказателства', () => {
    expect(entryProfit({ max_margin: 10, max_margin_pct: 50 }).pct).toBeCloseTo(33.3, 1);
    const group = { group_id: '1', name: 'Glucomannan', brand: 'B', variants: [{ sku_id: 's', retail_price: 20, b2b_price: 10, available: true }] };
    const product = curatedGroupToSiteProduct(group, MAIN_SLOTS[0]);
    expect(product.system_data.goals).toContain('appetite-control');
    expect(product.system_data.curation).toMatchObject({ slot: 'appetite_fiber', evidence: 'висока' });
    expect(product.system_data.portfolio.group_id).toBe('1');
  });
});
