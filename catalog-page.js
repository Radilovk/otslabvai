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

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cardHtml(product, productPage) {
  const d = product.public_data;
  if (!d) return '';
  const variants = (d.variants || []).filter((v) => v.available !== false && typeof v.price === 'number');
  const sale = d.sale_price;
  const onSale = typeof sale === 'number' && sale > 0 && sale < Number(d.price) && !variants.length;
  let price;
  if (!onSale && variants.length > 1) {
    const min = Math.min(...variants.map((v) => v.price));
    const max = Math.max(...variants.map((v) => v.price));
    price = min < max ? `<span class="price-from">от</span> ${min.toFixed(2)} €` : `${min.toFixed(2)} €`;
  } else if (!onSale && variants.length === 1) {
    price = `${variants[0].price.toFixed(2)} €`;
  } else if (onSale) {
    price = `<span class="price-original">${Number(d.price).toFixed(2)} €</span><span class="price-sale">${sale.toFixed(2)} €</span>`;
  } else {
    price = typeof d.price === 'number' ? `${d.price.toFixed(2)} €` : '';
  }
  const tag = d.tagline || (d.description ? String(d.description).split('\n')[0].slice(0, 120) : '');
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
    if (e.target.closest('a, button') && !e.target.closest('.nav-dropdown-toggle')) close();
  });
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

  initMenu();
  const cartKey = cfg.cartKey;
  const count = JSON.parse(localStorage.getItem(cartKey) || '[]').reduce((n, i) => n + i.quantity, 0);
  const cartCountEl = document.getElementById('cart-count');
  const cartCountMenuEl = document.getElementById('cart-count-menu');
  if (cartCountEl) cartCountEl.textContent = count;
  if (cartCountMenuEl) cartCountMenuEl.textContent = count;

  if (!grid) return;

  if (!categoryId && !componentId) {
    grid.innerHTML = `<p class="catalog-empty">Липсва категория. <a href="${cfg.homePage}">Начало</a></p>`;
    return;
  }

  try {
    const dirty = document.cookie.split(';').some((c) => c.trim() === `${cfg.dirtyCookie}=1`);
    if (dirty) document.cookie = `${cfg.dirtyCookie}=; Max-Age=0; path=/`;
    const res = await fetch(`${API_URL}/${cfg.contentFile}`, { cache: dirty ? 'no-store' : 'default' });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (cfg.rewriteImages) rewriteAllProductImages(data.page_content);

    const cat = findCategory(data.page_content, categoryId, componentId);
    if (!cat) {
      grid.innerHTML = `<p class="catalog-empty">Категорията не е намерена. <a href="${cfg.homePage}">Начало</a></p>`;
      return;
    }

    document.title = `${cat.title || categoryId} - ${data.settings?.site_name || cfg.defaultBrand}`;
    if (titleEl) titleEl.textContent = cat.title || categoryId;
    if (descEl) descEl.textContent = cat.description || '';
    if (backEl) backEl.href = cat.id ? `${cfg.homePage}#${cat.id}` : cfg.homePage;

    const products = sortByOrder(cat.products).filter(isCatalogOnly);
    if (!products.length) {
      grid.innerHTML = '<p class="catalog-empty">Няма допълнителни продукти. Превключете продукти на „каталог“ от админ панела.</p>';
      return;
    }
    grid.innerHTML = products.map((p) => cardHtml(p, cfg.productPage)).join('');
  } catch (e) {
    console.error(e);
    grid.innerHTML = `<p class="catalog-empty">Грешка при зареждане. <a href="${cfg.homePage}">Начало</a></p>`;
  }
}

run(document.body.dataset.site || 'main');
