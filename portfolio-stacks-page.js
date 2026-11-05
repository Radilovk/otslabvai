/**
 * stacks.html — обзор на готовите стакове; stack.html?id=<id> — лендинг на един стак.
 * Продуктите идват от /portfolio/stacks: изборът (наличност при доставчика, замяна,
 * качество и марж) е на сървъра. Тук е само показването и количката.
 */
import {
  escapeHtml, getCart, saveCart, updateCartBadges, showToast, initPortfolioPage,
  formatPrice, buildPortfolioProductUrl,
} from './portfolio-shared.js';
import { API_URL } from './config.js';
import { variantDisplayPrice, fetchPromoPrices } from './portfolio-promo-catalog.js';
import { loadActivePromo } from './portfolio-promo-ui.js';
import { STACK_CONTENT, STACK_ORDER } from './portfolio-stacks-content.js';

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27300%27 height=%27300%27%3E%3Crect fill=%27%23eef2f0%27 width=%27300%27 height=%27300%27/%3E%3C/svg%3E";

const hubRoot = document.getElementById('sk-hub');
const stackRoot = document.getElementById('sk-stack');
const stackId = String(new URLSearchParams(location.search).get('id') || '').toLowerCase();

/** @type {Record<string, any>} */
let stacks = {};

const priced = (item) => variantDisplayPrice(item.pick_variant, loadActivePromo()) || item.pick_variant || {};
const stackTotal = (stack) => (stack?.slots || []).reduce((s, slot) => s + (slot.item ? Number(priced(slot.item).retail_price) || 0 : 0), 0);
const stackItems = (stack) => (stack?.slots || []).map((s) => s.item).filter(Boolean);
const img = (item) => {
  const v = priced(item);
  return escapeHtml(v.image || item.image || PLACEHOLDER_IMG);
};
const thumb = (item, alt = '') => `<span class="sk-thumb"><img src="${item ? img(item) : PLACEHOLDER_IMG}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'"></span>`;
const productName = (item) => {
  const v = priced(item);
  return [item.name, v.pack].filter(Boolean).join(' · ');
};

async function fetchStacks(id = '') {
  try {
    const res = await fetch(`${API_URL}/portfolio/stacks${id ? `?id=${encodeURIComponent(id)}` : ''}`);
    const data = res.ok ? await res.json() : null;
    for (const s of data?.stacks || []) stacks[s.id] = s;
  } catch {
    /* показваме текста без продукти */
  }
}

function addStackToCart(id) {
  const stack = stacks[id];
  const slots = (stack?.slots || []).filter((slot) => slot.item);
  if (!slots.length) return;
  const cart = getCart();
  for (const slot of slots) {
    const item = slot.item;
    const v = priced(item);
    if (!v?.sku_id) continue;
    const idx = cart.findIndex((c) => c.sku_id === v.sku_id);
    if (idx > -1) {
      cart[idx].quantity += 1;
      // Мястото в пакета — за замяната с един клик в количката, ако продуктът се изчерпа.
      if (!cart[idx].stack_id) Object.assign(cart[idx], { stack_id: id, stack_slot: slot.id });
    } else {
      cart.push({
        sku_id: v.sku_id,
        group_id: item.group_id,
        barcode: v.barcode,
        id: v.sku_id,
        name: [item.name, v.pack, v.option].filter(Boolean).join(' – '),
        pack: v.pack,
        option: v.option,
        price: v.retail_price,
        quantity: 1,
        image: v.image || item.image,
        stack_id: id,
        stack_slot: slot.id,
      });
    }
  }
  saveCart(cart);
  updateCartBadges();
  showToast(slots.length > 1 ? `Пакетът (${slots.length} продукта) е в количката` : 'Добавено в количката', 'success');
}

/* ---------- Обзор ---------- */

