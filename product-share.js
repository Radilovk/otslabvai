/**
 * Shared product link sharing — Web Share API with clipboard fallback.
 */

export const SHARE_ICON_PATH =
  '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>';

export function shareIconSvg({ size = 18, className = '', strokeWidth = 2 } = {}) {
  const cls = className ? ` ${className}` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="share-icon${cls}" aria-hidden="true">${SHARE_ICON_PATH}</svg>`;
}

/** Build absolute URL from a site-relative path or return href as-is. */
export function absoluteProductUrl(pathOrUrl, origin = typeof location !== 'undefined' ? location.origin : '') {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return origin || '';
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw, origin || 'https://example.com').href;
  } catch {
    return raw;
  }
}

export async function copyTextToClipboard(text) {
  const value = String(text || '');
  if (!value) return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      /* fall through */
    }
  }
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  textarea.remove();
  return ok;
}

/**
 * Share a product link via native share sheet or clipboard.
 * @returns {{ ok: boolean, method?: 'share'|'clipboard', cancelled?: boolean }}
 */
export async function shareProductLink({ url, title = '', text = '' } = {}) {
  const shareUrl = absoluteProductUrl(url);
  if (!shareUrl) return { ok: false };

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        url: shareUrl,
        title: title || undefined,
        text: text || undefined,
      });
      return { ok: true, method: 'share' };
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: false, cancelled: true };
    }
  }

  const copied = await copyTextToClipboard(shareUrl);
  return { ok: copied, method: copied ? 'clipboard' : undefined };
}

/** Update browser URL without reload (portfolio variant deep links). */
export function replaceProductUrl(path, title) {
  if (typeof history === 'undefined' || !path) return;
  try {
    const next = absoluteProductUrl(path);
    const current = absoluteProductUrl(location.pathname + location.search);
    if (next === current) return;
    history.replaceState(history.state, title || document.title, path);
  } catch {
    /* ignore */
  }
}

/**
 * Wire a share button to share/copy the product URL.
 * @param {HTMLElement} btn
 * @param {{ getUrl: () => string, getTitle?: () => string, getText?: () => string, onSuccess?: (result: object) => void, onError?: () => void }} opts
 */
export function bindProductShareButton(btn, opts) {
  if (!btn || typeof opts?.getUrl !== 'function') return;
  btn.addEventListener('click', async () => {
    const result = await shareProductLink({
      url: opts.getUrl(),
      title: opts.getTitle?.() || '',
      text: opts.getText?.() || '',
    });
    if (result.cancelled) return;
    if (result.ok) opts.onSuccess?.(result);
    else opts.onError?.();
  });
}
