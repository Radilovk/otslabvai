import { API_URL } from './config.js';

const CART_KEY = 'portfolioCart';

const DOM = {
  root: document.getElementById('product-root'),
  cartCount: document.getElementById('cart-count'),
  toastContainer: document.getElementById('toast-container')
};

let product = null;
let selectedPack = '';
let selectedVariant = null;

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCart() {
  return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function updateCartCount() {
  const count = getCart().reduce((s, i) => s + i.quantity, 0);
  if (DOM.cartCount) DOM.cartCount.textContent = count;
}

function showToast(msg, type = 'info') {
  if (!DOM.toastContainer) return;
  const el = document.createElement('div');
  el.className = `pf-toast ${type}`;
  el.textContent = msg;
  DOM.toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

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
    <a href="portfolio.html" class="pf-back-link" style="max-width:1100px;margin:1rem auto 0;display:flex;padding:0 1.25rem;">← Назад към каталога</a>
    <div class="pf-product-layout">
      <div class="pf-product-gallery">
        <img id="product-image" src="${escapeHtml(img)}" alt="${escapeHtml(product.name)}">
        ${product.label ? `<p style="margin-top:1rem;"><a href="${escapeHtml(product.label)}" target="_blank" rel="noopener">Виж етикет / състав</a></p>` : ''}
      </div>
      <div class="pf-product-info">
        <div class="pf-product-brand">${escapeHtml(product.brand)}</div>
        <h1>${escapeHtml(product.name)}</h1>
        <p style="color:var(--pf-text-muted);font-size:0.9rem;">${escapeHtml(product.category)}</p>
        <div class="pf-product-price" id="price-display">${price} €</div>

        ${hasPacks ? `
        <div class="pf-variant-group">
          <label>Разфасовка</label>
          <div class="pf-variant-options" id="pack-options">
            ${packs.map((p) => `
              <button type="button" class="pf-variant-btn ${p === selectedPack ? 'active' : ''}" data-pack="${escapeHtml(p)}">${escapeHtml(p)}</button>
            `).join('')}
          </div>
        </div>` : ''}

        ${hasOptions ? `
        <div class="pf-variant-group">
          <label>Вкус / опция</label>
          <div class="pf-variant-options" id="option-options">
            ${options.map((v) => `
              <button type="button" class="pf-variant-btn ${v.sku_id === selectedVariant?.sku_id ? 'active' : ''}"
                data-sku="${escapeHtml(v.sku_id)}" ${!v.available ? 'disabled' : ''}>
                ${escapeHtml(v.option || 'Стандарт')}
              </button>
            `).join('')}
          </div>
        </div>` : ''}

        <button type="button" class="pf-add-btn" id="add-to-cart" ${!selectedVariant?.available ? 'disabled' : ''}>
          ${selectedVariant?.available ? 'Добави в количката' : 'Изчерпан'}
        </button>

        ${product.description ? `<div class="pf-description">${product.description}</div>` : ''}
      </div>
    </div>`;

  bindVariantEvents();
}

function bindVariantEvents() {
  document.querySelectorAll('#pack-options .pf-variant-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedPack = btn.dataset.pack;
      const options = getOptionsForPack(selectedPack);
      selectedVariant = options.find((v) => v.available) || options[0];
      render();
    });
  });

  document.querySelectorAll('#option-options .pf-variant-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const sku = btn.dataset.sku;
      selectedVariant = product.variants.find((v) => v.sku_id === sku);
      render();
    });
  });

  document.getElementById('add-to-cart')?.addEventListener('click', addToCart);
}

function addToCart() {
  if (!selectedVariant || !selectedVariant.available) {
    showToast('Този вариант не е наличен.', 'error');
    return;
  }

  const v = selectedVariant;
  const cart = getCart();
  const label = [product.name, v.pack, v.option].filter(Boolean).join(' – ');
  const id = v.sku_id;

  const idx = cart.findIndex((i) => i.sku_id === id);
  if (idx > -1) {
    cart[idx].quantity++;
  } else {
    cart.push({
      sku_id: id,
      barcode: v.barcode,
      id,
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
  updateCartCount();
  showToast('Добавено в количката!', 'success');
}

async function loadProduct() {
  const params = new URLSearchParams(window.location.search);
  const groupId = params.get('group_id');
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

updateCartCount();
loadProduct();
