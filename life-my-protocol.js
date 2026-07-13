import { formatPriceEur } from './protocol-quiz-engine.js';
import { getMyProtocol } from './life-protocol-store.js';
import { resolveImageUrl } from './life-img.js';

const contentEl = document.getElementById('lmp-content');
const titleEl = document.getElementById('lmp-title');
const subtitleEl = document.getElementById('lmp-subtitle');
const metaEl = document.getElementById('lmp-meta');
const disclaimerEl = document.getElementById('lmp-disclaimer');

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function classifyTiming(timing) {
  const t = String(timing || '').toLowerCase();
  if (t.includes('вечер') || t.includes('нощ') || t.includes('evening')) return 'evening';
  if (t.includes('обед') || t.includes('следобед') || t.includes('midday')) return 'midday';
  return 'morning';
}

function buildSchedule(tier, baseSchedule) {
  const schedule = { morning: [], midday: [], evening: [] };
  for (const p of tier.products || []) {
    const slot = classifyTiming(p.timing);
    schedule[slot].push(`${p.name} — ${p.dose || 'според етикета'}`);
  }
  if (!schedule.morning.length && baseSchedule?.morning?.length) schedule.morning = [...baseSchedule.morning];
  if (!schedule.midday.length && baseSchedule?.midday?.length) schedule.midday = [...baseSchedule.midday];
  if (!schedule.evening.length && baseSchedule?.evening?.length) schedule.evening = [...baseSchedule.evening];
  return schedule;
}

function renderSlot(label, items) {
  if (!items?.length) return '';
  return `<div class="lmp-slot">
    <h3>${escapeHtml(label)}</h3>
    <ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
  </div>`;
}

function renderProduct(p) {
  const url = p.product_url || `life-product.html?id=${encodeURIComponent(p.product_id || '')}`;
  const imgUrl = resolveImageUrl(p.image_url, 400);
  const img = imgUrl
    ? `<img src="${escapeHtml(imgUrl)}" alt="" loading="lazy">`
    : '<div style="width:64px;height:64px;background:var(--bg-secondary);border-radius:8px;"></div>';
  const dose = [p.timing, p.dose].filter(Boolean).join(' · ');
  return `<a href="${escapeHtml(url)}" class="lmp-product">
    ${img}
    <div class="lmp-product-body">
      <strong>${escapeHtml(p.name)}</strong>
      ${dose ? `<span class="lmp-product-dose">${escapeHtml(dose)}</span>` : ''}
      ${p.why_for_you ? `<p class="lmp-product-why">${escapeHtml(p.why_for_you)}</p>` : ''}
    </div>
  </a>`;
}

function formatDate(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

function renderProtocol(protocol) {
  const tier = protocol.selectedTier;
  if (!tier) return renderEmpty();

  const schedule = buildSchedule(tier, protocol.protocol_schedule);
  const productCount = (tier.products || []).length;
  const total = tier.monthly_total_eur
    ?? (tier.products || []).reduce((s, p) => s + (Number(p.price_eur) || 0), 0);

  titleEl.textContent = protocol.tierName || 'Моят протокол';
  subtitleEl.textContent = tier.tagline || 'Вашият персонализиран стак за прием — структуриран по време на деня.';

  metaEl.innerHTML = [
    `<span class="lmp-meta-chip">${productCount} продукта</span>`,
    `<span class="lmp-meta-chip gold">${formatPriceEur(total)} / месец</span>`,
    protocol.purchasedAt ? `<span class="lmp-meta-chip">Активен от ${escapeHtml(formatDate(protocol.purchasedAt))}</span>` : ''
  ].filter(Boolean).join('');

  contentEl.innerHTML = `
    ${protocol.analysis ? `<div class="lmp-analysis">${escapeHtml(protocol.analysis)}</div>` : ''}
    <section class="lmp-section" aria-labelledby="lmp-schedule-title">
      <h2 id="lmp-schedule-title">Дневен график на прием</h2>
      <div class="lmp-schedule-grid">
        ${renderSlot('Сутрин', schedule.morning)}
        ${renderSlot('Обед / следобед', schedule.midday)}
        ${renderSlot('Вечер', schedule.evening)}
      </div>
      ${protocol.protocol_schedule?.weekly_notes ? `<p class="lmp-subtitle" style="margin-top:1rem;margin-bottom:0;">${escapeHtml(protocol.protocol_schedule.weekly_notes)}</p>` : ''}
    </section>
    <section class="lmp-section" aria-labelledby="lmp-products-title">
      <h2 id="lmp-products-title">Продукти във вашия стак</h2>
      <div class="lmp-products">${(tier.products || []).map(renderProduct).join('')}</div>
    </section>
    ${(protocol.lifestyle_tips || []).length ? `<section class="lmp-section lmp-tips"><h2>Съвети за начин на живот</h2><ul>${protocol.lifestyle_tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul></section>` : ''}
  `;

  disclaimerEl.textContent = protocol.disclaimer || 'Информацията не замества лекарска консултация.';
}

function renderEmpty() {
  titleEl.textContent = 'Все още нямате активен протокол';
  subtitleEl.textContent = 'Попълнете въпросника, изберете стак и завършете поръчката, за да видите пълния си протокол тук.';
  metaEl.innerHTML = '';
  contentEl.innerHTML = `<div class="lmp-empty">
    <p>След закупуване на персонален стак, вашият график на прием и продукти ще се показват на тази страница.</p>
    <a href="life-protocol-quiz.html" class="btn-hero-primary">Започнете вашия протокол</a>
  </div>`;
  disclaimerEl.textContent = '';
}

function initHeaderScroll() {
  const header = document.querySelector('.main-header');
  let scrolled = false;
  const on = () => { if (!scrolled) { scrolled = true; header?.classList.add('scrolled'); } };
  const off = () => { if (scrolled) { scrolled = false; header?.classList.remove('scrolled'); } };
  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) on(); else if (window.scrollY < 20) off();
  }, { passive: true });
}

function updateCartBadge() {
  try {
    const cart = JSON.parse(localStorage.getItem('lifeCart') || '[]');
    const el = document.getElementById('cart-count');
    if (el) {
      const n = cart.reduce((s, i) => s + (i.quantity || 1), 0);
      el.textContent = String(n);
      el.style.display = n > 0 ? 'flex' : 'none';
    }
  } catch { /* ignore */ }
}

const protocol = getMyProtocol();
if (protocol?.purchased) {
  renderProtocol(protocol);
} else {
  renderEmpty();
}

initHeaderScroll();
updateCartBadge();
