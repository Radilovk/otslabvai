import { pickTierForBudget, rankSiteAdvisorProducts } from './site-advisor-engine.js';
import { buildSiteAdvisorProfile } from './site-advisor-engine.js';

const product = (id, name) => ({
  product_id: id,
  public_data: { name, price: 20, variants: [] },
  system_data: { application_type: 'Oral', inventory: 5, goals: [] },
});

describe('site advisor', () => {
  test('бюджетът избира най-пълния пакет, който се вписва', () => {
    const tiers = {
      basic: { monthly_total_eur: 40, monthly_cost_eur: 18 },
      optimal: { monthly_total_eur: 74, monthly_cost_eur: 37 },
      premium: { monthly_total_eur: 90, monthly_cost_eur: 45 },
    };
    expect(pickTierForBudget(tiers, 'up30')).toBe('basic');
    expect(pickTierForBudget(tiers, '30-60')).toBe('premium');
    expect(pickTierForBudget({ basic: { monthly_total_eur: 50 } }, 'up30')).toBe('basic');
  });

  test('„без стимуланти“ и „чувствителен“ изключват стимулантите, но не бърнърите без стимуланти', () => {
    const products = [
      product('burn', 'Thermo Fat Burner'),
      product('caff', 'Caffeine 200 mg капсули'),
      product('lipo', 'Lipotropic Fat Burner Stim Free'),
      product('mag', 'Магнезий'),
    ];
    const base = { sex: 'female', email: 'a@b.cc' };
    for (const tolerance of ['avoid', 'sensitive']) {
      const res = rankSiteAdvisorProducts(buildSiteAdvisorProfile({ ...base, stimulant_tolerance: tolerance }, 'main'), products, 'main');
      expect(res.ranked.map((r) => r.product.product_id).sort()).toEqual(['lipo', 'mag']);
    }
    const ok = rankSiteAdvisorProducts(buildSiteAdvisorProfile({ ...base, stimulant_tolerance: 'ok' }, 'main'), products, 'main');
    expect(ok.ranked).toHaveLength(4);
  });

  test('daotslabna: при кърмене / бременност / хранително разстройство / ИТМ < 18.5 — без програма', () => {
    expect(() => buildSiteAdvisorProfile({ sex: 'female', email: 'a@b.cc', conditions: ['breastfeeding'] }, 'main')).toThrow(/кърмене/);
    expect(() => buildSiteAdvisorProfile({ sex: 'female', conditions: ['eating_disorder'] }, 'main')).toThrow(/хранително разстройство/);
    expect(() => buildSiteAdvisorProfile({ sex: 'female', height_cm: 170, weight_kg: 48 }, 'main')).toThrow(/под нормата/);
  });

  test('life: при кърмене — без продукти за отслабване и стимуланти', () => {
    const products = [product('burn', 'Thermo Fat Burner'), product('lipo', 'Lipotropic Fat Burner Stim Free'), product('mag', 'Магнезий')];
    const res = rankSiteAdvisorProducts(buildSiteAdvisorProfile({ sex: 'female', email: 'a@b.cc', conditions: ['breastfeeding'] }, 'life'), products, 'life');
    expect(res.ranked.map((r) => r.product.product_id)).not.toContain('burn');
  });

  test('отговор на скрит въпрос отпада (лекарства за диабет без диабет)', () => {
    expect(buildSiteAdvisorProfile({ sex: 'female', conditions: ['none'], diabetes_meds: 'glp1' }, 'main').diabetes_meds).toBe('');
    expect(buildSiteAdvisorProfile({ sex: 'female', conditions: ['diabetes'], diabetes_meds: 'glp1' }, 'main').diabetes_meds).toBe('glp1');
  });

  test('храненето определя ролите: големи порции → апетит; сладко → кръвна захар; стрес → магнезий', () => {
    const p = buildSiteAdvisorProfile({ sex: 'female', eating_pattern: ['big_portions', 'sweet_cravings', 'emotional'], symptoms: ['none'] }, 'main');
    expect(p.symptoms).toEqual(expect.arrayContaining(['cravings', 'sugar_cravings', 'stress_eating']));
    expect(p.symptoms).not.toContain('none');
  });

  test('life приема избрания фокус; main винаги е отслабване', () => {
    expect(buildSiteAdvisorProfile({ priority: 'skin' }, 'life').priority).toBe('skin');
    expect(buildSiteAdvisorProfile({ priority: 'hack' }, 'life').priority).toBe('longevity');
    expect(buildSiteAdvisorProfile({ priority: 'skin' }, 'main').priority).toBe('otshalvane');
  });
});
