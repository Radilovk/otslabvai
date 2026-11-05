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
          { text: 'AI консултант', url: 'portfolio-advisor-quiz.html' },
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
  map: '<path d="M9 3 3 5.5v15L9 18l6 2.5 6-2.5v-15L15 5.5 9 3z"/><path d="M9 3v15M15 5.5v15"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>'
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

/** URL към страницата на продукта (с опционален SKU за избран вариант). */
export function buildPortfolioProductUrl(groupId, skuId) {
  if (!groupId) return 'portfolio.html';
  let url = `portfolio-product.html?group_id=${encodeURIComponent(groupId)}`;
  if (skuId) url += `&sku=${encodeURIComponent(skuId)}`;
  return url;
}

import { applyHeroSettings } from './portfolio-hero.js';

export { applyHeroSettings };

function setTextIfChanged(el, text) {
  if (el && text != null && el.textContent !== text) el.textContent = text;
}

export function applyBrandingFromSettings(settings) {
  if (!settings) return;
  applySiteSettings(settings);
  applyHeroSettings(settings);
}

export function applySiteSettings(settings) {
  if (!settings) return;
  const nameEl = document.getElementById('site-name');
  const taglineEl = document.getElementById('site-tagline');
  const sloganEl = document.getElementById('site-slogan');
  if (nameEl && settings.site_name) {
    const parts = String(settings.site_name).split(' - ');
    setTextIfChanged(nameEl, parts[0] || settings.site_name);
    if (taglineEl && parts[1]) setTextIfChanged(taglineEl, parts[1]);
  }
  if (sloganEl && settings.site_slogan) setTextIfChanged(sloganEl, settings.site_slogan);

  const footerBrand = document.getElementById('footer-brand-name');
  if (footerBrand && settings.site_name) {
    setTextIfChanged(footerBrand, String(settings.site_name).split(' - ')[0] || settings.site_name);
  }
}

const THEME_TOGGLE_SVG = `
  <svg class="pf-theme-sun" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
  <svg class="pf-theme-moon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

export function initPortfolioTheme() {
  const btn = document.getElementById('pf-theme-toggle');
  if (!btn) return;

  const applyMetaTheme = (theme) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#080f1a' : '#0f2540';
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
          <a href="portfolio-stacks.html" class="pf-nav-link ${active === 'stacks' ? 'active' : ''}">Пакети</a>
          <a href="portfolio-advisor-quiz.html" class="pf-nav-link ${active === 'advisor' ? 'active' : ''}">AI консултант</a>
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

const MENU_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
const CLOSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

/** Вторични страници в мобилното меню. */
const MENU_INFO_LINKS = [
  ['portfolio-shipping.html', 'Доставка'],
  ['portfolio-faq.html', 'Въпроси'],
  ['portfolio-terms.html', 'Общи условия'],
  ['portfolio-policy.html', 'Поверителност'],
];

/**
 * Мобилно меню (под 900px горното меню е скрито): бутон ☰ в хедъра → панел отдясно.
 * Линковете се вземат от .pf-nav — едно място за всички страници (и статичния хедър в portfolio.html).
 */
function initMobileMenu(headerSlot) {
  const actions = headerSlot?.querySelector('.pf-header-actions');
  const nav = headerSlot?.querySelector('.pf-nav');
  if (!actions || !nav || actions.querySelector('.pf-menu-btn')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pf-menu-btn';
  btn.setAttribute('aria-label', 'Меню');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'pf-mobile-menu');
  btn.innerHTML = MENU_ICON;
  actions.appendChild(btn);

  const here = (location.pathname.split('/').pop() || 'portfolio.html').toLowerCase();
  const isHere = (href) => {
    const file = String(href).split('?')[0].toLowerCase();
    return file === here || `portfolio-${here}` === file;
  };
  const mainLinks = [...nav.querySelectorAll('a')].map((a) => {
    const href = a.getAttribute('href') || '#';
    // Хедърът по подразбиране маркира „Каталог“ — на информационните страници това не важи.
    const onInfoPage = MENU_INFO_LINKS.some(([h]) => isHere(h));
    const active = isHere(href) || (!onInfoPage && a.classList.contains('active'));
    return `<a href="${escapeHtml(href)}" class="pf-menu-link${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''}>${escapeHtml(a.textContent.trim())}</a>`;
  }).join('');
  const hasPromo = !!document.querySelector('[data-pf-promo-open]');

  const overlay = document.createElement('div');
  overlay.className = 'pf-menu-overlay';
  overlay.hidden = true;
  const panel = document.createElement('nav');
  panel.id = 'pf-mobile-menu';
  panel.className = 'pf-menu';
  panel.setAttribute('aria-label', 'Меню');
  panel.hidden = true;
  panel.innerHTML = `
    <div class="pf-menu-head">
      <span class="pf-menu-title">Меню</span>
      <button type="button" class="pf-menu-close" aria-label="Затвори менюто">${CLOSE_ICON}</button>
    </div>
    <div class="pf-menu-main">${mainLinks}</div>
    <a href="portfolio-checkout.html" class="pf-menu-cart">
      <span>Количка</span>
      <span class="pf-menu-cart-count" data-pf-cart-count ${getCartCount() === 0 ? 'style="display:none"' : ''}>${getCartCount()}</span>
    </a>
    <div class="pf-menu-tools">
      ${hasPromo ? '<button type="button" class="pf-menu-tool" data-menu-promo>Промо код</button>' : ''}
      <button type="button" class="pf-menu-tool" data-menu-theme>Тъмна тема</button>
    </div>
    <div class="pf-menu-info">
      ${MENU_INFO_LINKS.map(([href, text]) => `<a href="${href}"${isHere(href) ? ' aria-current="page"' : ''}>${text}</a>`).join('')}
    </div>`;
  document.body.append(overlay, panel);

  const themeBtn = panel.querySelector('[data-menu-theme]');
  const syncTheme = () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    themeBtn.textContent = dark ? 'Светла тема' : 'Тъмна тема';
  };
  syncTheme();

  let lastFocus = null;
  const open = () => {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    panel.hidden = false;
    requestAnimationFrame(() => {
      overlay.classList.add('pf-open');
      panel.classList.add('pf-open');
    });
    btn.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('pf-menu-locked');
    panel.querySelector('.pf-menu-link, a')?.focus({ preventScroll: true });
  };
  const close = () => {
    overlay.classList.remove('pf-open');
    panel.classList.remove('pf-open');
    btn.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('pf-menu-locked');
    setTimeout(() => {
      if (!panel.classList.contains('pf-open')) { overlay.hidden = true; panel.hidden = true; }
    }, 260);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
  };

  btn.addEventListener('click', () => (panel.classList.contains('pf-open') ? close() : open()));
  overlay.addEventListener('click', close);
  panel.querySelector('.pf-menu-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('pf-open')) close();
  });
  // Линк към същата страница (напр. „Каталог“ от каталога) — само затваря.
  panel.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a && a.getAttribute('aria-current') === 'page') { e.preventDefault(); close(); }
  });
  themeBtn.addEventListener('click', () => {
    document.getElementById('pf-theme-toggle')?.click();
    syncTheme();
  });
  panel.querySelector('[data-menu-promo]')?.addEventListener('click', () => {
    close();
    document.querySelector('[data-pf-promo-open]:not([data-menu-promo])')?.click();
  });
  // Ако екранът се разшири до десктоп, менюто не остава отворено.
  window.matchMedia?.('(min-width: 900px)').addEventListener?.('change', (mq) => { if (mq.matches) close(); });
}

