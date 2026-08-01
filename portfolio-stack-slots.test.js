import {
  classifyProductSlot,
  getProductConflictGroups,
  productsConflictInStack,
  GOAL_SLOT_ORDER,
} from './portfolio-stack-slots.js';
import { portfolioGroupToSiteProduct } from './portfolio-import.js';

function makeProduct(name, categoryTop, extra = {}) {
  const group = {
    group_id: String(Math.random()).slice(2, 8),
    name,
    brand: 'Brand',
    brand_id: '1',
    category: categoryTop,
    category_path: [categoryTop],
    image: '',
    variants: [{ sku_id: '1', retail_price: 20, available: true }],
    ...extra,
  };
  return portfolioGroupToSiteProduct(group);
}

describe('portfolio-stack-slots', () => {
  test('класифицира fat burner и protein в различни слотове', () => {
    const burner = makeProduct('Thermo Fat Burner MAX', 'Изгаряне на мазнини');
    const whey = makeProduct('Gold Whey Isolate', 'Протеини');
    expect(classifyProductSlot(burner)).toBe('fat_burner');
    expect(classifyProductSlot(whey)).toBe('protein');
  });

  test('два thermogenic продукта конфликтират', () => {
    const a = makeProduct('Thermo Burn', 'Изгаряне на мазнини');
    const b = makeProduct('Lida Slim Thermo', 'Билки');
    expect(productsConflictInStack(a, b)).toBe(true);
  });

  test('протеин и креатин не конфликтират', () => {
    const protein = makeProduct('Whey Protein', 'Протеини');
    const creatine = makeProduct('Creatine Monohydrate', 'Креатин');
    expect(productsConflictInStack(protein, creatine)).toBe(false);
  });

  test('два протеина конфликтират', () => {
    const a = makeProduct('Whey Isolate', 'Протеини');
    const b = makeProduct('Casein Night', 'Протеини');
    expect(productsConflictInStack(a, b)).toBe(true);
  });

  test('stimulant и melatonin конфликтират', () => {
    const preworkout = makeProduct('Preworkout Booster Caffeine', 'Предтренировъчни добавки');
    const sleep = makeProduct('Melatonin 3mg', 'Билки');
    expect(getProductConflictGroups(preworkout)).toContain('stimulant');
    expect(getProductConflictGroups(sleep)).toContain('melatonin');
    expect(productsConflictInStack(preworkout, sleep)).toBe(true);
  });

  test('otshalvane slot order започва с fat_burner', () => {
    expect(GOAL_SLOT_ORDER.otshalvane[0]).toBe('fat_burner');
  });
});
