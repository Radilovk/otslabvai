import { API_URL } from './config.js';
import {
  CART_KEY, getCart, saveCart, updateCartBadges, showToast, formatPrice, initPortfolioPage, icon, escapeHtml
} from './portfolio-shared.js';

let cart = getCart();
let activePromoCode = null;

const els = {};

function $(id) { return document.getElementById(id); }

function calculateShipping(subtotal) {
  if (subtotal >= 100) return 0;
  const deliveryCourier = $('delivery-courier')?.checked;
  const deliveryAddress = $('delivery-address')?.checked;
  let basePrice = 1.52;
  let codRate = 0.0096;

  if (deliveryCourier) {
    if ($('courier-ekont')?.checked) {
      basePrice = 3.1;
      codRate = 0.0298;
    }
  } else if (deliveryAddress) {
    basePrice = 4.55;
    codRate = 0.0298;
  }
  return basePrice + subtotal * codRate;
}

function getSubtotal() {
  return cart.reduce((s, p) => s + p.price * p.quantity, 0);
}

function getPromoDiscount(subtotal) {
  if (!activePromoCode) return 0;
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
  const actionTotal = $('checkout-action-total');
  if (actionTotal) actionTotal.textContent = formatPrice(total);

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

function syncCheckoutActionBar(hasItems) {
  const bar = $('checkout-action-bar');
  if (!bar) return;
  bar.hidden = !hasItems;
  document.body.classList.toggle('pf-checkout-has-bar', hasItems);
}

function renderCart() {
  const list = $('product-list');
  if (!cart.length) {
    list.innerHTML = '<li class="pf-empty-cart"><p>Количката е празна.</p><a href="portfolio.html" class="pf-btn pf-btn-outline">Към каталога</a></li>';
    syncSubmitButtons({ disabled: true });
    syncCheckoutActionBar(false);
    updateSummary();
    return;
  }

  list.innerHTML = cart.map((item, idx) => `
    <li class="pf-summary-item" data-idx="${idx}">
      ${item.image ? `<img src="${item.image}" alt="" class="pf-summary-img" loading="lazy" decoding="async">` : '<div class="pf-summary-img pf-summary-img--empty"></div>'}
      <div class="pf-summary-info">
        <strong>${item.name}</strong>
        <div class="pf-qty-row">
          <button type="button" class="pf-qty-btn" data-action="minus" data-idx="${idx}" aria-label="Намали">−</button>
          <span>${item.quantity}</span>
          <button type="button" class="pf-qty-btn" data-action="plus" data-idx="${idx}" aria-label="Увеличи">+</button>
        </div>
      </div>
      <div class="pf-summary-price">${formatPrice(item.price * item.quantity)}</div>
      <button type="button" class="pf-remove-btn" data-action="remove" data-idx="${idx}" aria-label="Премахни">${icon('x', { size: 16 })}</button>
    </li>`).join('');

  syncSubmitButtons({ disabled: false });
  syncCheckoutActionBar(true);
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

function validateForm() {
  let ok = true;
  ['first-name', 'last-name', 'phone'].forEach((id) => {
    const el = $(id);
    const invalid = !el?.value.trim();
    el?.classList.toggle('is-invalid', invalid);
    if (invalid) ok = false;
  });

  if ($('delivery-address')?.checked) {
    ['address', 'city', 'postcode'].forEach((id) => {
      const el = $(id);
      const invalid = !el?.value.trim();
      el?.classList.toggle('is-invalid', invalid);
      if (invalid) ok = false;
    });
  } else {
    const speedy = $('courier-speedy')?.checked;
    const officeId = speedy ? $('final-speedy-id')?.value : $('final-office-id')?.value;
    if (!officeId) {
      showToast(speedy ? 'Изберете офис на Speedy.' : 'Изберете офис на Econt.', 'error');
      ok = false;
    }
  }

  if (!$('policy-consent')?.checked || !$('terms')?.checked) {
    showToast('Моля, приемете условията.', 'error');
    ok = false;
  }
  return ok;
}

async function submitOrder(e) {
  e.preventDefault();
  if (!cart.length || !validateForm()) return;

  syncSubmitButtons({ disabled: true, label: 'Изпращане...' });

  const formData = Object.fromEntries(new FormData($('checkout-form')));
  const subtotal = getSubtotal();
  const shipping = calculateShipping(subtotal);

  if ($('delivery-courier')?.checked) {
    formData.deliveryMethod = 'courier';
    if ($('courier-speedy')?.checked) {
      formData.courierCompany = 'Speedy';
      formData.courierOfficeId = $('final-speedy-id').value;
      formData.courierOfficeName = $('speedy-selected-name')?.textContent || '';
      formData.courierOfficeAddress = $('speedy-selected-addr')?.textContent || '';
      formData.speedy_office_id = formData.courierOfficeId;
    } else {
      formData.courierCompany = 'Econt';
      formData.courierOfficeId = $('final-office-id').value;
      if (selectedEcontOffice) {
        formData.courierOfficeName = econtOfficeLabel(selectedEcontOffice);
        formData.courierOfficeAddress = selectedEcontOffice.address?.fullAddress || '';
      }
    }
  } else {
    formData.deliveryMethod = 'address';
  }

  formData.firstName = formData.firstName || $('first-name').value;
  formData.lastName = formData.lastName || $('last-name').value;

  const total = subtotal - getPromoDiscount(subtotal) + shipping;

  try {
    const res = await fetch(`${API_URL}/portfolio/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: formData,
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
    if (!res.ok) throw new Error(data.error || 'Грешка при поръчка');

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

async function applyPromoCode() {
  const code = ($('promo-code-input')?.value || $('promo-code-input-summary')?.value || '').trim();
  if (!code) {
    setPromoMessage('Въведете промо код.', 'error');
    return;
  }

  const btn = $('apply-promo-btn') || $('apply-promo-btn-summary');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`${API_URL}/portfolio/validate-promo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (!data.valid) {
      activePromoCode = null;
      setPromoMessage(data.error || 'Невалиден промо код.', 'error');
      updateSummary();
      return;
    }
    activePromoCode = data.promoCode;
    const discountLabel = data.promoCode.discountType === 'percentage'
      ? `${data.promoCode.discount}%`
      : formatPrice(data.promoCode.discount);
    setPromoMessage(`Промо кодът е приложен: −${discountLabel}`, 'success');
    if ($('promo-code-input')) $('promo-code-input').value = data.promoCode.code;
    if ($('promo-code-input-summary')) $('promo-code-input-summary').value = data.promoCode.code;
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

async function init() {
  await initPortfolioPage({ active: 'checkout', settingsOnly: true });
  document.body.classList.add('pf-body--checkout');
  cart = getCart();
  renderCart();

  $('apply-promo-btn')?.addEventListener('click', applyPromoCode);
  $('apply-promo-btn-summary')?.addEventListener('click', applyPromoCode);
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
  $('checkout-form')?.addEventListener('submit', submitOrder);

  setupSpeedy();
  toggleDeliveryFields();
  toggleCourierWidgets();
}

init();
