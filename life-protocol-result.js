import { formatPriceEur, buildCumulativeBenefitTiers } from './protocol-quiz-engine.js';

const RESULT_KEY = 'lifeProtocolResult';
const CART_KEY = 'lifeCart';

const container = document.getElementById('lpr-content');
const disclaimerEl = document.getElementById('lpr-disclaimer');
const subtitleEl = document.getElementById('lpr-subtitle');

let resultData = null;
let selectedTierKey = 'optimal';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadResult() {
  try {
    return JSON.parse(sessionStorage.getItem(RESULT_KEY) || 'null');
  } catch {
    return null;
  }
}

function tierTotalEur(tier) {
  if (typeof tier.monthly_total_eur === 'number') return tier.monthly_total_eur;
  const sum = (tier.products || []).reduce((s, p) => s + (Number(p.price_eur) || 0), 0);
  return Math.round(sum * 100) / 100;
}

/** Кумулативни ползи със семантична дедупликация */
function normalizeBenefitsForDisplay(tiers) {
  return buildCumulativeBenefitTiers(tiers);
}

function renderBenefits(benefits, inheritedCount = 0) {
  return benefits
    .map((b, i) => {
      const isNew = i >= inheritedCount;
      const cls = isNew ? 'lpr-benefit-new' : 'lpr-benefit-base';
      return `<li class="${cls}">${escapeHtml(b)}</li>`;
    })
    .join('');
}

function renderProductCard(product) {
  const img = product.image_url
    ? `<img src="${escapeHtml(product.image_url)}" alt="" class="lpr-product-img" loading="lazy">`
    : '<div class="lpr-product-img lpr-product-img--placeholder" aria-hidden="true"></div>';
  const url = product.product_url || `life-product.html?id=${encodeURIComponent(product.product_id || '')}`;
  const dose = [product.timing, product.dose].filter(Boolean).join(' · ');
  const variant = product.variant_name ? `<span class="lpr-product-variant">${escapeHtml(product.variant_name)}</span>` : '';

  return `<a href="${escapeHtml(url)}" class="lpr-product-card" target="_blank" rel="noopener">
    ${img}
    <div class="lpr-product-body">
      <strong class="lpr-product-name">${escapeHtml(product.name)}</strong>
      ${product.brand ? `<span class="lpr-product-brand">${escapeHtml(product.brand)}</span>` : ''}
      ${variant}
      ${dose ? `<span class="lpr-product-dose">${escapeHtml(dose)}</span>` : ''}
      ${product.why_for_you ? `<span class="lpr-product-why">${escapeHtml(product.why_for_you)}</span>` : ''}
      <span class="lpr-product-price">${formatPriceEur(product.price_eur)}</span>
    </div>
  </a>`;
}

function renderTier(key, tier, recommended, benefitMeta) {
  const totalEur = tierTotalEur(tier);
  const products = tier.products || [];
  const benefits = renderBenefits(benefitMeta.list, benefitMeta.inherited);
  const productCards = products.map(renderProductCard).join('');

  return `<article class="lpr-tier${recommended ? ' recommended' : ''}" data-tier="${key}" role="button" tabindex="0" aria-pressed="false">
    ${recommended ? '<span class="lpr-tier-badge">Препоръчан</span>' : ''}
    <h3>${escapeHtml(tier.name || key)}</h3>
    <p class="lpr-tagline">${escapeHtml(tier.tagline || '')}</p>
    <div class="lpr-price">${formatPriceEur(totalEur)}</div>
    <div class="lpr-price-sub">месечен стак · ${products.length} продукта</div>
    <ul class="lpr-benefits">${benefits}</ul>
    ${tier.strategy ? `<p class="lpr-strategy">${escapeHtml(tier.strategy)}</p>` : ''}
    <div class="lpr-products-section">
      <button type="button" class="lpr-products-toggle open" data-tier-toggle="${key}" aria-expanded="true" aria-controls="lpr-products-${key}">
        <span>Продукти в стака (${products.length})</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="lpr-product-grid" id="lpr-products-${key}">${productCards}</div>
    </div>
    <button type="button" class="lpq-btn lpq-btn-primary lpr-order-btn" data-action="add-tier" data-tier="${key}">
      Поръчай този протокол — ${formatPriceEur(totalEur)}
    </button>
  </article>`;
}

