import { API_URL } from './config.js';
import {
  CART_KEY, getCart, saveCart, updateCartBadges, showToast, formatPrice, initPortfolioPage, icon, escapeHtml,
  buildPortfolioProductUrl
} from './portfolio-shared.js';
import { sync, resolveGroupIdBySku } from './portfolio-cache.js';
import {
  validatePortfolioCustomer,
  validateCartHasSku,
  isValidBgPhone
} from './portfolio-order-validation.js';
import {
  validateCartOnServer as sharedValidateCart,
  setStockWarningBanner,
  syncCartPricesFromServer,
  promoUsesLinePricing
} from './portfolio-checkout-shared.js';
import { calculateCheckoutShipping } from './checkout-shipping.js';
import {
  applyPortfolioPromoCode,
  clearPortfolioPromo,
  loadActivePromo,
  promoSuccessMessage,
} from './portfolio-promo-ui.js';

let cart = getCart();
let activePromoCode = null;

const els = {};

function $(id) { return document.getElementById(id); }

function deliveryCustomerForShipping() {
  const deliveryCourier = $('delivery-courier')?.checked;
  const deliveryAddress = $('delivery-address')?.checked;
  return {
    deliveryMethod: deliveryCourier ? 'courier' : (deliveryAddress ? 'address' : 'courier'),
    courierCompany: $('courier-ekont')?.checked ? 'Econt' : 'Speedy'
  };
}

function calculateShipping(subtotal) {
  return calculateCheckoutShipping(subtotal, deliveryCustomerForShipping());
}

function getSubtotal() {
  return cart.reduce((s, p) => s + p.price * p.quantity, 0);
}

function getPromoDiscount(subtotal) {
  if (!activePromoCode) return 0;
  if (promoUsesLinePricing(activePromoCode)) return 0;
  if (activePromoCode.discountType === 'percentage') {
    return subtotal * (activePromoCode.discount / 100);
  }
  return Math.min(activePromoCode.discount, subtotal);
}

function updateSummary() {
  const subtotal = getSubtotal();
  const shipping = subtotal > 0 ? calculateShipping(subtotal) : 0;
  const discountAmount = getPromoDiscount(subtotal);
  const total = Math.max(0, subtotal - discountAmount + shipping);

  $('summary-subtotal').textContent = formatPrice(subtotal);
  $('summary-shipping').textContent = shipping === 0 && subtotal > 0 ? 'Безплатна' : formatPrice(shipping);
  $('summary-total').textContent = formatPrice(total);

  const discountRow = $('discount-row');
  if (discountRow) {
    discountRow.style.display = discountAmount > 0 ? 'flex' : 'none';
    $('summary-discount').textContent = `-${formatPrice(discountAmount)}`;
    const label = activePromoCode?.code ? ` (${activePromoCode.code})` : '';
    discountRow.querySelector('span:first-child').textContent = `Отстъпка${label}`;
  }
}

const SUBMIT_LABEL = 'Поръчай с наложен платеж';

function syncSubmitButtons({ disabled, label = SUBMIT_LABEL } = {}) {
  ['submit-btn', 'submit-btn-mobile'].forEach((id) => {
    const btn = $(id);
    if (!btn) return;
    btn.disabled = disabled;
    btn.textContent = label;
  });
}

function syncFloatingSubmit(hasItems) {
  const btn = $('submit-btn-mobile');
  if (!btn) return;
  btn.classList.toggle('pf-visible', hasItems);
  document.body.classList.toggle('pf-checkout-has-fab', hasItems);
}

function bindSubmitButtons() {
  ['submit-btn', 'submit-btn-mobile'].forEach((id) => {
    $(id)?.addEventListener('click', (e) => {
      e.preventDefault();
      submitOrder(e);
    });
  });
  $('checkout-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitOrder(e);
  });
}

function renderCartItemMedia(item, productUrl) {
  const safeName = escapeHtml(item.name);
  if (item.image) {
    const img = `<img src="${escapeHtml(item.image)}" alt="" class="pf-summary-img" loading="lazy" decoding="async">`;
    return productUrl
      ? `<a href="${escapeHtml(productUrl)}" class="pf-summary-product-link" aria-label="Преглед: ${safeName}">${img}</a>`
      : img;
  }
  const placeholder = '<div class="pf-summary-img pf-summary-img--empty"></div>';
  return productUrl
    ? `<a href="${escapeHtml(productUrl)}" class="pf-summary-product-link" aria-label="Преглед: ${safeName}">${placeholder}</a>`
    : placeholder;
}

