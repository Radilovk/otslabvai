/**
 * Portfolio → Site import: интеграция на продукти от B2B каталога (Fitness1 API,
 * синхронизиран в KV) към проектите „Да Отслабна" (index) и Life Protocols (life).
 *
 * Продуктите се конвертират към хомогенната схема public_data/system_data,
 * използвана от продуктовите категории в page_content / life_page_content,
 * така че импортираните продукти са неразличими от ръчно създадените.
 *
 * Използва се от worker.js за /portfolio/import/* маршрутите.
 */

import { filterIndex, sortByMarginDesc } from './portfolio-filter.js';

export class PortfolioImportError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'PortfolioImportError';
    this.status = status;
  }
}

/** Проекти, към които може да се импортира, с целите им за AI подбор. */
export const IMPORT_PROJECTS = {
  main: {
    kvKey: 'page_content',
    staticFallbackKey: 'static_backend_page_content.json',
    siteLabel: '„Да Отслабна" — магазин за отслабване (daotslabna.com)',
    goalLabel: 'отслабване, изгаряне на мазнини, контрол на апетита, ускоряване на метаболизма',
    defaultGoals: ['отслабване']
  },
  life: {
    kvKey: 'life_page_content',
    staticFallbackKey: 'static_backend_life_page_content.json',
    siteLabel: 'Life Protocols — премиум магазин за антиейджинг, дълголетие и биохакинг',
    goalLabel: 'антиейджинг, клетъчна регенерация, дълголетие, когнитивно и хормонално здраве',
    defaultGoals: ['anti-aging']
  }
};

/** Премахва HTML тагове и нормализира whitespace (описанията от Fitness1 са HTML). */
export function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

const SHORT_DESCRIPTION_LIMIT = 480;

/**
 * Разбива HTML описание (Fitness1) на структурирано съдържание за продуктовата
 * страница — както изглежда в portfolio: кратко маркетингово описание за
 * листинга, детайлен текст в секцията „За продукта" и ползи от bullet списъци.
 * @param {string} html - HTML описание от каталога
 * @param {string} productName - име на продукта (за заглавие по подразбиране)
 * @returns {{ description: string, about: {title: string, description: string, benefits: Array<{title: string, text: string}>} | null }}
 */
export function htmlToStructuredContent(html, productName = '') {
  if (!html) return { description: '', about: null };
  const src = String(html);

  // Bullet точки от <li> елементи → ползи
  const bullets = [];
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch;
  while ((liMatch = liRe.exec(src)) && bullets.length < 8) {
    const text = stripHtml(liMatch[1]).replace(/\n+/g, ' ').trim();
    if (text) bullets.push(text);
  }

  // Първото заглавие става заглавие на секцията „За продукта"
  const headingMatch = src.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
  const headingText = headingMatch
    ? stripHtml(headingMatch[1]).replace(/\n+/g, ' ').trim()
    : '';

  // Параграфи — без списъците и заглавията, които вече са извлечени
  const withoutBlocks = src
    .replace(/<(ul|ol)[^>]*>[\s\S]*?<\/\1>/gi, '\n')
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '\n');
  const paragraphs = stripHtml(withoutBlocks)
    .split('\n')
    .map((s) => s.trim())
    .filter((p) => p.length > 1);

  // Кратко описание = първият параграф (до разумна дължина, срязан на изречение)
  let description = paragraphs[0] || '';
  const rest = paragraphs.slice(1);
  if (description.length > SHORT_DESCRIPTION_LIMIT) {
    const cut = description.slice(0, SHORT_DESCRIPTION_LIMIT);
    const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    if (sentenceEnd > 120) {
      rest.unshift(description.slice(sentenceEnd + 2));
      description = description.slice(0, sentenceEnd + 1);
    }
  }

  const benefits = bullets.slice(0, 6).map((b) => {
    const sep = b.indexOf(':');
    if (sep > 4 && sep < 90) {
      return { title: b.slice(0, sep).trim(), text: b.slice(sep + 1).trim() };
    }
    if (b.length <= 90) return { title: b, text: '' };
    return { title: `${b.slice(0, 88).trim()}…`, text: b };
  });

  const aboutDescription = rest.join('\n\n');
  const about = (aboutDescription || benefits.length)
    ? {
        title: headingText || (productName ? `За ${productName}` : 'За продукта'),
        description: aboutDescription,
        benefits
      }
    : null;

  return { description, about };
}