function classifyTiming(timing) {
  const t = String(timing || '').toLowerCase();
  if (t.includes('вечер') || t.includes('нощ') || t.includes('evening') || t.includes('bed')) return 'evening';
  if (t.includes('обед') || t.includes('следобед') || t.includes('midday') || t.includes('lunch')) return 'midday';
  return 'morning';
}

function buildTierSchedule(tier, baseSchedule) {
  const products = tier.products || [];
  const schedule = {
    morning: [],
    midday: [],
    evening: [],
    weekly_notes: baseSchedule?.weekly_notes || '',
    products,
  };

  for (const p of products) {
    const slot = classifyTiming(p.timing);
    const line = `${p.name} — ${p.dose || 'според етикета'}`;
    schedule[slot].push(line);
  }

  if (!schedule.morning.length && baseSchedule?.morning?.length) {
    schedule.morning = [...baseSchedule.morning];
  }
  if (!schedule.evening.length && baseSchedule?.evening?.length) {
    schedule.evening = [...baseSchedule.evening];
  }

  return schedule;
}

function renderScheduleBlock(label, icon, items) {
  if (!items?.length) return '';
  const list = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  return `<div class="lpr-schedule-block">
    <div class="lpr-schedule-time">
      <span class="lpr-schedule-icon" aria-hidden="true">${icon}</span>
      <strong>${escapeHtml(label)}</strong>
    </div>
    <ul class="lpr-schedule-list">${list}</ul>
  </div>`;
}

function renderSchedulePanel(schedule, tier, tierKey) {
  const productLinks = (schedule.products || []).map((p) => {
    const url = p.product_url || `life-product.html?id=${encodeURIComponent(p.product_id)}`;
    return `<a href="${escapeHtml(url)}" class="lpr-schedule-link">${escapeHtml(p.name)}</a>`;
  });

  const blocks = [
    renderScheduleBlock('Сутрин', '☀', schedule.morning),
    renderScheduleBlock('Обед / следобед', '◐', schedule.midday),
    renderScheduleBlock('Вечер', '☾', schedule.evening),
  ].filter(Boolean).join('');

  return `
    <div class="lpr-schedule-header">
      <h3>Дневен график</h3>
      <span class="lpr-schedule-tier-label">${escapeHtml(tier.name || tierKey)}</span>
    </div>
    ${blocks ? `<div class="lpr-schedule-blocks">${blocks}</div>` : '<p class="lpr-schedule-empty">Няма зададен график за този вариант.</p>'}
    ${schedule.weekly_notes ? `<div class="lpr-schedule-notes"><strong>Седмична бележка:</strong> ${escapeHtml(schedule.weekly_notes)}</div>` : ''}
    ${productLinks.length ? `<div class="lpr-schedule-products"><strong>Продукти в стака:</strong> ${productLinks.join('<span class="lpr-schedule-sep">·</span>')}</div>` : ''}
  `;
}

function toggleProductGrid(btn, forceOpen) {
  const key = btn.dataset.tierToggle;
  const grid = document.getElementById(`lpr-products-${key}`);
  if (!grid) return;

  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : grid.hasAttribute('hidden');
  if (shouldOpen) {
    grid.removeAttribute('hidden');
  } else {
    grid.setAttribute('hidden', '');
  }
  btn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  btn.classList.toggle('open', shouldOpen);
}

function bindTierToggles() {
  container.querySelectorAll('[data-tier-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleProductGrid(btn);
    });
    toggleProductGrid(btn, true);
  });
}

