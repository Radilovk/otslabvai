/**
 * Portfolio promo code UI — homepage modal + session handoff to checkout.
 */

import { API_URL } from './config.js';
import { setLowMarginPromoUnlock, clearLowMarginPromoUnlock } from './product-visibility.js';
import { promoUsesLinePricing } from './portfolio-checkout-shared.js';

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
    const mode = promo.pricing_mode === 'below_regular' ? 'под препоръчителна' : 'над доставна';
    return `Код ${promo.code}: персонални цени ${pct}% ${mode}.`;
  }
  const label = promo.discountType === 'percentage'
    ? `${promo.discount}%`
    : `${Number(promo.discount).toFixed(2)} €`;
  return `Код ${promo.code}: отстъпка ${label}.`;
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
  setLowMarginPromoUnlock(promo);
  return { ok: true, promo, message: promoSuccessMessage(promo) };
}

export function clearPortfolioPromo() {
  saveActivePromo(null);
  clearLowMarginPromoUnlock();
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

/**
 * Homepage promo modal + optional trigger buttons.
 * @param {{ onApplied?: (promo: object) => void }} [opts]
 */
export function initPortfolioPromoModal(opts = {}) {
  const modal = document.getElementById('pf-promo-modal');
  const input = document.getElementById('pf-promo-modal-input');
  const applyBtn = document.getElementById('pf-promo-modal-apply');
  const msg = document.getElementById('pf-promo-modal-msg');
  if (!modal || !input || !applyBtn) return;

  const openers = document.querySelectorAll('[data-pf-promo-open]');
  const closers = modal.querySelectorAll('[data-pf-promo-close]');

  const open = () => {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    const saved = loadActivePromo();
    if (saved?.code && !input.value) input.value = saved.code;
    setTimeout(() => input.focus(), 50);
  };

  const close = () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  };

  openers.forEach((btn) => btn.addEventListener('click', open));
  closers.forEach((btn) => btn.addEventListener('click', close));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) close();
  });

  const runApply = async () => {
    const code = input.value.trim();
    if (!code) {
      setModalMessage(msg, 'Въведете промо код.', 'error');
      return;
    }
    applyBtn.disabled = true;
    setModalMessage(msg, 'Проверяваме кода…', '');
    try {
      const result = await applyPortfolioPromoCode(code);
      if (!result.ok) {
        setModalMessage(msg, result.error, 'error');
        return;
      }
      setModalMessage(msg, result.message, 'success');
      opts.onApplied?.(result.promo);
      setTimeout(close, 1200);
    } catch {
      setModalMessage(msg, 'Грешка при проверка на кода.', 'error');
    } finally {
      applyBtn.disabled = false;
    }
  };

  applyBtn.addEventListener('click', runApply);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runApply();
    }
  });

  const saved = loadActivePromo();
  if (saved?.code) {
    openers.forEach((btn) => btn.classList.add('pf-promo-chip--active'));
    btnSetLabel(openers, saved.code);
  }
}

function btnSetLabel(buttons, code) {
  buttons.forEach((btn) => {
    const label = btn.querySelector('.pf-promo-chip-label');
    if (label) label.textContent = code;
    else btn.setAttribute('title', `Промо: ${code}`);
  });
}
