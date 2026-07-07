import { API_URL } from './config.js';
import {
  CART_KEY, getCart, saveCart, updateCartBadges, showToast, formatPrice, initPortfolioPage
} from './portfolio-shared.js';

const SPEEDY_WIDGET_URL =
  'https://services.speedy.bg/office_locator_widget_v3/office_locator.php?lang=bg&showOfficesList=0&pickUp=1&officeType=ALL&officesFilterOnTheMap=0&selectOfficeButtonCaption=%D0%98%D0%B7%D0%B1%D0%BE%D1%80';

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

  const discountRow = $('discount-row');
  if (discountRow) {
    discountRow.style.display = discountAmount > 0 ? 'flex' : 'none';
    $('summary-discount').textContent = `-${formatPrice(discountAmount)}`;
    const label = activePromoCode?.code ? ` (${activePromoCode.code})` : '';
    discountRow.querySelector('span:first-child').textContent = `Отстъпка${label}`;
  }
}

function renderCart() {
  const list = $('product-list');
  const submitBtn = $('submit-btn');
  if (!cart.length) {
    list.innerHTML = '<li class="pf-empty-cart"><p>Количката е празна.</p><a href="portfolio.html" class="pf-btn pf-btn-outline">Към каталога</a></li>';
    submitBtn.disabled = true;
    updateSummary();
    return;
  }

  list.innerHTML = cart.map((item, idx) => `
    <li class="pf-summary-item" data-idx="${idx}">
      ${item.image ? `<img src="${item.image}" alt="" class="pf-summary-img">` : '<div class="pf-summary-img pf-summary-img--empty"></div>'}
      <div class="pf-summary-info">
        <strong>${item.name}</strong>
        <div class="pf-qty-row">
          <button type="button" class="pf-qty-btn" data-action="minus" data-idx="${idx}" aria-label="Намали">−</button>
          <span>${item.quantity}</span>
          <button type="button" class="pf-qty-btn" data-action="plus" data-idx="${idx}" aria-label="Увеличи">+</button>
        </div>
      </div>
      <div class="pf-summary-price">${formatPrice(item.price * item.quantity)}</div>
      <button type="button" class="pf-remove-btn" data-action="remove" data-idx="${idx}" aria-label="Премахни">×</button>
    </li>`).join('');

  submitBtn.disabled = false;
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
  $('speedy-widget').style.display = speedy ? 'block' : 'none';
  $('ekont-widget').style.display = speedy ? 'none' : 'block';
  if (!speedy && !window._ekontLoaded) loadEcontOffices();
  updateSummary();
}

function openSpeedyMap() {
  const modal = $('speedy-map-modal');
  const iframe = $('speedy-map-iframe');
  if (!iframe.src) iframe.src = SPEEDY_WIDGET_URL;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSpeedyMap() {
  $('speedy-map-modal').classList.remove('active');
  document.body.style.overflow = '';
}

let allEcontOffices = [];
let selectedEcontOffice = null;

function loadEcontOffices() {
  const status = $('ekont-status-text');
  fetch('https://ee.econt.com/services/Nomenclatures/NomenclaturesService.getOffices.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryCode: 'BGR' })
  })
    .then((r) => r.json())
    .then((data) => {
      if (data?.offices) {
        allEcontOffices = data.offices;
        window._ekontLoaded = true;
        status.textContent = '✓ Готово за търсене';
        status.style.color = 'var(--pf-primary)';
      }
    })
    .catch(() => {
      status.textContent = 'Грешка при зареждане. Опитайте отново.';
      status.style.color = '#c0392b';
    });
}

function setupEcontSearch() {
  const input = $('ekont-office-search');
  const dropdown = $('econt-offices-dropdown');
  input?.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (q.length < 2) { dropdown.style.display = 'none'; return; }
    const filtered = allEcontOffices.filter((o) => {
      const name = o.name + (o.isAPS ? ' (ЕКОНТОМАТ)' : '');
      const addr = o.address?.fullAddress || '';
      return name.toLowerCase().includes(q) || addr.toLowerCase().includes(q);
    }).slice(0, 20);
    dropdown.innerHTML = filtered.length
      ? filtered.map((o) => `<div class="pf-dropdown-item" data-code="${o.code}"><strong>${o.name}</strong><span>${o.address?.fullAddress || ''}</span></div>`).join('')
      : '<div class="pf-dropdown-item pf-dropdown-empty">Няма резултати</div>';
    dropdown.style.display = 'block';
  });
  dropdown?.addEventListener('click', (e) => {
    const item = e.target.closest('[data-code]');
    if (!item) return;
    const office = allEcontOffices.find((o) => o.code === item.dataset.code);
    if (!office) return;
    selectedEcontOffice = office;
    $('final-office-id').value = office.code;
    input.value = office.name;
    $('ekont-status-text').textContent = `✓ ${office.name}`;
    dropdown.style.display = 'none';
  });
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

  const btn = $('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Изпращане...';

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
        formData.courierOfficeName = selectedEcontOffice.name;
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
    btn.disabled = false;
    btn.textContent = 'Поръчай с наложен платеж';
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
      $('speedy-selected-addr').textContent = data.address?.fullAddressString || '';
      $('speedy-selected-info').style.display = 'block';
      $('open-speedy-map-btn').textContent = 'Смени офиса';
      closeSpeedyMap();
    }
  });
}

async function init() {
  await initPortfolioPage({ active: 'checkout' });
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
  setupEcontSearch();
  toggleDeliveryFields();
  toggleCourierWidgets();
}

init();
