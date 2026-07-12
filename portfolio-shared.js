import { API_URL } from './config.js';

export const CART_KEY = 'portfolioCart';

export const BRAND_NAME = 'BIOCODE';
export const BRAND_FULL = 'BIOCODE - Nutrition Science';
export const BRAND_SLOGAN = 'Протеини, витамини, аминокиселини';
export const BRAND_LOGO = 'images/biocode-logo.png';
export const BRAND_FAVICON = 'images/biocode-favicon.png';
export const BRAND_HERO_IMAGE = 'images/portfolio-hero.jpg';

const DEFAULT_FOOTER = {
  contact_email: 'office@biocode.com',
  contact_phone: '',
  copyright_text: '',
  social_facebook: '',
  social_instagram: '',
  social_youtube: '',
  columns: [
    {
      type: 'links',
      title: 'Каталог',
      links: [
        { text: 'Всички продукти', url: 'portfolio.html' },
        { text: 'Количка', url: 'portfolio-checkout.html' }
      ]
    },
    {
      type: 'links',
      title: 'Информация',
      links: [
        { text: 'Доставка', url: 'portfolio-shipping.html' },
        { text: 'Поверителност', url: 'portfolio-policy.html' },
        { text: 'Общи условия', url: 'portfolio-terms.html' }
      ]
    },
    {
      type: 'contact',
      title: 'Контакт',
      lines: ['Доставка до офис · наложен платеж']
    }
  ]
};

function resolveFooterSettings(settings) {
  const incoming = settings?.footer || {};
  return {
    ...DEFAULT_FOOTER,
    ...incoming,
    columns: incoming.columns?.length ? incoming.columns : DEFAULT_FOOTER.columns
  };
}

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
  document.getElementById('pf-fab-cart')?.classList.toggle('pf-visible', count > 0);
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
  const taglineEl = document.getElementById('site-tagline');
  const sloganEl = document.getElementById('site-slogan');
  if (nameEl && settings.site_name) {
    const parts = String(settings.site_name).split(' - ');
    nameEl.textContent = parts[0] || settings.site_name;
    if (taglineEl && parts[1]) taglineEl.textContent = parts[1];
  }
  if (sloganEl && settings.site_slogan) sloganEl.textContent = settings.site_slogan;

  const footerBrand = document.getElementById('footer-brand-name');
  if (footerBrand && settings.site_name) {
    footerBrand.textContent = String(settings.site_name).split(' - ')[0] || settings.site_name;
  }
}

export function applyHeroSettings(settings) {
  if (!settings) return;
  const img = document.getElementById('hero-image');
  if (img && settings.hero_image) {
    img.src = settings.hero_image;
  }
  const title = document.getElementById('hero-title');
  if (title && settings.hero_title) title.textContent = settings.hero_title;
  const sub = document.getElementById('hero-subtitle');
  if (sub && settings.site_slogan) sub.textContent = settings.site_slogan;
}

