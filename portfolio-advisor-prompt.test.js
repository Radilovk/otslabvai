import {
  buildAdvisorClinicalGuardrails,
  hasAdvisorClinicalComplexity,
  resolveAdvisorCompositionMode,
  buildPortfolioAdvisorMessages,
} from './portfolio-advisor-prompt.js';

describe('portfolio-advisor-prompt hybrid', () => {
  test('hasAdvisorClinicalComplexity при диабет + статини', () => {
    expect(hasAdvisorClinicalComplexity({
      conditions: ['diabetes', 'hypertension'],
      medications: ['statins'],
      allergies: ['none'],
      diet: 'omnivore',
    })).toBe(true);
  });

  test('resolveAdvisorCompositionMode hybrid → ai_pick за сложен профил', () => {
    const profile = {
      conditions: ['diabetes', 'hypertension'],
      medications: ['statins'],
      allergies: ['lactose'],
      diet: 'omnivore',
      priority: 'otshalvane',
      bmi: 34,
    };
    expect(resolveAdvisorCompositionMode(profile, { composition_mode: 'hybrid' })).toBe('ai_pick');
    expect(resolveAdvisorCompositionMode(profile, { composition_mode: 'compose_narrate' })).toBe('compose_narrate');
  });

  test('resolveAdvisorCompositionMode hybrid → compose_narrate за прост профил', () => {
    const profile = {
      conditions: ['none'],
      medications: ['none'],
      allergies: ['none'],
      diet: 'omnivore',
      priority: 'muscle',
      activity: 'regular',
    };
    expect(resolveAdvisorCompositionMode(profile, { composition_mode: 'hybrid' })).toBe('compose_narrate');
  });

  test('buildAdvisorClinicalGuardrails включва статини и хипертония', () => {
    const text = buildAdvisorClinicalGuardrails({
      sex: 'female',
      age_band: '45-54',
      bmi: 34,
      priority: 'otshalvane',
      conditions: ['hypertension', 'diabetes'],
      medications: ['statins'],
      allergies: ['lactose'],
      diet: 'omnivore',
      activity: 'moderate',
    });
    expect(text).toMatch(/статини/i);
    expect(text).toMatch(/хипертония/i);
    expect(text).toMatch(/lactose/i);
  });

  test('buildPortfolioAdvisorMessages вгражда guardrails в system prompt', () => {
    const profile = { conditions: ['hypertension'], medications: ['none'], allergies: ['none'], diet: 'omnivore' };
    const messages = buildPortfolioAdvisorMessages('BASE', { client_profile: profile }, profile);
    expect(messages[0].content).toMatch(/КЛИНИЧНИ GUARDRAILS/);
    expect(messages[0].content).toMatch(/хипертония/i);
  });
});
