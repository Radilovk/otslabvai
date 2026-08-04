import { formatPriceEur, buildCumulativeBenefitTiers } from './protocol-quiz-engine.js';
import { persistAdvisorResult, loadAdvisorResult, RESULT_KEY } from './portfolio-advisor-store.js';
import { CART_KEY, saveCart, updateCartBadges, showToast } from './portfolio-shared.js';
import { resolveImageUrl } from './life-img.js';

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

function tierTotalEur(tier) {
  if (typeof tier.monthly_total_eur === 'number') return tier.monthly_total_eur;
  const sum = (tier.products || []).reduce((s, p) => s + (Number(p.price_eur) || 0), 0);
  return Math.round(sum * 100) / 100;
}

function normalizeBenefitsForDisplay(tiers, isSingle) {
  if (isSingle) {
    return {
      basic: { list: tiers.basic?.benefits || [], inherited: 0 },
      optimal: { list: tiers.optimal?.benefits || [], inherited: 0 },
      premium: { list: tiers.premium?.benefits || [], inherited: 0 },
    };
  }
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
  const imgUrl = resolveImageUrl(product.image_url, 400);
  const img = imgUrl
    ? `<img src="${escapeHtml(imgUrl)}" alt="" class="lpr-product-img" loading="lazy">`
    : '<div class="lpr-product-img lpr-product-img--placeholder" aria-hidden="true"></div>';
  const url = product.product_url || `portfolio-product.html?group_id=${encodeURIComponent(product.group_id || '')}`;
  const dose = [product.timing, product.dose].filter(Boolean).join(' · ');
  const variant = product.variant_name ? `<span class="lpr-product-variant">${escapeHtml(product.variant_name)}</span>` : '';

  return `<a href="${escapeHtml(url)}" class="lpr-product-card">
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

function productCountLabel(count, isSingle) {
  if (isSingle) return count === 1 ? '1 продукт' : `${count} продукта`;
  return `${count} продукта в пакета`;
}

function renderTier(key, tier, recommended, benefitMeta, isSingle) {
  const totalEur = tierTotalEur(tier);
  const products = tier.products || [];
  const benefits = renderBenefits(benefitMeta.list, benefitMeta.inherited);
  const productCards = products.map(renderProductCard).join('');
  const orderLabel = isSingle ? 'Добави в количката' : 'Поръчай този пакет';

  return `<article class="lpr-tier${recommended ? ' recommended' : ''}" data-tier="${key}" role="button" tabindex="0" aria-pressed="false">
    ${recommended ? '<span class="lpr-tier-badge">Препоръчан</span>' : ''}
    <h3>${escapeHtml(tier.name || key)}</h3>
    <p class="lpr-tagline">${escapeHtml(tier.tagline || '')}</p>
    <div class="lpr-price">${formatPriceEur(totalEur)}</div>
    <div class="lpr-price-sub">${productCountLabel(products.length, isSingle)}</div>
    <ul class="lpr-benefits">${benefits}</ul>
    ${tier.strategy ? `<p class="lpr-strategy">${escapeHtml(tier.strategy)}</p>` : ''}
    <div class="lpr-products-section">
      <button type="button" class="lpr-products-toggle open" data-tier-toggle="${key}" aria-expanded="true" aria-controls="lpr-products-${key}">
        <span>Продукти (${products.length})</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="lpr-product-grid" id="lpr-products-${key}">${productCards}</div>
    </div>
    <button type="button" class="lpq-btn lpq-btn-primary lpr-order-btn" data-action="add-tier" data-tier="${key}">
      ${orderLabel} — ${formatPriceEur(totalEur)}
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
  if (tier.schedule) {
    return { ...tier.schedule, products: tier.products || [] };
  }
  const products = tier.products || [];
  const schedule = { morning: [], midday: [], evening: [], weekly_notes: baseSchedule?.weekly_notes || '', products };

  for (const p of products) {
    const slot = classifyTiming(p.timing);
    schedule[slot].push(`${p.name} — ${p.dose || 'според етикета'}`);
  }

  if (!schedule.morning.length && baseSchedule?.morning?.length) schedule.morning = [...baseSchedule.morning];
  if (!schedule.evening.length && baseSchedule?.evening?.length) schedule.evening = [...baseSchedule.evening];

  return schedule;
}

function renderScheduleBlock(label, icon, items) {
  if (!items?.length) return '';
  const list = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  return `<div class="lpr-schedule-block">
    <div class="lpr-schedule-time"><span class="lpr-schedule-icon" aria-hidden="true">${icon}</span><strong>${escapeHtml(label)}</strong></div>
    <ul class="lpr-schedule-list">${list}</ul>
  </div>`;
}