function renderCartItemTitle(item, productUrl) {
  const safeName = escapeHtml(item.name);
  if (!productUrl) return `<strong>${safeName}</strong>`;
  return `<a href="${escapeHtml(productUrl)}" class="pf-summary-product-link pf-summary-product-name">${safeName}</a>`;
}

function hasStockWarning() {
  const banner = document.getElementById('cart-stock-warning');
  return banner && !banner.hidden && banner.textContent;
}

function renderCart() {
  const list = $('product-list');
  if (!cart.length) {
    list.innerHTML = '<li class="pf-empty-cart"><p>Количката е празна.</p><a href="portfolio.html" class="pf-btn pf-btn-outline">Към каталога</a></li>';
    setStockWarningBanner('');
    syncSubmitButtons({ disabled: true });
    syncFloatingSubmit(false);
    updateSummary();
    return;
  }

  list.innerHTML = cart.map((item, idx) => {
    const productUrl = item.group_id
      ? buildPortfolioProductUrl(item.group_id, item.sku_id || item.id)
      : null;
    return `
    <li class="pf-summary-item" data-idx="${idx}">
      ${renderCartItemMedia(item, productUrl)}
      <div class="pf-summary-info">
        ${renderCartItemTitle(item, productUrl)}
        ${productUrl ? `<a href="${escapeHtml(productUrl)}" class="pf-summary-view-link">Преглед на продукта</a>` : ''}
        <div class="pf-qty-row">
          <button type="button" class="pf-qty-btn" data-action="minus" data-idx="${idx}" aria-label="Намали">−</button>
          <span>${item.quantity}</span>
          <button type="button" class="pf-qty-btn" data-action="plus" data-idx="${idx}" aria-label="Увеличи">+</button>
        </div>
      </div>
      <div class="pf-summary-price">${formatPrice(item.price * item.quantity)}</div>
      <button type="button" class="pf-remove-btn" data-action="remove" data-idx="${idx}" aria-label="Премахни">${icon('x', { size: 16 })}</button>
    </li>`;
  }).join('');

  syncSubmitButtons({ disabled: !!hasStockWarning() });
  syncFloatingSubmit(true);
  updateSummary();
  updateCartBadges();

  list.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.idx, 10);
      const action = btn.dataset.action;
      if (action === 'plus') cart[i].quantity++;
      else if (action === 'minus') {
        cart[i].quantity--;
        if (cart[i].quantity <= 0) cart.splice(i, 1);
      } else if (action === 'remove') cart.splice(i, 1);
      saveCart(cart);
      renderCart();
    });
  });
}

async function validateCartOnServer({ silent = false } = {}) {
  const ok = await sharedValidateCart({
    apiUrl: API_URL,
    products: cart,
    promoCode: activePromoCode?.code,
    project: 'portfolio',
    silent,
    showToast,
    onPriceSync: (serverProducts) => {
      if (syncCartPricesFromServer(cart, serverProducts)) {
        saveCart(cart);
        renderCart();
      }
    }
  });
  syncSubmitButtons({ disabled: !ok || !!hasStockWarning() });
  return ok;
}

function toggleDeliveryFields() {
  const toAddress = $('delivery-address')?.checked;
  $('address-fields')?.classList.toggle('pf-visible', toAddress);
  $('courier-fields')?.classList.toggle('pf-visible', !toAddress);
  $('address').required = toAddress;
  $('city').required = toAddress;
  $('postcode').required = toAddress;
  updateSummary();
}

function toggleCourierWidgets() {
  const speedy = $('courier-speedy')?.checked;
  const ekont = $('courier-ekont')?.checked;
  if (speedy) {
    $('speedy-widget').style.display = 'block';
    $('ekont-widget').style.display = 'none';
  } else if (ekont) {
    $('speedy-widget').style.display = 'none';
    $('ekont-widget').style.display = 'block';
    if (!ekontOfficesLoaded) loadEcontOffices();
  } else {
    $('speedy-widget').style.display = 'none';
    $('ekont-widget').style.display = 'none';
  }
  updateSummary();
}