/**
 * Конвертира група от portfolio каталога (резултат от groupRawProducts със
 * retail цени) към хомогенната продуктова схема на index/life страниците.
 * @param {object} group - каталожна група { group_id, name, brand, variants[], ... }
 * @returns {object} продукт { product_id, public_data, system_data, display_order }
 */
export function portfolioGroupToSiteProduct(group) {
  const variants = (group.variants || []).map((v) => ({
    option_name: [v.pack, v.option].filter(Boolean).join(' • '),
    sku: String(v.sku_id || ''),
    price: Number(v.retail_price) || 0,
    ean: v.barcode || '',
    image_url: v.image || '',
    available: v.available !== false
  }));

  const availablePrices = variants.filter((v) => v.available && v.price > 0).map((v) => v.price);
  const allPrices = variants.map((v) => v.price).filter((p) => p > 0);
  const price = availablePrices.length
    ? Math.min(...availablePrices)
    : (allPrices.length ? Math.min(...allPrices) : null);

  const packs = [...new Set((group.variants || []).map((v) => v.pack).filter(Boolean))];
  const anyAvailable = variants.some((v) => v.available);
  const structured = htmlToStructuredContent(group.description || '', group.name || '');

  return {
    product_id: `prod-pf-${group.group_id}`,
    display_order: 0,
    public_data: {
      name: group.name || '',
      brand: group.brand || '',
      price,
      tagline: '',
      description: structured.description,
      ...(structured.about ? { about_content: structured.about } : {}),
      image_url: group.image || '',
      // Етикетът (supplement facts) влиза и като линк, и в галерията — както при B2B XLSX импорта.
      label_url: group.label || '',
      additional_images: group.label || '',
      packaging: {
        capsules_or_grams: packs.join(' / '),
        doses_per_package: ''
      },
      variants
    },
    system_data: {
      manufacturer: group.brand || '',
      application_type: 'Oral',
      inventory: anyAvailable ? 10 : 0,
      goals: [],
      source: 'portfolio',
      portfolio: {
        group_id: String(group.group_id),
        category: group.category || '',
        brand_id: group.brand_id ? String(group.brand_id) : '',
        imported_at: new Date().toISOString()
      }
    }
  };
}

/** Прилага AI/ръчни override-и (tagline, goals, description, effects) върху конвертиран продукт. */
export function applyProductOverrides(product, override) {
  if (!override) return product;
  if (override.tagline) product.public_data.tagline = String(override.tagline);
  if (override.description) product.public_data.description = String(override.description);
  if (Array.isArray(override.goals) && override.goals.length) {
    product.system_data.goals = override.goals.map((g) => String(g).trim()).filter(Boolean);
  }
  if (Array.isArray(override.effects) && override.effects.length) {
    product.public_data.effects = override.effects
      .filter((e) => e && e.label)
      .map((e) => ({ label: String(e.label), value: Math.max(0, Math.min(100, Number(e.value) || 0)) }));
  }
  return product;
}

function getPortfolioGroupId(product) {
  return product?.system_data?.portfolio?.group_id
    ? String(product.system_data.portfolio.group_id)
    : null;
}

/** Обновява само търговските полета (цена, варианти, наличност) на съществуващ импортиран продукт. */
function updateCommercialFields(existing, incoming) {
  existing.public_data = existing.public_data || {};
  existing.system_data = existing.system_data || {};

  existing.public_data.price = incoming.public_data.price;
  existing.public_data.variants = incoming.public_data.variants;
  if (!existing.public_data.image_url) existing.public_data.image_url = incoming.public_data.image_url;
  if (!existing.public_data.label_url) existing.public_data.label_url = incoming.public_data.label_url;
  if (!existing.public_data.description) existing.public_data.description = incoming.public_data.description;
  if (!existing.public_data.about_content && incoming.public_data.about_content) {
    existing.public_data.about_content = incoming.public_data.about_content;
  }

  const anyAvailable = (incoming.public_data.variants || []).some((v) => v.available);
  if (!anyAvailable) {
    existing.system_data.inventory = 0;
  } else if (!Number(existing.system_data.inventory)) {
    existing.system_data.inventory = incoming.system_data.inventory;
  }

  existing.system_data.source = 'portfolio';
  existing.system_data.portfolio = {
    ...(existing.system_data.portfolio || {}),
    ...incoming.system_data.portfolio,
    imported_at: existing.system_data.portfolio?.imported_at || incoming.system_data.portfolio.imported_at,
    refreshed_at: new Date().toISOString()
  };
}

