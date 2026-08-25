/**
 * Portfolio promo code UI — homepage modal + session handoff to checkout.
 */

import { API_URL } from './config.js';
import { escapeHtml } from './portfolio-shared.js';
import { promoUsesLinePricing } from './portfolio-checkout-shared.js';
import { syncPromoCatalogUnlock, notifyPromoChanged } from './portfolio-promo-catalog.js';

export const PROMO_CODE_SESSION_KEY = 'pfActivePromoCode';

export function saveActivePromo(promo) {
  try {
    if (promo?.code) sessionStorage.setItem(PROMO_CODE_SESSION_KEY, JSON.stringify(promo));
    else sessionStorage.removeItem(PROMO_CODE_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function loadActivePromo() {
  try {
    const raw = sessionStorage.getItem(PROMO_CODE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function promoSuccessMessage(promo) {
  if (!promo) return 'Промо кодът е приложен.';
  if (promoUsesLinePricing(promo)) {
    if (promo.discountType === 'margin_percentage') {
      return `Код ${promo.code}: ${promo.discount}% от маржа (специални цени).`;
    }
    const pct = promo.pricing_percent ?? 0;
    const mode = promo.pricing_mode === 'below_regular' ? 'под клиентска' : 'над доставна';
    return `Код ${promo.code}: персонални цени ${pct}% ${mode}.`;
  }
  const label = promo.discountType === 'percentage'
    ? `${promo.discount}%`
    : `${Number(promo.discount).toFixed(2)} €`;
  return `Код ${promo.code}: отстъпка ${label}.`;
}

function promoConditionLines(promo) {
  if (!promo) return [];
  const lines = [promoSuccessMessage(promo)];

  if (promo.discountType === 'percentage' && Number(promo.discount) > 0 && !promoUsesLinePricing(promo)) {
    lines.push(`Отстъпка ${promo.discount}% се прилага върху стойността на продуктите в количката.`);
  }
  if (promo.discountType === 'fixed' && Number(promo.discount) > 0 && !promoUsesLinePricing(promo)) {
    lines.push(`От количката се изважда ${Number(promo.discount).toFixed(2)} €.`);
  }
  if (promoUsesLinePricing(promo)) {
    if (promo.discountType === 'margin_percentage') {
      lines.push('Цените на артикулите се преизчисляват според маржа между клиентска и доставна цена.');
    } else if (promo.pricing_mode === 'below_regular') {
      lines.push('Показваме персонални цени под стандартната клиентска цена на всеки артикул.');
    } else if (promo.pricing_mode === 'above_b2b') {
      lines.push('Показваме персонални цени над доставната цена на всеки артикул.');
    }
    lines.push('Отстъпката се вижда директно в цените на продуктите, не като отделен ред в количката.');
  }

  if (promo.show_low_margin) {
    lines.push('Кодът отключва допълнителни продукти в каталога, които обикновено не се показват.');
  } else if (promo.code) {
    lines.push('Кодът се запазва за количката до премахване или изтичане на сесията.');
  }

  if (promo.validUntil) {
    const date = new Date(promo.validUntil);
    if (!Number.isNaN(date.getTime())) {
      lines.push(`Валиден до: ${date.toLocaleString('bg-BG', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })}.`);
    }
  }

  if (promo.maxUses) {
    const used = Number(promo.usedCount) || 0;
    const max = Number(promo.maxUses);
    lines.push(`Остават ${Math.max(0, max - used)} от ${max} възможни използвания на кода.`);
  }

  const description = String(promo.description || '').trim();
  if (description) lines.push(description);
  return lines;
}

function promoConditionsHtml(promo) {
  const lines = promoConditionLines(promo);
  if (!lines.length) return '';
  return `<ul class="pf-promo-conditions-list">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
}

export async function validatePortfolioPromo(code) {
  const res = await fetch(`${API_URL}/portfolio/validate-promo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: String(code || '').trim() }),
  });
  return res.json();
}

export async function applyPortfolioPromoCode(code) {
  const data = await validatePortfolioPromo(code);
  if (!data.valid) {
    return { ok: false, error: data.error || 'Невалиден промо код.' };
  }
  const promo = data.promoCode;
  saveActivePromo(promo);
  syncPromoCatalogUnlock(promo);
  notifyPromoChanged(promo);
  return { ok: true, promo, message: promoSuccessMessage(promo) };
}

export function clearPortfolioPromo() {
  saveActivePromo(null);
  syncPromoCatalogUnlock(null);
  notifyPromoChanged(null);
}

function setModalMessage(el, text, type = '') {
  if (!el) return;
  if (!text) {
    el.hidden = true;
    el.textContent = '';
    el.className = 'pf-promo-msg';
    return;
  }
  el.hidden = false;
  el.textContent = text;
  el.className = `pf-promo-msg ${type}`.trim();
}

function promoModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return null;
  return {
    modal,
    title: modal.querySelector('[data-pf-promo-title]'),
    form: modal.querySelector('[data-pf-promo-form]'),
    success: modal.querySelector('[data-pf-promo-success]'),
    conditions: modal.querySelector('[data-pf-promo-conditions]'),
    input: modal.querySelector('[data-pf-promo-input]'),
    apply: modal.querySelector('[data-pf-promo-apply]'),
    msg: modal.querySelector('[data-pf-promo-msg]'),
  };
}

function showPromoForm(m) {
  if (m.title) m.title.textContent = 'Промо код';
  if (m.form) m.form.hidden = false;
  if (m.success) m.success.hidden = true;
  if (m.conditions) m.conditions.innerHTML = '';
  setModalMessage(m.msg, '', '');
}

function showPromoSuccess(m, promo) {
  if (m.title) {
    m.title.textContent = promo?.code
      ? `Промо код ${promo.code} е активен`
      : 'Промо кодът е приложен';
  }
  if (m.conditions) m.conditions.innerHTML = promoConditionsHtml(promo);
  if (m.form) m.form.hidden = true;
  if (m.success) m.success.hidden = false;
  setModalMessage(m.msg, '', '');
}

const boundPromoModals = new Set();

function bindPromoModalClose(m, onClose) {
  if (boundPromoModals.has(m.modal.id)) return;
  boundPromoModals.add(m.modal.id);
  const close = () => {
    m.modal.classList.remove('active');
    m.modal.setAttribute('aria-hidden', 'true');
    onClose?.();
  };
  m.modal.querySelectorAll('[data-pf-promo-close]').forEach((btn) => btn.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && m.modal.classList.contains('active')) close();
  });
}