function openSpeedyMap() {
  $('speedy-map-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSpeedyMap() {
  $('speedy-map-modal').classList.remove('active');
  document.body.style.overflow = '';
}

let ekontOfficesLoaded = false;
let allEcontOffices = [];
let selectedEcontOffice = null;
let ekontChangeHandlerAttached = false;

function econtOfficeLabel(office) {
  let name = office.name;
  if (office.isAPS === true) name += ' (ЕКОНТОМАТ)';
  else if (office.isMPS === true) name += ' (МОБИЛЕН)';
  return name;
}

function loadEcontOffices() {
  const status = $('ekont-status-text');
  const ekontInput = $('ekont-office-search');
  const ekontDropdown = $('econt-offices-dropdown');
  const hiddenInput = $('final-office-id');

  fetch('https://ee.econt.com/services/Nomenclatures/NomenclaturesService.getOffices.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryCode: 'BGR' })
  })
    .then((r) => r.json())
    .then((data) => {
      if (data?.offices) {
        allEcontOffices = data.offices;
        status.textContent = '✓ Готово';
        status.classList.add('pf-hint--ok');
        ekontOfficesLoaded = true;
      }
    })
    .catch(() => {
      status.textContent = 'Грешка при зареждане. Опитайте отново.';
      status.classList.remove('pf-hint--ok');
      status.classList.add('pf-hint--error');
    });

  if (!ekontChangeHandlerAttached) {
    ekontInput?.addEventListener('input', () => {
      const searchValue = ekontInput.value.toLowerCase().trim();
      if (searchValue.length < 2) {
        ekontDropdown.style.display = 'none';
        return;
      }

      const filteredOffices = allEcontOffices.filter((office) => {
        const cleanName = econtOfficeLabel(office);
        const fullAddr = office.address?.fullAddress || '';
        return cleanName.toLowerCase().includes(searchValue) || fullAddr.toLowerCase().includes(searchValue);
      });

      if (filteredOffices.length > 0) {
        ekontDropdown.innerHTML = filteredOffices.map((office) => {
          const cleanName = econtOfficeLabel(office);
          const fullAddr = office.address?.fullAddress || '';
          return `<div class="pf-dropdown-item" data-office-code="${escapeHtml(office.code)}"><strong>${escapeHtml(cleanName)}</strong><span>${escapeHtml(fullAddr)}</span></div>`;
        }).join('');
        ekontDropdown.style.display = 'block';
      } else {
        ekontDropdown.innerHTML = '<div class="pf-dropdown-item pf-dropdown-empty">Няма намерени офиси</div>';
        ekontDropdown.style.display = 'block';
      }
    });

    ekontDropdown?.addEventListener('click', (e) => {
      const item = e.target.closest('[data-office-code]');
      if (!item?.dataset.officeCode) return;
      const office = allEcontOffices.find((o) => o.code === item.dataset.officeCode);
      if (!office) return;

      const cleanName = econtOfficeLabel(office);
      const fullAddr = office.address?.fullAddress || '';
      ekontInput.value = cleanName;
      hiddenInput.value = office.code;
      selectedEcontOffice = office;
      status.textContent = `✓ Избран: ${cleanName}${fullAddr ? ` - ${fullAddr}` : ''}`;
      status.classList.add('pf-hint--ok');
      ekontDropdown.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
      if (!ekontInput?.contains(e.target) && !ekontDropdown?.contains(e.target)) {
        ekontDropdown.style.display = 'none';
      }
    });

    ekontInput?.addEventListener('focus', () => {
      if (ekontInput.value.length >= 2) {
        ekontInput.dispatchEvent(new Event('input'));
      }
    });

    ekontChangeHandlerAttached = true;
  }
}

function buildCustomerPayload() {
  const payload = {
    firstName: $('first-name')?.value?.trim() || '',
    lastName: $('last-name')?.value?.trim() || '',
    phone: $('phone')?.value?.trim() || '',
    email: $('email')?.value?.trim() || '',
    paymentMethod: 'cod',
    policyConsent: $('policy-consent')?.checked === true,
    terms: $('terms')?.checked === true
  };

  if ($('delivery-courier')?.checked) {
    payload.deliveryMethod = 'courier';
    if ($('courier-speedy')?.checked) {
      payload.courierCompany = 'Speedy';
      payload.courierOfficeId = $('final-speedy-id')?.value?.trim() || '';
      payload.courierOfficeName = $('speedy-selected-name')?.textContent?.trim() || '';
      payload.courierOfficeAddress = $('speedy-selected-addr')?.textContent?.trim() || '';
      payload.speedy_office_id = payload.courierOfficeId;
    } else {
      payload.courierCompany = 'Econt';
      payload.courierOfficeId = $('final-office-id')?.value?.trim() || '';
      if (selectedEcontOffice) {
        payload.courierOfficeName = econtOfficeLabel(selectedEcontOffice);
        payload.courierOfficeAddress = selectedEcontOffice.address?.fullAddress || '';
      } else {
        payload.courierOfficeName = '';
        payload.courierOfficeAddress = '';
      }
    }
  } else {
    payload.deliveryMethod = 'address';
    payload.address = $('address')?.value?.trim() || '';
    payload.city = $('city')?.value?.trim() || '';
    payload.postcode = $('postcode')?.value?.trim() || '';
  }

  return payload;
}

