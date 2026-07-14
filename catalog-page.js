import { API_URL } from './config.js';
import { findCategory, isCatalogOnly, sortByOrder } from './product-visibility.js';
import { rewriteAllProductImages } from './life-img.js';

const SITES = {
  main: {
    contentFile: 'page_content.json',
    dirtyCookie: 'page_dirty',
    homePage: 'index.html',
    productPage: 'product.html',
    cartKey: 'cart',
    defaultBrand: 'ДА ОТСЛАБНА'
  },
  life: {
    contentFile: 'life_page_content.json',
    dirtyCookie: 'life_dirty',
    homePage: 'life.html',
    productPage: 'life-product.html',
    cartKey: 'lifeCart',
    defaultBrand: 'Life Protocols',
    rewriteImages: true
  }
};

let navDropdownOutsideClickAttached = false;

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function priceHtml(d) {
  const variants = (d.variants || []).filter((v) => v.available !== false && typeof v.price === 'number');
  const sale = d.sale_price;
  const onSale = typeof sale === 'number' && sale > 0 && sale < Number(d.price) && !variants.length;
  if (!onSale && variants.length > 1) {
    const min = Math.min(...variants.map((v) => v.price));
    const max = Math.max(...variants.map((v) => v.price));
    return min < max ? `<span class="price-from">от</span> ${min.toFixed(2)} €` : `${min.toFixed(2)} €`;
  }
  if (!onSale && variants.length === 1) return `${variants[0].price.toFixed(2)} €`;
  if (onSale) {
    return `<span class="price-original">${Number(d.price).toFixed(2)} €</span><span class="price-sale">${sale.toFixed(2)} €</span>`;
  }
  return typeof d.price === 'number' ? `${d.price.toFixed(2)} €` : '';
}

function cardHtml(product, productPage, siteKey) {
  const d = product.public_data;
  if (!d) return '';
  const tag = d.tagline || (d.description ? String(d.description).split('\n')[0].slice(0, 120) : '');
  const price = priceHtml(d);

  if (siteKey === 'life') {
    return `<a href="${productPage}?id=${encodeURIComponent(product.product_id)}" class="life-catalog-card">
      <div class="life-catalog-image">${d.image_url ? `<img src="${esc(d.image_url)}" alt="${esc(d.name)}" loading="lazy" decoding="async">` : '<div class="life-catalog-no-image" aria-hidden="true"></div>'}</div>
      <div class="life-catalog-body">
        ${d.brand ? `<span class="life-catalog-brand">${esc(d.brand)}</span>` : ''}
        <h3 class="life-catalog-title">${esc(d.name)}</h3>
        ${tag ? `<p class="life-catalog-tagline">${esc(tag)}</p>` : ''}
        <div class="life-catalog-price">${price}</div>
      </div>
    </a>`;
  }

  return `<a href="${productPage}?id=${encodeURIComponent(product.product_id)}" class="catalog-card">
    <div class="catalog-image">${d.image_url ? `<img src="${esc(d.image_url)}" alt="${esc(d.name)}" loading="lazy">` : ''}</div>
    <div class="catalog-body">
      ${d.brand ? `<span class="catalog-brand">${esc(d.brand)}</span>` : ''}
      <h3 class="catalog-title">${esc(d.name)}</h3>
      ${tag ? `<p class="catalog-tagline">${esc(tag)}</p>` : ''}
      <div class="catalog-price">${price}</div>
    </div>
  </a>`;
}