function renderHubCard(id) {
  const c = STACK_CONTENT[id];
  const s = stacks[id];
  const loaded = !!s;
  const slots = loaded ? s.slots : [{}, {}, {}];
  const total = loaded ? stackTotal(s) : 0;
  return `
    <a class="sk-card" href="portfolio-stack.html?id=${id}" style="--sk-accent:${c.accent}">
      <div>
        <span class="sk-eyebrow">${escapeHtml(c.goal)}</span>
        <h2>${escapeHtml(c.name)}</h2>
      </div>
      <p>${escapeHtml(c.short)}</p>
      <div class="sk-card-slots">
        ${slots.map((slot) => `
          <div class="sk-card-slot">
            ${loaded ? thumb(slot.item, slot.item?.name || '') : '<span class="sk-thumb sk-skeleton"></span>'}
            <span>${escapeHtml(slot.substance?.label || slot.title || '')}</span>
          </div>`).join('')}
      </div>
      <div class="sk-card-foot">
        <span class="sk-total">${total ? formatPrice(total) : '&nbsp;'}<small>${loaded ? `${stackItems(s).length} продукта` : ''}</small></span>
        <span class="sk-more">Виж пакета →</span>
      </div>
    </a>`;
}

function renderHub() {
  hubRoot.querySelector('.sk-grid').innerHTML = STACK_ORDER.map(renderHubCard).join('');
}

/* ---------- Лендинг ---------- */

function renderBuybox(id) {
  const s = stacks[id];
  const box = document.getElementById('sk-buybox');
  if (!s) {
    box.innerHTML = '<p class="sk-muted" style="margin:0">В момента не можем да заредим продуктите. Опитайте отново след малко.</p>';
    return;
  }
  const items = stackItems(s);
  const total = stackTotal(s);
  box.innerHTML = `
    ${s.slots.map((slot) => slot.item ? `
      <div class="sk-buybox-row">
        ${thumb(slot.item, slot.item.name)}
        <div><strong>${escapeHtml(slot.substance.label)}</strong><span>${escapeHtml(slot.item.brand || '')}</span></div>
        <b>${formatPrice(priced(slot.item).retail_price)}</b>
      </div>` : '').join('')}
    <div class="sk-buybox-total"><span>Общо за пакета</span><span class="sk-total">${formatPrice(total)}</span></div>
    <button type="button" class="pf-btn pf-btn-primary pf-btn-block" data-add-stack="${id}" ${items.length ? '' : 'disabled'}>Добави пакета в количката</button>
    <p class="sk-buybox-note">Всички продукти са налични в момента · Наложен платеж · Доставка до офис</p>`;
  const bar = document.getElementById('sk-bar');
  bar.innerHTML = `<span class="sk-total">${formatPrice(total)}<small>${items.length} продукта</small></span>
    <button type="button" class="pf-btn pf-btn-primary" data-add-stack="${id}" ${items.length ? '' : 'disabled'}>Добави пакета</button>`;
}

/** „Мястото „Черен дроб““ → името на веществото, което реално е в пакета. */
function scheduleText(text, stack) {
  return String(text).replace(/Мястото „([^“]+)“/g, (m, title) => {
    const slot = (stack?.slots || []).find((s) => s.title.startsWith(title) || title.startsWith(s.title));
    return slot?.substance?.label || title;
  });
}

function renderSchedule(id) {
  const c = STACK_CONTENT[id];
  document.getElementById('sk-schedule').innerHTML = c.schedule
    .map(([when, what]) => `<div><dt>${escapeHtml(when)}</dt><dd>${escapeHtml(scheduleText(what, stacks[id]))}</dd></div>`).join('');
}

