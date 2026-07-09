/**
 * Shared portfolio order validation (client checkout + server API).
 * Order is rejected unless every required field passes.
 */

export function isTruthyConsent(value) {
  return value === true || value === 'true' || value === 'on' || value === '1' || value === 1;
}

export function normalizePhone(phone) {
  if (phone == null) return '';
  return String(phone).replace(/[\s\-()]/g, '');
}

export function isValidBgPhone(phone) {
  const p = normalizePhone(phone);
  return /^\+359[0-9]{8,9}$/.test(p) || /^0[0-9]{8,9}$/.test(p);
}

export function isValidEmail(email) {
  if (!email?.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePortfolioCustomer(customer) {
  const errors = [];
  if (!customer || typeof customer !== 'object') {
    return { valid: false, errors: ['Липсват данни за клиент.'] };
  }

  const firstName = (customer.firstName || '').trim();
  const lastName = (customer.lastName || '').trim();
  const phone = (customer.phone || '').trim();
  const email = (customer.email || '').trim();

  if (firstName.length < 2) errors.push('Името трябва да е поне 2 символа.');
  if (lastName.length < 2) errors.push('Фамилията трябва да е поне 2 символа.');
  if (!isValidBgPhone(phone)) errors.push('Въведете валиден телефон (+359... или 0...).');
  if (email && !isValidEmail(email)) errors.push('Въведете валиден email адрес.');

  if (!isTruthyConsent(customer.policyConsent)) {
    errors.push('Трябва да приемете политиката за поверителност.');
  }
  if (!isTruthyConsent(customer.terms)) {
    errors.push('Трябва да приемете общите условия.');
  }

  const method = customer.deliveryMethod;
  if (method === 'courier') {
    const company = customer.courierCompany;
    if (company !== 'Speedy' && company !== 'Econt') {
      errors.push('Изберете куриер (Speedy или Econt).');
    }
    const officeId = String(
      customer.courierOfficeId || customer.speedy_office_id || customer.office_id || ''
    ).trim();
    if (!officeId) errors.push('Изберете офис на куриер.');
    if (!(customer.courierOfficeName || '').trim()) {
      errors.push('Липсва избран офис. Изберете офис от картата или списъка.');
    }
  } else if (method === 'address') {
    if (!(customer.address || '').trim()) errors.push('Попълнете адрес за доставка.');
    if (!(customer.city || '').trim()) errors.push('Попълнете град.');
    if (!(customer.postcode || '').trim()) errors.push('Попълнете пощенски код.');
  } else {
    errors.push('Изберете метод на доставка.');
  }

  return { valid: errors.length === 0, errors };
}

export function sanitizePortfolioCustomer(customer) {
  const officeId = String(
    customer.courierOfficeId || customer.speedy_office_id || customer.office_id || ''
  ).trim();

  return {
    firstName: (customer.firstName || '').trim(),
    lastName: (customer.lastName || '').trim(),
    phone: normalizePhone(customer.phone),
    email: (customer.email || '').trim(),
    deliveryMethod: customer.deliveryMethod,
    courierCompany: customer.courierCompany || null,
    courierOfficeId: officeId || null,
    courierOfficeName: (customer.courierOfficeName || '').trim() || null,
    courierOfficeAddress: (customer.courierOfficeAddress || '').trim() || null,
    speedy_office_id: customer.deliveryMethod === 'courier' && customer.courierCompany === 'Speedy'
      ? officeId
      : null,
    address: (customer.address || '').trim() || null,
    city: (customer.city || '').trim() || null,
    postcode: (customer.postcode || '').trim() || null,
    paymentMethod: customer.paymentMethod || 'cod',
    policyConsent: isTruthyConsent(customer.policyConsent),
    terms: isTruthyConsent(customer.terms)
  };
}

export function validateCartHasSku(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return { valid: false, errors: ['Количката е празна.'] };
  }
  const errors = [];
  for (const p of products) {
    const sku = String(p.sku_id || p.id || '').trim();
    const qty = Number(p.quantity);
    if (!sku) errors.push('Липсва продукт в количката. Добавете отново от каталога.');
    if (!Number.isFinite(qty) || qty < 1 || qty > 99) {
      errors.push('Невалидно количество в количката.');
    }
  }
  return { valid: errors.length === 0, errors };
}
