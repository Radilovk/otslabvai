import { buildSiteAdvisorSteps, getSiteAdvisorMeta } from './site-advisor-config.js';

describe('site-advisor-config', () => {
  test('does not include meta intro step', () => {
    for (const siteId of ['main', 'life']) {
      const steps = buildSiteAdvisorSteps(siteId, {});
      expect(steps.some((s) => s.id === 'site_intro')).toBe(false);
      expect(steps[0].id).toBe('sex');
    }
  });

  test('main meta copy avoids internal implementation notes', () => {
    const meta = getSiteAdvisorMeta('main');
    const joined = JSON.stringify(meta).toLowerCase();
    expect(joined).not.toMatch(/не питаме|не се пита/);
  });

  test('no separate pregnancy step — only in health status for women', () => {
    for (const siteId of ['main', 'life']) {
      const femaleSteps = buildSiteAdvisorSteps(siteId, { sex: 'female' });
      expect(femaleSteps.some((s) => s.id === 'pregnancy')).toBe(false);

      const conditions = femaleSteps.find((s) => s.id === 'conditions');
      expect(conditions?.options.some((o) => o.value === 'pregnancy')).toBe(true);
      expect(conditions?.options.some((o) => o.value === 'breastfeeding')).toBe(true);

      const maleConditions = buildSiteAdvisorSteps(siteId, { sex: 'male' })
        .find((s) => s.id === 'conditions');
      expect(maleConditions?.options.some((o) => o.value === 'pregnancy')).toBe(false);
    }
  });
});
