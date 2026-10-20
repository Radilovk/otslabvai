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

describe('акцентите на началната страница', () => {
  test('AI съветникът веднага след банера, NutriPlan след първата категория; старата карта към теста отпада', async () => {
    const { renderWithFeatures } = await import('./site-features.js');
    const content = [
      { type: 'hero_banner' },
      { type: 'info_card', button: { url: 'https://radilovk.github.io/port/quest.html' } },
      { type: 'product_category' },
      { type: 'product_category' },
    ];
    const html = renderWithFeatures(content, 'main', (c) => `<x-${c.type}></x-${c.type}>`);
    const order = [...html.matchAll(/<x-([a-z_]+)>|class="sf sf--main (sf-[a-z]+)/g)].map((m) => m[1] || m[2]);
    expect(order).toEqual(['hero_banner', 'sf-advisor', 'product_category', 'sf-np', 'product_category']);
  });

  test('ако админът е поставил блока NutriPlan — не се добавя втори', async () => {
    const { renderWithFeatures } = await import('./site-features.js');
    const html = renderWithFeatures([{ type: 'hero_banner' }, { type: 'product_category' }, { type: 'nutriplan_cta' }], 'life', (c) => (c.type === 'nutriplan_cta' ? 'NP' : ''));
    expect(html.match(/sf-np/g)).toBeNull();
    expect(html).toContain('life-protocol-quiz.html');
  });
});
