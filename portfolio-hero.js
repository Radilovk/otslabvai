/** Hero banners from repo static assets (images/*). KV stores paths only. */

import { heroSrc } from './portfolio-hero-path.js';

export { heroSrc } from './portfolio-hero-path.js';

function pathsFromSettings(settings = {}) {
  const slides = (Array.isArray(settings.hero_slides) ? settings.hero_slides : [])
    .map((s) => heroSrc(s?.image))
    .filter(Boolean);
  if (slides.length) return slides;
  return [heroSrc(settings.hero_image)];
}

function imgPathname(img) {
  try {
    return new URL(img.src, location.origin).pathname;
  } catch {
    return '';
  }
}

function applyHeroText(settings) {
  const title = document.getElementById('hero-title');
  const subtitle = document.getElementById('hero-subtitle');
  if (title) title.textContent = settings.hero_title || 'Каталог добавки';
  if (subtitle) subtitle.textContent = settings.site_slogan || '';
}

let rotateTimer = null;

export function applyHeroSettings(settings) {
  const media = document.querySelector('#pf-hero .pf-hero-media');
  if (!media || !settings) return;

  const urls = pathsFromSettings(settings);
  const key = urls.join('|');
  if (media.dataset.heroKey === key && media.childElementCount) {
    applyHeroText(settings);
    return;
  }

  const multi = urls.length > 1;
  if (!multi && urls.length === 1) {
    const lone = media.querySelector('#hero-image');
    if (lone && media.childElementCount === 1 && imgPathname(lone) === urls[0]) {
      media.dataset.heroKey = key;
      document.getElementById('pf-hero')?.classList.remove('pf-hero--carousel');
      media.classList.remove('pf-hero-media--carousel');
      applyHeroText(settings);
      return;
    }
  }

  media.dataset.heroKey = key;
  if (rotateTimer) clearTimeout(rotateTimer);
  rotateTimer = null;

  document.getElementById('pf-hero')?.classList.toggle('pf-hero--carousel', multi);
  media.classList.toggle('pf-hero-media--carousel', multi);
  media.innerHTML = urls.map((src, i) => `
    <div class="pf-hero-slide${i === 0 ? ' is-active' : ''}">
      <img src="${src}" alt=""${i === 0 ? ' id="hero-image"' : ''} decoding="${i === 0 ? 'sync' : 'async'}" loading="${i === 0 ? 'eager' : 'lazy'}">
    </div>`).join('');

  media.querySelectorAll('img').forEach((img) => {
    img.addEventListener('load', () => img.classList.add('pf-hero-ready'), { once: true });
    if (img.complete) img.classList.add('pf-hero-ready');
  });

  applyHeroText(settings);

  if (!multi) return;
  const ms = Math.max(3000, Math.min(30000, Number(settings.hero_carousel_interval) || 6000));
  const slideEls = [...media.querySelectorAll('.pf-hero-slide')];
  let idx = 0;
  const tick = () => {
    slideEls[idx].classList.remove('is-active');
    idx = (idx + 1) % slideEls.length;
    slideEls[idx].classList.add('is-active');
    rotateTimer = setTimeout(tick, ms);
  };
  rotateTimer = setTimeout(tick, ms);
}

export function getHeroPreloadImage(settings) {
  return pathsFromSettings(settings)[0];
}
