import { API_URL } from './config.js';

const CART_KEY = 'portfolioCart';
const LIMIT = 24;

const DOM = {
  grid: document.getElementById('catalog-grid'),
  pagination: document.getElementById('pagination'),
  resultsMeta: document.getElementById('results-meta'),
  searchInput: document.getElementById('search-input'),
  filterCategory: document.getElementById('filter-category'),
  filterBrand: document.getElementById('filter-brand'),
  filterMinPrice: document.getElementById('filter-min-price'),
  filterMaxPrice: document.getElementById('filter-max-price'),
  filterAvailable: document.getElementById('filter-available'),
  sortSelect: document.getElementById('sort-select'),
  clearFilters: document.getElementById('clear-filters'),
  cartCount: document.getElementById('cart-count'),
  siteName: document.getElementById('site-name'),
  siteSlogan: document.getElementById('site-slogan'),
  syncBanner: document.getElementById('sync-banner'),
  filtersToggle: document.getElementById('filters-toggle'),
  sidebar: document.getElementById('sidebar'),
  toastContainer: document.getElementById('toast-container')
};

let state = {
  page: 1,
  total: 0,
  totalPages: 0,
  loading: false
};

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function getCart() {
  return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
}

function updateCartCount() {
  const count = getCart().reduce((s, i) => s + i.quantity, 0);
  if (DOM.cartCount) DOM.cartCount.textContent = count;
}

function getFiltersFromUI() {
  const params = new URLSearchParams();
  params.set('page', String(state.page));
  params.set('limit', String(LIMIT));
  params.set('sort', DOM.sortSelect.value);

  const q = DOM.searchInput.value.trim();
  if (q) params.set('q', q);
  if (DOM.filterCategory.value) params.set('category', DOM.filterCategory.value);
  if (DOM.filterBrand.value) params.set('brand', DOM.filterBrand.value);
  if (DOM.filterMinPrice.value) params.set('min_price', DOM.filterMinPrice.value);
  if (DOM.filterMaxPrice.value) params.set('max_price', DOM.filterMaxPrice.value);
  if (DOM.filterAvailable.checked) params.set('available', '1');

  return params;
}

function formatPrice(item) {
  if (item.min_price === item.max_price) {
    return `${item.min_price.toFixed(2)} €`;
  }
  return `<span class="from">от</span> ${item.min_price.toFixed(2)} €`;
}

function renderCard(item) {
  const variantBadge =
    item.variant_count > 1
      ? `<span class="pf-badge">${item.variant_count} варианта</span>`
      : '';
  const stockBadge = !item.available ? '<span class="pf-badge out">Изчерпан</span>' : '';

  return `
    <a href="portfolio-product.html?group_id=${encodeURIComponent(item.group_id)}" class="pf-card">
      <div class="pf-card-image">
        ${variantBadge}${stockBadge}
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async">
      </div>
      <div class="pf-card-body">
        <span class="pf-card-brand">${escapeHtml(item.brand)}</span>
        <h2 class="pf-card-title">${escapeHtml(item.name)}</h2>
        <div class="pf-card-price">${formatPrice(item)}</div>
      </div>
    </a>`;
}

function renderPagination() {
  if (state.totalPages <= 1) {
    DOM.pagination.innerHTML = '';
    return;
  }

  const prevDisabled = state.page <= 1 ? 'disabled' : '';
  const nextDisabled = state.page >= state.totalPages ? 'disabled' : '';

  let pages = '';
  const start = Math.max(1, state.page - 2);
  const end = Math.min(state.totalPages, state.page + 2);
  for (let p = start; p <= end; p++) {
    const cls = p === state.page ? 'current' : '';
    pages += `<button type="button" data-page="${p}" class="${cls}">${p}</button>`;
  }

  DOM.pagination.innerHTML = `
    <button type="button" data-page="${state.page - 1}" ${prevDisabled}>← Предишна</button>
    ${pages}
    <button type="button" data-page="${state.page + 1}" ${nextDisabled}>Следваща →</button>`;

  DOM.pagination.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page, 10);
      if (p >= 1 && p <= state.totalPages && p !== state.page) {
        state.page = p;
        loadCatalog();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}

