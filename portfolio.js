import {
  escapeHtml, debounce, updateCartBadges, initPortfolioPage, applySiteSettings
} from './portfolio-shared.js';
import { ensureBootstrap, getFiltersFromCache, queryCatalogFromCache } from './portfolio-cache.js';

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
  syncBanner: document.getElementById('sync-banner'),
  filtersToggle: document.getElementById('filters-toggle'),
  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebar-overlay'),
  heroStats: document.getElementById('hero-stats'),
  statProducts: document.getElementById('stat-products'),
  statBrands: document.getElementById('stat-brands')
};

let state = { page: 1, total: 0, totalPages: 0, loading: false, cacheReady: false };

function getFilterParams() {
  return {
    sort: DOM.sortSelect.value,
    q: DOM.searchInput.value.trim(),
    category: DOM.filterCategory.value,
    brand: DOM.filterBrand.value,
    min_price: DOM.filterMinPrice.value,
    max_price: DOM.filterMaxPrice.value,
    available: DOM.filterAvailable.checked ? '1' : ''
  };
}

function formatPrice(item) {
  if (item.min_price === item.max_price) return `${item.min_price.toFixed(2)} €`;
  return `<span class="from">от</span> ${item.min_price.toFixed(2)} €`;
}

function renderCard(item) {
  const variantBadge = item.variant_count > 1 ? `<span class="pf-badge">${item.variant_count} варианта</span>` : '';
  const stockBadge = !item.available ? '<span class="pf-badge out">Изчерпан</span>' : '';
  return `
    <a href="portfolio-product.html?group_id=${encodeURIComponent(item.group_id)}" class="pf-card-link">
      <div class="pf-card-image">${variantBadge}${stockBadge}
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" width="300" height="300">
      </div>
      <div class="pf-card-body">
        <span class="pf-card-brand">${escapeHtml(item.brand)}</span>
        <h2 class="pf-card-title">${escapeHtml(item.name)}</h2>
        <div class="pf-card-price">${formatPrice(item)}</div>
      </div>
    </a>`;
}

function showSkeletons() {
  DOM.grid.innerHTML = Array(6).fill('<div class="pf-skeleton"></div>').join('');
}

function renderPagination() {
  if (state.totalPages <= 1) { DOM.pagination.innerHTML = ''; return; }
  const prevDisabled = state.page <= 1 ? 'disabled' : '';
  const nextDisabled = state.page >= state.totalPages ? 'disabled' : '';
  let pages = '';
  const start = Math.max(1, state.page - 2);
  const end = Math.min(state.totalPages, state.page + 2);
  for (let p = start; p <= end; p++) {
    pages += `<button type="button" data-page="${p}" class="${p === state.page ? 'current' : ''}">${p}</button>`;
  }
  DOM.pagination.innerHTML = `
    <button type="button" data-page="${state.page - 1}" ${prevDisabled} aria-label="Предишна">←</button>
    ${pages}
    <button type="button" data-page="${state.page + 1}" ${nextDisabled} aria-label="Следваща">→</button>`;
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

function loadCatalog() {
  if (!state.cacheReady) return;
  const data = queryCatalogFromCache(getFilterParams(), state.page, LIMIT);
  if (!data) {
    DOM.grid.innerHTML = '<div class="pf-error">Каталогът не е наличен офлайн.</div>';
    return;
  }
  state.total = data.total;
  state.totalPages = data.total_pages;
  state.page = data.page;
  DOM.resultsMeta.textContent = `${data.total.toLocaleString('bg-BG')} продукта`;
  DOM.grid.innerHTML = data.items.length
    ? data.items.map(renderCard).join('')
    : '<div class="pf-empty">Няма продукти с тези филтри. Опитайте да промените критериите.</div>';
  renderPagination();
}

function populateFilters(filters) {
  DOM.filterCategory.innerHTML = '<option value="">Всички категории</option>';
  DOM.filterBrand.innerHTML = '<option value="">Всички марки</option>';
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
  if (DOM.heroStats) {
    DOM.heroStats.style.display = 'flex';
    DOM.statProducts.textContent = filters.total_groups.toLocaleString('bg-BG');
    DOM.statBrands.textContent = filters.brands.length.toLocaleString('bg-BG');
  }
}

function openFilters() {
  DOM.sidebar?.classList.add('pf-sidebar--open');
  DOM.sidebarOverlay?.classList.add('pf-visible');
  DOM.filtersToggle?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('pf-no-scroll');
}

function closeFilters() {
  DOM.sidebar?.classList.remove('pf-sidebar--open');
  DOM.sidebarOverlay?.classList.remove('pf-visible');
  DOM.filtersToggle?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('pf-no-scroll');
}

function bindEvents() {
  const reload = debounce(() => { state.page = 1; loadCatalog(); }, 200);
  DOM.searchInput.addEventListener('input', reload);
  [DOM.filterCategory, DOM.filterBrand, DOM.filterMinPrice, DOM.filterMaxPrice, DOM.filterAvailable, DOM.sortSelect]
    .forEach((el) => el.addEventListener('change', () => { state.page = 1; loadCatalog(); closeFilters(); }));
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
  DOM.filtersToggle?.addEventListener('click', () => {
    if (DOM.sidebar?.classList.contains('pf-sidebar--open')) closeFilters();
    else openFilters();
  });
  DOM.sidebarOverlay?.addEventListener('click', closeFilters);
  const params = new URLSearchParams(location.search);
  if (params.get('q')) DOM.searchInput.value = params.get('q');
  if (params.get('category')) DOM.filterCategory.value = params.get('category');
  if (params.get('brand')) DOM.filterBrand.value = params.get('brand');
}

async function init() {
  await initPortfolioPage({ active: 'catalog', showMobileBar: true });
  showSkeletons();

  try {
    const bootstrap = await ensureBootstrap();
    applySiteSettings(bootstrap.settings);
    if (bootstrap.settings?.site_slogan) {
      const sub = document.getElementById('hero-subtitle');
      if (sub) sub.textContent = bootstrap.settings.site_slogan;
    }
    const filters = getFiltersFromCache();
    if (filters) populateFilters(filters);
    state.cacheReady = true;
    bindEvents();
    loadCatalog();
  } catch (err) {
    if (DOM.syncBanner) {
      DOM.syncBanner.style.display = 'block';
      DOM.syncBanner.textContent = err.message || 'Каталогът не е синхронизиран. Стартирайте sync от Admin → Portfolio.';
    }
    DOM.grid.innerHTML = `<div class="pf-error">${escapeHtml(err.message || 'Грешка при зареждане')}</div>`;
    DOM.resultsMeta.textContent = '';
  }

  updateCartBadges();
}

init();
