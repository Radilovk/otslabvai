import { API_URL } from './config.js';
import {
  escapeHtml, getCart, saveCart, updateCartBadges, showToast, initPortfolioPage
} from './portfolio-shared.js';

const DOM = {
  root: document.getElementById('product-root'),
  toastContainer: document.getElementById('toast-container')
};

let product = null;
let selectedPack = '';
let selectedVariant = null;

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
}

function render() {
  if (!product) return;
  const packs = getPacks();
  const hasPacks = packs.length > 1 || (packs.length === 1 && packs[0]);
  const options = getOptionsForPack(selectedPack);
  const hasOptions = options.some((o) => o.option);
  const price = selectedVariant ? selectedVariant.retail_price.toFixed(2) : '—';
  const img = selectedVariant?.image || product.image;

  document.title = `${product.name} – Portfolio`;

  DOM.root.innerHTML = `
    <a href="portfolio.html" class="pf-back-link">← Назад към каталога</a>
    <div class="pf-product-grid">
      <div class="pf-gallery">
        <img id="product-image" src="${escapeHtml(img)}" alt="${escapeHtml(product.name)}">
        ${product.label ? `<p style="margin-top:1rem;"><a href="${escapeHtml(product.label)}" target="_blank" rel="noopener noreferrer" class="pf-btn pf-btn-outline" style="font-size:0.85rem;">Етикет / състав</a></p>` : ''}
      </div>
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

        <button type="button" class="pf-btn pf-btn-primary pf-btn-block" id="add-to-cart" ${!selectedVariant?.available ? 'disabled' : ''}>
          ${selectedVariant?.available ? 'Добави в количката' : 'Изчерпан'}
        </button>

        <div class="pf-description" id="description-block">${product.description || '<p style="color:var(--pf-muted)">Зареждане на описание...</p>'}</div>
      </div>
    </div>`;

  bindVariantEvents();
  if (!product.description) loadDescription();
}

function bindVariantEvents() {
  document.querySelectorAll('#pack-options .pf-variant-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedPack = btn.dataset.pack;
      const opts = getOptionsForPack(selectedPack);
      selectedVariant = opts.find((v) => v.available) || opts[0];
      render();
    });
  });
  document.querySelectorAll('#option-options .pf-variant-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      selectedVariant = product.variants.find((v) => v.sku_id === btn.dataset.sku);
      render();
    });
  });
  document.getElementById('add-to-cart')?.addEventListener('click', addToCart);
}

async function loadDescription() {
  try {
    const res = await fetch(`${API_URL}/portfolio/product/description?group_id=${encodeURIComponent(product.group_id)}`);
    const data = await res.json();
    const block = document.getElementById('description-block');
    if (block && data.description) block.innerHTML = data.description;
    else if (block) block.innerHTML = '<p style="color:var(--pf-muted)">Няма налично описание.</p>';
  } catch {
    const block = document.getElementById('description-block');
    if (block) block.innerHTML = '';
  }
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
  if (idx > -1) cart[idx].quantity++;
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
      quantity: 1,
      image: v.image || product.image
    });
  }
  saveCart(cart);
  updateCartBadges();
  showToast('Добавено в количката!', 'success');
}

async function loadProduct() {
  const groupId = new URLSearchParams(location.search).get('group_id');
  if (!groupId) {
    DOM.root.innerHTML = '<div class="pf-error">Липсва идентификатор на продукта.</div>';
    return;
  }
  try {
    const res = await fetch(`${API_URL}/portfolio/product?group_id=${encodeURIComponent(groupId)}`);
    const data = await res.json();
    if (!res.ok) {
      DOM.root.innerHTML = `<div class="pf-error">${escapeHtml(data.error || 'Продуктът не е намерен')}</div>`;
      return;
    }
    product = data;
    pickDefaultVariant();
    render();
  } catch {
    DOM.root.innerHTML = '<div class="pf-error">Грешка при зареждане.</div>';
  }
}

async function init() {
  await initPortfolioPage();
  updateCartBadges();
  await loadProduct();
}

init();
