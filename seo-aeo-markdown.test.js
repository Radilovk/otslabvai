import {
  estimateMarkdownTokens,
  htmlToAgentMarkdown,
  wantsMarkdownResponse,
} from './seo-aeo-markdown.js';

describe('seo-aeo-markdown', () => {
  test('wantsMarkdownResponse detects Accept: text/markdown', () => {
    expect(wantsMarkdownResponse(new Request('https://life-protocols.com/', {
      headers: { Accept: 'text/markdown' },
    }))).toBe(true);
    expect(wantsMarkdownResponse(new Request('https://life-protocols.com/', {
      headers: { Accept: 'text/html' },
    }))).toBe(false);
  });

  test('htmlToAgentMarkdown emits frontmatter and body', () => {
    const html = `<!doctype html><html><head>
<title>Life Protocols - Test</title>
<meta name="description" content="Anti-aging storefront">
<script type="application/ld+json">{"@type":"OnlineStore"}</script>
</head><body><h1>Life Protocols</h1><p>Longevity products.</p></body></html>`;
    const md = htmlToAgentMarkdown(html, { canonical: 'https://life-protocols.com/' });
    expect(md).toContain('title: Life Protocols - Test');
    expect(md).toContain('# Life Protocols');
    expect(md).toContain('Longevity products.');
    expect(md).toContain('```json');
    expect(md).toContain('OnlineStore');
  });

  test('estimateMarkdownTokens returns positive integer', () => {
    expect(estimateMarkdownTokens('hello world')).toBeGreaterThan(0);
  });
});
