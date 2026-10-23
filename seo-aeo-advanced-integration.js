/**
 * Agent Readiness Level 4/5 — OAuth, MCP, A2A, Agent Skills, Web Bot Auth, ARD.
 * Discovery metadata for the three storefront domains (read-heavy public APIs + admin OAuth).
 */

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=3600',
  'access-control-allow-origin': '*',
};

const AI_CATALOG_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=3600',
  'access-control-allow-origin': '*',
};

const MARKDOWN_HEADERS = {
  'content-type': 'text/markdown; charset=utf-8',
  'cache-control': 'public, max-age=3600',
};

const WEB_BOT_AUTH_HEADERS = {
  'content-type': 'application/http-message-signatures-directory+json',
  'cache-control': 'public, max-age=86400',
};

/** RFC 7638 JWK thumbprint for the published Web Bot Auth directory key (Ed25519). */
export const WEB_BOT_AUTH_KEY_ID = 'NFcWBst6DXG-N35nHdzMrioWntdzNZghQSkjHNMMSjw';

/** Base64url Ed25519 public key (no padding) — directory verification key. */
export const WEB_BOT_AUTH_PUBLIC_X = 'JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs';

/** @param {string} text @returns {Promise<string>} */
export async function sha256Digest(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

/**
 * @param {import('./seo-aeo-inject.js').SITE_SEO extends Record<string, infer S> ? S : never} site
 */
export function oauthAuthorizationServer(site) {
  const origin = site.origin;
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/admin.html`,
    token_endpoint: `${origin}/admin/session`,
    jwks_uri: `${origin}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'client_credentials'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    scopes_supported: ['catalog:read', 'storefront:read', 'content:read', 'admin:write'],
    code_challenge_methods_supported: ['S256'],
    agent_auth: {
      skill: `${origin}/auth.md`,
      register_uri: `${origin}/.well-known/agent-skills/index.json`,
      identity_types_supported: ['anonymous'],
      credential_types_supported: ['none'],
      claim_uri: `${origin}/auth.md#anonymous-flow`,
      anonymous: {
        credential_types_supported: ['none'],
        claim_uri: `${origin}/auth.md#anonymous-flow`,
      },
    },
  };
}

/**
 * @param {Parameters<typeof oauthAuthorizationServer>[0]} site
 */
export function oauthProtectedResource(site) {
  return {
    resource: site.origin,
    authorization_servers: [site.origin],
    bearer_methods_supported: ['header'],
    scopes_supported: ['catalog:read', 'storefront:read', 'content:read', 'admin:write'],
    resource_documentation: `${site.origin}/llms.txt`,
    resource_signing_alg_values_supported: ['RS256', 'ES256'],
  };
}

export function jwksDocument() {
  return {
    keys: [{
      kty: 'OKP',
      crv: 'Ed25519',
      kid: WEB_BOT_AUTH_KEY_ID,
      x: WEB_BOT_AUTH_PUBLIC_X,
      use: 'sig',
      alg: 'EdDSA',
    }],
  };
}

export function httpMessageSignaturesDirectory() {
  return {
    keys: [{
      kty: 'OKP',
      crv: 'Ed25519',
      kid: WEB_BOT_AUTH_KEY_ID,
      x: WEB_BOT_AUTH_PUBLIC_X,
      use: 'sig',
    }],
  };
}

/**
 * @param {Parameters<typeof oauthAuthorizationServer>[0]} site
 */
export function authMd(site) {
  return `# ${site.name} auth.md

You are an agent. This document describes how to register for **anonymous read-only** access to **${site.origin}** and which APIs require user consent.

Supported identity type: **anonymous**. Credential type: **none** (no \`Authorization\` header on public read routes).

## Machine-readable metadata

- Protected Resource Metadata: \`${site.origin}/.well-known/oauth-protected-resource\`
- Authorization Server (includes \`agent_auth\`): \`${site.origin}/.well-known/oauth-authorization-server\`
- Agent skills index (registration/discovery): \`${site.origin}/.well-known/agent-skills/index.json\`

## Step 1 — Register (anonymous discovery)

No account or API key is issued. Discover capabilities from the agent skills index:

\`\`\`http
GET /.well-known/agent-skills/index.json HTTP/1.1
Host: ${new URL(site.origin).host}
\`\`\`

Response (200): JSON skills index with \`sha256:\` digests. Use the linked \`SKILL.md\` for storefront tools.

## Step 2 — Use public read APIs (credential: none)

These endpoints are open to AI crawlers and agents (see \`robots.txt\` Content-Signal):

- \`GET /llms.txt\` — site map for LLMs
- \`GET /llms-full.txt\` — full product catalog (markdown)
- \`GET /.well-known/api-catalog\` — RFC 9727 linkset
- \`GET /c/now\` — catalog artifact pointers (main)
- \`GET /portfolio/bootstrap\` — storefront bootstrap JSON
- \`GET /products/{slug}\` — product detail pages

Send \`Accept: text/markdown\` on HTML URLs for agent-readable markdown.

\`\`\`http
GET /llms.txt HTTP/1.1
Host: ${new URL(site.origin).host}
\`\`\`

No request body. No authentication. Credential type supported: **none**.

## Protected admin & commerce APIs

Write/admin routes require a session from \`POST /admin/login\` or OAuth token per:

- \`/.well-known/oauth-protected-resource\`
- \`/.well-known/oauth-authorization-server\`

Scopes: \`catalog:read\`, \`storefront:read\`, \`content:read\`, \`admin:write\`.

Do not call checkout, admin, or advisor submit endpoints without explicit user consent in the browser.

## Anonymous flow {#anonymous-flow}

Agents may use **anonymous** identity for read-only catalog discovery:

1. Fetch this \`auth.md\` and \`/.well-known/agent-skills/index.json\`
2. Use public GET endpoints above (no registration POST required)
3. Do not call checkout, admin, or advisor submit endpoints without user consent

Contact: ${site.securityContact || 'office@biocode.com'}
`;
}

