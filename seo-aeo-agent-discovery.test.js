import {
  agentDiscoveryLinkHeader,
  apiCatalogJson,
  apiCatalogLinkset,
  openapiCatalogSpec,
  serveAgentDiscoveryAsset,
} from './seo-aeo-agent-discovery.js';
import { SITE_SEO } from './seo-aeo-inject.js';

describe('seo-aeo-agent-discovery', () => {
  test('apiCatalogLinkset includes RFC 9727 relations', () => {
    const { linkset } = apiCatalogLinkset(SITE_SEO.main);
    expect(linkset.length).toBeGreaterThanOrEqual(4);
    const home = linkset.find((e) => e.anchor === 'https://daotslabna.com/');
    expect(home['service-doc'].some((l) => l.href.endsWith('/llms.txt'))).toBe(true);
    expect(home.describedby.some((l) => l.href.endsWith('/sitemap.xml'))).toBe(true);
    const catalog = linkset.find((e) => e.anchor.endsWith('/c/now'));
    expect(catalog['service-desc'][0].href).toContain('/.well-known/openapi/catalog.json');
  });

  test('apiCatalogJson is valid JSON with linkset', () => {
    const parsed = JSON.parse(apiCatalogJson(SITE_SEO.portfolio));
    expect(Array.isArray(parsed.linkset)).toBe(true);
    expect(JSON.stringify(parsed)).toContain('portfolio/bootstrap');
  });

  test('agentDiscoveryLinkHeader includes api-catalog and describedby', () => {
    const link = agentDiscoveryLinkHeader(SITE_SEO.life);
    expect(link).toContain('rel="api-catalog"');
    expect(link).toContain('</llms.txt>; rel="describedby"');
    expect(link).toContain('application/linkset+json');
  });

  test('serveAgentDiscoveryAsset returns linkset response', async () => {
    const res = serveAgentDiscoveryAsset(SITE_SEO.main, '/.well-known/api-catalog');
    expect(res).not.toBeNull();
    expect(res.headers.get('content-type')).toContain('application/linkset+json');
    const body = await res.text();
    expect(body).toContain('"anchor": "https://daotslabna.com/page_content.json"');
  });

  test('openapiCatalogSpec uses site origin', () => {
    const spec = openapiCatalogSpec(SITE_SEO.main);
    expect(spec.servers[0].url).toBe('https://daotslabna.com');
    expect(spec.paths['/c/now']).toBeDefined();
  });
});
