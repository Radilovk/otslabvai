/**
 * Онлайн плащане с карта (Stripe Checkout) — единственият начин на плащане.
 *
 * Поток: поръчка → Stripe Checkout Session → клиентът плаща на страницата на Stripe →
 * webhook `checkout.session.completed` → поръчката става платена и чак тогава B2B редовете
 * се изпращат към Fitness1 / Sila. Неплатена поръчка никога не стига до доставчик.
 *
 * Секрети (npx wrangler secret put …): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
 */

import { SITE_BY_HOST } from './hostname-routing.js';

const STRIPE_API = 'https://api.stripe.com/v1';
/** Минимумът на Stripe за expires_at е 30 мин. */
export const CHECKOUT_SESSION_TTL_SEC = 30 * 60;
const WEBHOOK_TOLERANCE_SEC = 300;

export const PAYMENT_METHOD_CARD = 'card';
export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  EXPIRED: 'expired',
});

export const ORDER_STATUS_AWAITING_PAYMENT = 'Чака плащане';
export const ORDER_STATUS_UNPAID = 'Неплатена';

export class PaymentError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'PaymentError';
    this.status = status;
  }
}

/** Страници за връщане след плащане, по сайт. */
const RETURN_PAGES = {
  portfolio: { success: '/portfolio-order-success.html', cancel: '/portfolio-checkout.html' },
  life: { success: '/life-order-success.html', cancel: '/life-checkout.html' },
  main: { success: '/checkout.html', cancel: '/checkout.html' },
};

const DEFAULT_ORIGIN = {
  portfolio: 'https://biocode-bg.com',
  life: 'https://life-protocols.com',
  main: 'https://daotslabna.com',
};

export function getStripeSecretKey(env) {
  return String(env?.STRIPE_SECRET_KEY || '').trim();
}

export function isPaymentConfigured(env) {
  return Boolean(getStripeSecretKey(env));
}

/** Поръчка, създадена с онлайн плащане (старите поръчки нямат `payment`). */
export function orderRequiresPayment(order) {
  return Boolean(order?.payment);
}

export function isOrderPaid(order) {
  if (!orderRequiresPayment(order)) return true;
  return order.payment.status === PAYMENT_STATUS.PAID;
}

/**
 * Произход за връщане от Stripe: Origin на заявката, само ако е един от нашите домейни
 * (или localhost за разработка). Иначе — официалният домейн на сайта.
 * @param {string|null} originHeader
 * @param {string} project
 */
export function resolveReturnOrigin(originHeader, project) {
  const site = RETURN_PAGES[project] ? project : 'portfolio';
  try {
    const u = new URL(String(originHeader || ''));
    const host = u.hostname.toLowerCase();
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if ((u.protocol === 'https:' && SITE_BY_HOST[host]) || isLocal) return u.origin;
  } catch {
    /* няма или невалиден Origin */
  }
  return DEFAULT_ORIGIN[site];
}

export function buildReturnUrls(origin, project, orderId) {
  const pages = RETURN_PAGES[project] || RETURN_PAGES.portfolio;
  const id = encodeURIComponent(orderId);
  return {
    success_url: `${origin}${pages.success}?id=${id}&paid=1`,
    cancel_url: `${origin}${pages.cancel}?cancelled=${id}`,
  };
}

/** Евро → цели центове (Stripe работи с най-малката единица). */
export function toMinorUnits(amountEur) {
  return Math.round(Number(amountEur) * 100);
}

/** Плоски полета за application/x-www-form-urlencoded, както ги очаква Stripe. */
export function encodeStripeForm(obj, prefix = '', out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === 'object') encodeStripeForm(value, name, out);
    else out.append(name, String(value));
  }
  return out;
}

/**
 * @param {object} order
 * @param {{ origin?: string, nowSec?: number }} [options]
 * Параметри на Checkout Session. Сумата е един ред с крайната сума от сървъра
 * (с промо и доставка), за да съвпада до цент с поръчката.
 */
export function buildCheckoutSessionParams(order, { origin, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  const amount = toMinorUnits(order.payment.amount);
  if (!(amount > 0)) throw new PaymentError('Невалидна сума за плащане.', 400);
  const names = (order.products || [])
    .map((p) => `${p.name || p.sku_id} × ${p.quantity}`)
    .join(', ');
  const email = String(order.customer?.email || '').trim();
  return {
    mode: 'payment',
    locale: 'bg',
    client_reference_id: order.id,
    customer_email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
    expires_at: nowSec + CHECKOUT_SESSION_TTL_SEC,
    ...buildReturnUrls(origin, order.project, order.id),
    metadata: { order_id: order.id, project: order.project },
    payment_intent_data: { metadata: { order_id: order.id } },
    line_items: {
      0: {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: amount,
          product_data: {
            name: `Поръчка ${order.id}`,
            description: names.slice(0, 500) || undefined,
          },
        },
      },
    },
  };
}

async function stripeRequest(env, method, path, params) {
  const key = getStripeSecretKey(env);
  if (!key) throw new PaymentError('Онлайн плащането не е конфигурирано (STRIPE_SECRET_KEY).', 503);
  const init = {
    method,
    headers: { Authorization: `Bearer ${key}` },
  };
  if (params) {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = encodeStripeForm(params).toString();
  }
  const res = await fetch(`${STRIPE_API}/${path}`, init);
  let data;
  try {
    data = await res.json();
  } catch {
    throw new PaymentError('Невалиден отговор от Stripe.', 502);
  }
  if (!res.ok) {
    throw new PaymentError(`Stripe: ${data?.error?.message || res.status}`, 502);
  }
  return data;
}

/**
 * @param {object} env
 * @param {object} order
 * @param {{ origin?: string }} [options]
 * @returns {Promise<{ id: string, url: string, expires_at: number }>}
 */
export async function createCheckoutSession(env, order, { origin } = {}) {
  const session = await stripeRequest(env, 'POST', 'checkout/sessions', buildCheckoutSessionParams(order, { origin }));
  if (!session?.id || !session?.url) throw new PaymentError('Stripe не върна линк за плащане.', 502);
  return session;
}

export async function retrieveCheckoutSession(env, sessionId) {
  return stripeRequest(env, 'GET', `checkout/sessions/${encodeURIComponent(sessionId)}`);
}

/** Сесията е платена изцяло и сумата и поръчката съвпадат. */
export function isSessionPaidForOrder(session, order) {
  if (!session || session.payment_status !== 'paid') return false;
  const orderId = session.metadata?.order_id || session.client_reference_id;
  if (orderId !== order.id) return false;
  if (String(session.currency || '').toLowerCase() !== 'eur') return false;
  return Number(session.amount_total) === toMinorUnits(order.payment.amount);
}

function hexToBytes(hex) {
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function computeStripeSignature(secret, timestamp, rawBody) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${rawBody}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Проверка на заглавката Stripe-Signature (t=…,v1=…) по документацията на Stripe.
 * @returns {Promise<boolean>}
 */
export async function verifyStripeSignature(rawBody, header, secret, { nowSec = Math.floor(Date.now() / 1000) } = {}) {
  if (!secret || !header) return false;
  const parts = String(header).split(',').map((p) => p.trim().split('='));
  const t = Number(parts.find(([k]) => k === 't')?.[1]);
  const v1 = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isFinite(t) || !v1.length) return false;
  if (Math.abs(nowSec - t) > WEBHOOK_TOLERANCE_SEC) return false;
  const expected = hexToBytes(await computeStripeSignature(secret, t, rawBody));
  return v1.some((sig) => {
    const got = hexToBytes(sig);
    return got && timingSafeEqual(got, expected);
  });
}