function markInvalidFields(customerCheck) {
  const setInvalid = (id, invalid) => $(id)?.classList.toggle('is-invalid', invalid);

  setInvalid('first-name', (customerCheck.errors || []).some((e) => e.includes('Името')));
  setInvalid('last-name', (customerCheck.errors || []).some((e) => e.includes('Фамилия')));
  setInvalid('phone', (customerCheck.errors || []).some((e) => e.includes('телефон')));
  setInvalid('email', (customerCheck.errors || []).some((e) => e.includes('email')));
  setInvalid('address', (customerCheck.errors || []).some((e) => e.includes('адрес')));
  setInvalid('city', (customerCheck.errors || []).some((e) => e.includes('град')));
  setInvalid('postcode', (customerCheck.errors || []).some((e) => e.includes('пощенски')));
}

function scrollToFirstInvalid() {
  const firstInvalid = document.querySelector('.is-invalid, .pf-field input:invalid, .pf-check input.is-invalid');
  firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (typeof firstInvalid?.focus === 'function') {
    try { firstInvalid.focus({ preventScroll: true }); } catch { firstInvalid.focus(); }
  }
}

function validateForm() {
  const customer = buildCustomerPayload();
  const customerCheck = validatePortfolioCustomer(customer);
  markInvalidFields(customerCheck);

  const cartCheck = validateCartHasSku(cart);
  if (!cartCheck.valid) {
    showToast(cartCheck.errors[0], 'error');
    return false;
  }

  if (!customerCheck.valid) {
    showToast(customerCheck.errors[0], 'error');
    scrollToFirstInvalid();
    return false;
  }

  return true;
}

