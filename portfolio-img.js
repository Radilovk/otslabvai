/**
 * Бързи продуктови снимки за biocode-bg.com.
 *
 * Снимките на доставчиците (fitness1.bg, distro.silabg.com) са 1000×1000 JPEG, 45–95 KB всяка.
 * Карта на телефон е ~175px широка — тегли се ~25× повече от нужното.
 * Тук всяка външна снимка минава през wsrv.nl (image CDN с кеш, както в Life Protocols):
 * смалена до нужната ширина, в WebP, с srcset за 1x/2x екрани (~3–15 KB).
 * Ако CDN-ът не отговори — оригиналът; ако и той не — празно поле.
 */
import { resolveImageUrl } from './life-img.js';

export const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27300%27 height=%27300%27%3E%3Crect fill=%27%23eef2f0%27 width=%27300%27 height=%27300%27/%3E%3C/svg%3E";

/** Размери по място: ширините в srcset и `sizes` (CSS ширината на снимката). */
export const IMG_PRESETS = {
  thumb: { widths: [96, 192], sizes: '96px' },
  card: { widths: [240, 400], sizes: '(max-width: 640px) 45vw, 210px' },
  pick: { widths: [240, 400], sizes: '(max-width: 639px) 116px, 320px' },
  hero: { widths: [480, 800], sizes: '(max-width: 900px) 100vw, 50vw' },
};

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Резервен вариант при грешка: оригиналът, после празно поле. Глобален — за inline onerror. */
function installFallback() {
  if (typeof window === 'undefined' || window.pfImgFallback) return;
  window.pfImgFallback = (el) => {
    const orig = el.getAttribute('data-orig');
    el.removeAttribute('srcset');
    if (orig && el.getAttribute('src') !== orig && !el.dataset.triedOrig) {
      el.dataset.triedOrig = '1';
      el.src = orig;
      return;
    }
    el.onerror = null;
    el.src = PLACEHOLDER_IMG;
  };
}
installFallback();

/**
 * src + srcset за снимка в даден размер.
 * @param {string} url
 * @param {keyof typeof IMG_PRESETS} [preset]
 * @returns {{ src: string, srcset: string, sizes: string, orig: string }}
 */
export function optimizedImage(url, preset = 'card') {
  const orig = String(url || '').trim();
  const p = IMG_PRESETS[preset] || IMG_PRESETS.card;
  if (!orig || orig.startsWith('data:')) return { src: orig || PLACEHOLDER_IMG, srcset: '', sizes: '', orig: '' };
  const variants = p.widths.map((w) => [resolveImageUrl(orig, w), w]);
  // Собствен файл или SVG — без прокси, без srcset.
  if (variants[0][0] === orig) return { src: orig, srcset: '', sizes: '', orig: '' };
  return {
    src: variants[0][0],
    srcset: variants.map(([u, w]) => `${u} ${w}w`).join(', '),
    sizes: p.sizes,
    orig,
  };
}

/**
 * Готов <img> таг с бързата снимка.
 * @param {string} url
 * @param {{ preset?: keyof typeof IMG_PRESETS, alt?: string, cls?: string, eager?: boolean, id?: string }} [opts]
 * eager — първите видими снимки (над сгъвката): зареждат се веднага, с висок приоритет.
 */
export function productImgTag(url, opts = {}) {
  const { src, srcset, sizes, orig } = optimizedImage(url, opts.preset || 'card');
  const attrs = [
    opts.id ? `id="${esc(opts.id)}"` : '',
    opts.cls ? `class="${esc(opts.cls)}"` : '',
    `src="${esc(src)}"`,
    srcset ? `srcset="${esc(srcset)}" sizes="${esc(sizes)}"` : '',
    orig ? `data-orig="${esc(orig)}"` : '',
    `alt="${esc(opts.alt || '')}"`,
    opts.eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"',
    'decoding="async"',
    'referrerpolicy="no-referrer"',
    'onerror="pfImgFallback(this)"',
  ].filter(Boolean);
  return `<img ${attrs.join(' ')}>`;
}

/** Смяна на снимката в съществуващ <img> (галерия на продукта). */
export function setProductImg(el, url, preset = 'hero') {
  if (!el) return;
  const { src, srcset, sizes, orig } = optimizedImage(url, preset);
  delete el.dataset.triedOrig;
  if (srcset) {
    el.srcset = srcset;
    el.sizes = sizes;
  } else {
    el.removeAttribute('srcset');
  }
  if (orig) el.setAttribute('data-orig', orig);
  else el.removeAttribute('data-orig');
  el.src = src;
}
