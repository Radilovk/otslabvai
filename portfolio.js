import {
  escapeHtml, debounce, updateCartBadges, initPortfolioPage,
  isWishlisted, toggleWishlist, showToast, icon
} from './portfolio-shared.js';
import { getCachedSettings, getFiltersFromCache, queryCatalogFromCache, getFacetsFromCache } from './portfolio-cache.js';
import {
  countActiveFilters as countFilters,
  getRemovableFilterChips,
  shouldShowActiveFilterRow,
  formatFiltersToggleLabel
} from './portfolio-catalog-ui.js';

const LIMIT = 24;
const MAX_CHIPS = 9;

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
  sidebarClose: document.getElementById('sidebar-close'),
  sidebarApply: document.getElementById('sidebar-apply'),
  heroStats: document.getElementById('hero-stats'),
  statProducts: document.getElementById('stat-products'),
  statBrands: document.getElementById('stat-brands'),
  categoryChips: document.getElementById('category-chips'),
  activeFilters: document.getElementById('active-filters')
};

let state = { page: 1, total: 0, totalPages: 0, loading: false, cacheReady: false };
let topCategories = [];

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

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Crect fill='%23eef2f0' width='300' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.35em' fill='%235f6f66' font-family='sans-serif' font-size='14'%3EНяма снимка%3C/text%3E%3C/svg%3E";

function renderCard(item) {
  const variantBadge = item.variant_count > 1 ? `<span class="pf-badge">${item.variant_count} варианта</span>` : '';
  const stockBadge = !item.available ? '<span class="pf-badge out">Изчерпан</span>' : '';
  const img = item.image || PLACEHOLDER_IMG;
  const wished = isWishlisted(item.group_id);
  return `
    <div class="pf-product-card">
      <button type="button" class="pf-wish-btn ${wished ? 'active' : ''}" data-wish="${escapeHtml(item.group_id)}" aria-label="Любими" aria-pressed="${wished}">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${wished ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
      </button>
      <a href="portfolio-product.html?group_id=${encodeURIComponent(item.group_id)}" class="pf-card-link">
        <div class="pf-card-image">${variantBadge}${stockBadge}
          <img src="${escapeHtml(img)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" sizes="(max-width: 640px) 45vw, 210px" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
        </div>
        <div class="pf-card-body">
          <span class="pf-card-brand">${escapeHtml(item.brand)}</span>
          <h2 class="pf-card-title">${escapeHtml(item.name)}</h2>
          <div class="pf-card-price">${formatPrice(item)}</div>
        </div>
      </a>
    </div>`;
}

