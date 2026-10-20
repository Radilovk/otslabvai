import { rankSupplementCandidates, slotForQuery, fitScore, SUPPLEMENT_SLOTS, normalizeSupplementQuery } from './portfolio-supplement-pick.js';
import { enrichIndexEntry } from './portfolio-search.js';

let n = 0;
const entry = (name, max_margin = 2, extra = {}) => enrichIndexEntry({
  group_id: String(++n), name, brand: 'B', category: 'Витамини', packs: [], available: true, margin_eligible: true, max_margin, ...extra,
}, { variants: [], description: extra.description || '' });
const names = (r) => r.candidates.map((e) => e.name);

describe('portfolio-supplement-pick', () => {
  test('между еднакво подходящите печели по-големият марж', () => {
    const idx = [entry('Magnesium Bisglycinate 125 mg', 2.1), entry('Magnesium Bisglycinate 375 mg', 4.8), entry('Magnesium Glycinate', 3.2)];
    expect(names(rankSupplementCandidates(idx, 'Магнезиев бисглицинат'))).toEqual(['Magnesium Bisglycinate 375 mg', 'Magnesium Glycinate', 'Magnesium Bisglycinate 125 mg']);
  });

  test('по-неподходящ продукт не изпреварва с марж (извън допуска)', () => {
    const idx = [entry('Magnesium Citrate 200mg', 1), entry('Magnesium Oxide 400', 9)];
    // цитрат: форма +5, предпочитана +3, единичен +2 = 10; оксид: единичен +2 = 2 → извън допуска
    expect(names(rankSupplementCandidates(idx, 'Магнезиев цитрат'))).toEqual(['Magnesium Citrate 200mg']);
  });

  test('D3 без K2 / MK-7, мултивитамини и калций', () => {
    const idx = [entry('Vitamin D3 1000 + K2', 9), entry('Vitamin D-3 & MK-7', 8), entry('Multivitamin D3', 7), entry('Vitamin D3 2000 IU', 1)];
    expect(names(rankSupplementCandidates(idx, 'Витамин D3'))).toEqual(['Vitamin D3 2000 IU']);
  });

  test('D3 + K2 като търсеща дума → комбинацията', () => {
    expect(slotForQuery('Витамин D3 + K2').key).toBe('d3k2');
    const idx = [entry('Vitamin D3 1000 IU + K2 50 mcg', 2), entry('Vitamin D3 2000', 5)];
    expect(names(rankSupplementCandidates(idx, 'Витамин D3 + K2'))[0]).toBe('Vitamin D3 1000 IU + K2 50 mcg');
  });

  test('без алкални смеси, напитки и смеси с глюкозамин', () => {
    const mg = [entry('Alkaline System | with Sodium & Magnesium', 10), entry('Magnesium Citrate', 1)];
    expect(names(rankSupplementCandidates(mg, 'Магнезий'))).toEqual(['Magnesium Citrate']);
    const col = [entry('Protein Water | Collagen Peptides', 10), entry('Joint | Collagen with Glucosamine', 9), entry('Collagen Peptides', 1)];
    expect(names(rankSupplementCandidates(col, 'Колагенови пептиди'))).toEqual(['Collagen Peptides']);
  });

  test('омега от водорасли или веган → само веган', () => {
    const idx = [entry('Omega 3 Ultra', 9), entry('Omega-3 Vegan | DHA', 1)];
    expect(names(rankSupplementCandidates(idx, 'Омега-3 от водорасли'))).toEqual(['Omega-3 Vegan | DHA']);
    expect(names(rankSupplementCandidates(idx, 'Омега-3', { vegan: true }))).toEqual(['Omega-3 Vegan | DHA']);
  });

  test('NAC не съвпада с Echinacea', () => {
    expect(rankSupplementCandidates([entry('Echinacea 250mg.')], 'NAC (N-Ацетил Цистеин)').candidates).toEqual([]);
  });

  test('непозната дума → обичайното търсене, подредено по марж', () => {
    const idx = [entry('Spermidine 1 mg', 1), entry('Spermidine Complex', 3), entry('Vitamin C', 9)];
    const r = rankSupplementCandidates(idx, 'Spermidine');
    expect(r.slot).toBeNull();
    expect(names(r)).toEqual(['Spermidine Complex', 'Spermidine 1 mg']);
  });

  test('празна дума и лимит', () => {
    expect(rankSupplementCandidates([entry('Zinc 15')], '').candidates).toEqual([]);
    const many = Array.from({ length: 10 }, (_, i) => entry(`Zinc ${i}`, i));
    expect(rankSupplementCandidates(many, 'Цинк', { max: 6 }).candidates).toHaveLength(6);
  });

  test('всеки слот има задължителни думи', () => {
    for (const s of SUPPLEMENT_SLOTS) expect(s.must).toBeInstanceOf(RegExp);
    expect(fitScore(SUPPLEMENT_SLOTS[0], { name: '' }, { q: 'x' })).toBe(-1);
  });

  test('кирилски букви вместо латински: „Витамин С“, „В12“, „Д3“, „К2“', () => {
    expect(slotForQuery('Витамин С').key).toBe('vitamin_c');
    expect(slotForQuery('Витамин В12').key).toBe('b12');
    expect(slotForQuery('Витамин Д3').key).toBe('vitamin_d');
    expect(slotForQuery('Витамин D3 + К2').key).toBe('d3k2');
    expect(slotForQuery('Витамин К2').key).toBe('vitamin_k2');
    // предлогът „с“ не става буква на витамин
    expect(normalizeSupplementQuery('Колаген с витамин С')).toBe('Колаген с витамин c');
  });

  test('желязо, калий, цинк — кирилските окончания', () => {
    expect(slotForQuery('Желязо').key).toBe('iron');
    expect(slotForQuery('Желязен бисглицинат').key).toBe('iron');
    expect(slotForQuery('Калий').key).toBe('potassium');
    expect(slotForQuery('Калиев цитрат').key).toBe('potassium');
    expect(slotForQuery('Цинк').key).toBe('zinc');
  });

  test('едно вещество: комбинациите отпадат, щом има самостоятелен продукт; „ / “ не е комбинация', () => {
    const idx = [entry('NOW Foods NAC | with Quercetin & Zinc', 9), entry('C-1000 Zinc Immune | Vitamin C + Zinc', 8), entry('Zinc Picolinate 50 mg', 1)];
    expect(names(rankSupplementCandidates(idx, 'Цинк'))).toEqual(['Zinc Picolinate 50 mg']);
    const th = [entry('Sleep Regimen 3-in-1 | Melatonin, 5-HTP and Theanine', 9), entry('L-Theanine 200 mg / Double Strength', 2)];
    expect(names(rankSupplementCandidates(th, 'L-теанин'))).toEqual(['L-Theanine 200 mg / Double Strength']);
    const d3 = [entry('Omega + D3 Liquid', 9), entry('Vitamin D-3 5000 IU', 1)];
    expect(names(rankSupplementCandidates(d3, 'Витамин D3'))).toEqual(['Vitamin D-3 5000 IU']);
  });

  test('две вещества: основното е първото написано, комбинацията печели', () => {
    expect(slotForQuery('Колаген с витамин C').key).toBe('collagen');
    expect(slotForQuery('Желязо + витамин C').key).toBe('iron');
    const idx = [entry('Vitamin C 1000', 9), entry('Collagen Peptides', 3), entry('Collagen Peptides + Vitamin C', 2)];
    expect(names(rankSupplementCandidates(idx, 'Колаген с витамин C'))[0]).toBe('Collagen Peptides + Vitamin C');
  });

  test('D3 + K2 изисква и двете; без омега и калций', () => {
    const idx = [entry('Omega 3 / D3 + K2', 9), entry('Calcium + D3 + K2', 8), entry('Vitamin D3 2000', 7), entry('D3 + K2 Drops', 1)];
    expect(names(rankSupplementCandidates(idx, 'Витамин D3 + K2'))).toEqual(['D3 + K2 Drops']);
  });

  test('веган: животинските съставки отпадат (колаген, D3 от ланолин)', () => {
    const idx = [entry('Marine Collagen', 9), entry('Collagen Vegan Booster', 1)];
    expect(names(rankSupplementCandidates(idx, 'Колаген', { vegan: true }))).toEqual(['Collagen Vegan Booster']);
    expect(rankSupplementCandidates([entry('Vitamin D-3 5000 IU', 5)], 'Витамин D3', { vegan: true }).candidates).toEqual([]);
  });

  test('кремове и гелове не са добавка', () => {
    expect(names(rankSupplementCandidates([entry('Vitamin E Cream', 9), entry('Vitamin E-400', 1)], 'Витамин E'))).toEqual(['Vitamin E-400']);
  });
});
