const RESULT_KEY = 'lifeProtocolResult';
const CART_KEY = 'lifeCart';

const container = document.getElementById('lpr-content');
const disclaimerEl = document.getElementById('lpr-disclaimer');

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

function formatPrice(tier) {
  const bgn = tier.monthly_total_bgn ?? 0;
  const eur = tier.monthly_total_eur ?? Math.round((bgn / 1.96) * 100) / 100;
  return { bgn, eur };
}

function renderTier(key, tier, recommended) {
  const { bgn, eur } = formatPrice(tier);
  const benefits = (tier.benefits || []).map((b) => `<li>${escapeHtml(b)}</li>`).join('');
  const productNames = (tier.products || []).map((p) => escapeHtml(p.name)).join(', ');

  return `<article class="lpr-tier${recommended ? ' recommended' : ''}" data-tier="${key}">
    ${recommended ? '<span class="lpr-tier-badge">Препоръчан</span>' : ''}
    <h3>${escapeHtml(tier.name || key)}</h3>
    <p class="lpr-tagline">${escapeHtml(tier.tagline || '')}</p>
    <div class="lpr-price">${bgn.toFixed(2)} лв</div>
    <div class="lpr-price-sub">≈ ${eur.toFixed(2)} EUR / месечно · ${(tier.products || []).length} продукта</div>
    <ul class="lpr-benefits">${benefits}</ul>
    <p class="lpr-products-mini">${productNames}</p>
    ${tier.strategy ? `<p style="font-size:0.85rem;margin-bottom:1rem">${escapeHtml(tier.strategy)}</p>` : ''}
    <button type="button" class="lpq-btn lpq-btn-primary" style="width:100%" data-action="add-tier" data-tier="${key}">
      Поръчай този протокол
    </button>
  </article>`;
}

function renderSchedule(schedule) {
  if (!schedule) return '';
  return `<section class="lpr-schedule">
    <h3>Дневен график</h3>
    ${schedule.morning?.length ? `<p><strong>Сутрин:</strong> ${schedule.morning.map(escapeHtml).join('; ')}</p>` : ''}
    ${schedule.evening?.length ? `<p><strong>Вечер:</strong> ${schedule.evening.map(escapeHtml).join('; ')}</p>` : ''}
    ${schedule.weekly_notes ? `<p><strong>Бележка:</strong> ${escapeHtml(schedule.weekly_notes)}</p>` : ''}
  </section>`;
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
    ${renderSchedule(data.protocol_schedule)}
    ${(data.lifestyle_tips || []).length ? `<section class="lpr-schedule"><h3>Съвети за начин на живот</h3><ul>${data.lifestyle_tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul></section>` : ''}
  `;

  disclaimerEl.textContent = data.disclaimer || 'Информацията не замества лекарска консултация.';

  container.querySelectorAll('[data-action="add-tier"]').forEach((btn) => {
    btn.addEventListener('click', () => addTierToCart(tiers[btn.dataset.tier], btn));
  });
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
      price: item.price_bgn || 0,
      quantity: 1,
      inventory: 99,
      image: item.image_url || '',
    });
    existingIds.add(item.product_id);
  }

  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  localStorage.setItem('lifeProtocolSelectedTier', JSON.stringify({
    tierName: tier.name,
    monthly_total_bgn: tier.monthly_total_bgn,
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
