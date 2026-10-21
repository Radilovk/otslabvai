import { getProductFacts, factsConflict, isRedYeastRice } from './advisor-product-facts.js';
import { profileExcludesStimulants, enforceStimulantRules, getExclusionReasons } from './protocol-safety-rules.js';

let n = 0;
const product = (name, { category = 'Отслабване и контрол на теглото > Фетбърнъри', about = null, description = '' } = {}) => ({
  product_id: `p${++n}`,
  public_data: { name, description, about_content: about, price: 20, variants: [{ option_name: '60 капс.', price: 20, available: true }] },
  system_data: { portfolio: { category } },
});

describe('стимуланти: разпознаване и правила', () => {
  test('зелен чай, горчив портокал, мате са стимуланти; съставът в about_content се чете', () => {
    expect(getProductFacts(product('MeiziMax', { category: 'Отслабване > Потискане на апетита', description: 'Съдържа 300 mg екстракт от зелен чай' })).stimulant).toBe(true);
    expect(getProductFacts(product('Bitter Orange Slim')).stimulant).toBe(true);
    expect(getProductFacts(product('ThermoLean', { about: { title: 'Състав', description: 'гуарана и yerba mate', benefits: [] } })).stimulant).toBe(true);
    expect(getProductFacts(product('Lean Choline', { category: 'Отслабване > Фетбърнъри без стимуланти', description: 'Не съдържа кофеин.' })).stimulant).toBe(false);
  });

  test('два продукта със зелен чай / два бърнъра не влизат заедно', () => {
    const a = product('Lean Burn', { category: 'Отслабване > Фетбърнъри без стимуланти', description: 'green tea extract' });
    const b = product('MeiziMax', { category: 'Отслабване > Потискане на апетита', description: 'екстракт от зелен чай' });
    expect(factsConflict(a, b)).toBe(true);
    const c = product('Cayenne Pepper', { category: 'Отслабване > Фетбърнъри без стимуланти', description: 'капсаицин' });
    const d = product('Legendary Lipo Burn', { description: 'кофеин' });
    expect(factsConflict(c, d)).toBe(true);
  });

  test('без стимуланти при лош сън, 65+, SSRI, хипертония, бременност', () => {
    expect(profileExcludesStimulants({ symptoms: ['poor_sleep'] })).toBe(true);
    expect(profileExcludesStimulants({ age_band: '65+' })).toBe(true);
    expect(profileExcludesStimulants({ medications: ['ssri'] })).toBe(true);
    expect(profileExcludesStimulants({ conditions: ['hypertension'] })).toBe(true);
    expect(profileExcludesStimulants({ conditions: ['pregnancy'] })).toBe(true);
    expect(profileExcludesStimulants({ stimulant_tolerance: 'ok', symptoms: ['fatigue'] })).toBe(false);
  });

  test('последна проверка: един стимулант в пакет, нито един при изключен профил', () => {
    const s1 = product('Lipo Burn', { description: 'кофеин' });
    const s2 = product('Green Tea Slim', { category: 'Отслабване > Потискане на апетита' });
    const ok = product('Glucomannan', { category: 'Отслабване > Потискане на апетита' });
    const map = new Map([s1, s2, ok].map((p) => [p.product_id, p]));
    const resp = () => ({ tiers: { basic: { products: [{ product_id: s1.product_id }, { product_id: ok.product_id }] }, optimal: { products: [s1, s2, ok].map((p) => ({ product_id: p.product_id })) }, premium: { products: [{ product_id: ok.product_id }] } } });
    const r1 = resp();
    enforceStimulantRules(r1, map, { stimulant_tolerance: 'ok' });
    expect(r1.tiers.optimal.products.map((p) => p.product_id)).toEqual([s1.product_id, ok.product_id]);
    const r2 = resp();
    enforceStimulantRules(r2, map, { conditions: ['hypertension'] });
    expect(r2.tiers.optimal.products.map((p) => p.product_id)).toEqual([ok.product_id]);
  });

  test('червеният ориз (= ловастатин) не се предлага', () => {
    const p = product('Red Yeast Rice & CoQ10', { category: 'Сърце > Червен ориз' });
    expect(isRedYeastRice(p)).toBe(true);
    expect(getExclusionReasons({}, p).some((r) => /червен ориз/.test(r))).toBe(true);
  });
});

describe('новите въпроси изключват продукти', () => {
  const p = (name, category) => ({ product_id: name, public_data: { name, price: 20, variants: [{ option_name: '60 капс.', price: 20, available: true }] }, system_data: { portfolio: { category } } });
  const has = (profile, product, re) => getExclusionReasons(profile, product).some((r) => re.test(r));

  test('GLP-1 → без средства за апетит; инсулин → без продукти за кръвна захар', () => {
    expect(has({ diabetes_meds: 'glp1' }, p('Glucomannan', 'Отслабване > Потискане на апетита'), /GLP-1/)).toBe(true);
    expect(has({ diabetes_meds: 'insulin_su' }, p('Berberine 500', 'Здраве > Кръвна захар'), /инсулин/)).toBe(true);
  });

  test('подуване → без фибри; будене нощем → без мелатонин; акне → без биотин', () => {
    expect(has({ digestion: ['bloating'] }, p('Psyllium Husk', 'Отслабване > Потискане на апетита'), /фибри/)).toBe(true);
    expect(has({ sleep_issue: 'waking' }, p('Melatonin 1 mg', 'Сън'), /мелатонин/)).toBe(true);
    expect(has({ sleep_issue: 'falling_asleep' }, p('Melatonin 1 mg', 'Сън'), /мелатонин/)).toBe(false);
    expect(has({ skin_concern: 'acne' }, p('Biotin 10000', 'Красота'), /биотин/)).toBe(true);
  });

  test('рефлукс, тревожност, епилепсия → без стимуланти', () => {
    expect(profileExcludesStimulants({ digestion: ['reflux'] })).toBe(true);
    expect(profileExcludesStimulants({ conditions: ['anxiety'] })).toBe(true);
    expect(profileExcludesStimulants({ conditions: ['epilepsy'] })).toBe(true);
  });
});
