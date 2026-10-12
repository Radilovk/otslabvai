/**
 * Съхранение на поръчки: всяка поръчка в собствен KV запис `portfolio_order:<id>`.
 *
 * Старият общ масив `portfolio_orders` (чети → добави → запиши) губеше поръчки при
 * едновременен запис — напр. одобрение в админа (чака доставчика няколко секунди)
 * + нова поръчка в същия момент. Сега всеки запис пипа само своя ключ.
 *
 * Старият масив се чете (само за четене) и се слива с новите записи; при промяна
 * на стара поръчка тя се записва като отделен запис, който има предимство.
 */

export const KV_ORDERS_LEGACY = 'portfolio_orders';
export const ORDER_KEY_PREFIX = 'portfolio_order:';

/** Максимум поръчки с пълни данни в един отговор (KV лимит ~1000 операции/заявка). */
export const ORDER_LIST_LIMIT = 400;

const GET_BATCH = 50;

export function orderKey(id) {
  return `${ORDER_KEY_PREFIX}${id}`;
}

function orderMetadata(order) {
  return {
    project: String(order.project || 'portfolio').slice(0, 40),
    status: String(order.status || '').slice(0, 80),
    timestamp: String(order.timestamp || ''),
    b2b_pending: !!order.b2b_pending,
  };
}

function orderTime(order) {
  const t = Date.parse(order?.timestamp || '');
  return Number.isFinite(t) ? t : 0;
}

async function readLegacyOrders(env) {
  const raw = await env.PAGE_CONTENT.get(KV_ORDERS_LEGACY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function listOrderKeys(env) {
  const kv = env.PAGE_CONTENT;
  if (typeof kv.list !== 'function') return [];
  const keys = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: ORDER_KEY_PREFIX, cursor });
    keys.push(...(page.keys || []));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

/**
 * @param {object} env
 * @param {object} order
 * @param {{ isB2bPending?: (order: object) => boolean }} [opts]
 */
export async function saveOrderRecord(env, order, { isB2bPending } = {}) {
  if (!order?.id) throw new Error('Поръчка без ID не може да бъде записана.');
  const metadata = orderMetadata({ ...order, b2b_pending: isB2bPending ? isB2bPending(order) : false });
  await env.PAGE_CONTENT.put(orderKey(order.id), JSON.stringify(order), { metadata });
}

export async function getOrderRecord(env, id) {
  if (!id) return null;
  const raw = await env.PAGE_CONTENT.get(orderKey(id));
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* повреден запис → опитай стария масив */
    }
  }
  const legacy = await readLegacyOrders(env);
  return legacy.find((o) => o.id === id) || null;
}

/**
 * Всички поръчки, най-новите първи.
 * @param {object} env
 * @param {{ project?: string|null, limit?: number }} [opts]
 */
export async function listOrderRecords(env, { project = null, limit = ORDER_LIST_LIMIT } = {}) {
  const [keys, legacy] = await Promise.all([listOrderKeys(env), readLegacyOrders(env)]);

  const matchesProject = (p) => !project || String(p || 'portfolio') === project;

  const wantedKeys = keys
    .filter((k) => !k.metadata || matchesProject(k.metadata.project))
    .sort((a, b) => Date.parse(b.metadata?.timestamp || '') - Date.parse(a.metadata?.timestamp || '') || 0)
    .slice(0, limit);

  const fresh = [];
  for (let i = 0; i < wantedKeys.length; i += GET_BATCH) {
    const batch = wantedKeys.slice(i, i + GET_BATCH);
    const values = await Promise.all(batch.map((k) => env.PAGE_CONTENT.get(k.name)));
    for (const raw of values) {
      if (!raw) continue;
      try {
        fresh.push(JSON.parse(raw));
      } catch {
        /* пропусни повреден запис */
      }
    }
  }

  const byId = new Map();
  for (const order of legacy) {
    if (order?.id && matchesProject(order.project)) byId.set(order.id, order);
  }
  // Ключ, който съществува като отделен запис, има предимство пред стария масив,
  // дори ако не е попаднал в лимита по-горе.
  const ownKeyIds = new Set(keys.map((k) => k.name.slice(ORDER_KEY_PREFIX.length)));
  for (const id of ownKeyIds) byId.delete(id);
  for (const order of fresh) {
    if (order?.id && matchesProject(order.project)) byId.set(order.id, order);
  }

  return [...byId.values()]
    .sort((a, b) => orderTime(b) - orderTime(a))
    .slice(0, limit);
}

/**
 * Брой поръчки и чакащи B2B — от metadata, без да се чете всяка поръчка.
 * @param {object} env
 * @param {{ project?: string|null, isB2bPending: (order: object) => boolean }} opts
 */
export async function summarizeOrderRecords(env, { project = null, isB2bPending }) {
  const [keys, legacy] = await Promise.all([listOrderKeys(env), readLegacyOrders(env)]);
  const matchesProject = (p) => !project || String(p || 'portfolio') === project;
  const ownKeyIds = new Set(keys.map((k) => k.name.slice(ORDER_KEY_PREFIX.length)));

  let total = 0;
  let pending = 0;
  for (const k of keys) {
    if (k.metadata && !matchesProject(k.metadata.project)) continue;
    if (!k.metadata) {
      // Запис без metadata (не би трябвало) — прочети го.
      const order = await getOrderRecord(env, k.name.slice(ORDER_KEY_PREFIX.length));
      if (!order || !matchesProject(order.project)) continue;
      total += 1;
      if (isB2bPending(order)) pending += 1;
      continue;
    }
    total += 1;
    if (k.metadata.b2b_pending) pending += 1;
  }
  for (const order of legacy) {
    if (!order?.id || ownKeyIds.has(order.id) || !matchesProject(order.project)) continue;
    total += 1;
    if (isB2bPending(order)) pending += 1;
  }
  return { total, pending };
}
