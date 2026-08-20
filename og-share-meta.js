/**
 * Open Graph / share preview helpers — high-res product images + HTML meta injection.
 * Works in browser and Cloudflare Worker (no DOM).
 */

export const OG_IMAGE_WIDTH = 1200;

const BLOCKED_IMAGE_HOSTS = new Set(['fitness1.bg', 'www.fitness1.bg']);
const PROXY_BASE = 'https://wsrv.nl/?url=';

export function escapeHtmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/** Absolute URL from path or passthrough for http(s). */
export function absoluteUrl(pathOrUrl, origin = '') {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = origin || 'https://example.com';
  try {
    return new URL(raw, base).href;
  } catch {
    return raw;
  }
}

/**
 * High-quality image URL for link previews.
 * Proxies blocked fitness1.bg hosts via wsrv.nl at 1200px width.
 */
export function resolveOgImageUrl(url, width = OG_IMAGE_WIDTH, origin = '') {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:')) return '';

  try {
    const parsed = new URL(raw, origin || 'https://example.com');
    if (!BLOCKED_IMAGE_HOSTS.has(parsed.hostname)) {
      return parsed.href;
    }
    const stripped = parsed.host + parsed.pathname + parsed.search;
    return `${PROXY_BASE}${encodeURIComponent(stripped)}&w=${width}&fit=inside&q=90`;
  } catch {
    return raw;
  }
}

/**
 * Replace or append a meta tag in static HTML <head>.
 */
export function upsertMetaTag(html, { attr, name, content }) {
  if (!content) return html;
  const escaped = escapeHtmlAttr(content);
  const safeName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<meta[^>]*\\s${attr}=["']${safeName}["'][^>]*>`, 'i');
  const tag = `<meta ${attr}="${name}" content="${escaped}">`;
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

/**
 * Inject product Open Graph + Twitter meta into HTML (for crawlers / first paint).
 */
export function injectProductOgMeta(html, { title, description, image, url }) {
  let out = html;
  if (title) {
    out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtmlAttr(title)}</title>`);
    out = upsertMetaTag(out, { attr: 'property', name: 'og:title', content: title });
    out = upsertMetaTag(out, { attr: 'name', name: 'twitter:title', content: title });
  }
  if (description) {
    out = upsertMetaTag(out, { attr: 'name', name: 'description', content: description });
    out = upsertMetaTag(out, { attr: 'property', name: 'og:description', content: description });
    out = upsertMetaTag(out, { attr: 'name', name: 'twitter:description', content: description });
  }
  if (image) {
    out = upsertMetaTag(out, { attr: 'property', name: 'og:image', content: image });
    out = upsertMetaTag(out, { attr: 'property', name: 'og:image:width', content: String(OG_IMAGE_WIDTH) });
    out = upsertMetaTag(out, { attr: 'name', name: 'twitter:card', content: 'summary_large_image' });
    out = upsertMetaTag(out, { attr: 'name', name: 'twitter:image', content: image });
  }
  if (url) {
    out = upsertMetaTag(out, { attr: 'property', name: 'og:url', content: url });
  }
  return out;
}
