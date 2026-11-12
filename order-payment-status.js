/**
 * Страница след плащане: пита сървъра за статуса на поръчката, докато Stripe потвърди плащането.
 * Количката се изчиства само при платена поръчка — при отказ клиентът може да опита отново.
 */

const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {string} apiUrl
 * @param {string} orderId
 * @returns {Promise<{ state: 'paid'|'pending'|'unpaid'|'missing'|'error', order?: object, error?: string }>}
 */
export async function waitForOrderPayment(apiUrl, orderId, { attempts = POLL_ATTEMPTS, intervalMs = POLL_INTERVAL_MS } = {}) {
  let last = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${apiUrl}/portfolio/order?id=${encodeURIComponent(orderId)}`, { cache: 'no-cache' });
      const data = await res.json();
      if (!res.ok || !data.id) return { state: 'missing', error: data.error };
      last = data;
      if (data.payment_status === 'paid' || !data.payment_status) return { state: 'paid', order: data };
      if (data.payment_status === 'expired') return { state: 'unpaid', order: data };
    } catch {
      if (i === attempts - 1) return { state: 'error' };
    }
    if (i < attempts - 1) await sleep(intervalMs);
  }
  return { state: 'pending', order: last };
}

export const CHECKOUT_SUBMIT_LABEL = 'Плати с карта';
export const PAYMENT_CANCELLED_MESSAGE = 'Плащането не беше завършено. Количката е запазена — можете да опитате отново.';