function initNavDropdowns() {
  document.querySelectorAll('.nav-item.has-dropdown').forEach((parent) => {
    const toggle = parent.querySelector('.nav-dropdown-toggle');
    const menu = parent.querySelector('.nav-dropdown-menu');
    if (!toggle || !menu) return;

    parent.addEventListener('mouseenter', () => {
      if (window.innerWidth > 992) {
        menu.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
    parent.addEventListener('mouseleave', () => {
      if (window.innerWidth > 992) {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains('open');
      document.querySelectorAll('.nav-item.has-dropdown .nav-dropdown-menu.open').forEach((m) => {
        m.classList.remove('open');
        const t = m.previousElementSibling;
        if (t) t.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        menu.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  if (!navDropdownOutsideClickAttached) {
    navDropdownOutsideClickAttached = true;
    document.addEventListener('click', () => {
      document.querySelectorAll('.nav-item.has-dropdown .nav-dropdown-menu.open').forEach((menu) => {
        menu.classList.remove('open');
        const toggle = menu.previousElementSibling;
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }
}

function initMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav-links');
  const overlay = document.querySelector('.nav-overlay');
  if (!toggle || !nav || !overlay) return;
  const close = () => {
    toggle.classList.remove('active');
    nav.classList.remove('active');
    overlay.classList.remove('active');
    document.body.classList.remove('nav-open');
  };
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    nav.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.classList.toggle('nav-open');
  });
  overlay.addEventListener('click', close);
  nav.addEventListener('click', (e) => {
    if (e.target.closest('.nav-dropdown-toggle')) return;
    if (e.target.closest('a, button')) close();
  });
}

function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  const toggle = () => btn.classList.toggle('visible', window.scrollY > 400);
  window.addEventListener('scroll', toggle, { passive: true });
  toggle();
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function renderLifeChrome(data, cfg) {
  const { settings, navigation, footer, page_content: pageContent } = data;

  const brandName = document.getElementById('header-brand-name');
  const brandSlogan = document.getElementById('header-brand-slogan');
  if (brandName && settings?.site_name) brandName.textContent = settings.site_name;
  if (brandSlogan) {
    brandSlogan.textContent = settings?.site_slogan || '';
    brandSlogan.style.display = settings?.site_slogan ? 'block' : 'none';
  }

  const navLinks = document.getElementById('main-nav-links');
  if (navLinks) {
    const categories = (pageContent || []).filter((c) => c.type === 'product_category' && !c.is_hidden && c.title);
    let html = '';
    if (categories.length) {
      const items = categories.map((c) => {
        const anchor = c.id || c.component_id;
        return `<li role="none"><a href="${cfg.homePage}#${esc(anchor)}" role="menuitem">${esc(c.title)}</a></li>`;
      }).join('');
      html += `<li class="nav-item has-dropdown">` +
        `<button class="nav-dropdown-toggle" aria-expanded="false" aria-haspopup="true">Категории` +
        `<svg class="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>` +
        `</button><ul class="nav-dropdown-menu" role="menu">${items}</ul></li>`;
    }
    (navigation || []).filter((item) => !item.link?.startsWith('#')).forEach((item) => {
      html += `<li><a href="${esc(item.link)}">${esc(item.text)}</a></li>`;
    });
    const cartLi = navLinks.querySelector('.cart-link-mobile');
    navLinks.innerHTML = html;
    if (cartLi) navLinks.appendChild(cartLi);
    initNavDropdowns();
  }

  const grid = document.getElementById('footer-grid-container');
  const copy = document.getElementById('footer-copyright-container');
  if (grid && footer?.columns?.length) {
    grid.innerHTML = footer.columns.map((col) => {
      if (col.type === 'logo') {
        const logo = settings?.logo_url || 'images/life-icons/logo.png';
        return `<div class="footer-column"><a href="${cfg.homePage}" class="logo-container footer-logo-container">` +
          `<img src="${esc(logo)}" alt="${esc(settings?.site_name || 'Life Protocols')}" id="footer-logo-img">` +
          `<div><span class="brand-name">${esc(settings?.site_name || '')}</span>` +
          `${settings?.site_slogan ? `<span class="brand-slogan">${esc(settings.site_slogan)}</span>` : ''}</div></a></div>`;
      }
      if (col.type === 'links') {
        const links = (col.links || []).map((l) => `<li><a href="${esc(l.url)}">${esc(l.text)}</a></li>`).join('');
        return `<div class="footer-column"><h4>${esc(col.title)}</h4><ul>${links}</ul></div>`;
      }
      return '';
    }).join('');
  }
  if (copy) {
    copy.innerHTML = `<span>${esc(footer?.copyright_text || settings?.site_name || cfg.defaultBrand)}</span>`;
  }
}

async function run(siteKey) {
  const cfg = SITES[siteKey];
  if (!cfg) return;

  const params = new URLSearchParams(location.search);
  const categoryId = params.get('category') || params.get('id') || '';
  const componentId = params.get('component') || '';
  const grid = document.getElementById('category-grid');
  const titleEl = document.getElementById('category-title');
  const descEl = document.getElementById('category-description');
  const backEl = document.getElementById('category-back-link');
  const countEl = document.getElementById('category-count');
  const emptyClass = siteKey === 'life' ? 'life-category-empty' : 'catalog-empty';

  initMenu();
  initBackToTop();

  const cartKey = cfg.cartKey;
  const count = JSON.parse(localStorage.getItem(cartKey) || '[]').reduce((n, i) => n + i.quantity, 0);
  const cartCountEl = document.getElementById('cart-count');
  const cartCountMenuEl = document.getElementById('cart-count-menu');
  if (cartCountEl) cartCountEl.textContent = count;
  if (cartCountMenuEl) cartCountMenuEl.textContent = count;

  if (!grid) return;

  if (!categoryId && !componentId) {
    grid.innerHTML = `<p class="${emptyClass}">Липсва категория. <a href="${cfg.homePage}">Начало</a></p>`;
    return;
  }

  try {
    const dirty = document.cookie.split(';').some((c) => c.trim() === `${cfg.dirtyCookie}=1`);
    if (dirty) document.cookie = `${cfg.dirtyCookie}=; Max-Age=0; path=/`;
    const res = await fetch(`${API_URL}/${cfg.contentFile}`, { cache: dirty ? 'no-store' : 'default' });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (cfg.rewriteImages) rewriteAllProductImages(data.page_content);
    if (siteKey === 'life') renderLifeChrome(data, cfg);

    const cat = findCategory(data.page_content, categoryId, componentId);
    if (!cat) {
      grid.innerHTML = `<p class="${emptyClass}">Категорията не е намерена. <a href="${cfg.homePage}">Начало</a></p>`;
      return;
    }

    document.title = `${cat.title || categoryId} - ${data.settings?.site_name || cfg.defaultBrand}`;
    if (titleEl) titleEl.textContent = cat.title || categoryId;
    if (descEl) descEl.textContent = cat.description || '';
    const backHref = cat.id ? `${cfg.homePage}#${cat.id}` : cfg.homePage;
    if (backEl) backEl.href = backHref;

    const products = sortByOrder(cat.products).filter(isCatalogOnly);
    if (!products.length) {
      grid.innerHTML = `<p class="${emptyClass}">Няма допълнителни продукти. Превключете продукти на „каталог“ от админ панела.</p>`;
      return;
    }

    if (countEl) {
      countEl.hidden = false;
      countEl.textContent = `${products.length} ${products.length === 1 ? 'продукт' : 'продукта'} в каталога`;
    }
    grid.innerHTML = products.map((p) => cardHtml(p, cfg.productPage, siteKey)).join('');
  } catch (e) {
    console.error(e);
    grid.innerHTML = `<p class="${emptyClass}">Грешка при зареждане. <a href="${cfg.homePage}">Начало</a></p>`;
  }
}

run(document.body.dataset.site || 'main');