function renderSchedulePanel(schedule, tier, tierKey) {
  const productLinks = (schedule.products || []).map((p) => {
    const url = p.product_url || `portfolio-product.html?group_id=${encodeURIComponent(p.group_id || '')}`;
    return `<a href="${escapeHtml(url)}" class="lpr-schedule-link">${escapeHtml(p.name)}</a>`;
  });

  const blocks = [
    renderScheduleBlock('Сутрин', '☀', schedule.morning),
    renderScheduleBlock('Обед / следобед', '◐', schedule.midday),
    renderScheduleBlock('Вечер', '☾', schedule.evening),
  ].filter(Boolean).join('');

  return `
    <div class="lpr-schedule-header">
      <h3>Приемен график</h3>
      <span class="lpr-schedule-tier-label">${escapeHtml(tier.name || tierKey)}</span>
    </div>
    ${blocks ? `<div class="lpr-schedule-blocks">${blocks}</div>` : '<p class="lpr-schedule-empty">Няма зададен график за този вариант.</p>'}
    ${schedule.weekly_notes ? `<div class="lpr-schedule-notes"><strong>Бележка:</strong> ${escapeHtml(schedule.weekly_notes)}</div>` : ''}
    ${productLinks.length ? `<div class="lpr-schedule-products"><strong>Продукти:</strong> ${productLinks.join('<span class="lpr-schedule-sep">·</span>')}</div>` : ''}
  `;
}

function toggleProductGrid(btn, forceOpen) {
  const key = btn.dataset.tierToggle;
  const grid = document.getElementById(`lpr-products-${key}`);
  if (!grid) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : grid.hasAttribute('hidden');
  if (shouldOpen) grid.removeAttribute('hidden');
  else grid.setAttribute('hidden', '');
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
  panel.innerHTML = renderSchedulePanel(buildTierSchedule(tier, baseSchedule), tier, tierKey);
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
  const isSingle = data.selection_mode === 'single';
  const benefits = normalizeBenefitsForDisplay(tiers, isSingle);

  container.innerHTML = `
    <div class="lpr-analysis">${escapeHtml(data.analysis || '')}</div>
    <p class="lpr-tier-hint">Кликнете върху вариант, за да видите приемния график</p>
    <div class="lpr-tiers">
      ${renderTier('basic', tiers.basic || {}, rec === 'basic', benefits.basic, isSingle)}
      ${renderTier('optimal', tiers.optimal || {}, rec === 'optimal', benefits.optimal, isSingle)}
      ${renderTier('premium', tiers.premium || {}, rec === 'premium', benefits.premium, isSingle)}
    </div>
    <section class="lpr-schedule" id="lpr-schedule-panel" aria-live="polite"></section>
    ${(data.lifestyle_tips || []).length ? `<section class="lpr-schedule lpr-lifestyle-tips"><h3>Съвети</h3><ul class="lpr-schedule-list">${data.lifestyle_tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul></section>` : ''}
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
    subtitleEl.textContent = isSingle
      ? 'Три варианта на единичен продукт · изберете и добавете в количката'
      : 'Три пакета · изберете вариант и добавете в количката';
  }
}

function addTierToCart(tier, btn) {
  if (!tier?.products?.length) return;

  const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  const existingSkus = new Set(cart.map((i) => i.sku_id || i.id));

  for (const item of tier.products) {
    const skuId = item.sku_id || item.product_id;
    if (!skuId || existingSkus.has(skuId)) continue;
    cart.push({
      sku_id: skuId,
      id: skuId,
      name: item.name,
      price: item.price_eur || 0,
      quantity: 1,
      image: resolveImageUrl(item.image_url, 400) || '',
      group_id: item.group_id || '',
    });
    existingSkus.add(skuId);
  }

  saveCart(cart);
  updateCartBadges();
  if (resultData) persistAdvisorResult(resultData);

  btn.textContent = 'Добавено ✓';
  btn.disabled = true;
  showToast('Добавено в количката!', 'success');

  setTimeout(() => {
    window.location.href = 'portfolio-checkout.html';
  }, 700);
}

const data = loadAdvisorResult() || (() => {
  try {
    return JSON.parse(sessionStorage.getItem(RESULT_KEY) || 'null');
  } catch {
    return null;
  }
})();

if (!data?.tiers) {
  container.innerHTML = `<div class="lpq-card"><p>Няма наличен резултат. <a href="portfolio-advisor-quiz.html">Попълнете въпросника</a>.</p></div>`;
} else {
  renderResult(data);
}