/**
 * @param {Parameters<typeof oauthAuthorizationServer>[0]} site
 */
export function agentSkillMarkdown(site) {
  return `# ${site.name} storefront agent skill

Use this skill when answering questions about products, shipping, or FAQs on **${site.origin}**.

## Discovery

- API catalog: \`${site.origin}/.well-known/api-catalog\`
- MCP card: \`${site.origin}/.well-known/mcp/server-card.json\`
- A2A card: \`${site.origin}/.well-known/agent-card.json\`
- llms.txt: \`${site.origin}/llms.txt\`

## Tools (HTTP)

| Action | Method | Path |
|--------|--------|------|
| Catalog snapshot | GET | /c/now |
| Product list | GET | /llms-full.txt |
| FAQ | GET | /faq.html (Accept: text/markdown) |
| Bootstrap | GET | /portfolio/bootstrap |

Respect \`Content-Signal: search=yes,ai-input=yes,ai-train=no\`.
`;
}

/**
 * @param {Parameters<typeof oauthAuthorizationServer>[0]} site
 */
export async function agentSkillsIndex(site) {
  const skillBody = agentSkillMarkdown(site);
  const skillPath = '/.well-known/agent-skills/storefront/SKILL.md';
  return {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [{
      name: `${site.siteId}-storefront`,
      type: 'skill-md',
      description: `${site.name} — public catalog, FAQ, and storefront discovery for AI agents (${site.origin}).`,
      url: skillPath,
      digest: await sha256Digest(skillBody),
    }],
  };
}

/**
 * @param {Parameters<typeof oauthAuthorizationServer>[0]} site
 */
export function mcpServerCard(site) {
  const tools = [
    { name: 'get_llms_index', description: 'Fetch llms.txt site map for agents.' },
    { name: 'get_catalog_snapshot', description: 'Fetch /c/now immutable catalog artifact hashes.' },
    { name: 'get_api_catalog', description: 'Fetch RFC 9727 api-catalog linkset JSON.' },
  ];
  if (site.siteId !== 'main') {
    tools.push({ name: 'get_storefront_bootstrap', description: 'Fetch /portfolio/bootstrap JSON.' });
  }
  return {
    name: `${site.siteId}-storefront-mcp`,
    title: site.name,
    version: '1.0.0',
    description: `${site.name} public read-only storefront discovery — maps to HTTP APIs documented in /.well-known/api-catalog.`,
    vendor: {
      name: site.name,
      url: site.origin,
    },
    endpoint: `${site.origin}/.well-known/openapi/catalog.json`,
    transport: 'http',
    protocolVersion: '2025-11-25',
    authentication: 'none',
    capabilities: {
      tools: true,
      prompts: false,
      resources: true,
      logging: false,
    },
    tools,
    links: {
      site: site.origin,
      apiCatalog: `${site.origin}/.well-known/api-catalog`,
      llms: `${site.origin}/llms.txt`,
    },
  };
}

/**
 * @param {Parameters<typeof oauthAuthorizationServer>[0]} site
 */
export function a2aAgentCard(site) {
  const advisorPath = site.siteId === 'life'
    ? '/life-protocol-quiz.html'
    : site.siteId === 'portfolio'
      ? '/portfolio-advisor-quiz.html'
      : '/main-advisor-quiz.html';

  return {
    protocolVersion: '1.0',
    name: site.name,
    description: `${site.description} Read-only A2A surface for catalog search, FAQ, and product discovery. Interactive checkout and admin flows require human consent.`,
    version: '1.0.0',
    documentationUrl: `${site.origin}/llms.txt`,
    provider: {
      organization: site.name,
      url: site.origin,
    },
    supportedInterfaces: [{
      url: `${site.origin}/a2a/v1`,
      protocolBinding: 'JSONRPC',
      protocolVersion: '1.0',
    }],
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false,
    },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/markdown', 'text/plain'],
    skills: [
      {
        id: 'search-catalog',
        name: 'Search product catalog',
        description: 'Search products and categories using llms.txt and public catalog APIs.',
        tags: ['catalog', 'search', 'products'],
        examples: ['Which fat burners do you sell?', 'List protein products under 50 EUR'],
        inputModes: ['text/plain'],
        outputModes: ['text/markdown'],
      },
      {
        id: 'get-faq',
        name: 'Answer storefront FAQ',
        description: 'Return FAQ answers about shipping, returns, and ordering.',
        tags: ['faq', 'support'],
        examples: ['What are your shipping options?', 'Do you ship nationwide in Bulgaria?'],
        inputModes: ['text/plain'],
        outputModes: ['text/markdown'],
      },
      {
        id: 'advisor-info',
        name: 'Personalized advisor quiz',
        description: `Explain the personalized advisor quiz at ${advisorPath} (user must complete quiz in browser).`,
        tags: ['advisor', 'quiz', 'personalization'],
        examples: ['How does the product advisor work?'],
        inputModes: ['text/plain'],
        outputModes: ['text/plain'],
      },
    ],
  };
}