function renderSlots(id) {
  const s = stacks[id];
  const wrap = document.getElementById('sk-slots');
  if (!s) return;
  wrap.innerHTML = s.slots.map((slot) => {
    const item = slot.item;
    const v = item ? priced(item) : null;
    return `
      <article class="sk-slot">
        <div class="sk-slot-head"><h3>${escapeHtml(slot.title)}</h3></div>
        ${slot.substance ? `<p class="sk-substance">${escapeHtml(slot.substance.label)}</p><p class="sk-why">${escapeHtml(slot.substance.why)}</p>` : ''}
        ${item && slot.proof?.length ? `<ul class="sk-proof" aria-label="Защо този продукт">${slot.proof.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
        ${item ? `
          <a class="sk-product" href="${buildPortfolioProductUrl(item.group_id, v.sku_id)}">
            ${thumb(item, item.name)}
            <div>
              <small>${escapeHtml(item.brand || '')}</small>
              <strong>${escapeHtml(item.name)}</strong>
              ${v.pack ? `<em>${escapeHtml(v.pack)}</em>` : ''}
              <b>${formatPrice(v.retail_price)}</b>
            </div>
          </a>` : '<div class="sk-slot-empty">Временно няма наличен продукт за това място.</div>'}
      </article>`;
  }).join('');
}

function renderStaticStack(id) {
  const c = STACK_CONTENT[id];
  document.documentElement.style.setProperty('--sk-accent', c.accent);
  document.title = `${c.name}: ${c.goal} – пакет от 3 добавки | BIOCODE`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', `${c.goal}: ${c.short}`);
  const canon = document.querySelector('link[rel="canonical"]');
  if (canon) canon.setAttribute('href', `https://biocode-bg.com/stack.html?id=${id}`);

  document.getElementById('sk-goal').textContent = c.goal;
  document.getElementById('sk-title').textContent = `Пакет „${c.name}“`;
  document.getElementById('sk-lead').textContent = c.lead;
  document.getElementById('sk-forwho').innerHTML = c.forWho.map((t) => `<li>${escapeHtml(t)}</li>`).join('');
  renderSchedule(id);
  document.getElementById('sk-expect').innerHTML = c.expect.map(([when, what]) => `<div><strong>${escapeHtml(when)}</strong><span>${escapeHtml(what)}</span></div>`).join('');
  document.getElementById('sk-note').textContent = c.note;
  document.getElementById('sk-faq').innerHTML = c.faq.map(([q, a]) => `<details><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`).join('');
  document.getElementById('sk-others').innerHTML = STACK_ORDER.filter((o) => o !== id).map((o) => {
    const oc = STACK_CONTENT[o];
    return `<a class="sk-chip" href="portfolio-stack.html?id=${o}" style="--sk-chip:${oc.accent}"><i></i>${escapeHtml(oc.name)} · ${escapeHtml(oc.goal)}</a>`;
  }).join('');
}

/** Лентата с цената се показва, когато бутонът в кутията не се вижда (над или под екрана). */
function initStickyBar() {
  const bar = document.getElementById('sk-bar');
  const box = document.getElementById('sk-buybox');
  if (!bar || !box) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const btn = box.querySelector('[data-add-stack]');
    if (!btn) return bar.classList.remove('sk-visible');
    const r = btn.getBoundingClientRect();
    bar.classList.toggle('sk-visible', r.bottom > window.innerHeight || r.bottom < 0);
  };
  const schedule = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  new MutationObserver(schedule).observe(box, { childList: true });
  schedule();
}

async function refreshPromo(render) {
  const promo = loadActivePromo();
  const skuIds = Object.values(stacks).flatMap((s) => stackItems(s).map((it) => it.pick_variant?.sku_id)).filter(Boolean);
  if (!promo || !skuIds.length) return;
  const changed = await fetchPromoPrices(promo, { skuIds }).catch(() => false);
  if (changed) render();
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add-stack]');
  if (btn) addStackToCart(btn.dataset.addStack);
});

initPortfolioPage({ active: 'stacks', settingsOnly: true }).catch(() => {});

if (hubRoot) {
  renderHub();
  fetchStacks().then(() => {
    renderHub();
    refreshPromo(renderHub);
  });
} else if (stackRoot) {
  const id = STACK_CONTENT[stackId] ? stackId : null;
  if (!id) {
    location.replace('portfolio-stacks.html');
  } else {
    renderStaticStack(id);
    initStickyBar();
    fetchStacks(id).then(() => {
      const render = () => { renderBuybox(id); renderSlots(id); renderSchedule(id); };
      render();
      refreshPromo(render);
    });
  }
}
