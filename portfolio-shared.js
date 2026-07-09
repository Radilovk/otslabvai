import { API_URL } from './config.js';

export const CART_KEY = 'portfolioCart';
export const WISHLIST_KEY = 'portfolioWishlist';

export const BRAND_NAME = 'BIOCODE';
export const BRAND_FULL = 'BIOCODE - Nutrition Science';
export const BRAND_SLOGAN = 'Научно обосновани хранителни добавки';
export const BRAND_LOGO = 'images/biocode-logo.png';

/** Stroke-based icon set (24x24, currentColor) — used instead of emoji everywhere. */
const ICON_PATHS = {
  card: '<rect x="1.5" y="4.5" width="21" height="15" rx="2.5"/><path d="M1.5 9.5h21"/><path d="M5 15h4"/>',
  truck: '<path d="M1.5 6.5h11v10h-11z"/><path d="M12.5 10h4.5l4 3.5v3h-8.5z"/><circle cx="6" cy="18.5" r="2"/><circle cx="17.5" cy="18.5" r="2"/>',
  shieldCheck: '<path d="M12 2 4 5v6c0 5 3.4 8.6 8 11 4.6-2.4 8-6 8-11V5z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  box: '<path d="M12 2.5 22 8v8l-10 5.5L2 16V8z"/><path d="M2 8l10 5.5L22 8"/><path d="M12 13.5V22"/>',
  undo: '<path d="M4 8h10.5a5.5 5.5 0 0 1 0 11H10"/><path d="M8 4 4 8l4 4"/>',
  lock: '<rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5"/>',
  pin: '<path d="M12 21.5S5 14.8 5 9.8a7 7 0 0 1 14 0c0 5-7 11.7-7 11.7z"/><circle cx="12" cy="9.5" r="2.5"/>',
  check: '<path d="M4 12.5 9.5 18 20 6"/>',
  checkCircle: '<circle cx="12" cy="12" r="9.5"/><path d="m7.5 12.5 3 3 6-6.5"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="8.5" y="2" width="7" height="4" rx="1.2"/><path d="M8.5 11h7M8.5 15h7"/>',
  menu: '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  arrowRight: '<path d="M4 12h16"/><path d="m13 5 7 7-7 7"/>',
  map: '<path d="M9 3 3 5.5v15L9 18l6 2.5 6-2.5v-15L15 5.5 9 3z"/><path d="M9 3v15M15 5.5v15"/>'
};

