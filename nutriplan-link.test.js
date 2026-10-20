import { buildNutriPlanHandoff, renderNutriPlanPromo, nutriPlanUrl } from './nutriplan-link.js';

describe('nutriplan-link', () => {
  test('пратката: източник по сайта, без бюджет, продуктите от препоръчания вариант', () => {
    const h = buildNutriPlanHandoff('life', { sex: 'male', budget_band: 'up30', site_id: 'life', priority: 'sleep' }, {
      recommended_tier: 'basic',
      tiers: { basic: { name: 'Базов', products: [{ name: 'Magnesium', dose: '2 капс.', timing: 'вечер', price_eur: 9 }] }, premium: { products: [{ name: 'X' }] } },
    });
    expect(h.source).toBe('lifeprotocols');
    expect(h.answers).toEqual({ sex: 'male', priority: 'sleep' });
    expect(h.protocol).toEqual({ tier: 'Базов', products: [{ name: 'Magnesium', dose: '2 капс.', timing: 'вечер' }] });
  });

  test('рекламният блок: стойности по подразбиране, utm на сайта, екраниране', () => {
    const html = renderNutriPlanPromo({ title: '<b>x</b>', options: {} }, 'main');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain(nutriPlanUrl('main', 'page').replace('&', '&amp;'));
    expect(html).toContain('utm_source=daotslabna');
    expect(renderNutriPlanPromo({}, 'life')).toContain('utm_source=lifeprotocols');
  });
});