function findCategoryComponent(pageContent, categoryId) {
  return (pageContent.page_content || []).find(
    (c) => c.type === 'product_category' && (c.id === categoryId || c.component_id === categoryId)
  ) || null;
}

/**
 * Слива конвертирани продукти в продуктова категория на page content JSON.
 * Съществуващи продукти (по portfolio group_id или product_id) се обновяват
 * само в търговската част — ръчно редактираните текстове се запазват.
 * @param {object} pageContent - целият page content JSON ({ settings, page_content, ... })
 * @param {object} opts - { categoryId?, categoryTitle?, products }
 * @returns {{ added: number, updated: number, categoryId: string, createdCategory: boolean }}
 */
export function mergeProductsIntoContent(pageContent, { categoryId, categoryTitle, products }) {
  if (!Array.isArray(pageContent.page_content)) {
    throw new PortfolioImportError('Невалидна структура на page content.', 500);
  }

  let category = categoryId ? findCategoryComponent(pageContent, categoryId) : null;
  let createdCategory = false;

  if (!category) {
    if (!categoryTitle) {
      throw new PortfolioImportError('Категорията не е намерена. Подайте category_id на съществуваща категория или category_title за нова.', 400);
    }
    category = {
      id: categoryId || `pf-import-${Date.now()}`,
      type: 'product_category',
      title: categoryTitle,
      description: '',
      options: { is_collapsible: true, is_expanded_by_default: true },
      products: []
    };
    pageContent.page_content.push(category);
    createdCategory = true;
  }

  if (!Array.isArray(category.products)) category.products = [];

  // Индекси за дедупликация — и по portfolio group_id (в цялото съдържание,
  // за да не се дублира продукт между категории), и по product_id.
  const byGroupId = new Map();
  for (const comp of pageContent.page_content) {
    if (comp.type !== 'product_category' || !Array.isArray(comp.products)) continue;
    for (const p of comp.products) {
      const gid = getPortfolioGroupId(p);
      if (gid && !byGroupId.has(gid)) byGroupId.set(gid, p);
    }
  }
  const idsInCategory = new Set(category.products.map((p) => p.product_id));

  let added = 0;
  let updated = 0;
  let maxOrder = category.products.reduce(
    (m, p) => Math.max(m, Number.isFinite(p.display_order) ? p.display_order : -1), -1
  );

  for (const incoming of products) {
    const gid = getPortfolioGroupId(incoming);
    // Fallback по product_id само за продукти с portfolio произход — ръчен
    // продукт със съвпадащо ID не бива да бъде презаписан с каталожни данни.
    const existing = (gid && byGroupId.get(gid))
      || category.products.find(
        (p) => p.product_id === incoming.product_id && p.system_data?.source === 'portfolio'
      );

    if (existing) {
      updateCommercialFields(existing, incoming);
      updated++;
      continue;
    }

    // Гарантираме уникален product_id в категорията
    let newId = incoming.product_id;
    while (idsInCategory.has(newId)) newId = `${newId}-copy`;
    incoming.product_id = newId;
    idsInCategory.add(newId);

    incoming.display_order = ++maxOrder;
    category.products.push(incoming);
    if (gid) byGroupId.set(gid, incoming);
    added++;
  }

  return { added, updated, categoryId: category.id || category.component_id, createdCategory };
}

/**
 * Събира portfolio group_id-тата на всички импортирани продукти в page content.
 * @returns {string[]}
 */