const THEME_TOGGLE_SVG = `
  <svg class="pf-theme-sun" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
  <svg class="pf-theme-moon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

export function initPortfolioTheme() {
  const btn = document.getElementById('pf-theme-toggle');
  if (!btn) return;

  const applyMetaTheme = (theme) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#0a1628' : '#0f2540';
  };

  const setTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
    btn.setAttribute('aria-label', theme === 'dark' ? 'Светла тема' : 'Тъмна тема');
    applyMetaTheme(theme);
  };

  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });

  applyMetaTheme(document.documentElement.getAttribute('data-theme') || 'light');
}

function renderFooterColumns(footer, siteName) {
  const columns = footer?.columns || [];
  return columns.map((col) => {
    if (col.type === 'contact') {
      const email = footer.contact_email || col.lines?.[0] || '';
      const phone = footer.contact_phone || '';
      const extra = (col.lines || []).slice(phone ? 0 : 1);
      return `<div class="pf-footer-col">
        <h4>${escapeHtml(col.title || 'Контакт')}</h4>
        <ul class="pf-footer-contact">
          ${email ? `<li><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></li>` : ''}
          ${phone ? `<li><a href="tel:${escapeHtml(phone.replace(/\s/g, ''))}">${escapeHtml(phone)}</a></li>` : ''}
          ${extra.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
        </ul>
      </div>`;
    }
    if (col.type === 'links' && Array.isArray(col.links)) {
      const links = col.links.map((link) =>
        `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.text)}</a></li>`
      ).join('');
      return `<div class="pf-footer-col"><h4>${escapeHtml(col.title || '')}</h4><ul>${links}</ul></div>`;
    }
    return '';
  }).join('');
}

function renderFooterSocial(footer) {
  const items = [
    { key: 'social_facebook', label: 'Facebook', icon: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>' },
    { key: 'social_instagram', label: 'Instagram', icon: '<rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>' },
    { key: 'social_youtube', label: 'YouTube', icon: '<path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>' }
  ];
  const links = items
    .filter((item) => footer?.[item.key])
    .map((item) => `<a href="${escapeHtml(footer[item.key])}" class="pf-footer-social-link" target="_blank" rel="noopener noreferrer" aria-label="${item.label}"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${item.icon}</svg></a>`)
    .join('');
  return links ? `<div class="pf-footer-social">${links}</div>` : '';
}

export function renderFooter(settings = null) {
  const year = new Date().getFullYear();
  const siteName = settings?.site_name ? String(settings.site_name).split(' - ')[0] : BRAND_NAME;
  const siteSlogan = settings?.site_slogan || 'Nutrition Science';
  const footer = resolveFooterSettings(settings);
  const copyright = footer.copyright_text
    || `© ${year} ${siteName} · Всички права запазени.`;

  return `
    <footer class="pf-footer">
      <div class="pf-footer-grid">
        <div class="pf-footer-brand-col">
          <a href="portfolio.html" class="pf-footer-brand">
            <img src="${BRAND_LOGO}" alt="" class="pf-footer-logo" width="40" height="40" loading="lazy" decoding="async">
            <div>
              <strong id="footer-brand-name">${escapeHtml(siteName)}</strong>
              <span>${escapeHtml(siteSlogan)}</span>
              <span class="pf-footer-tagline">Оригинални добавки · доставка до офис</span>
            </div>
          </a>
        </div>
        ${renderFooterColumns(footer, siteName)}
      </div>
      <div class="pf-footer-bottom">
        <p class="pf-footer-copy">${escapeHtml(copyright)}</p>
        ${renderFooterSocial(footer)}
      </div>
    </footer>`;
}

export function renderHeader(active = 'catalog') {
  const count = getCartCount();
  return `
    <div class="pf-scroll-progress" id="pf-scroll-progress" aria-hidden="true"></div>
    <header class="pf-header">
      <div class="pf-header-inner">
        <a href="portfolio.html" class="pf-logo" aria-label="${BRAND_FULL} – начало">
          <img src="${BRAND_LOGO}" alt="" class="pf-logo-img" width="46" height="46" decoding="async">
          <div class="pf-logo-text-wrap">
            <span class="pf-logo-text" id="site-name">${BRAND_NAME}</span>
            <span class="pf-logo-tagline" id="site-tagline">Nutrition Science</span>
            <span class="pf-logo-slogan" id="site-slogan">${BRAND_SLOGAN}</span>
          </div>
        </a>
        <nav class="pf-nav" aria-label="Основна навигация">
          <a href="portfolio.html" class="pf-nav-link ${active === 'catalog' ? 'active' : ''}">Каталог</a>
        </nav>
        <div class="pf-header-actions">
          <button type="button" class="pf-theme-toggle" id="pf-theme-toggle" aria-label="Тъмна тема">${THEME_TOGGLE_SVG}</button>
          <a href="portfolio-checkout.html" class="pf-cart-btn" aria-label="Количка${count > 0 ? `, ${count} артикула` : ''}">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <span class="pf-cart-btn-label">Количка</span>
            <span class="pf-cart-badge" data-pf-cart-count ${count === 0 ? 'style="display:none"' : ''}>${count}</span>
          </a>
        </div>
      </div>
    </header>`;
}

export function renderFloatingCartFab() {
  const count = getCartCount();
  return `
    <a href="portfolio-checkout.html" class="pf-floating-btn pf-fab-cart ${count > 0 ? 'pf-visible' : ''}" id="pf-fab-cart" aria-label="Количка${count > 0 ? `, ${count} артикула` : ''}">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
      <span class="pf-fab-badge" data-pf-cart-count ${count === 0 ? 'style="display:none"' : ''}>${count}</span>
    </a>`;
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
  const settings = await loadSiteSettings({ settingsOnly });
  if (headerSlot) headerSlot.innerHTML = renderHeader(active);
  if (footerSlot) footerSlot.innerHTML = renderFooter(settings);
  if (showMobileBar && mobileBarSlot) mobileBarSlot.innerHTML = renderFloatingCartFab();
  applySiteSettings(settings);
  initPortfolioTheme();
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