/** Show conditions modal (catalog or checkout). */
export function openPromoConditionsModal(promo, modalId = 'pf-promo-conditions-modal') {
  const m = promoModal(modalId);
  if (!m) return;
  bindPromoModalClose(m, m.form ? () => showPromoForm(m) : undefined);
  showPromoSuccess(m, promo);
  m.modal.classList.add('active');
  m.modal.setAttribute('aria-hidden', 'false');
}

/**
 * Homepage promo modal + optional trigger buttons.
 * @param {{ onApplied?: (promo: object) => void, modalId?: string }} [opts]
 */
export function initPortfolioPromoModal(opts = {}) {
  const m = promoModal(opts.modalId || 'pf-promo-modal');
  if (!m?.input || !m?.apply) return;

  const openers = document.querySelectorAll('[data-pf-promo-open]');
  bindPromoModalClose(m, () => showPromoForm(m));

  const open = () => {
    showPromoForm(m);
    m.modal.classList.add('active');
    m.modal.setAttribute('aria-hidden', 'false');
    const saved = loadActivePromo();
    if (saved?.code && !m.input.value) m.input.value = saved.code;
    setTimeout(() => m.input.focus(), 50);
  };

  openers.forEach((btn) => btn.addEventListener('click', open));

  const runApply = async () => {
    const code = m.input.value.trim();
    if (!code) {
      setModalMessage(m.msg, 'Въведете промо код.', 'error');
      return;
    }
    m.apply.disabled = true;
    setModalMessage(m.msg, 'Проверяваме кода…', '');
    try {
      const result = await applyPortfolioPromoCode(code);
      if (!result.ok) {
        setModalMessage(m.msg, result.error, 'error');
        return;
      }
      showPromoSuccess(m, result.promo);
      opts.onApplied?.(result.promo);
    } catch {
      setModalMessage(m.msg, 'Грешка при проверка на кода.', 'error');
    } finally {
      m.apply.disabled = false;
    }
  };

  m.apply.addEventListener('click', runApply);
  m.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runApply();
    }
  });

  const saved = loadActivePromo();
  if (saved?.code) {
    openers.forEach((btn) => btn.classList.add('pf-promo-chip--active'));
    openers.forEach((btn) => {
      const label = btn.querySelector('.pf-promo-chip-label');
      if (label) label.textContent = saved.code;
      else btn.setAttribute('title', `Промо: ${saved.code}`);
    });
  }
}