export function collectImportedGroupIds(pageContent) {
  const ids = new Set();
  for (const comp of pageContent.page_content || []) {
    if (comp.type !== 'product_category' || !Array.isArray(comp.products)) continue;
    for (const p of comp.products) {
      const gid = getPortfolioGroupId(p);
      if (gid) ids.add(gid);
    }
  }
  return Array.from(ids);
}

/**
 * Опреснява цени/варианти/наличности на всички импортирани продукти по
 * актуалния portfolio каталог. Продукти, чиято група вече липсва в каталога,
 * се маркират като неналични (inventory 0, variants unavailable).
 * @param {object} pageContent
 * @param {Map<string, object>} groupsById - актуалните каталожни групи
 * @returns {{ updated: number, missing: number }}
 */
export function refreshImportedProductsInContent(pageContent, groupsById) {
  let updated = 0;
  let missing = 0;

  for (const comp of pageContent.page_content || []) {
    if (comp.type !== 'product_category' || !Array.isArray(comp.products)) continue;
    for (const product of comp.products) {
      const gid = getPortfolioGroupId(product);
      if (!gid) continue;

      const group = groupsById.get(gid);
      if (!group) {
        if (product.system_data.inventory !== 0) {
          product.system_data.inventory = 0;
          (product.public_data?.variants || []).forEach((v) => { v.available = false; });
          missing++;
        }
        continue;
      }

      updateCommercialFields(product, portfolioGroupToSiteProduct(group));
      updated++;
    }
  }

  return { updated, missing };
}

const AI_SELECT_MAX_CATALOG_ENTRIES = 180;

function formatCatalogLine(e) {
  const kw = e.search_text ? e.search_text.slice(0, 60) : '';
  const marginPct = e.max_margin_pct ?? 0;
  const marginEur = e.max_margin ?? 0;
  return [e.group_id, e.name, e.brand || '-', e.brand_id || '-', e.category || '-', e.min_price ?? 0, marginPct, marginEur, kw].join(';');
}

export function buildAiSelectionMessages({ project, prompt, index, limit = 12, history = [], catalogTotal = 0 }) {
  const projectInfo = IMPORT_PROJECTS[project];
  if (!projectInfo) {
    throw new PortfolioImportError(`Невалиден проект „${project}". Позволени: ${Object.keys(IMPORT_PROJECTS).join(', ')}.`, 400);
  }

  const available = sortByMarginDesc((index || []).filter((e) => e.available !== false));
  const shown = available.slice(0, AI_SELECT_MAX_CATALOG_ENTRIES);
  const entries = shown.map(formatCatalogLine).join('\n');
  const truncated = catalogTotal > shown.length
    ? `\n(Показани ${shown.length} от ${catalogTotal} налични — подредени по марж; използвай филтрите в админ панела за по-тесен обхват.)`
    : '';

  const system = `Ти си AI асистент за подбор на продукти от B2B каталог.
Сайт: ${projectInfo.siteLabel}. Тема: ${projectInfo.goalLabel}.

Каталог (group_id;име;марка;brand_id;категория;цена;марж_%;марж_€;ключови_думи):
${entries}${truncated}

ВАЖНО: При равна релевантност предпочитай продукти и марки с по-висока търговска отстъпка (колони margin_% и margin_€ – само за вътрешен подбор). Подреди selected по низходяща отстъпка.

Отговори САМО с JSON: {"reply":"текст на български","selected":[{"group_id":"ID","reason":"...","goals":["..."],"tagline":"..."}]}
Само group_id от каталога. До ${limit} в selected. Без подбор → selected:[].`;

  const messages = [{ role: 'system', content: system }];
  for (const msg of history) {
    if (msg?.role === 'user' || msg?.role === 'assistant') {
      messages.push({ role: msg.role, content: String(msg.content || '').slice(0, 1500) });
    }
  }
  messages.push({ role: 'user', content: prompt });
  return messages;
}

/**
 * Нормализира AI отговора за подбор: валидни group_id-та, дедупликация, чисти полета.
 * @param {object|Array} raw - суров JSON отговор от AI
 * @param {Set<string>} validIds - позволените group_id-та от каталога
 * @returns {Array<{group_id: string, reason: string, goals: string[], tagline: string,
 *   name?: string, brand?: string, category?: string, min_price?: number, image?: string}>}
 */