/**
 * Agent Readiness Directory (ARD) — ai-catalog.json manifest.
 * @param {Parameters<typeof oauthAuthorizationServer>[0]} site
 */
export function aiCatalogManifest(site) {
  const hostId = new URL(site.origin).hostname.replace(/\./g, '-');
  return {
    specVersion: '1.0',
    host: {
      displayName: site.name,
      identifier: hostId,
    },
    entries: [
      {
        identifier: `urn:air:${hostId}:mcp:storefront`,
        displayName: `${site.name} MCP Server Card`,
        type: 'application/mcp-server-card+json',
        url: `${site.origin}/.well-known/mcp/server-card.json`,
        description: 'Public read-only storefront MCP tool metadata.',
        representativeQueries: [
          'List catalog discovery tools',
          'Fetch llms.txt site map',
          'Get API catalog linkset',
        ],
      },
      {
        identifier: `urn:air:${hostId}:a2a:storefront`,
        displayName: `${site.name} A2A Agent Card`,
        type: 'application/a2a-agent-card+json',
        url: `${site.origin}/.well-known/agent-card.json`,
        description: 'Agent-to-agent discovery for catalog search and FAQ.',
        representativeQueries: [
          'Discover agent skills for this shop',
          'Search product catalog via A2A',
        ],
      },
      {
        identifier: `urn:air:${hostId}:auth:authmd`,
        displayName: 'auth.md agent registration',
        type: 'text/markdown',
        url: `${site.origin}/auth.md`,
        description: 'Agent authentication and public vs protected API scopes.',
        representativeQueries: [
          'How do agents authenticate?',
          'Which APIs are public for crawlers?',
        ],
      },
      {
        identifier: `urn:air:${hostId}:api:catalog`,
        displayName: 'RFC 9727 API Catalog',
        type: 'application/linkset+json',
        url: `${site.origin}/.well-known/api-catalog`,
        description: 'Machine-readable HTTP API discovery linkset.',
        representativeQueries: [
          'List public HTTP APIs',
          'Find catalog snapshot endpoint',
        ],
      },
    ],
  };
}

/** Minimal A2A JSON-RPC response for discovery probes. */
export function a2aJsonRpcResponse(id, site) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result: {
      kind: 'message',
      message: {
        role: 'agent',
        parts: [{
          kind: 'text',
          text: `${site.name} A2A endpoint is read-only. Use GET ${site.origin}/llms.txt and /.well-known/api-catalog for catalog discovery. POST checkout/advisor endpoints require user consent in browser.`,
        }],
      },
    },
  };
}

/**
 * @param {Parameters<typeof oauthAuthorizationServer>[0]} site
 * @param {string} pathname
 */
export async function serveAdvancedIntegrationAsset(site, pathname) {
  if (pathname === '/.well-known/oauth-authorization-server') {
    return jsonResponse(oauthAuthorizationServer(site));
  }
  if (pathname === '/.well-known/oauth-protected-resource') {
    return jsonResponse(oauthProtectedResource(site));
  }
  if (pathname === '/.well-known/jwks.json') {
    return jsonResponse(jwksDocument());
  }
  if (pathname === '/.well-known/http-message-signatures-directory') {
    return new Response(JSON.stringify(httpMessageSignaturesDirectory(), null, 2), {
      headers: WEB_BOT_AUTH_HEADERS,
    });
  }
  if (pathname === '/auth.md') {
    return new Response(authMd(site), { headers: MARKDOWN_HEADERS });
  }
  if (pathname === '/.well-known/mcp/server-card.json') {
    return jsonResponse(mcpServerCard(site));
  }
  if (pathname === '/.well-known/agent-card.json') {
    return jsonResponse(a2aAgentCard(site));
  }
  if (pathname === '/.well-known/agent-skills/index.json') {
    return jsonResponse(await agentSkillsIndex(site));
  }
  if (pathname === '/.well-known/agent-skills/storefront/SKILL.md') {
    return new Response(agentSkillMarkdown(site), { headers: MARKDOWN_HEADERS });
  }
  if (pathname === '/.well-known/ai-catalog.json') {
    return new Response(JSON.stringify(aiCatalogManifest(site), null, 2), {
      headers: AI_CATALOG_HEADERS,
    });
  }
  return null;
}

function jsonResponse(obj) {
  return new Response(JSON.stringify(obj, null, 2), { headers: JSON_HEADERS });
}