export function icon(name, { size = 18, className = '', strokeWidth = 2 } = {}) {
  const paths = ICON_PATHS[name];
  if (!paths) return '';
  const cls = className ? ` ${className}` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="pf-icon${cls}" aria-hidden="true">${paths}</svg>`;
}

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getCart() {
  return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
}

export function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function getCartCount() {
  return getCart().reduce((s, i) => s + i.quantity, 0);
}

export function getCartSubtotal() {
  return getCart().reduce((s, i) => s + i.price * i.quantity, 0);
}

export function updateCartBadges() {
  const count = getCartCount();
  document.querySelectorAll('[data-pf-cart-count]').forEach((el) => {
    el.textContent = count;
    el.style.display = count > 0 ? '' : 'none';
  });
  document.querySelectorAll('[data-pf-cart-subtotal]').forEach((el) => {
    const subtotal = getCartSubtotal();
    el.textContent = `${subtotal.toFixed(2)} €`;
    el.closest('.pf-mobile-cart-bar')?.classList.toggle('pf-visible', count > 0);
  });
}

export function getWishlist() {
  try {
    return JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]');
  } catch {
    return [];
  }
}

export function isWishlisted(groupId) {
  return getWishlist().includes(String(groupId));
}

export function toggleWishlist(groupId) {
  const id = String(groupId);
  const list = getWishlist();
  const idx = list.indexOf(id);
  if (idx > -1) list.splice(idx, 1);
  else list.push(id);
  try {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
  } catch { /* quota */ }
  return list.includes(id);
}

export function showToast(message, type = 'info', containerId = 'toast-container') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const el = document.createElement('div');
  el.className = `pf-toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('pf-toast-out');
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

export function formatPrice(amount) {
  return `${Number(amount).toFixed(2)} €`;
}

export async function loadSiteSettings({ settingsOnly = false } = {}) {
  try {
    const cache = await import('./portfolio-cache.js');
    if (settingsOnly) {
      return await cache.ensureSettings();
    }
    await cache.ensureBootstrap();
    return cache.getCachedSettings();
  } catch {
    try {
      const res = await fetch(`${API_URL}/portfolio/settings`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}

export function applySiteSettings(settings) {
  if (!settings) return;
  const nameEl = document.getElementById('site-name');
  const sloganEl = document.getElementById('site-slogan');
  if (nameEl && settings.site_name) nameEl.textContent = settings.site_name;
  if (sloganEl && settings.site_slogan) sloganEl.textContent = settings.site_slogan;
  if (settings.site_name) {
    document.title = document.title
      .replace(/^Portfolio/, settings.site_name)
      .replace(/^BIOCODE/, settings.site_name.split(' - ')[0] || settings.site_name);
  }
}

export function renderHeader(active = 'catalog') {
  const count = getCartCount();
  return `
    <div class="pf-scroll-progress" id="pf-scroll-progress" aria-hidden="true"></div>
    <header class="pf-header">
      <div class="pf-header-inner">
        <a href="portfolio.html" class="pf-logo" aria-label="${BRAND_FULL} – начало">
          <img src="${BRAND_LOGO}" alt="" class="pf-logo-img" width="44" height="44" decoding="async">
          <div class="pf-logo-text-wrap">
            <span class="pf-logo-text" id="site-name">${BRAND_FULL}</span>
            <span class="pf-logo-slogan" id="site-slogan">${BRAND_SLOGAN}</span>
          </div>
        </a>
        <nav class="pf-nav" aria-label="Основна навигация">
          <a href="portfolio.html" class="pf-nav-link ${active === 'catalog' ? 'active' : ''}">Каталог</a>
        </nav>
        <div class="pf-header-actions">
          <a href="portfolio-checkout.html" class="pf-cart-btn" aria-label="Количка${count > 0 ? `, ${count} артикула` : ''}">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <span class="pf-cart-btn-label">Количка</span>
            <span class="pf-cart-badge" data-pf-cart-count ${count === 0 ? 'style="display:none"' : ''}>${count}</span>
          </a>
        </div>
      </div>
    </header>`;
}

export function renderMobileCartBar() {
  const count = getCartCount();
  const subtotal = getCartSubtotal();
  return `
    <div class="pf-mobile-cart-bar ${count > 0 ? 'pf-visible' : ''}" id="pf-mobile-cart-bar">
      <div class="pf-mobile-cart-bar-inner">
        <div class="pf-mobile-cart-info">
          <span class="pf-mobile-cart-count">${count} арт.</span>
          <strong data-pf-cart-subtotal>${subtotal.toFixed(2)} €</strong>
        </div>
        <a href="portfolio-checkout.html" class="pf-btn pf-btn-primary">Към количката</a>
      </div>
    </div>`;
}

export function renderFooter() {
  const year = new Date().getFullYear();
  return `
    <footer class="pf-footer">
      <div class="pf-footer-inner">
        <div class="pf-footer-brand">
          <img src="${BRAND_LOGO}" alt="" class="pf-footer-logo" width="36" height="36" loading="lazy" decoding="async">
          <div>
            <strong id="footer-brand-name">${BRAND_NAME}</strong>
            <span>Nutrition Science · доставка до офис</span>
          </div>
        </div>
        <div class="pf-footer-links">
          <a href="portfolio-policy.html">Поверителност</a>
          <a href="portfolio-shipping.html">Доставка</a>
          <a href="portfolio-terms.html">Условия</a>
        </div>
        <p class="pf-footer-copy">© ${year} ${BRAND_NAME} · Всички права запазени</p>
      </div>
    </footer>`;
}

function initScrollEffects() {
  const header = document.querySelector('.pf-header');
  const progressBar = document.getElementById('pf-scroll-progress');
  const scrollTopBtn = document.createElement('button');
  scrollTopBtn.type = 'button';
  scrollTopBtn.className = 'pf-scroll-top';
  scrollTopBtn.id = 'pf-scroll-top';
  scrollTopBtn.setAttribute('aria-label', 'Нагоре');
  scrollTopBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(scrollTopBtn);

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      if (progressBar && docH > 0) {
        progressBar.style.transform = `scaleX(${Math.min(1, y / docH)})`;
      }
      header?.classList.toggle('pf-header--scrolled', y > 8);
      scrollTopBtn.classList.toggle('pf-visible', y > 500);
      ticking = false;
    });
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

export async function initPortfolioPage({
  active = 'catalog',
  showMobileBar = false,
  settingsOnly = false
} = {}) {
  const headerSlot = document.getElementById('pf-header-slot');
  const footerSlot = document.getElementById('pf-footer-slot');
  const mobileBarSlot = document.getElementById('pf-mobile-cart-slot');
  if (headerSlot) headerSlot.innerHTML = renderHeader(active);
  if (footerSlot) footerSlot.innerHTML = renderFooter();
  if (showMobileBar && mobileBarSlot) mobileBarSlot.innerHTML = renderMobileCartBar();
  const settings = await loadSiteSettings({ settingsOnly });
  applySiteSettings(settings);
  updateCartBadges();
  initScrollEffects();
  return { settings };
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
