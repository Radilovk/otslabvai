/**
 * Portfolio hero — single image or crossfade carousel.
 * Centralizes display logic (replaces inline scripts + scattered applyHeroSettings).
 */

const DEFAULT_HERO_IMAGE = 'images/portfolio-hero.jpg';
const DEFAULT_INTERVAL_MS = 6000;

function heroImagePath(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw, typeof window !== 'undefined' ? window.location.href : 'https://example.com/');
    return u.pathname + u.search;
  } catch {
    return raw.split('#')[0];
  }
}

function slideId() {
  return `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** @typedef {{ id: string, image: string, title?: string, subtitle?: string }} HeroSlide */

/**
 * Normalize settings into a consistent hero config.
 * @param {object} settings
 */
export function normalizeHeroConfig(settings = {}) {
  const fallbackImage = String(settings.hero_image || DEFAULT_HERO_IMAGE).trim() || DEFAULT_HERO_IMAGE;
  const defaultTitle = settings.hero_title || 'Каталог добавки';
  const defaultSubtitle = settings.site_slogan || '';

  const rawSlides = Array.isArray(settings.hero_slides) ? settings.hero_slides : [];
  const slides = rawSlides
    .map((s, i) => ({
      id: String(s?.id || `legacy-${i}`),
      image: String(s?.image || '').trim(),
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
    slides: [{ id: slide?.id || 'single', image, title: slide?.title || defaultTitle, subtitle: slide?.subtitle || defaultSubtitle }],
    title: slide?.title || defaultTitle,
    subtitle: slide?.subtitle || defaultSubtitle,
    primaryImage: image
  };
}

/** First hero image URL for preload / early paint. */
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

function cacheHeroSrc(url) {
  try { localStorage.setItem('pf-hero-src', url); } catch { /* ignore */ }
}

function buildSlideEl(slide, { active = false, eager = false } = {}) {
  const img = document.createElement('img');
  img.src = slide.image;
  img.alt = '';
  img.dataset.heroSrc = slide.image;
  img.decoding = 'async';
  if (eager) {
    img.loading = 'eager';
    img.fetchPriority = 'high';
  } else {
    img.loading = 'lazy';
  }
  bindImageReady(img);

  const el = document.createElement('div');
  el.className = 'pf-hero-slide' + (active ? ' is-active' : '');
  el.dataset.slideId = slide.id;
  el.appendChild(img);
  return el;
}

let carouselController = null;

function destroyCarousel() {
  if (carouselController) {
    carouselController.destroy();
    carouselController = null;
  }
}

function updateHeroCopy(config, slideIndex = 0) {
  const slide = config.slides[slideIndex] || config.slides[0];
  const title = slide?.title || config.title;
  const subtitle = slide?.subtitle || config.subtitle;
  const inner = document.querySelector('.pf-hero-inner');
  const apply = () => {
    setTextIfChanged(document.getElementById('hero-title'), title);
    setTextIfChanged(document.getElementById('hero-subtitle'), subtitle);
  };
  if (!inner || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    apply();
    return;
  }
  inner.classList.add('pf-hero-copy--fade');
  window.setTimeout(() => {
    apply();
    inner.classList.remove('pf-hero-copy--fade');
  }, 220);
}

function renderSingleHero(media, config) {
  destroyCarousel();
  media.innerHTML = '';
  media.classList.remove('pf-hero-media--carousel');
  const slide = config.slides[0];
  const img = document.createElement('img');
  img.id = 'hero-image';
  img.alt = '';
  img.width = 1400;
  img.height = 666;
  img.loading = 'eager';
  img.decoding = 'sync';
  img.fetchPriority = 'high';
  img.src = slide.image;
  img.dataset.heroSrc = slide.image;
  bindImageReady(img);
  media.appendChild(img);
  cacheHeroSrc(slide.image);
  updateHeroCopy(config, 0);
}

function createCarouselController(media, config) {
  const slides = [...media.querySelectorAll('.pf-hero-slide')];
  let index = 0;
  let timer = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const interval = reducedMotion ? 0 : config.interval;

  function setActive(i) {
    slides.forEach((s, j) => s.classList.toggle('is-active', j === i));
    updateHeroCopy(config, i);
    cacheHeroSrc(config.slides[i]?.image || config.primaryImage);
  }

  function clearTimer() {
    if (timer) { clearTimeout(timer); timer = null; }
  }

  function schedule() {
    clearTimer();
    if (!interval || slides.length < 2) return;
    timer = setTimeout(() => goTo((index + 1) % slides.length), interval);
  }

  function goTo(i) {
    index = ((i % slides.length) + slides.length) % slides.length;
    setActive(index);
    schedule();
  }

  setActive(0);
  if (slides.length > 1 && interval) schedule();

  return { destroy: clearTimer };
}

function renderCarouselHero(hero, media, config) {
  destroyCarousel();
  media.innerHTML = '';
  media.classList.add('pf-hero-media--carousel');

  config.slides.forEach((slide, i) => {
    media.appendChild(buildSlideEl(slide, { active: i === 0, eager: i === 0 }));
  });

  carouselController = createCarouselController(media, config);
  cacheHeroSrc(config.primaryImage);
}

/**
 * Apply hero settings to the page (idempotent).
 * @param {object} settings
 */
export function applyHeroSettings(settings) {
  if (!settings) return;

  const hero = document.getElementById('pf-hero');
  const media = hero?.querySelector('.pf-hero-media');
  if (!hero || !media) return;

  const config = normalizeHeroConfig(settings);
  document.documentElement.setAttribute('data-pf-hero-mode', config.mode);

  const showCarousel = config.mode === 'carousel' && config.slides.length > 1;
  hero.classList.toggle('pf-hero--carousel', showCarousel);

  const hasCarouselDom = media.classList.contains('pf-hero-media--carousel')
    && media.querySelectorAll('.pf-hero-slide').length > 1;

  if (!showCarousel && hasCarouselDom) {
    const incomingCount = (Array.isArray(settings.hero_slides) ? settings.hero_slides : [])
      .filter((s) => s?.image?.trim()).length;
    if (incomingCount < 2) return;
  }

  if (showCarousel) {
    const currentKey = [...media.querySelectorAll('.pf-hero-slide img')].map((i) => heroImagePath(i.dataset.heroSrc)).join('|');
    const nextKey = config.slides.map((s) => heroImagePath(s.image)).join('|');
    if (currentKey !== nextKey) {
      renderCarouselHero(hero, media, config);
    } else {
      updateHeroCopy(config, 0);
    }
    return;
  }

  const img = document.getElementById('hero-image');
  const next = config.slides[0]?.image || DEFAULT_HERO_IMAGE;
  if (!img || heroImagePath(img.dataset.heroSrc) !== heroImagePath(next)) {
    renderSingleHero(media, config);
    return;
  }
  if (!img.dataset.heroSrc) img.dataset.heroSrc = next;
  updateHeroCopy(config, 0);
}

/** Create a blank slide for admin. */
export function createHeroSlide(image = '') {
  return { id: slideId(), image, title: '', subtitle: '' };
}

export { DEFAULT_HERO_IMAGE, DEFAULT_INTERVAL_MS, heroImagePath };
