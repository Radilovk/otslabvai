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

function formatPromoValidUntil(validUntil) {
  if (!validUntil) return '';
  const date = new Date(validUntil);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('bg-BG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Human-readable promo conditions for the client success modal. */
export function buildPromoConditions(promo) {
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

  const until = formatPromoValidUntil(promo.validUntil);
  if (until) lines.push(`Валиден до: ${until}.`);

  if (promo.maxUses) {
    const used = Number(promo.usedCount) || 0;
    const max = Number(promo.maxUses);
    const remaining = Math.max(0, max - used);
    lines.push(`Остават ${remaining} от ${max} възможни използвания на кода.`);
  }

  const description = String(promo.description || '').trim();
  if (description) lines.push(description);

  return lines;
}

export function buildPromoConditionsHtml(promo) {
  const lines = buildPromoConditions(promo);
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

function getPromoModalEls(modalId = 'pf-promo-modal') {
  const modal = document.getElementById(modalId);
  if (!modal) return null;
  return {
    modal,
    title: modal.querySelector('[data-pf-promo-title]') || document.getElementById('pf-promo-modal-title'),
    formBlock: modal.querySelector('[data-pf-promo-form]'),
    successBlock: modal.querySelector('[data-pf-promo-success]'),
    conditionsEl: modal.querySelector('[data-pf-promo-conditions]'),
    input: modal.querySelector('[data-pf-promo-input]') || document.getElementById('pf-promo-modal-input'),
    applyBtn: modal.querySelector('[data-pf-promo-apply]') || document.getElementById('pf-promo-modal-apply'),
    msg: modal.querySelector('[data-pf-promo-msg]') || document.getElementById('pf-promo-modal-msg'),
    closers: modal.querySelectorAll('[data-pf-promo-close]'),
    openers: document.querySelectorAll('[data-pf-promo-open]'),
  };
}

export function showPromoConditionsView(modalId = 'pf-promo-modal', promo) {
  const els = getPromoModalEls(modalId);
  if (!els) return;

  if (els.title) {
    els.title.textContent = promo?.code
      ? `Промо код ${promo.code} е активен`
      : 'Промо кодът е приложен';
  }
  if (els.conditionsEl) {
    els.conditionsEl.innerHTML = buildPromoConditionsHtml(promo);
  }
  if (els.formBlock) els.formBlock.hidden = true;
  if (els.successBlock) els.successBlock.hidden = false;
  setModalMessage(els.msg, '', '');
}

export function resetPromoInputView(modalId = 'pf-promo-modal') {
  const els = getPromoModalEls(modalId);
  if (!els) return;

  if (els.formBlock) els.formBlock.hidden = false;
  if (els.successBlock) els.successBlock.hidden = true;
  if (els.title) els.title.textContent = 'Промо код';
  if (els.conditionsEl) els.conditionsEl.innerHTML = '';
  setModalMessage(els.msg, '', '');
}

export function openPromoConditionsModal(promo, modalId = 'pf-promo-modal') {
  initPromoConditionsModal(modalId);
  const els = getPromoModalEls(modalId);
  if (!els) return;

  showPromoConditionsView(modalId, promo);
  els.modal.classList.add('active');
  els.modal.setAttribute('aria-hidden', 'false');
}

/** Bind close handlers for a conditions-only modal (checkout). */
export function initPromoConditionsModal(modalId = 'pf-promo-conditions-modal') {
  const modal = document.getElementById(modalId);
  if (!modal || modal.dataset.pfPromoBound === '1') return;
  modal.dataset.pfPromoBound = '1';

  const close = () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  };

  modal.querySelectorAll('[data-pf-promo-close]').forEach((btn) => {
    btn.addEventListener('click', close);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) close();
  });
}

/**
 * Homepage promo modal + optional trigger buttons.
 * @param {{ onApplied?: (promo: object) => void, modalId?: string }} [opts]
 */
export function initPortfolioPromoModal(opts = {}) {
  const modalId = opts.modalId || 'pf-promo-modal';
  const els = getPromoModalEls(modalId);
  if (!els || !els.input || !els.applyBtn) return;

  const open = () => {
    resetPromoInputView(modalId);
    els.modal.classList.add('active');
    els.modal.setAttribute('aria-hidden', 'false');
    const saved = loadActivePromo();
    if (saved?.code && !els.input.value) els.input.value = saved.code;
    setTimeout(() => els.input.focus(), 50);
  };

  const close = () => {
    els.modal.classList.remove('active');
    els.modal.setAttribute('aria-hidden', 'true');
    resetPromoInputView(modalId);
  };

  els.openers.forEach((btn) => btn.addEventListener('click', open));
  els.closers.forEach((btn) => btn.addEventListener('click', close));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal.classList.contains('active')) close();
  });

  const runApply = async () => {
    const code = els.input.value.trim();
    if (!code) {
      setModalMessage(els.msg, 'Въведете промо код.', 'error');
      return;
    }
    els.applyBtn.disabled = true;
    setModalMessage(els.msg, 'Проверяваме кода…', '');
    try {
      const result = await applyPortfolioPromoCode(code);
      if (!result.ok) {
        setModalMessage(els.msg, result.error, 'error');
        return;
      }
      showPromoConditionsView(modalId, result.promo);
      opts.onApplied?.(result.promo);
    } catch {
      setModalMessage(els.msg, 'Грешка при проверка на кода.', 'error');
    } finally {
      els.applyBtn.disabled = false;
    }
  };

  els.applyBtn.addEventListener('click', runApply);
  els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runApply();
    }
  });

  const saved = loadActivePromo();
  if (saved?.code) {
    els.openers.forEach((btn) => btn.classList.add('pf-promo-chip--active'));
    btnSetLabel(els.openers, saved.code);
  }
}

function btnSetLabel(buttons, code) {
  buttons.forEach((btn) => {
    const label = btn.querySelector('.pf-promo-chip-label');
    if (label) label.textContent = code;
    else btn.setAttribute('title', `Промо: ${code}`);
  });
}