async function submitOrder(e) {
  e.preventDefault();
  if (!cart.length || !validateForm()) return;

  syncSubmitButtons({ disabled: true, label: 'Проверка на наличност...' });

  try {
    await sync({ force: true });
  } catch { /* validate-cart uses server snapshot */ }

  const stockOk = await validateCartOnServer();
  if (!stockOk) {
    syncSubmitButtons({ disabled: false });
    return;
  }

  syncSubmitButtons({ disabled: true, label: 'Изпращане...' });

  const customer = buildCustomerPayload();
  const subtotal = getSubtotal();
  const shipping = calculateShipping(subtotal);
  const total = subtotal - getPromoDiscount(subtotal) + shipping;

  try {
    const res = await fetch(`${API_URL}/portfolio/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer,
        products: cart,
        promoCode: activePromoCode?.code || undefined,
        summary: {
          subtotal: formatPrice(subtotal),
          shipping: shipping === 0 ? 'Безплатна' : formatPrice(shipping),
          total: formatPrice(total)
        }
      })
    });
    const data = await res.json();
    if (res.status !== 201 || !data.success || !data.order?.id) {
      throw new Error(data.error || 'Поръчката не беше приета. Проверете данните и опитайте отново.');
    }

    localStorage.removeItem(CART_KEY);
    sessionStorage.setItem('pf_last_order', JSON.stringify(data.order));
    window.location.href = `portfolio-order-success.html?id=${encodeURIComponent(data.order.id)}`;
  } catch (err) {
    showToast(err.message || 'Грешка при изпращане.', 'error');
    syncSubmitButtons({ disabled: false });
  }
}

function setPromoMessage(text, type = '') {
  ['promo-message', 'promo-message-summary'].forEach((id) => {
    const el = $(id);
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'pf-promo-msg';
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.className = `pf-promo-msg ${type}`;
  });
}

function syncPromoRemoveButtons() {
  const show = !!activePromoCode;
  ['remove-promo-btn', 'remove-promo-btn-summary'].forEach((id) => {
    const el = $(id);
    if (el) el.hidden = !show;
  });
}

async function removePromoCode() {
  activePromoCode = null;
  clearPortfolioPromo();
  $('promo-code-input') && ($('promo-code-input').value = '');
  $('promo-code-input-summary') && ($('promo-code-input-summary').value = '');
  setPromoMessage('Промо кодът е премахнат.', 'success');
  syncPromoRemoveButtons();
  await validateCartOnServer({ silent: true });
  updateSummary();
}

async function applyPromoCode() {
  const code = ($('promo-code-input')?.value || $('promo-code-input-summary')?.value || '').trim();
  if (!code) {
    setPromoMessage('Въведете промо код.', 'error');
    return;
  }

  const btn = $('apply-promo-btn') || $('apply-promo-btn-summary');
  if (btn) btn.disabled = true;

  try {
    const result = await applyPortfolioPromoCode(code);
    if (!result.ok) {
      activePromoCode = null;
      clearPortfolioPromo();
      setPromoMessage(result.error, 'error');
      updateSummary();
      return;
    }
    activePromoCode = result.promo;
    setPromoMessage(result.message, 'success');
    if (promoUsesLinePricing(result.promo)) {
      await validateCartOnServer({ silent: true });
    }
    if ($('promo-code-input')) $('promo-code-input').value = result.promo.code;
    if ($('promo-code-input-summary')) $('promo-code-input-summary').value = result.promo.code;
    syncPromoRemoveButtons();
    updateSummary();
  } catch {
    setPromoMessage('Грешка при проверка на промо кода.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function setupSpeedy() {
  $('open-speedy-map-btn')?.addEventListener('click', openSpeedyMap);
  $('close-speedy-map-btn')?.addEventListener('click', closeSpeedyMap);
  $('speedy-map-overlay')?.addEventListener('click', closeSpeedyMap);

  window.addEventListener('message', (event) => {
    if (event.origin.indexOf('speedy.bg') === -1) return;
    const data = event.data;
    if (data?.id) {
      $('final-speedy-id').value = data.id;
      $('speedy-selected-name').textContent = data.name || '';
      const addr = data.address?.fullAddressString || '';
      $('speedy-selected-addr').textContent = addr;
      $('speedy-selected-info').style.display = 'block';
      const openBtn = $('open-speedy-map-btn');
      if (openBtn) openBtn.textContent = 'Смени офиса';
      closeSpeedyMap();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('speedy-map-modal')?.classList.contains('active')) {
      closeSpeedyMap();
    }
  });
}

async function enrichCartGroupIds() {
  await sync();
  let changed = false;
  for (const item of cart) {
    if (item.group_id) continue;
    const groupId = await resolveGroupIdBySku(item.sku_id || item.id);
    if (groupId) {
      item.group_id = groupId;
      changed = true;
    }
  }
  if (changed) saveCart(cart);
}

async function init() {
  await initPortfolioPage({ active: 'checkout', settingsOnly: true });
  document.body.classList.add('pf-body--checkout');
  cart = getCart();
  await enrichCartGroupIds();
  renderCart();

  const savedPromo = loadActivePromo();
  if (savedPromo?.code) {
    activePromoCode = savedPromo;
    if ($('promo-code-input')) $('promo-code-input').value = savedPromo.code;
    if ($('promo-code-input-summary')) $('promo-code-input-summary').value = savedPromo.code;
    syncPromoRemoveButtons();
    setPromoMessage(promoSuccessMessage(savedPromo), 'success');
  }

  if (cart.length) validateCartOnServer({ silent: true });

  $('apply-promo-btn')?.addEventListener('click', applyPromoCode);
  $('apply-promo-btn-summary')?.addEventListener('click', applyPromoCode);
  $('remove-promo-btn')?.addEventListener('click', removePromoCode);
  $('remove-promo-btn-summary')?.addEventListener('click', removePromoCode);
  $('promo-code-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applyPromoCode(); }
  });
  $('promo-code-input-summary')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applyPromoCode(); }
  });

  $('delivery-address')?.addEventListener('change', toggleDeliveryFields);
  $('delivery-courier')?.addEventListener('change', toggleDeliveryFields);
  $('courier-speedy')?.addEventListener('change', toggleCourierWidgets);
  $('courier-ekont')?.addEventListener('change', toggleCourierWidgets);
  bindSubmitButtons();

  ['first-name', 'last-name', 'phone', 'email', 'address', 'city', 'postcode'].forEach((id) => {
    $(id)?.addEventListener('input', () => $(id)?.classList.remove('is-invalid'));
  });
  $('phone')?.addEventListener('blur', () => {
    const phone = $('phone')?.value?.trim();
    if (phone && !isValidBgPhone(phone)) {
      $('phone')?.classList.add('is-invalid');
    }
  });

  setupSpeedy();
  toggleDeliveryFields();
  toggleCourierWidgets();
}

init();