function setActiveNav(headerSlot, active) {
  headerSlot?.querySelectorAll('.pf-nav-link').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const isCatalog = active === 'catalog' && href.includes('portfolio.html') && !href.includes('advisor');
    const isAdvisor = active === 'advisor' && href.includes('advisor');
    const isCheckout = active === 'checkout' && href.includes('checkout');
    const isStacks = active === 'stacks' && href.includes('stacks');
    link.classList.toggle('active', isCatalog || isAdvisor || isCheckout || isStacks);
  });
}

export async function initPortfolioPage({
  active = 'catalog',
  showMobileBar = false,
  settingsOnly = false
} = {}) {
  const headerSlot = document.getElementById('pf-header-slot');
  const footerSlot = document.getElementById('pf-footer-slot');
  const mobileBarSlot = document.getElementById('pf-mobile-cart-slot');
  const cache = await import('./portfolio-cache.js');

  if (headerSlot?.querySelector('.pf-header')) {
    setActiveNav(headerSlot, active);
  } else if (headerSlot) {
    headerSlot.innerHTML = renderHeader(active);
  }
  if (showMobileBar && mobileBarSlot && !mobileBarSlot.querySelector('.pf-fab-cart')) {
    mobileBarSlot.innerHTML = renderFloatingCartFab();
  }
  initPortfolioTheme();
  initMobileMenu(headerSlot);
  updateCartBadges();
  initScrollEffects();

  await cache.hydrateLocalCache();
  const settings = await cache.refreshBranding();
  if (footerSlot && !footerSlot.querySelector('.pf-footer')) {
    footerSlot.innerHTML = renderFooter(settings);
  }
  applyBrandingFromSettings(settings);

  // Hero uses live KV branding from refreshBranding(); catalog sync must not override it.

  if (settingsOnly && !settings) {
    await cache.ensureSettings({ force: true });
    const fresh = cache.getCachedSettings();
    if (footerSlot && !footerSlot.querySelector('.pf-footer')) {
      footerSlot.innerHTML = renderFooter(fresh);
    }
    applyBrandingFromSettings(fresh);
    return { settings: fresh };
  }

  return { settings };
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