function updateSchedulePanel(tiers, baseSchedule, tierKey) {
  const panel = document.getElementById('lpr-schedule-panel');
  if (!panel) return;

  selectedTierKey = tierKey;
  const tier = tiers[tierKey] || {};
  const schedule = buildTierSchedule(tier, baseSchedule);
  panel.innerHTML = renderSchedulePanel(schedule, tier, tierKey);

  container.querySelectorAll('.lpr-tier').forEach((el) => {
    const active = el.dataset.tier === tierKey;
    el.classList.toggle('selected', active);
    el.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function bindTierSelection(tiers, baseSchedule) {
  const selectTier = (tierKey) => {
    if (!tiers[tierKey]) return;
    updateSchedulePanel(tiers, baseSchedule, tierKey);
  };

  container.querySelectorAll('.lpr-tier').forEach((tierEl) => {
    tierEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-tier-toggle], [data-action], a, button')) return;
      selectTier(tierEl.dataset.tier);
    });
    tierEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      selectTier(tierEl.dataset.tier);
    });
  });

  selectTier(resultData?.recommended_tier || 'optimal');
}

function renderResult(data) {
  resultData = data;
  const rec = data.recommended_tier || 'optimal';
  const tiers = data.tiers || {};
  const benefits = normalizeBenefitsForDisplay(tiers);

  container.innerHTML = `
    <div class="lpr-analysis">${escapeHtml(data.analysis || '')}</div>
    <p class="lpr-tier-hint">Кликнете върху вариант, за да видите неговия дневен график</p>
    <div class="lpr-tiers">
      ${renderTier('basic', tiers.basic || {}, rec === 'basic', benefits.basic)}
      ${renderTier('optimal', tiers.optimal || {}, rec === 'optimal', benefits.optimal)}
      ${renderTier('premium', tiers.premium || {}, rec === 'premium', benefits.premium)}
    </div>
    <section class="lpr-schedule" id="lpr-schedule-panel" aria-live="polite"></section>
    ${(data.lifestyle_tips || []).length ? `<section class="lpr-schedule lpr-lifestyle-tips"><h3>Съвети за начин на живот</h3><ul class="lpr-schedule-list">${data.lifestyle_tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul></section>` : ''}
  `;

  disclaimerEl.textContent = data.disclaimer || 'Информацията не замества лекарска консултация.';

  bindTierToggles();
  bindTierSelection(tiers, data.protocol_schedule);

  container.querySelectorAll('[data-action="add-tier"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      addTierToCart(tiers[btn.dataset.tier], btn);
    });
  });

  if (subtitleEl) {
    subtitleEl.textContent = 'Изберете вариант за график · продуктите са видими във всеки стак';
  }
}

function addTierToCart(tier, btn) {
  if (!tier?.products?.length) return;

  const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  const existingIds = new Set(cart.map((i) => i.id));

  for (const item of tier.products) {
    if (existingIds.has(item.product_id)) continue;
    cart.push({
      id: item.product_id,
      name: item.name,
      price: item.price_eur || 0,
      quantity: 1,
      inventory: 99,
      image: item.image_url || '',
    });
    existingIds.add(item.product_id);
  }

  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  localStorage.setItem('lifeProtocolSelectedTier', JSON.stringify({
    tierName: tier.name,
    monthly_total_eur: tierTotalEur(tier),
    timestamp: Date.now(),
  }));

  btn.textContent = 'Добавено ✓';
  btn.disabled = true;

  setTimeout(() => {
    window.location.href = 'life-checkout.html';
  }, 600);
}

const data = loadResult();
if (!data?.tiers) {
  container.innerHTML = `<div class="lpq-card"><p>Няма наличен резултат. <a href="life-protocol-quiz.html">Попълнете въпросника</a>.</p></div>`;
} else {
  renderResult(data);
}
