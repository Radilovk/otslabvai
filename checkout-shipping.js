/**
 * Shared checkout shipping calculation (client + server).
 */

const FREE_SHIPPING_THRESHOLD = 100;

/**
 * @param {number} subtotal - product subtotal after line promos, before cart discount
 * @param {object} customer - sanitized customer with deliveryMethod, courierCompany
 */
export function calculateCheckoutShipping(subtotal, customer = {}) {
  const amount = Number(subtotal) || 0;
  if (amount <= 0) return 0;
  if (amount >= FREE_SHIPPING_THRESHOLD) return 0;

  const method = customer.deliveryMethod;
  let basePrice = 1.52;
  let codRate = 0.0096;

  if (method === 'courier') {
    if (customer.courierCompany === 'Econt') {
      basePrice = 3.1;
      codRate = 0.0298;
    }
  } else if (method === 'address') {
    basePrice = 4.55;
    codRate = 0.0298;
  }

  return roundMoney(basePrice + amount * codRate);
}

export function formatShippingLabel(amount) {
  if (amount === 0) return 'Безплатна';
  return `${roundMoney(amount).toFixed(2)} €`;
}

function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
