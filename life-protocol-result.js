import { formatPriceEur } from './protocol-quiz-engine.js';

const RESULT_KEY = 'lifeProtocolResult';
const CART_KEY = 'lifeCart';

const container = document.getElementById('lpr-content');
const disclaimerEl = document.getElementById('lpr-disclaimer');
const subtitleEl = document.getElementById('lpr-subtitle');

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

function renderTier(key, tier, recommended) {
  const totalEur = tierTotalEur(tier);
  const products = tier.products || [];
  const benefits = (tier.benefits || []).map((b) => `<li>${escapeHtml(b)}</li>`).join('');
  const productCards = products.map(renderProductCard).join('');

  return `<article class="lpr-tier${recommended ? ' recommended' : ''}" data-tier="${key}">
    ${recommended ? '<span class="lpr-tier-badge">Препоръчан</span>' : ''}
    <h3>${escapeHtml(tier.name || key)}</h3>
    <p class="lpr-tagline">${escapeHtml(tier.tagline || '')}</p>
    <div class="lpr-price">${formatPriceEur(totalEur)}</div>
    <div class="lpr-price-sub">месечен стак · ${products.length} продукта</div>
    <ul class="lpr-benefits">${benefits}</ul>
    ${tier.strategy ? `<p class="lpr-strategy">${escapeHtml(tier.strategy)}</p>` : ''}
    <div class="lpr-products-section">
      <button type="button" class="lpr-products-toggle" data-tier-toggle="${key}" aria-expanded="false">
        <span>Виж всички продукти (${products.length})</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="lpr-product-grid" id="lpr-products-${key}" hidden>${productCards}</div>
    </div>
    <button type="button" class="lpq-btn lpq-btn-primary lpr-order-btn" data-action="add-tier" data-tier="${key}">
      Поръчай този протокол — ${formatPriceEur(totalEur)}
    </button>
  </article>`;
}

function renderSchedule(schedule, tiers) {
  if (!schedule) return '';

  const productLinks = [];
  const optimal = tiers?.optimal?.products || tiers?.premium?.products || [];
  for (const p of optimal.slice(0, 6)) {
    const url = p.product_url || `life-product.html?id=${encodeURIComponent(p.product_id)}`;
    productLinks.push(`<a href="${escapeHtml(url)}" class="lpr-schedule-link">${escapeHtml(p.name)}</a>`);
  }

  return `<section class="lpr-schedule">
    <h3>Дневен график</h3>
    ${schedule.morning?.length ? `<p><strong>Сутрин:</strong> ${schedule.morning.map(escapeHtml).join('; ')}</p>` : ''}
    ${schedule.evening?.length ? `<p><strong>Вечер:</strong> ${schedule.evening.map(escapeHtml).join('; ')}</p>` : ''}
    ${schedule.weekly_notes ? `<p><strong>Бележка:</strong> ${escapeHtml(schedule.weekly_notes)}</p>` : ''}
    ${productLinks.length ? `<div class="lpr-schedule-products"><strong>Продукти в препоръчания стак:</strong> ${productLinks.join(' · ')}</div>` : ''}
  </section>`;
}

function bindTierToggles() {
  container.querySelectorAll('[data-tier-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.tierToggle;
      const grid = document.getElementById(`lpr-products-${key}`);
      if (!grid) return;
      const open = grid.hidden;
      grid.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.classList.toggle('open', open);
    });
  });

  const recommended = container.querySelector('.lpr-tier.recommended [data-tier-toggle]');
  recommended?.click();
}

function renderResult(data) {
  const rec = data.recommended_tier || 'optimal';
  const tiers = data.tiers || {};

  container.innerHTML = `
    <div class="lpr-analysis">${escapeHtml(data.analysis || '')}</div>
    <div class="lpr-tiers">
      ${renderTier('basic', tiers.basic || {}, rec === 'basic')}
      ${renderTier('optimal', tiers.optimal || {}, rec === 'optimal')}
      ${renderTier('premium', tiers.premium || {}, rec === 'premium')}
    </div>
    ${renderSchedule(data.protocol_schedule, tiers)}
    ${(data.lifestyle_tips || []).length ? `<section class="lpr-schedule"><h3>Съвети за начин на живот</h3><ul>${data.lifestyle_tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul></section>` : ''}
  `;

  disclaimerEl.textContent = data.disclaimer || 'Информацията не замества лекарска консултация.';

  bindTierToggles();

  container.querySelectorAll('[data-action="add-tier"]').forEach((btn) => {
    btn.addEventListener('click', () => addTierToCart(tiers[btn.dataset.tier], btn));
  });

  if (subtitleEl) {
    subtitleEl.textContent = 'Разгънете всеки вариант, за да видите продуктите с снимки и линкове';
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
