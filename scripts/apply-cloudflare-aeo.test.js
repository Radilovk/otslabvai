import { buildAiCrawlerUaExpression } from './apply-cloudflare-aeo.mjs';
import { AI_CRAWLER_AGENTS } from '../seo-aeo-inject.js';

describe('buildAiCrawlerUaExpression', () => {
  test('includes all AI crawler agents from Worker robots.txt', () => {
    const expr = buildAiCrawlerUaExpression();
    for (const agent of AI_CRAWLER_AGENTS) {
      expect(expr).toContain(`http.user_agent contains "${agent}"`);
    }
    expect(expr.startsWith('(')).toBe(true);
    expect(expr.endsWith(')')).toBe(true);
  });
});
