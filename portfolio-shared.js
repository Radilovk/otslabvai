import { API_URL } from './config.js';

export const CART_KEY = 'portfolioCart';

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

export async function loadSiteSettings() {
  try {
    const { ensureBootstrap, getCachedSettings } = await import('./portfolio-cache.js');
    await ensureBootstrap();
    return getCachedSettings();
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
  if (settings.site_name) document.title = document.title.replace(/^Portfolio/, settings.site_name);
}

export function renderHeader(active = 'catalog') {
  const count = getCartCount();
  return `
    <header class="pf-header">
      <div class="pf-header-inner">
        <a href="portfolio.html" class="pf-logo" aria-label="Начало">
          <div class="pf-logo-icon" aria-hidden="true">P</div>
          <div class="pf-logo-text-wrap">
            <span class="pf-logo-text" id="site-name">Portfolio</span>
            <span class="pf-logo-slogan" id="site-slogan">Хранителни добавки</span>
          </div>
        </a>
        <nav class="pf-nav" aria-label="Основна навигация">
          <a href="portfolio.html" class="pf-nav-link ${active === 'catalog' ? 'active' : ''}">Каталог</a>
        </nav>
        <a href="portfolio-checkout.html" class="pf-cart-btn" aria-label="Количка">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span class="pf-cart-btn-label">Количка</span>
          <span class="pf-cart-badge" data-pf-cart-count ${count === 0 ? 'style="display:none"' : ''}>${count}</span>
        </a>
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
  return `
    <footer class="pf-footer">
      <div class="pf-footer-inner">
        <p>© ${new Date().getFullYear()} Portfolio · Хранителни добавки</p>
        <div class="pf-footer-links">
          <a href="policy.html" target="_blank">Поверителност</a>
          <a href="shipping.html" target="_blank">Доставка</a>
          <a href="terms.html" target="_blank">Условия</a>
        </div>
      </div>
    </footer>`;
}

export async function initPortfolioPage({ active = 'catalog', showMobileBar = false } = {}) {
  const headerSlot = document.getElementById('pf-header-slot');
  const footerSlot = document.getElementById('pf-footer-slot');
  const mobileBarSlot = document.getElementById('pf-mobile-cart-slot');
  if (headerSlot) headerSlot.innerHTML = renderHeader(active);
  if (footerSlot) footerSlot.innerHTML = renderFooter();
  if (showMobileBar && mobileBarSlot) mobileBarSlot.innerHTML = renderMobileCartBar();
  const settings = await loadSiteSettings();
  applySiteSettings(settings);
  updateCartBadges();
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
