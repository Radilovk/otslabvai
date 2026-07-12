import {
  escapeHtml, getCart, saveCart, updateCartBadges, showToast, initPortfolioPage, icon
} from './portfolio-shared.js';
import { getProductFromCache, getDescriptionFromCache, getCachedMeta } from './portfolio-cache.js';
import { filterIndex } from './portfolio-filter.js';

const DOM = {
  root: document.getElementById('product-root'),
  toastContainer: document.getElementById('toast-container')
};

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect fill='%23eef2f0' width='300' height='300'/%3E%3C/svg%3E";

let product = null;
let selectedPack = '';
let selectedVariant = null;
let selectedImage = '';
let quantity = 1;
let activeTab = 'description';

function getPacks() {
  return [...new Set(product.variants.map((v) => v.pack).filter(Boolean))];
}

function getOptionsForPack(pack) {
  return product.variants.filter((v) => v.pack === pack || (!pack && !v.pack));
}

function pickDefaultVariant() {
  const packs = getPacks();
  selectedPack = packs[0] || '';
  const options = getOptionsForPack(selectedPack);
  selectedVariant = options.find((v) => v.available) || options[0] || null;
  selectedImage = selectedVariant?.image || product.image;
}

function getGalleryImages() {
  const images = [product.image, ...product.variants.map((v) => v.image)]
    .filter(Boolean)
    .filter((img, idx, arr) => arr.indexOf(img) === idx);
  return images.length ? images : [PLACEHOLDER_IMG];
}

function renderBreadcrumb() {
  const topCat = product.category_path?.[0] || '';
  const restCat = (product.category_path || []).slice(1);
  return `
    <nav class="pf-breadcrumb" aria-label="Път в каталога">
      <a href="portfolio.html">Начало</a>
      ${topCat ? `<span>/</span><a href="portfolio.html?category=${encodeURIComponent(topCat)}">${escapeHtml(topCat)}</a>` : ''}
      ${restCat.map((c) => `<span>/</span><span>${escapeHtml(c)}</span>`).join('')}
      <span>/</span><span class="pf-breadcrumb-current">${escapeHtml(product.name)}</span>
    </nav>`;
}

function renderGallery() {
  const images = getGalleryImages();
  return `
    <div class="pf-gallery">
      <img id="product-image" src="${escapeHtml(selectedImage)}" alt="${escapeHtml(product.name)}" sizes="(max-width: 900px) 100vw, 50vw" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
      ${images.length > 1 ? `
      <div class="pf-gallery-thumbs">
        ${images.map((img) => `<button type="button" class="pf-gallery-thumb ${img === selectedImage ? 'active' : ''}" data-img="${escapeHtml(img)}"><img src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></button>`).join('')}
      </div>` : ''}
      ${product.label ? `<p class="pf-label-link"><a href="${escapeHtml(product.label)}" target="_blank" rel="noopener noreferrer" class="pf-btn pf-btn-outline">Етикет / състав</a></p>` : ''}
    </div>`;
}

function renderTabs() {
  const hasDescription = !!product.description;
  return `
    <div class="pf-tabs">
      <div class="pf-tab-list" role="tablist">
        <button type="button" class="pf-tab-btn ${activeTab === 'description' ? 'active' : ''}" data-tab="description" role="tab">Описание</button>
        <button type="button" class="pf-tab-btn ${activeTab === 'shipping' ? 'active' : ''}" data-tab="shipping" role="tab">Доставка и плащане</button>
      </div>
      <div class="pf-tab-panel ${activeTab === 'description' ? 'active' : ''}" data-panel="description" id="description-block">
        ${hasDescription ? product.description : '<p class="pf-muted-text">Зареждане на описание...</p>'}
      </div>
      <div class="pf-tab-panel ${activeTab === 'shipping' ? 'active' : ''}" data-panel="shipping">
        <ul class="pf-shipping-info">
          <li>${icon('truck')}<span>Доставка до офис на Speedy или Econt, или до личен адрес</span></li>
          <li>${icon('card')}<span>Плащане с наложен платеж – плащате при получаване</span></li>
          <li>${icon('box')}<span>Поръчката се преглежда преди изпращане към доставчик</span></li>
          <li>${icon('undo')}<span>Право на връщане в срок съгласно политиката ни</span></li>
        </ul>
      </div>
    </div>`;
}