function showSkeletons() {
  DOM.grid.innerHTML = Array(8).fill(`
    <div class="pf-skeleton-card">
      <div class="pf-skeleton pf-skeleton-img"></div>
      <div class="pf-skeleton pf-skeleton-line" style="width:60%"></div>
      <div class="pf-skeleton pf-skeleton-line" style="width:90%"></div>
      <div class="pf-skeleton pf-skeleton-line" style="width:40%"></div>
    </div>`).join('');
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
    <button type="button" data-page="${state.page - 1}" ${prevDisabled} aria-label="Предишна">${icon('chevronLeft', { size: 16 })}</button>
    ${pages}
    <button type="button" data-page="${state.page + 1}" ${nextDisabled} aria-label="Следваща">${icon('chevronRight', { size: 16 })}</button>`;
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

function getFilterState() {
  const params = getFilterParams();
  return {
    q: params.q,
    category: params.category,
    brand: params.brand,
    min_price: params.min_price,
    max_price: params.max_price,
    availableOnly: DOM.filterAvailable.checked
  };
}

function countActiveFilters() {
  return countFilters(getFilterState());
}

function updateFiltersToggleLabel() {
  const label = document.getElementById('filters-toggle-label');
  if (!label) return;
  label.textContent = formatFiltersToggleLabel(countActiveFilters());
}

function renderActiveFilterChips() {
  if (!DOM.activeFilters) return;
  const totalActive = countActiveFilters();

  if (!shouldShowActiveFilterRow(totalActive)) {
    DOM.activeFilters.innerHTML = '';
    return;
  }

  const params = getFilterParams();
  const brandOpt = params.brand
    ? [...DOM.filterBrand.options].find((o) => o.value === params.brand)
    : null;
  const chips = getRemovableFilterChips({
    q: params.q,
    brand: params.brand,
    brandLabel: brandOpt ? brandOpt.textContent.replace(/\s*\(\d+\)$/, '') : '',
    min_price: params.min_price,
    max_price: params.max_price,
    availableOnly: DOM.filterAvailable.checked
  });

  DOM.activeFilters.innerHTML = chips.map((c) => `
    <button type="button" class="pf-active-chip" data-clear="${c.key}">
      ${escapeHtml(c.label)}
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>`).join('')
    + `<button type="button" class="pf-active-chip pf-active-chip--clear" data-clear="all">Изчисти всички</button>`;

  DOM.activeFilters.querySelectorAll('[data-clear]').forEach((btn) => {
    btn.addEventListener('click', () => clearOneFilter(btn.dataset.clear));
  });
}

function clearOneFilter(key) {
  if (key === 'all') { DOM.clearFilters.click(); return; }
  if (key === 'q') DOM.searchInput.value = '';
  if (key === 'category') DOM.filterCategory.value = '';
  if (key === 'brand') DOM.filterBrand.value = '';
  if (key === 'price') { DOM.filterMinPrice.value = ''; DOM.filterMaxPrice.value = ''; }
  if (key === 'available') DOM.filterAvailable.checked = true;
  state.page = 1;
  reconcileFacets();
  loadCatalog();
}

function renderCategoryChips() {
  if (!DOM.categoryChips || !topCategories.length) return;
  const activeCategory = DOM.filterCategory.value;
  const facets = getFacetsFromCache(getFilterParams());
  const visibleNames = new Set((facets?.categories || topCategories).map((c) => c.name));

  DOM.categoryChips.innerHTML = topCategories
    .filter((c) => {
      const active = c.name === activeCategory;
      return active || visibleNames.has(c.name);
    })
    .map((c) => {
    const active = c.name === activeCategory;
    return `<button type="button" class="pf-chip ${active ? 'active' : ''}" data-chip-category="${escapeHtml(c.name)}">${escapeHtml(c.name)}</button>`;
  }).join('');

  DOM.categoryChips.querySelectorAll('[data-chip-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.chipCategory;
      DOM.filterCategory.value = DOM.filterCategory.value === name ? '' : name;
      state.page = 1;
      reconcileFacets();
      loadCatalog();
      closeFilters();
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
  DOM.resultsMeta.textContent = DOM.filterAvailable.checked
    ? `${data.total.toLocaleString('bg-BG')} налични продукта`
    : `${data.total.toLocaleString('bg-BG')} продукта`;
  DOM.grid.innerHTML = data.items.length
    ? data.items.map(renderCard).join('')
    : `<div class="pf-empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <p>Няма продукти с тези филтри.</p>
        <button type="button" class="pf-btn pf-btn-outline pf-empty-clear" id="empty-clear-filters">Изчисти филтрите</button>
      </div>`;
  document.getElementById('empty-clear-filters')?.addEventListener('click', () => {
    DOM.clearFilters.click();
  });
  DOM.grid.querySelectorAll('[data-wish]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const active = toggleWishlist(btn.dataset.wish);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
      btn.querySelector('svg').setAttribute('fill', active ? 'currentColor' : 'none');
      showToast(active ? 'Добавено в любими' : 'Премахнато от любими', 'success');
    });
  });
  renderPagination();
  updateFiltersToggleLabel();
  renderActiveFilterChips();
  renderCategoryChips();
  updateSidebarApplyLabel();
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
  topCategories = [...filters.categories].sort((a, b) => b.count - a.count).slice(0, MAX_CHIPS);
}

/** Rebuild category/brand <select> options scoped to the other active filters
 *  (hides brands with nothing in the chosen category and vice versa), and
 *  resets a selection that's no longer valid. Pure client-side, 0 requests. */
function reconcileFacets() {
  let params = getFilterParams();
  let facets = getFacetsFromCache(params);
  if (!facets) return;

  let changed = false;
  if (params.category && !facets.categories.some((c) => c.name === params.category)) {
    DOM.filterCategory.value = '';
    changed = true;
  }
  if (params.brand && !facets.brands.some((b) => b.id === params.brand)) {
    DOM.filterBrand.value = '';
    changed = true;
  }
  if (changed) {
    params = getFilterParams();
    facets = getFacetsFromCache(params);
  }

  const prevCategory = DOM.filterCategory.value;
  const prevBrand = DOM.filterBrand.value;

  DOM.filterCategory.innerHTML = '<option value="">Всички категории</option>'
    + facets.categories.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)} (${c.count})</option>`).join('');
  DOM.filterBrand.innerHTML = '<option value="">Всички марки</option>'
    + facets.brands.map((b) => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)} (${b.count})</option>`).join('');

  DOM.filterCategory.value = prevCategory;
  DOM.filterBrand.value = prevBrand;
}

function openFilters() {
  DOM.sidebar?.classList.add('pf-sidebar--open');
  DOM.sidebarOverlay?.classList.add('pf-visible');
  DOM.filtersToggle?.setAttribute('aria-expanded', 'true');
  DOM.filtersToggle?.classList.add('pf-filters-toggle--hidden');
  document.body.classList.add('pf-no-scroll');
  updateSidebarApplyLabel();
}

function closeFilters() {
  DOM.sidebar?.classList.remove('pf-sidebar--open');
  DOM.sidebarOverlay?.classList.remove('pf-visible');
  DOM.filtersToggle?.setAttribute('aria-expanded', 'false');
  DOM.filtersToggle?.classList.remove('pf-filters-toggle--hidden');
  document.body.classList.remove('pf-no-scroll');
}

function updateSidebarApplyLabel() {
  if (!DOM.sidebarApply) return;
  const n = state.total;
  DOM.sidebarApply.textContent = n > 0
    ? `Покажи ${n.toLocaleString('bg-BG')} резултата`
    : 'Покажи резултатите';
}

function bindEvents() {
  const reload = debounce(() => { state.page = 1; reconcileFacets(); loadCatalog(); }, 200);
  DOM.searchInput.addEventListener('input', reload);
  [DOM.filterMinPrice, DOM.filterMaxPrice]
    .forEach((el) => el.addEventListener('input', reload));
  [DOM.filterMinPrice, DOM.filterMaxPrice, DOM.filterAvailable]
    .forEach((el) => el.addEventListener('change', () => { state.page = 1; reconcileFacets(); loadCatalog(); }));
  [DOM.filterCategory, DOM.filterBrand]
    .forEach((el) => el.addEventListener('change', () => { state.page = 1; reconcileFacets(); loadCatalog(); closeFilters(); }));
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
    reconcileFacets();
    loadCatalog();
    closeFilters();
  });
  DOM.filtersToggle?.addEventListener('click', () => {
    if (DOM.sidebar?.classList.contains('pf-sidebar--open')) closeFilters();
    else openFilters();
  });
  DOM.sidebarOverlay?.addEventListener('click', closeFilters);
  DOM.sidebarClose?.addEventListener('click', closeFilters);
  DOM.sidebarApply?.addEventListener('click', closeFilters);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && DOM.sidebar?.classList.contains('pf-sidebar--open')) closeFilters();
  });
  const params = new URLSearchParams(location.search);
  if (params.get('q')) DOM.searchInput.value = params.get('q');
  if (params.get('category')) DOM.filterCategory.value = params.get('category');
  if (params.get('brand')) DOM.filterBrand.value = params.get('brand');
}

async function init() {
  await initPortfolioPage({ active: 'catalog', showMobileBar: true });
  showSkeletons();

  try {
    const settings = getCachedSettings();
    if (settings?.site_slogan) {
      const sub = document.getElementById('hero-subtitle');
      if (sub) sub.textContent = settings.site_slogan;
    }
    const filters = getFiltersFromCache();
    if (filters) populateFilters(filters);
    state.cacheReady = true;
    bindEvents();
    reconcileFacets();
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
