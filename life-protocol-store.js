/**
 * Клиентско съхранение на персонален протокол (след закупуване на стак).
 */

export const MY_PROTOCOL_KEY = 'lifeMyProtocol';
export const PENDING_PROTOCOL_KEY = 'lifeProtocolPending';
export const SELECTED_TIER_KEY = 'lifeProtocolSelectedTier';
export const RESULT_SESSION_KEY = 'lifeProtocolResult';
export const RESULT_PERSISTENT_KEY = 'lifeProtocolResultPersistent';

const PROTOCOL_QUIZ_URL = 'life-protocol-quiz.html';
const MY_PROTOCOL_URL = 'life-my-protocol.html';

export function getMyProtocol() {
  try {
    return JSON.parse(localStorage.getItem(MY_PROTOCOL_KEY) || 'null');
  } catch {
    return null;
  }
}

export function hasPurchasedProtocol() {
  const p = getMyProtocol();
  return Boolean(p?.purchased && p?.selectedTier?.products?.length);
}

export function getPendingProtocolResult() {
  try {
    return (
      JSON.parse(sessionStorage.getItem(RESULT_SESSION_KEY) || 'null')
      || JSON.parse(localStorage.getItem(RESULT_PERSISTENT_KEY) || 'null')
    );
  } catch {
    return null;
  }
}

export function persistProtocolResult(data) {
  if (!data) return;
  try {
    sessionStorage.setItem(RESULT_SESSION_KEY, JSON.stringify(data));
    localStorage.setItem(RESULT_PERSISTENT_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not persist protocol result', e);
  }
}

/**
 * Запазва пълния протокол след успешна поръчка на стак.
 */
export function savePurchasedProtocol(resultData, tierKey, meta = {}) {
  if (!resultData?.tiers?.[tierKey]) return null;

  const tier = resultData.tiers[tierKey];
  const payload = {
    purchased: true,
    purchasedAt: Date.now(),
    orderId: meta.orderId || null,
    sessionId: resultData.sessionId || null,
    email: meta.email || resultData.email || null,
    tierKey,
    tierName: tier.name,
    analysis: resultData.analysis || '',
    selectedTier: tier,
    tiers: resultData.tiers,
    protocol_schedule: resultData.protocol_schedule || null,
    lifestyle_tips: resultData.lifestyle_tips || [],
    disclaimer: resultData.disclaimer || '',
    recommended_tier: resultData.recommended_tier || tierKey
  };

  localStorage.setItem(MY_PROTOCOL_KEY, JSON.stringify(payload));
  localStorage.setItem(SELECTED_TIER_KEY, JSON.stringify({
    tierName: tier.name,
    tierKey,
    monthly_total_eur: tier.monthly_total_eur,
    timestamp: Date.now()
  }));
  localStorage.removeItem(PENDING_PROTOCOL_KEY);
  return payload;
}

export function clearPurchasedProtocol() {
  localStorage.removeItem(MY_PROTOCOL_KEY);
}

export function getHeroPrimaryCta(defaultText = 'Започнете вашия протокол') {
  if (hasPurchasedProtocol()) {
    return {
      text: 'Моят протокол',
      action: 'link',
      target: MY_PROTOCOL_URL,
      variant: 'my-protocol'
    };
  }
  return {
    text: defaultText,
    action: 'link',
    target: PROTOCOL_QUIZ_URL,
    variant: 'quiz'
  };
}

export function getPremiumCta(defaultText = 'Получи своя протокол', defaultUrl = PROTOCOL_QUIZ_URL) {
  if (hasPurchasedProtocol()) {
    return {
      text: 'Създай нов протокол',
      url: `${PROTOCOL_QUIZ_URL}?replace=1`,
      variant: 'replace'
    };
  }
  return {
    text: defaultText,
    url: defaultUrl || PROTOCOL_QUIZ_URL,
    variant: 'quiz'
  };
}

export function getCtaButtonTarget() {
  return hasPurchasedProtocol() ? MY_PROTOCOL_URL : PROTOCOL_QUIZ_URL;
}
