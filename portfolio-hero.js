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

function createCarouselController(hero, media, config) {
  const slides = [...media.querySelectorAll('.pf-hero-slide')];
  const dotsWrap = hero.querySelector('.pf-hero-dots');
  const progress = hero.querySelector('.pf-hero-progress-bar');
  const prevBtn = hero.querySelector('.pf-hero-nav--prev');
  const nextBtn = hero.querySelector('.pf-hero-nav--next');
  let index = 0;
  let timer = null;
  let progressRaf = null;
  let progressStart = 0;
  let paused = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const interval = reducedMotion ? 0 : config.interval;

  const dots = slides.map((_, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pf-hero-dot';
    btn.setAttribute('aria-label', `Банер ${i + 1}`);
    btn.addEventListener('click', () => goTo(i, true));
    dotsWrap?.appendChild(btn);
    return btn;
  });

  function setActive(i) {
    slides.forEach((s, j) => s.classList.toggle('is-active', j === i));
    dots.forEach((d, j) => {
      d.classList.toggle('is-active', j === i);
      d.setAttribute('aria-current', j === i ? 'true' : 'false');
    });
    updateHeroCopy(config, i);
    cacheHeroSrc(config.slides[i]?.image || config.primaryImage);
  }

  function resetProgress() {
    if (!progress || !interval) return;
    progress.style.transition = 'none';
    progress.style.width = '0%';
    progress.offsetHeight; // reflow
    progress.style.transition = `width ${interval}ms linear`;
    progress.style.width = '100%';
    progressStart = performance.now();
  }

  function clearTimer() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (progressRaf) { cancelAnimationFrame(progressRaf); progressRaf = null; }
  }

  function schedule() {
    clearTimer();
    if (!interval || slides.length < 2 || paused) return;
    resetProgress();
    timer = setTimeout(() => goTo((index + 1) % slides.length), interval);
  }

  function goTo(i, userAction = false) {
    index = ((i % slides.length) + slides.length) % slides.length;
    setActive(index);
    if (userAction) schedule();
    else schedule();
  }

  function pause() {
    paused = true;
    clearTimer();
    if (progress) {
      const w = progress.getBoundingClientRect().width;
      const parent = progress.parentElement?.getBoundingClientRect().width || 1;
      progress.style.transition = 'none';
      progress.style.width = `${(w / parent) * 100}%`;
    }
  }

  function resume() {
    paused = false;
    schedule();
  }

  prevBtn?.addEventListener('click', () => goTo(index - 1, true));
  nextBtn?.addEventListener('click', () => goTo(index + 1, true));
  hero.addEventListener('mouseenter', pause);
  hero.addEventListener('mouseleave', resume);
  hero.addEventListener('focusin', pause);
  hero.addEventListener('focusout', (e) => {
    if (!hero.contains(e.relatedTarget)) resume();
  });

  let touchX = 0;
  hero.addEventListener('touchstart', (e) => { touchX = e.changedTouches[0]?.clientX || 0; }, { passive: true });
  hero.addEventListener('touchend', (e) => {
    const dx = (e.changedTouches[0]?.clientX || 0) - touchX;
    if (Math.abs(dx) > 48) goTo(dx < 0 ? index + 1 : index - 1, true);
  }, { passive: true });

  setActive(0);
  if (slides.length > 1 && interval) schedule();

  return {
    destroy() {
      clearTimer();
      prevBtn?.replaceWith(prevBtn.cloneNode(true));
      nextBtn?.replaceWith(nextBtn.cloneNode(true));
    }
  };
}

function renderCarouselHero(hero, media, config) {
  destroyCarousel();
  media.innerHTML = '';
  media.classList.add('pf-hero-media--carousel');

  config.slides.forEach((slide, i) => {
    media.appendChild(buildSlideEl(slide, { active: i === 0, eager: i === 0 }));
  });

  carouselController = createCarouselController(hero, media, config);
  cacheHeroSrc(config.primaryImage);
}

/**
 * Apply hero settings to the page (idempotent).
 * @param {object} settings
 */
export function applyHeroSettings(settings) {
  const hero = document.getElementById('pf-hero');
  const media = hero?.querySelector('.pf-hero-media');
  if (!hero || !media) return;

  const config = normalizeHeroConfig(settings);
  document.documentElement.setAttribute('data-pf-hero-mode', config.mode);

  const nav = hero.querySelector('.pf-hero-carousel-ui');
  const showCarouselUi = config.mode === 'carousel' && config.slides.length > 1;
  if (nav) nav.hidden = !showCarouselUi;
  hero.classList.toggle('pf-hero--carousel', showCarouselUi);

  if (config.mode === 'carousel' && config.slides.length > 1) {
    const currentKey = [...media.querySelectorAll('.pf-hero-slide img')].map((i) => heroImagePath(i.dataset.heroSrc)).join('|');
    const nextKey = config.slides.map((s) => heroImagePath(s.image)).join('|');
    if (currentKey !== nextKey) {
      if (nav) nav.querySelector('.pf-hero-dots').innerHTML = '';
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
