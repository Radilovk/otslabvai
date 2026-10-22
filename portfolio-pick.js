/**
 * pick.html?q=<добавка>&vegan=1&utm_source=nutriplan
 * Препоръка от NutriPlan / AIRIS идва само като търсеща дума; изборът (наличност
 * при доставчика, съвпадение, марж) е на сървъра — /portfolio/pick.
 */
import {
  escapeHtml, getCart, saveCart, updateCartBadges, showToast, initPortfolioPage,
  formatPrice, buildPortfolioProductUrl,
} from './portfolio-shared.js';
import { API_URL } from './config.js';
import { variantDisplayPrice, fetchPromoPrices } from './portfolio-promo-catalog.js';
import { loadActivePromo } from './portfolio-promo-ui.js';

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27300%27 height=%27300%27%3E%3Crect fill=%27%23eef2f0%27 width=%27300%27 height=%27300%27/%3E%3C/svg%3E";
const SOURCES = { nutriplan: 'NutriPlan', airis: 'AIRIS', emoeat: 'EmoEat' };

const params = new URLSearchParams(window.location.search);
const q = String(params.get('q') || '').trim().slice(0, 80);
const vegan = params.get('vegan') === '1';
const source = SOURCES[String(params.get('utm_source') || '').toLowerCase()] || '';

const DOM = {
  title: document.getElementById('pick-title'),
  sub: document.getElementById('pick-sub'),
  grid: document.getElementById('pick-grid'),
  more: document.getElementById('pick-more'),
  note: document.getElementById('pick-note'),
};

let items = [];

function catalogUrl() {
  return q ? `portfolio.html?q=${encodeURIComponent(q)}` : 'portfolio.html';
}

/** Вариантът с цената за активния промо код (както на продуктовата страница). */
const pricedVariant = (item) => variantDisplayPrice(item.pick_variant, loadActivePromo()) || item.pick_variant || {};

function renderCard(item, i) {
  const v = pricedVariant(item);
  const img = v.image || item.image || PLACEHOLDER_IMG;
  const pack = [v.pack, v.option].filter(Boolean).join(' · ');
  const url = buildPortfolioProductUrl(item.group_id, v.sku_id);
  return `
    <div class="pf-product-card pf-pick-card">
      <a href="${url}" class="pf-card-link">
        <div class="pf-card-image">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
        </div>
        <div class="pf-card-body">
          ${i === 0 ? '<span class="pf-pick-badge">Най-подходящ</span>' : ''}
          <span class="pf-card-brand">${escapeHtml(item.brand)}</span>
          <h2 class="pf-card-title">${escapeHtml(item.name)}${pack ? ` <span class="pf-card-packs">${escapeHtml(pack)}</span>` : ''}</h2>
          <div class="pf-card-price">${v.retail_price ? formatPrice(v.retail_price) : ''}</div>
        </div>
      </a>
      <div class="pf-pick-actions">
        <button type="button" class="pf-btn pf-btn-primary pf-btn-block" data-add="${i}">Добави в количката</button>
      </div>
    </div>`;
}

function addToCart(i) {
  const item = items[i];
  const v = item && pricedVariant(item);
  if (!v?.sku_id) return;
  const cart = getCart();
  const idx = cart.findIndex((c) => c.sku_id === v.sku_id);
  if (idx > -1) cart[idx].quantity += 1;
  else {
    cart.push({
      sku_id: v.sku_id,
      group_id: item.group_id,
      barcode: v.barcode,
      id: v.sku_id,
      name: [item.name, v.pack, v.option].filter(Boolean).join(' – '),
      pack: v.pack,
      option: v.option,
      price: v.retail_price,
      quantity: 1,
      image: v.image || item.image,
    });
  }
  saveCart(cart);
  updateCartBadges();
  showToast('Добавено в количката!', 'success');
}

function renderEmpty(message) {
  DOM.grid.innerHTML = `<div class="pf-empty" style="grid-column:1/-1"><p>${escapeHtml(message)}</p></div>`;
  DOM.more.hidden = false;
  DOM.more.innerHTML = `<a class="pf-btn pf-btn-primary" href="${catalogUrl()}">Търси в каталога</a>`;
}

async function load() {
  if (!q) {
    DOM.sub.textContent = '';
    renderEmpty('Няма зададена добавка.');
    return;
  }
  DOM.title.textContent = `Подбрано за: ${q}`;
  document.title = `${q} – BIOCODE Nutrition Science`;
  try {
    const res = await fetch(`${API_URL}/portfolio/pick?q=${encodeURIComponent(q)}&limit=3${vegan ? '&vegan=1' : ''}`);
    const data = res.ok ? await res.json() : null;
    items = Array.isArray(data?.items) ? data.items.filter((it) => it?.pick_variant) : [];
  } catch {
    items = [];
  }
  DOM.sub.textContent = source
    ? `Препоръка от вашия план в ${source}. Налични в момента продукти:`
    : 'Налични в момента продукти:';
  if (!items.length) {
    DOM.sub.textContent = '';
    renderEmpty('В момента нямаме наличен подходящ продукт. Вижте сходни в каталога.');
    return;
  }
  DOM.grid.innerHTML = items.map(renderCard).join('');
  const promo = loadActivePromo();
  fetchPromoPrices(promo, { skuIds: items.map((it) => it.pick_variant.sku_id) }).then((changed) => {
    if (changed) DOM.grid.innerHTML = items.map(renderCard).join('');
  });
  DOM.more.hidden = false;
  DOM.more.innerHTML = `<a class="pf-btn pf-btn-outline" href="${catalogUrl()}">Виж всички резултати</a>`;
  DOM.note.hidden = false;
  DOM.note.textContent = 'Дозировката следвайте според плана си или указанието на опаковката.';
}

DOM.grid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add]');
  if (btn) addToCart(Number(btn.dataset.add));
});

initPortfolioPage({ settingsOnly: true }).catch(() => {});
load();
