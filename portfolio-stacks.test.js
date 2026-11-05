import {
  STACK_IDS, STACK_RULES, resolveStack, rankSlotCandidates, variantValue, brandTrust,
  pickStackVariant, isStackUnfitPack, stackCandidateGroupIds, parseDose, potencyScore, stackProof,
} from './portfolio-stacks.js';
import { STACK_CONTENT, STACK_ORDER } from './portfolio-stacks-content.js';

let sku = 0;
function product(name, brand, { b2b, retail, ref = 0, pack = '60 капсули', category = 'Витамини', available = true, distributor = 'fitness1' } = {}) {
  sku += 1;
  const gid = String(1000 + sku);
  return {
    entry: { group_id: gid, name, brand, category_top: category, available, margin_eligible: true },
    group: {
      group_id: gid, name, image: 'x.jpg', distributor,
      variants: [{ sku_id: `s${sku}`, pack, b2b_price: b2b, retail_price: retail, f1_reference_price: ref || retail * 1.05, available, distributor }],
    },
  };
}

function catalog(list) {
  const index = list.map((p) => p.entry);
  const groups = new Map(list.map((p) => [p.entry.group_id, p.group]));
  return { index, getGroup: (gid) => groups.get(String(gid)) || null };
}

describe('portfolio-stacks', () => {
  test('всеки стак има 3 места, текст и цвят', () => {
    expect(STACK_IDS.sort()).toEqual([...STACK_ORDER].sort());
    for (const id of STACK_IDS) {
      expect(STACK_RULES[id].slots).toHaveLength(3);
      expect(STACK_CONTENT[id].name).toBeTruthy();
      expect(STACK_CONTENT[id].faq.length).toBeGreaterThan(0);
    }
  });

  test('маржът се мери спрямо цената в магазина на доставчика', () => {
    const v = variantValue({ b2b_price: 10, retail_price: 15, f1_reference_price: 20 });
    expect(v.abs).toBe(5);
    expect(v.rel).toBeCloseTo(0.25);
  });

  test('между продуктите на едно вещество печели по-високият относителен марж', () => {
    // Евтиният: 3 € печалба от 10 € при доставчика (30%); скъпият: 5 € от 40 € (12.5%).
    const cheap = product('Chromium Picolinate 200 mcg', 'Haya Labs', { b2b: 5, retail: 8, ref: 10 });
    const pricey = product('Chromium Picolinate 200 mcg Premium', 'Haya Labs', { b2b: 30, retail: 35, ref: 40 });
    const { index, getGroup } = catalog([pricey, cheap]);
    const ranked = rankSlotCandidates(index, STACK_RULES.slim.slots[1], getGroup);
    expect(ranked[0].entry.group_id).toBe(cheap.entry.group_id);
  });

  test('качеството на марката тежи при сходен марж', () => {
    const known = product('Milk Thistle 300 mg', 'NOW Foods', { b2b: 7, retail: 10, ref: 11 });
    const unknown = product('Milk Thistle 300 mg', 'NoName', { b2b: 6.8, retail: 10, ref: 11 });
    const { index, getGroup } = catalog([unknown, known]);
    const ranked = rankSlotCandidates(index, STACK_RULES.slim.slots[2], getGroup);
    expect(ranked[0].entry.brand).toBe('NOW Foods');
    expect(brandTrust('now foods')).toBe(1);
    expect(brandTrust('NoName', { NoName: 1.1 })).toBe(1.1);
  });

  test('изчерпан продукт се заменя със следващия; без основното вещество — заместителят', () => {
    const carnA = product('L-Carnitine 1000 mg', 'Biotech USA', { b2b: 6, retail: 12, ref: 13 });
    const carnB = product('L-Carnitine 500 mg', 'Everbuild', { b2b: 6, retail: 9, ref: 10 });
    const cla = product('CLA 1000 mg', 'Nutrend', { b2b: 8, retail: 14, ref: 15 });
    const chrom = product('Chromium Picolinate', 'Biotech USA', { b2b: 3, retail: 6, ref: 7 });
    const thistle = product('Milk Thistle', 'Biotech USA', { b2b: 5, retail: 10, ref: 11 });
    const { index, getGroup } = catalog([carnA, carnB, cla, chrom, thistle]);

    let r = resolveStack(index, 'slim', getGroup).slots;
    expect(r.map((x) => x.pick?.entry.group_id)).toEqual([carnA.entry.group_id, chrom.entry.group_id, thistle.entry.group_id]);
    expect(r.every((x) => x.primary)).toBe(true);

    // Изчерпан е силният карнитин; слабият (500 mg) е под прага за сила —
    // по-напред е силният заместител (CLA 1000 mg) от същото място.
    r = resolveStack(index, 'slim', getGroup, { unavailable: new Set([carnA.group.variants[0].sku_id]) }).slots;
    expect(r[0].pick.option.key).toBe('cla');

    const gone = new Set([carnA.group.variants[0].sku_id, carnB.group.variants[0].sku_id]);
    r = resolveStack(index, 'slim', getGroup, { unavailable: gone }).slots;
    expect(r[0].pick.option.key).toBe('cla');
    expect(r[0].primary).toBe(false);
  });

  test('аксесоари и продукти без марж не влизат', () => {
    const belt = product('Фитнес колан - Естествена кожа', 'ARMAGEDDON', { b2b: 5, retail: 20, category: 'Спортни аксесоари и уреди' });
    const biotinLow = product('Biotin 5000 mcg', 'Haya Labs', { b2b: 9.9, retail: 10, ref: 10.5 });
    const { index, getGroup } = catalog([belt, biotinLow]);
    const r = resolveStack(index, 'beauty', getGroup).slots;
    expect(r[2].pick).toBeNull();
    expect(stackCandidateGroupIds(index, 'beauty')).not.toContain(belt.entry.group_id);
  });

  test('един продукт не заема две места; мостри и кашони отпадат', () => {
    expect(isStackUnfitPack({ pack: '30 грама' })).toBe(true);
    expect(isStackUnfitPack({ pack: '60 x 15 Caps' })).toBe(true);
    expect(isStackUnfitPack({ pack: '90 капсули' })).toBe(false);
    const mg = product('Magnesium Bisglycinate', 'Forcelab', { b2b: 10, retail: 20, ref: 21 });
    const { index, getGroup } = catalog([mg]);
    const r = resolveStack(index, 'postpartum', getGroup).slots;
    expect(r[2].pick.entry.group_id).toBe(mg.entry.group_id);
    expect(pickStackVariant({ variants: [{ ...mg.group.variants[0], retail_price: 200 }] })).toBeNull();
  });

  test('Fitness1 е приоритет, дори Sila да има по-висок марж; Sila — само ако Fitness1 не е пълен', () => {
    const f1 = [
      product('L-Carnitine 1000 mg', 'Biotech USA', { b2b: 8.5, retail: 12, ref: 13 }),
      product('Chromium Picolinate', 'Biotech USA', { b2b: 4.4, retail: 6, ref: 7 }),
      product('Milk Thistle', 'Biotech USA', { b2b: 6.5, retail: 9, ref: 10 }),
    ];
    const sila = [
      product('L-Carnitine 500 mg', 'NOW Foods', { b2b: 3, retail: 11, ref: 12, distributor: 'sila' }),
      product('Chromium Picolinate 200', 'NOW Foods', { b2b: 1, retail: 6, ref: 7, distributor: 'sila' }),
      product('Milk Thistle 300', 'NOW Foods', { b2b: 2, retail: 9, ref: 10, distributor: 'sila' }),
    ];
    const { index, getGroup } = catalog([...f1, ...sila]);
    let res = resolveStack(index, 'slim', getGroup);
    expect(res.distributor).toBe('fitness1');
    expect(res.fallback).toBe(false);

    res = resolveStack(index, 'slim', getGroup, { unavailable: new Set([f1[2].group.variants[0].sku_id]) });
    expect(res.distributor).toBe('sila');
    expect(res.fallback).toBe(true);

    res = resolveStack(index, 'slim', getGroup, { preferred: 'sila' });
    expect(res.distributor).toBe('sila');
  });

  test('целият пакет е от един доставчик — никога Sila + Fitness1', () => {
    // Fitness1 има най-добрите продукти за 2 места, Sila — пълен пакет.
    const f1Carn = product('L-Carnitine 1000 mg', 'NOW Foods', { b2b: 4, retail: 12, ref: 13 });
    const f1Chrom = product('Chromium Picolinate', 'NOW Foods', { b2b: 2, retail: 8, ref: 9 });
    const silaCarn = product('L-Carnitine 500 mg', 'Biotech USA', { b2b: 8, retail: 11, ref: 12, distributor: 'sila' });
    const silaChrom = product('Chromium Picolinate 200', 'Biotech USA', { b2b: 4, retail: 6, ref: 7, distributor: 'sila' });
    const silaThistle = product('Milk Thistle', 'Biotech USA', { b2b: 6, retail: 9, ref: 10, distributor: 'sila' });
    const { index, getGroup } = catalog([f1Carn, f1Chrom, silaCarn, silaChrom, silaThistle]);

    const res = resolveStack(index, 'slim', getGroup);
    expect(res.distributor).toBe('sila');
    expect(res.slots.every((s) => s.pick && s.pick.group.distributor === 'sila')).toBe(true);

    // Щом и Fitness1 има пълен пакет — по-силният по марж/качество печели, пак без смесване.
    const f1Thistle = product('Milk Thistle 300', 'NOW Foods', { b2b: 3, retail: 10, ref: 11 });
    const c2 = catalog([f1Carn, f1Chrom, f1Thistle, silaCarn, silaChrom, silaThistle]);
    const res2 = resolveStack(c2.index, 'slim', c2.getGroup);
    expect(res2.distributor).toBe('fitness1');
    const dists = new Set(res2.slots.map((s) => s.pick.group.distributor));
    expect(dists.size).toBe(1);

    // Изчерпан продукт при Fitness1 без заместител там → целият пакет минава към Sila.
    const res3 = resolveStack(c2.index, 'slim', c2.getGroup, { unavailable: new Set([f1Thistle.group.variants[0].sku_id]) });
    expect(res3.distributor).toBe('sila');
  });

  test('доза от името и сила на действие', () => {
    expect(parseDose('Biotin Maximum Strength 10,000 mcg.', 'mcg')).toBe(10000);
    expect(parseDose('Vitamin D3 4000 + K2 MK-7 100 mcg', 'iu')).toBe(4000);
    expect(parseDose('Liposomal Coenzyme Q10 100 mg', 'mg')).toBe(100);
    expect(potencyScore('biotin', 'Biotin 500 mcg')).toBeLessThan(0.1);
    expect(potencyScore('coq10', 'Liposomal Coenzyme Q10 100 mg')).toBe(1);
    expect(potencyScore('magnesium', 'Magnesium Bisglycinate 200 mg')).toBe(1);
  });

  test('в групата с най-силно действие и висок марж първи са по-скъпите елитни марки', () => {
    // Трите са силни (Creapure); маржът е сходен (в групата). Евтиният е с малко по-висок марж,
    // но елитната марка с по-висока цена е първа.
    const cheap = product('Creatine Monohydrate Creapure', 'Trec Nutrition', { b2b: 10, retail: 20, ref: 21, pack: '300 грама' });
    const elite = product('Creatine Monohydrate Creapure', 'NOW Foods', { b2b: 30, retail: 50, ref: 54, pack: '500 грама' });
    const premium = product('Creatine 100% Creapure', 'Nutrend', { b2b: 24, retail: 40, ref: 42, pack: '500 грама' });
    const { index, getGroup } = catalog([cheap, premium, elite]);
    const ranked = rankSlotCandidates(index, STACK_RULES.tone.slots[1], getGroup);
    expect(ranked.map((r) => r.entry.brand)).toEqual(['NOW Foods', 'Nutrend', 'Trec Nutrition']);
    expect(ranked[0].band).toBe('elite');
  });

  test('нисък марж не влиза в елитната група дори при елитна марка', () => {
    const lowMargin = product('Creatine Creapure', 'NOW Foods', { b2b: 37, retail: 50, ref: 70, pack: '500 грама' });
    const goodMargin = product('Creatine Creapure', 'Nutrend', { b2b: 22, retail: 40, ref: 42, pack: '500 грама' });
    const { index, getGroup } = catalog([lowMargin, goodMargin]);
    const ranked = rankSlotCandidates(index, STACK_RULES.tone.slots[1], getGroup);
    expect(ranked[0].entry.brand).toBe('Nutrend');
    expect(ranked[1].band).toBe('strong');
  });

  test('бюджетна марка / слаба доза не изпреварва елитен заместител', () => {
    const weakBiotin = product('Biotin 500 mcg', 'Bioherba', { b2b: 3, retail: 8, ref: 9 });
    const eliteHair = product('Perfect Skin Hydro-Complex', 'Olimp Sport Nutrition', { b2b: 7, retail: 11.5, ref: 12 });
    const { index, getGroup } = catalog([weakBiotin, eliteHair]);
    const ranked = rankSlotCandidates(index, STACK_RULES.beauty.slots[2], getGroup);
    expect(ranked[0].entry.group_id).toBe(eliteHair.entry.group_id);
    expect(ranked[ranked.length - 1].band).toBe('reserve');
  });

  test('обосновка: доза, форма, марка — без марж', () => {
    const proof = stackProof('magnesium', 'Magnesium Bisglycinate 200 mg', 'NOW Foods');
    expect(proof).toEqual([
      '200 мг в доза — силна доза',
      'Бисглицинат — най-добре поносимата форма',
      'Елитна марка — фармацевтичен стандарт',
    ]);
    expect(stackProof('coq10', 'Liposomal Coenzyme Q10 100 mg', 'MagHerbs')[2]).toMatch(/Премиум/);
  });
});
