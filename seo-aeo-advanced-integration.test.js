import {
  a2aAgentCard,
  agentSkillsIndex,
  authMd,
  mcpServerCard,
  oauthAuthorizationServer,
  oauthProtectedResource,
  serveAdvancedIntegrationAsset,
} from './seo-aeo-advanced-integration.js';
import { SITE_SEO } from './seo-aeo-inject.js';

describe('seo-aeo-advanced-integration', () => {
  test('oauthAuthorizationServer includes required RFC 8414 fields and agent_auth', () => {
    const doc = oauthAuthorizationServer(SITE_SEO.main);
    expect(doc.issuer).toBe('https://daotslabna.com');
    expect(doc.authorization_endpoint).toContain('/admin.html');
    expect(doc.token_endpoint).toContain('/admin/session');
    expect(doc.jwks_uri).toContain('/.well-known/jwks.json');
    expect(doc.agent_auth.register_uri).toBe('https://daotslabna.com/auth.md');
  });

  test('oauthProtectedResource references site origin as resource and auth server', () => {
    const doc = oauthProtectedResource(SITE_SEO.portfolio);
    expect(doc.resource).toBe('https://biocode-bg.com');
    expect(doc.authorization_servers).toEqual(['https://biocode-bg.com']);
    expect(doc.bearer_methods_supported).toContain('header');
  });

  test('mcpServerCard includes serverInfo-like fields and tools', () => {
    const card = mcpServerCard(SITE_SEO.main);
    expect(card.name).toBeTruthy();
    expect(card.version).toBeTruthy();
    expect(card.endpoint).toContain('/.well-known/openapi/catalog.json');
    expect(card.transport).toBe('http');
    expect(card.tools.length).toBeGreaterThanOrEqual(3);
  });

  test('a2aAgentCard includes supportedInterfaces and non-empty skills', () => {
    const card = a2aAgentCard(SITE_SEO.life);
    expect(card.supportedInterfaces[0].url).toContain('/a2a/v1');
    expect(card.skills.length).toBeGreaterThanOrEqual(3);
    expect(card.skills[0].tags.length).toBeGreaterThan(0);
  });

  test('auth.md includes auth.md heading', () => {
    expect(authMd(SITE_SEO.main)).toMatch(/^# .*auth\.md/m);
    expect(authMd(SITE_SEO.main)).toContain('anonymous-flow');
  });

  test('agentSkillsIndex v0.2.0 schema with digest', async () => {
    const index = await agentSkillsIndex(SITE_SEO.main);
    expect(index.$schema).toContain('0.2.0');
    expect(index.skills[0].digest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test('serveAdvancedIntegrationAsset returns JSON for discovery paths', async () => {
    const paths = [
      '/.well-known/oauth-authorization-server',
      '/.well-known/oauth-protected-resource',
      '/.well-known/mcp/server-card.json',
      '/.well-known/agent-card.json',
      '/.well-known/agent-skills/index.json',
      '/.well-known/http-message-signatures-directory',
      '/.well-known/ai-catalog.json',
      '/auth.md',
    ];
    for (const path of paths) {
      const res = await serveAdvancedIntegrationAsset(SITE_SEO.main, path);
      expect(res).not.toBeNull();
      expect(res.status).toBe(200);
      const ct = res.headers.get('content-type') || '';
      if (path.endsWith('.json') || path.includes('oauth')) {
        expect(ct).toMatch(/application\/(json|[\w+-]+json)/);
      }
      if (path === '/auth.md') expect(ct).toContain('text/markdown');
      if (path === '/.well-known/http-message-signatures-directory') {
        expect(ct).toContain('application/http-message-signatures-directory+json');
      }
    }
  });
});
