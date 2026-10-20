import { rankSupplementCandidates, slotForQuery, fitScore, SUPPLEMENT_SLOTS } from './portfolio-supplement-pick.js';
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
});