function renderRelated() {
  const meta = getCachedMeta();
  const topCat = product.category_path?.[0];
  if (!meta?.index || !topCat) return '';
  const related = filterIndex(
    meta.index.filter((i) => i.category_top === topCat && i.group_id !== product.group_id),
    { sort: 'relevance' },
    meta
  ).slice(0, 4);
  if (!related.length) return '';
  return `
    <section class="pf-related">
      <h2>Още от „${escapeHtml(topCat)}"</h2>
      <div class="pf-grid pf-related-grid">
        ${related.map((item) => `
          <a href="portfolio-product.html?group_id=${encodeURIComponent(item.group_id)}" class="pf-card-link">
            <div class="pf-card-image">
              <img src="${escapeHtml(item.image || PLACEHOLDER_IMG)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" sizes="(max-width: 640px) 45vw, 160px" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
            </div>
            <div class="pf-card-body">
              <span class="pf-card-brand">${escapeHtml(item.brand)}</span>
              <h3 class="pf-card-title">${escapeHtml(item.name)}</h3>
              <div class="pf-card-price">${item.min_price.toFixed(2)} €</div>
            </div>
          </a>`).join('')}
      </div>
    </section>`;
}

function render() {
  if (!product) return;
  const packs = getPacks();
  const hasPacks = packs.length > 1 || (packs.length === 1 && packs[0]);
  const options = getOptionsForPack(selectedPack);
  const hasOptions = options.some((o) => o.option);
  const price = selectedVariant ? selectedVariant.retail_price.toFixed(2) : '—';
  const maxQty = selectedVariant?.available ? 99 : 1;

  document.title = `${product.name} – BIOCODE`;

  DOM.root.innerHTML = `
    ${renderBreadcrumb()}
    <div class="pf-product-grid">
      ${renderGallery()}
      <div class="pf-product-info">
        <div class="pf-product-brand">${escapeHtml(product.brand)}</div>
        <h1>${escapeHtml(product.name)}</h1>
        <p class="pf-product-cat">${escapeHtml(product.category)}</p>
        <div class="pf-product-price" id="price-display">${price} €</div>

        ${hasPacks ? `
        <div class="pf-variant-group">
          <label>Разфасовка</label>
          <div class="pf-variant-options" id="pack-options">
            ${packs.map((p) => `<button type="button" class="pf-variant-btn ${p === selectedPack ? 'active' : ''}" data-pack="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join('')}
          </div>
        </div>` : ''}

        ${hasOptions ? `
        <div class="pf-variant-group">
          <label>Вкус / опция</label>
          <div class="pf-variant-options" id="option-options">
            ${options.map((v) => `<button type="button" class="pf-variant-btn ${v.sku_id === selectedVariant?.sku_id ? 'active' : ''}" data-sku="${escapeHtml(v.sku_id)}" ${!v.available ? 'disabled' : ''}>${escapeHtml(v.option || 'Стандарт')}</button>`).join('')}
          </div>
        </div>` : ''}

        <div class="pf-buy-row">
          <div class="pf-qty-stepper" role="group" aria-label="Количество">
            <button type="button" id="qty-minus" aria-label="Намали">−</button>
            <input type="number" id="qty-input" value="${quantity}" min="1" max="${maxQty}" inputmode="numeric">
            <button type="button" id="qty-plus" aria-label="Увеличи">+</button>
          </div>
          <button type="button" class="pf-btn pf-btn-primary pf-btn-block pf-add-to-cart--inline" id="add-to-cart" ${!selectedVariant?.available ? 'disabled' : ''}>
            ${selectedVariant?.available ? 'Добави в количката' : 'Изчерпан'}
          </button>
        </div>

        <ul class="pf-trust-list">
          <li>${icon('card', { size: 16 })}<span>Наложен платеж</span></li>
          <li>${icon('truck', { size: 16 })}<span>До офис или адрес</span></li>
          <li>${icon('shieldCheck', { size: 16 })}<span>Оригинален продукт</span></li>
        </ul>

        ${renderTabs()}
      </div>
    </div>
    ${renderRelated()}`;

  bindPageEvents();
  syncProductFab();
  if (!product.description) loadDescription();
}

function syncProductFab() {
  const slot = document.getElementById('pf-product-buy-slot');
  if (!slot || !product) return;

  const available = !!selectedVariant?.available;
  if (!available) {
    slot.innerHTML = '';
    document.body.classList.remove('pf-product-has-fab');
    return;
  }

  slot.innerHTML = `
    <button type="button" class="pf-floating-btn pf-fab-action pf-fab-add pf-visible" id="add-to-cart-sticky">
      Добави в количката
    </button>`;

  document.body.classList.add('pf-product-has-fab');
  document.getElementById('add-to-cart-sticky')?.addEventListener('click', addToCart);
}

function bindPageEvents() {
  document.querySelectorAll('#pack-options .pf-variant-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedPack = btn.dataset.pack;
      const opts = getOptionsForPack(selectedPack);
      selectedVariant = opts.find((v) => v.available) || opts[0];
      selectedImage = selectedVariant?.image || product.image;
      quantity = 1;
      render();
    });
  });
  document.querySelectorAll('#option-options .pf-variant-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      selectedVariant = product.variants.find((v) => v.sku_id === btn.dataset.sku);
      selectedImage = selectedVariant?.image || product.image;
      quantity = 1;
      render();
    });
  });
  document.querySelectorAll('.pf-gallery-thumb').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedImage = btn.dataset.img;
      const img = document.getElementById('product-image');
      if (img) img.src = selectedImage;
      document.querySelectorAll('.pf-gallery-thumb').forEach((t) => t.classList.toggle('active', t === btn));
    });
  });
  document.querySelectorAll('.pf-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.pf-tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.pf-tab-panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === activeTab));
    });
  });
  document.getElementById('add-to-cart')?.addEventListener('click', addToCart);

  const qtyInput = document.getElementById('qty-input');
  const maxQty = selectedVariant?.available ? 99 : 1;
  document.getElementById('qty-minus')?.addEventListener('click', () => {
    quantity = Math.max(1, quantity - 1);
    if (qtyInput) qtyInput.value = quantity;
  });
  document.getElementById('qty-plus')?.addEventListener('click', () => {
    quantity = Math.min(maxQty, quantity + 1);
    if (qtyInput) qtyInput.value = quantity;
  });
  qtyInput?.addEventListener('change', () => {
    quantity = Math.min(maxQty, Math.max(1, parseInt(qtyInput.value, 10) || 1));
    qtyInput.value = quantity;
  });
}

async function loadDescription() {
  try {
    const data = await getDescriptionFromCache(product.group_id);
    const block = document.getElementById('description-block');
    if (block && data.description) {
      product.description = data.description;
      block.innerHTML = data.description;
      fixDescriptionImages(block);
    } else if (block) {
      block.innerHTML = '<p class="pf-muted-text">Няма налично описание.</p>';
    }
  } catch {
    const block = document.getElementById('description-block');
    if (block) block.innerHTML = '<p class="pf-muted-text">Няма налично описание.</p>';
  }
}

/** Strip fixed widths from API HTML so images scale on mobile */
function fixDescriptionImages(container) {
  container.querySelectorAll('img').forEach((img) => {
    img.removeAttribute('width');
    img.removeAttribute('height');
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.loading = 'lazy';
    img.decoding = 'async';
  });
  container.querySelectorAll('table').forEach((table) => {
    table.style.maxWidth = '100%';
    table.style.display = 'block';
    table.style.overflowX = 'auto';
  });
}

function addToCart() {
  if (!selectedVariant?.available) {
    showToast('Този вариант не е наличен.', 'error');
    return;
  }
  const v = selectedVariant;
  const label = [product.name, v.pack, v.option].filter(Boolean).join(' – ');
  const cart = getCart();
  const idx = cart.findIndex((i) => i.sku_id === v.sku_id);
  if (idx > -1) cart[idx].quantity += quantity;
  else {
    cart.push({
      sku_id: v.sku_id,
      barcode: v.barcode,
      id: v.sku_id,
      name: label,
      pack: v.pack,
      option: v.option,
      price: v.retail_price,
      b2b_price: v.b2b_price,
      quantity,
      image: v.image || product.image
    });
  }
  saveCart(cart);
  updateCartBadges();
  showToast(`Добавено в количката (${quantity} бр.)!`, 'success');
  quantity = 1;
}

async function loadProduct() {
  const groupId = new URLSearchParams(location.search).get('group_id');
  if (!groupId) {
    DOM.root.innerHTML = '<div class="pf-error">Липсва идентификатор на продукта.</div>';
    return;
  }
  try {
    const meta = getCachedMeta();
    const listed = meta?.index?.some((item) => item.group_id === groupId);
    if (meta?.index && !listed) {
      DOM.root.innerHTML = '<div class="pf-error">Продуктът не е наличен в момента.</div>';
      return;
    }
    product = await getProductFromCache(groupId);
    if (!product) {
      DOM.root.innerHTML = '<div class="pf-error">Продуктът не е намерен.</div>';
      return;
    }
    product.variants = (product.variants || []).filter((v) => v.available);
    if (!product.variants.length) {
      DOM.root.innerHTML = '<div class="pf-error">Продуктът не е наличен в момента.</div>';
      return;
    }
    pickDefaultVariant();
    render();
  } catch {
    DOM.root.innerHTML = '<div class="pf-error">Грешка при зареждане.</div>';
  }
}

async function init() {
  await initPortfolioPage({ showMobileBar: false, settingsOnly: false });
  document.body.classList.add('pf-body--product');
  updateCartBadges();
  await loadProduct();
}

init();