export function normalizeAiSelection(raw, validIds) {
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.selected) ? raw.selected : []);
  const seen = new Set();
  const result = [];

  for (const item of list) {
    const gid = String(item?.group_id ?? '').trim();
    if (!gid || seen.has(gid) || !validIds.has(gid)) continue;
    seen.add(gid);
    result.push({
      group_id: gid,
      reason: typeof item.reason === 'string' ? item.reason : '',
      goals: Array.isArray(item.goals) ? item.goals.map((g) => String(g).trim()).filter(Boolean) : [],
      tagline: typeof item.tagline === 'string' ? item.tagline.slice(0, 120) : ''
    });
  }

  return result;
}

/** Парсва AI отговор: текстов reply + нормализиран подбор. */
export function parseAiSelectResponse(raw, validIds) {
  const reply = typeof raw?.reply === 'string' ? raw.reply.trim() : '';
  return { reply, selected: normalizeAiSelection(raw, validIds) };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function parseIdsParam(url) {
  return (url.searchParams.get('ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Рутер за /portfolio/import/* маршрутите.
 */
export async function handlePortfolioImportRoute(request, env, url, deps) {
  const path = url.pathname;
  const method = request.method;

  try {
    // GET /portfolio/import/preview?ids=1,2,3 — конвертирани продукти за преглед/вмъкване в редактора
    if (path === '/portfolio/import/preview' && method === 'GET') {
      const ids = parseIdsParam(url);
      if (!ids.length) throw new PortfolioImportError('Липсва параметър ids.', 400);
      if (ids.length > 100) throw new PortfolioImportError('Максимум 100 продукта на заявка.', 400);

      const groups = await deps.loadGroupsByIds(env, ids);
      const products = [];
      const notFound = [];
      for (const id of ids) {
        const group = groups.get(String(id));
        if (group) products.push(portfolioGroupToSiteProduct(group));
        else notFound.push(String(id));
      }
      return jsonResponse({ products, not_found: notFound });
    }

    // POST /portfolio/import/ai-select — AI асистент с каталог като контекст
    if (path === '/portfolio/import/ai-select' && method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body?.project) throw new PortfolioImportError('Липсва project (main | life).', 400);
      if (!IMPORT_PROJECTS[body.project]) {
        throw new PortfolioImportError(`Невалиден проект „${body.project}".`, 400);
      }

      const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 2000) : '';
      if (!prompt) throw new PortfolioImportError('Липсва prompt.', 400);

      const meta = await deps.getCatalogMeta(env);
      if (!meta) throw new PortfolioImportError('Каталогът не е синхронизиран. Стартирайте sync от админ панела.', 404);

      const filters = body.filters || {};
      const indexSubset = filterIndex(meta.index || [], {
        brand: filters.brand || '',
        category: filters.category || '',
        q: filters.q || '',
        available: '1',
        sort: 'name'
      }, meta);

      if (!indexSubset.length) {
        return jsonResponse({ reply: 'Няма налични продукти по зададените филтри.', selected: [] });
      }

      const limit = Math.max(1, Math.min(40, Number(body.limit) || 12));
      const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
      const messages = buildAiSelectionMessages({
        project: body.project,
        prompt,
        index: indexSubset,
        limit,
        history,
        catalogTotal: indexSubset.length
      });

      let aiResult;
      try {
        aiResult = await deps.callAI(env, messages, body.settings || null);
      } catch (e) {
        const status = e?.status || (e?.name === 'UserFacingError' ? 400 : 502);
        throw new PortfolioImportError(e?.message || 'AI заявката се провали.', status);
      }

      if (!aiResult || typeof aiResult !== 'object') {
        throw new PortfolioImportError('AI върна неочакван формат на отговора.', 502);
      }

      const validIds = new Set(indexSubset.map((e) => String(e.group_id)));
      const { reply, selected } = parseAiSelectResponse(aiResult, validIds);
      const indexById = new Map(indexSubset.map((e) => [String(e.group_id), e]));
      const enriched = sortByMarginDesc(selected.slice(0, limit).map((item) => {
        const entry = indexById.get(item.group_id);
        return entry
          ? {
              ...item,
              name: entry.name,
              brand: entry.brand,
              category: entry.category,
              min_price: entry.min_price,
              max_margin: entry.max_margin,
              max_margin_pct: entry.max_margin_pct,
              image: entry.image
            }
          : item;
      }));

      return jsonResponse({ reply, selected: enriched, catalog_size: indexSubset.length });
    }

    // POST /portfolio/import/apply — директен сървърен импорт в page content на проект
    if (path === '/portfolio/import/apply' && method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body?.project) throw new PortfolioImportError('Липсва project (main | life).', 400);
      if (!IMPORT_PROJECTS[body.project]) {
        throw new PortfolioImportError(`Невалиден проект „${body.project}".`, 400);
      }
      const groupIds = Array.isArray(body.group_ids) ? body.group_ids.map(String) : [];
      if (!groupIds.length) throw new PortfolioImportError('Липсват group_ids.', 400);
      if (groupIds.length > 100) throw new PortfolioImportError('Максимум 100 продукта на заявка.', 400);

      const groups = await deps.loadGroupsByIds(env, groupIds);
      const overrides = body.overrides || {};
      const projectDefaults = IMPORT_PROJECTS[body.project].defaultGoals;

      const products = [];
      const notFound = [];
      for (const gid of groupIds) {
        const group = groups.get(gid);
        if (!group) { notFound.push(gid); continue; }
        const product = applyProductOverrides(portfolioGroupToSiteProduct(group), overrides[gid]);
        if (!product.system_data.goals.length) product.system_data.goals = [...projectDefaults];
        products.push(product);
      }
      if (!products.length) {
        throw new PortfolioImportError('Нито един от подадените продукти не е намерен в каталога.', 404);
      }

      const content = await deps.loadProjectContent(env, body.project);
      const result = mergeProductsIntoContent(content, {
        categoryId: body.category_id,
        categoryTitle: body.category_title,
        products
      });

      await deps.saveProjectContent(env, body.project, JSON.stringify(content, null, 2));
      return jsonResponse({ success: true, ...result, not_found: notFound });
    }

    // POST /portfolio/import/refresh — опресняване на цени/наличности на импортираните продукти
    if (path === '/portfolio/import/refresh' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const projects = Array.isArray(body?.projects) && body.projects.length
        ? body.projects.filter((p) => IMPORT_PROJECTS[p])
        : Object.keys(IMPORT_PROJECTS);

      const results = await refreshImportedProjects(env, projects, deps);
      return jsonResponse({ success: true, results });
    }

    throw new PortfolioImportError('Not Found', 404);
  } catch (e) {
    if (e instanceof PortfolioImportError) {
      return jsonResponse({ error: e.message }, e.status);
    }
    if (e?.name === 'UserFacingError') {
      return jsonResponse({ error: e.message }, e.status || 500);
    }
    console.error('Portfolio import error:', e);
    return jsonResponse({ error: e?.message || 'Вътрешна грешка в Portfolio import API.' }, 500);
  }
}

/**
 * Опреснява импортираните продукти в подадените проекти по актуалния каталог.
 * Използва се и след /portfolio/sync за автоматична синхронизация.
 * @returns {Promise<object>} резултат по проект: { updated, missing } или { skipped/error }
 */
export async function refreshImportedProjects(env, projects, deps) {
  const results = {};

  for (const project of projects) {
    try {
      const content = await deps.loadProjectContent(env, project).catch(() => null);
      if (!content) {
        results[project] = { skipped: true, reason: 'Няма page content.' };
        continue;
      }

      const groupIds = collectImportedGroupIds(content);
      if (!groupIds.length) {
        results[project] = { updated: 0, missing: 0, skipped: true, reason: 'Няма импортирани продукти.' };
        continue;
      }

      const groupsById = await deps.loadGroupsByIds(env, groupIds);
      const stats = refreshImportedProductsInContent(content, groupsById);
      await deps.saveProjectContent(env, project, JSON.stringify(content, null, 2));
      results[project] = stats;
    } catch (e) {
      console.error(`refreshImportedProjects(${project}) error:`, e);
      results[project] = { error: e.message };
    }
  }

  return results;
}