async function loadCatalog() {
  if (state.loading) return;
  state.loading = true;
  DOM.grid.innerHTML = '<div class="pf-loading">Зареждане...</div>';

  try {
    const res = await fetch(`${API_URL}/portfolio/catalog?${getFiltersFromUI()}`);
    const data = await res.json();

    if (!res.ok) {
      DOM.grid.innerHTML = `<div class="pf-error">${escapeHtml(data.error || 'Грешка при зареждане')}</div>`;
      DOM.resultsMeta.textContent = '';
      return;
    }

    state.total = data.total;
    state.totalPages = data.total_pages;
    state.page = data.page;

    DOM.resultsMeta.textContent = `${data.total.toLocaleString('bg-BG')} продукта`;

    if (!data.items.length) {
      DOM.grid.innerHTML = '<div class="pf-empty">Няма намерени продукти с тези филтри.</div>';
    } else {
      DOM.grid.innerHTML = data.items.map(renderCard).join('');
    }

    renderPagination();
  } catch (e) {
    DOM.grid.innerHTML = '<div class="pf-error">Неуспешна връзка със сървъра.</div>';
  } finally {
    state.loading = false;
  }
}

async function loadFilters() {
  try {
    const [filtersRes, settingsRes] = await Promise.all([
      fetch(`${API_URL}/portfolio/filters`),
      fetch(`${API_URL}/portfolio/settings`)
    ]);

    if (settingsRes.ok) {
      const settings = await settingsRes.json();
      if (DOM.siteName && settings.site_name) DOM.siteName.textContent = settings.site_name;
      if (DOM.siteSlogan && settings.site_slogan) DOM.siteSlogan.textContent = settings.site_slogan;
    }

    if (!filtersRes.ok) {
      const err = await filtersRes.json().catch(() => ({}));
      if (DOM.syncBanner) {
        DOM.syncBanner.style.display = 'block';
        DOM.syncBanner.textContent =
          err.error || 'Каталогът не е синхронизиран. Моля, стартирайте sync от админ панела → Portfolio.';
      }
      return;
    }

    const filters = await filtersRes.json();

    filters.categories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = `${c.name} (${c.count})`;
      DOM.filterCategory.appendChild(opt);
    });

    filters.brands.forEach((b) => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.name} (${b.count})`;
      DOM.filterBrand.appendChild(opt);
    });
  } catch {
    if (DOM.syncBanner) {
      DOM.syncBanner.style.display = 'block';
      DOM.syncBanner.textContent = 'Неуспешна връзка с API. Проверете дали Worker-ът е деплойнат.';
    }
  }
}

function bindEvents() {
  const reload = debounce(() => {
    state.page = 1;
    loadCatalog();
  }, 300);

  DOM.searchInput.addEventListener('input', reload);
  DOM.filterCategory.addEventListener('change', () => { state.page = 1; loadCatalog(); });
  DOM.filterBrand.addEventListener('change', () => { state.page = 1; loadCatalog(); });
  DOM.filterMinPrice.addEventListener('change', () => { state.page = 1; loadCatalog(); });
  DOM.filterMaxPrice.addEventListener('change', () => { state.page = 1; loadCatalog(); });
  DOM.filterAvailable.addEventListener('change', () => { state.page = 1; loadCatalog(); });
  DOM.sortSelect.addEventListener('change', () => { state.page = 1; loadCatalog(); });

  DOM.clearFilters.addEventListener('click', () => {
    DOM.searchInput.value = '';
    DOM.filterCategory.value = '';
    DOM.filterBrand.value = '';
    DOM.filterMinPrice.value = '';
    DOM.filterMaxPrice.value = '';
    DOM.filterAvailable.checked = true;
    DOM.sortSelect.value = 'name';
    state.page = 1;
    loadCatalog();
  });

  if (DOM.filtersToggle && DOM.sidebar) {
    DOM.filtersToggle.addEventListener('click', () => {
      DOM.sidebar.classList.toggle('collapsed');
    });
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('q')) DOM.searchInput.value = params.get('q');
  if (params.get('category')) DOM.filterCategory.value = params.get('category');
  if (params.get('brand')) DOM.filterBrand.value = params.get('brand');
}

async function init() {
  updateCartCount();
  bindEvents();
  await loadFilters();
  await loadCatalog();
}

init();
