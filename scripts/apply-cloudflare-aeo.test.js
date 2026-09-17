import { buildAiCrawlerUaExpression, dnsAidRecordSpecs } from './apply-cloudflare-aeo.mjs';
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

describe('dnsAidRecordSpecs', () => {
  test('uses protocol-specific alpn for _a2a._agents', () => {
    const specs = dnsAidRecordSpecs('daotslabna.com');
    const a2a = specs.find((s) => s.shortName === '_a2a._agents');
    expect(a2a.svcParams).toContain('alpn="a2a"');
    expect(a2a.svcParams).toContain('mandatory=alpn,port');
  });

  test('uses generic h2/h3 for index and mcp entrypoints', () => {
    const specs = dnsAidRecordSpecs('life-protocols.com');
    for (const shortName of ['_index._agents', '_mcp._agents']) {
      const spec = specs.find((s) => s.shortName === shortName);
      expect(spec.svcParams).toBe('alpn="h2,h3" port=443');
    }
  });
});
