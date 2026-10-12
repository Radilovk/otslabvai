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

  test('„без стимуланти“ изключва бърнъри; „чувствителен“ — само стимулантите', () => {
    const products = [
      product('burn', 'Thermo Fat Burner'),
      product('caff', 'Energy caffeine shot'),
      product('mag', 'Магнезий'),
    ];
    const base = { sex: 'female', email: 'a@b.cc' };
    const avoid = rankSiteAdvisorProducts(buildSiteAdvisorProfile({ ...base, stimulant_tolerance: 'avoid' }, 'main'), products, 'main');
    expect(avoid.ranked.map((r) => r.product.product_id)).toEqual(['mag']);
    const sens = rankSiteAdvisorProducts(buildSiteAdvisorProfile({ ...base, stimulant_tolerance: 'sensitive' }, 'main'), products, 'main');
    expect(sens.ranked.map((r) => r.product.product_id).sort()).toEqual(['burn', 'mag']);
  });

  test('life приема избрания фокус; main винаги е отслабване', () => {
    expect(buildSiteAdvisorProfile({ priority: 'skin' }, 'life').priority).toBe('skin');
    expect(buildSiteAdvisorProfile({ priority: 'hack' }, 'life').priority).toBe('longevity');
    expect(buildSiteAdvisorProfile({ priority: 'skin' }, 'main').priority).toBe('otshalvane');
  });
});
