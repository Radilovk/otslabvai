/**
 * Markdown for Agents — Accept: text/markdown content negotiation.
 * @see https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/
 */

/** @param {Request} request */
export function wantsMarkdownResponse(request) {
  const accept = request.headers.get('Accept') || '';
  return /text\/markdown/i.test(accept);
}

function escapeYaml(value) {
  const s = String(value || '').replace(/\r?\n/g, ' ').trim();
  if (/[:#"']/.test(s)) return JSON.stringify(s);
  return s;
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(html) {
  return decodeEntities(String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function extractMeta(html, name) {
  const re = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`,
    'i',
  );
  const m = html.match(re);
  if (m) return decodeEntities(m[1]);
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`,
    'i',
  );
  const m2 = html.match(re2);
  return m2 ? decodeEntities(m2[1]) : '';
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]) : '';
}

function extractJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (raw) blocks.push(raw);
  }
  return blocks;
}

function convertInline(html) {
  let out = html;
  out = out.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
    const text = stripTags(label) || href;
    return `[${text}](${href})`;
  });
  out = out.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  out = out.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  out = out.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  out = out.replace(/<br\s*\/?>/gi, '\n');
  return out;
}

function convertBodyHtml(bodyHtml) {
  let work = bodyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');

  work = convertInline(work);

  const lines = [];
  const blockRe = /<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = blockRe.exec(work)) !== null) {
    const tag = m[1].toLowerCase();
    const text = stripTags(convertInline(m[2]));
    if (!text) continue;
    if (tag.startsWith('h')) {
      const level = Number(tag.slice(1));
      lines.push(`${'#'.repeat(level)} ${text}`, '');
    } else if (tag === 'li') {
      lines.push(`- ${text}`);
    } else {
      lines.push(text, '');
    }
  }

  if (!lines.length) {
    const fallback = stripTags(work);
    if (fallback) lines.push(fallback, '');
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Rough token estimate (chars / 4). */
export function estimateMarkdownTokens(text) {
  return Math.max(1, Math.ceil(String(text || '').length / 4));
}

/**
 * @param {string} html
 * @param {{ canonical?: string|null, siteName?: string }} [meta]
 */
export function htmlToAgentMarkdown(html, meta = {}) {
  const title = extractTitle(html) || meta.siteName || '';
  const description = extractMeta(html, 'description');
  const front = [];
  if (title) front.push(`title: ${escapeYaml(title)}`);
  if (description) front.push(`description: ${escapeYaml(description)}`);
  if (meta.canonical) front.push(`canonical: ${meta.canonical}`);

  let md = '';
  if (front.length) {
    md += `---\n${front.join('\n')}\n---\n\n`;
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  md += convertBodyHtml(bodyMatch ? bodyMatch[1] : html);

  const jsonLd = extractJsonLd(html);
  if (jsonLd.length) {
    md += `\n\n\`\`\`json\n${jsonLd.join('\n')}\n\`\`\`\n`;
  }

  return md.trim() + '\n';
}

/**
 * @param {string} markdown
 * @param {{ vary?: boolean, tokenCount?: number, originalHtml?: string }} [opts]
 */
export function markdownResponseHeaders(markdown, opts = {}) {
  const headers = {
    'content-type': 'text/markdown; charset=utf-8',
    'cache-control': 'public, max-age=300, stale-while-revalidate=60',
    'x-markdown-tokens': String(opts.tokenCount ?? estimateMarkdownTokens(markdown)),
  };
  if (opts.vary !== false) headers.vary = 'Accept';
  if (opts.originalHtml) {
    headers['x-original-tokens'] = String(estimateMarkdownTokens(opts.originalHtml));
  }
  return headers;
}
