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
});
