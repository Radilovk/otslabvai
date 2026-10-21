import { guardAdvisorResponse, sanitizeAdviceText, allowedSubstances, ADVISOR_DISCLAIMER } from './advisor-ai-guard.js';

describe('предпазител след AI', () => {
  const resp = () => ({
    analysis: 'Целта ви е отслабване. Приемайте 5-HTP вечер за апетита. Пийте повече вода.',
    tiers: {
      basic: { products: [{ product_id: 'a', name: 'Glucomannan', dose: '3 капсули 3 пъти дневно', timing: 'вечер преди сън' }] },
      optimal: { products: [{ product_id: 'a', name: 'Glucomannan' }] },
      premium: { products: [{ product_id: 'a', name: 'Glucomannan', why_for_you: 'Засища. Добавете и жълт кантарион.' }] },
    },
    lifestyle_tips: ['Ограничете кофеина след обяд', 'Приемайте зелен чай екстракт сутрин'],
    disclaimer: '',
  });

  test('дозата и часът са от кода, не от AI', () => {
    const r = guardAdvisorResponse(resp(), () => ({ dose: 'Според етикета (2 капс.)', timing: '30 мин преди основно хранене' }));
    expect(r.tiers.basic.products[0]).toMatchObject({ dose: 'Според етикета (2 капс.)', timing: '30 мин преди основно хранене' });
  });

  test('указания за прием на вещества извън продуктите отпадат; общите съвети остават', () => {
    const r = guardAdvisorResponse(resp(), () => null);
    expect(r.analysis).toBe('Целта ви е отслабване. Пийте повече вода.');
    expect(r.tiers.premium.products[0].why_for_you).toBe('Засища.');
    expect(r.lifestyle_tips).toEqual(['Ограничете кофеина след обяд']);
    expect(r.disclaimer).toBe(ADVISOR_DISCLAIMER);
  });

  test('вещество, което е сред продуктите, може да се споменава', () => {
    const allowed = allowedSubstances([{ name: 'NOW Magnesium + Melatonin' }]);
    expect(sanitizeAdviceText('Приемайте мелатонина 30 мин преди сън.', allowed)).toBe('Приемайте мелатонина 30 мин преди сън.');
  });
});
