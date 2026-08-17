/**
 * Portfolio hero — auto crossfade between banners (no UI controls).
 * Settings: hero_slides[] + hero_mode + hero_carousel_interval from KV via /c/now.
 */

import { resolveHeroImageUrl } from './hero-image-url.js';

const DEFAULT_HERO_IMAGE = 'images/portfolio-hero.jpg';
const DEFAULT_INTERVAL_MS = 6000;

function slideId() {
  return `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** @typedef {{ id: string, image: string, title?: string, subtitle?: string }} HeroSlide */

export function normalizeHeroConfig(settings = {}) {
  const fallbackImage = resolveHeroImageUrl(settings.hero_image || DEFAULT_HERO_IMAGE);
  const defaultTitle = settings.hero_title || 'Каталог добавки';
  const defaultSubtitle = settings.site_slogan || '';

  const rawSlides = Array.isArray(settings.hero_slides) ? settings.hero_slides : [];
  const slides = rawSlides
    .map((s, i) => ({
      id: String(s?.id || `legacy-${i}`),
      image: resolveHeroImageUrl(s?.image),
      title: String(s?.title || '').trim(),
      subtitle: String(s?.subtitle || '').trim()
    }))
    .filter((s) => s.image);

  const mode = settings.hero_mode === 'carousel' && slides.length > 1 ? 'carousel' : 'single';
  const interval = Math.max(3000, Math.min(30000, Number(settings.hero_carousel_interval) || DEFAULT_INTERVAL_MS));

  if (mode === 'carousel') {
    return {
      mode,
      interval,
      slides: slides.map((s) => ({
        ...s,
        title: s.title || defaultTitle,
        subtitle: s.subtitle || defaultSubtitle
      })),
      title: defaultTitle,
      subtitle: defaultSubtitle,
      primaryImage: slides[0]?.image || fallbackImage
    };
  }

  const image = slides[0]?.image || fallbackImage;
  const slide = slides[0];
  return {
    mode: 'single',
    interval,
    slides: [{
      id: slide?.id || 'single',
      image,
      title: slide?.title || defaultTitle,
      subtitle: slide?.subtitle || defaultSubtitle
    }],
    title: slide?.title || defaultTitle,
    subtitle: slide?.subtitle || defaultSubtitle,
    primaryImage: image
  };
}

export function getHeroPreloadImage(settings) {
  return normalizeHeroConfig(settings).primaryImage;
}

function setTextIfChanged(el, text) {
  if (el && text != null && el.textContent !== text) el.textContent = text;
}

function markImageReady(img) {
  img.classList.add('pf-hero-ready');
}

function bindImageReady(img) {
  if (!img) return;
  img.addEventListener('load', () => markImageReady(img), { once: true });
  if (img.complete && img.naturalWidth > 0) markImageReady(img);
}

function updateHeroCopy(config, slideIndex = 0) {
  const slide = config.slides[slideIndex] || config.slides[0];
  const title = slide?.title || config.title;
  const subtitle = slide?.subtitle || config.subtitle;
  setTextIfChanged(document.getElementById('hero-title'), title);
  setTextIfChanged(document.getElementById('hero-subtitle'), subtitle);
}

let carouselTimer = null;

function clearCarouselTimer() {
  if (carouselTimer) {
    clearTimeout(carouselTimer);
    carouselTimer = null;
  }
}

function startCarousel(media, config) {
  clearCarouselTimer();
  const slideEls = [...media.querySelectorAll('.pf-hero-slide')];
  if (slideEls.length < 2) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const interval = reducedMotion ? 0 : config.interval;
  if (!interval) return;

  let index = slideEls.findIndex((el) => el.classList.contains('is-active'));
  if (index < 0) index = 0;

  const tick = () => {
    slideEls[index].classList.remove('is-active');
    index = (index + 1) % slideEls.length;
    slideEls[index].classList.add('is-active');
    updateHeroCopy(config, index);
    carouselTimer = setTimeout(tick, interval);
  };
  carouselTimer = setTimeout(tick, interval);
}

function renderHero(media, config) {
  clearCarouselTimer();
  media.innerHTML = '';

  const isCarousel = config.mode === 'carousel' && config.slides.length > 1;
  media.classList.toggle('pf-hero-media--carousel', isCarousel);

  config.slides.forEach((slide, i) => {
    const img = document.createElement('img');
    img.src = slide.image;
    img.alt = '';
    img.decoding = i === 0 ? 'sync' : 'async';
    img.loading = i === 0 ? 'eager' : 'lazy';
    if (i === 0) {
      img.id = 'hero-image';
      img.fetchPriority = 'high';
    }
    bindImageReady(img);

    const el = document.createElement('div');
    el.className = 'pf-hero-slide' + (i === 0 ? ' is-active' : '');
    el.appendChild(img);
    media.appendChild(el);
  });

  updateHeroCopy(config, 0);
  if (isCarousel) startCarousel(media, config);
}

/**
 * Apply hero settings once (from live KV branding).
 * @param {object} settings
 */
export function applyHeroSettings(settings) {
  if (!settings) return;

  const hero = document.getElementById('pf-hero');
  const media = hero?.querySelector('.pf-hero-media');
  if (!hero || !media) return;

  const config = normalizeHeroConfig(settings);
  const slideKey = config.slides.map((s) => s.image).join('|');

  if (media.dataset.heroKey === slideKey && media.childElementCount > 0) {
    updateHeroCopy(config, 0);
    return;
  }

  media.dataset.heroKey = slideKey;
  hero.classList.toggle('pf-hero--carousel', config.mode === 'carousel' && config.slides.length > 1);
  document.documentElement.setAttribute('data-pf-hero-mode', config.mode);
  renderHero(media, config);
}

export function createHeroSlide(image = '') {
  return { id: slideId(), image, title: '', subtitle: '' };
}

export { DEFAULT_HERO_IMAGE, DEFAULT_INTERVAL_MS, resolveHeroImageUrl };
