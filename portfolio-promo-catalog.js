/** Client session: promo codes that unlock low-margin catalog listings. */

export const LOW_MARGIN_PROMO_KEY = 'pfPromoShowLowMargin';
export const LOW_MARGIN_PROMO_CODE_KEY = 'pfPromoLowMarginCode';

export function isLowMarginCatalogUnlocked() {
  try {
    return sessionStorage.getItem(LOW_MARGIN_PROMO_KEY) === '1';
  } catch {
    return false;
  }
}

export function getLowMarginPromoCode() {
  try {
    return sessionStorage.getItem(LOW_MARGIN_PROMO_CODE_KEY) || '';
  } catch {
    return '';
  }
}

/** @param {{ show_low_margin?: boolean, code?: string } | null} promo */
export function setLowMarginCatalogUnlock(promo) {
  try {
    if (promo?.show_low_margin) {
      sessionStorage.setItem(LOW_MARGIN_PROMO_KEY, '1');
      if (promo.code) sessionStorage.setItem(LOW_MARGIN_PROMO_CODE_KEY, promo.code);
    } else {
      sessionStorage.removeItem(LOW_MARGIN_PROMO_KEY);
      sessionStorage.removeItem(LOW_MARGIN_PROMO_CODE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function clearLowMarginCatalogUnlock() {
  setLowMarginCatalogUnlock(null);
}
