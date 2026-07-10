/**
 * Парсва естествен език (български/английски) в структурирани филтри за
 * Portfolio импорт — марки, марж, съставки, ценови диапазон, сортиране.
 */

/** @typedef {{ brands?: string[], q?: string, min_price?: string, max_price?: string, min_markup_percent?: number, max_markup_percent?: number, category?: string, sort?: string }} ParsedFilters */

function stripFilterBoilerplate(text) {
  return String(text || '')
    .replace(/(?:^|\s)(изведи|покажи|филтрирай|лист|списък|намери|дай|филтър)(?=\s|$|[,.])/gi, ' ')
    .replace(/(?:^|\s)(продукти?|само|от|които|всички)(?=\s|$|[,.])/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,.\-–—]+\s*/, '')
    .trim();
}
const BRANDS_RE = /(?:марк[аи](?:те)?|brand(?:s)?|от\s+марк[аи](?:те)?)\s+([\d][\d,\s]*)/i;
export { BRANDS_RE };
const MARKUP_RE = /(?:(?:марж|markup|надбавк[аи]).*?(?:над|over|по-голям[ао]\s+от|>|от)\s*(\d+(?:[.,]\d+)?)\s*%|(?:продажна\s+цена|retail\s+price?).*?(?:над|over)\s*(\d+(?:[.,]\d+)?)\s*(?:%|процент[аи])|(\d+(?:[.,]\d+)?)\s*%\s*(?:марж|markup|надбавка|от\s+базовата|над\s+базовата))/i;
const CONTAINS_RE = /(?:съдържа(?:щи|т)?|със(?:\s+съставка)?|\bс\s+(?![\d,])|contain(?:ing)?|with)\s+([а-яa-z0-9+#\-\s]{2,50})/i;
const MIN_PRICE_RE = /(?:цен[аи]|price).*?(?:над|over|>|от)\s*(\d+(?:[.,]\d+)?)\s*(?:€|евро|eur)?/i;
const MAX_PRICE_RE = /(?:цен[аи]|price).*?(?:под|under|<|до)\s*(\d+(?:[.,]\d+)?)\s*(?:€|евро|eur)?/i;
const SORT_PRICE_ASC_RE = /\b(най-евтин|евтин|price\s*asc|sort\s*price\s*asc)\b/i;
const SORT_PRICE_DESC_RE = /\b(най-скъп|скъп|price\s*desc|sort\s*price\s*desc)\b/i;

function parseNum(raw) {
  if (raw == null || raw === '') return NaN;
  return parseFloat(String(raw).replace(',', '.'));
}

function cleanSearchTerm(term) {
  return String(term || '')
    .trim()
    .replace(/\s+(и|или|само|продукти?|от\s+каталога)$/i, '')
    .trim();
}

function resolveBrandNamesToIds(names, meta = {}) {
  const brands = meta.brands || [];
  if (!brands.length || !names.length) return [];

  const ids = [];
  for (const name of names) {
    const norm = name.toLowerCase().trim();
    const found = brands.find((b) => {
      const bn = String(b.name || '').toLowerCase();
      return bn === norm || bn.includes(norm) || norm.includes(bn);
    });
    if (found) ids.push(String(found.id));
  }
  return ids;
}

/**
 * @param {string} prompt
 * @param {object} [meta]
 * @returns {{ filters: ParsedFilters, aiInstructions: string, mode: 'filter'|'select' }}
 */
export function parseAiSelectPrompt(prompt, meta = {}) {
  const raw = String(prompt || '').trim();
  if (!raw) return { filters: {}, aiInstructions: '', mode: 'select' };

  /** @type {ParsedFilters} */
  const filters = {};
  let mode = /(?:^|\s)(изведи|покажи|филтрирай|лист|списък|намери|дай|филтър)(?=\s|$|[,.])/i.test(raw) ? 'filter' : 'select';
  let remainder = raw;

  const brandsMatch = raw.match(BRANDS_RE);
  if (brandsMatch) {
    const brands = brandsMatch[1].split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    if (brands.length) {
      filters.brands = brands.every((b) => /^\d+$/.test(b))
        ? brands
        : resolveBrandNamesToIds(brands, meta);
      if (!filters.brands.length && brands.every((b) => /^\d+$/.test(b))) {
        filters.brands = brands;
      }
      mode = 'filter';
      remainder = remainder.replace(brandsMatch[0], ' ').trim();
    }
  }

  const markupMatch = raw.match(MARKUP_RE);
  if (markupMatch) {
    const pct = parseNum(markupMatch[1] || markupMatch[2] || markupMatch[3]);
    if (!Number.isNaN(pct)) {
      filters.min_markup_percent = pct;
      mode = 'filter';
    }
  }

  const containsMatch = raw.match(CONTAINS_RE);
  if (containsMatch) {
    const term = cleanSearchTerm(containsMatch[1]);
    if (term.length >= 2) {
      filters.q = filters.q ? `${filters.q} ${term}` : term;
      mode = 'filter';
      remainder = remainder.replace(containsMatch[0], ' ').trim();
    }
  }

  const minPriceMatch = raw.match(MIN_PRICE_RE);
  if (minPriceMatch) {
    filters.min_price = minPriceMatch[1].replace(',', '.');
    mode = 'filter';
  }

  const maxPriceMatch = raw.match(MAX_PRICE_RE);
  if (maxPriceMatch) {
    filters.max_price = maxPriceMatch[1].replace(',', '.');
    mode = 'filter';
  }

  if (SORT_PRICE_ASC_RE.test(raw)) filters.sort = 'price_asc';
  if (SORT_PRICE_DESC_RE.test(raw)) filters.sort = 'price_desc';

  const aiInstructions = stripFilterBoilerplate(remainder);

  return { filters, aiInstructions, mode };
}

/** Дали да се ползва само филтър (без AI) при auto режим. */
export function shouldUseFilterOnly(parsed, requestMode = 'auto') {
  if (requestMode === 'filter') return true;
  if (requestMode === 'ai') return false;
  return parsed.mode === 'filter'
    && hasStructuredFilters(parsed.filters)
    && !parsed.aiInstructions;
}

/** @param {ParsedFilters} filters */
export function hasStructuredFilters(filters = {}) {
  const hasNum = (v) => v !== '' && v != null && !Number.isNaN(Number(v));
  return Boolean(
    filters.brands?.length
    || filters.q
    || filters.min_price
    || filters.max_price
    || hasNum(filters.min_markup_percent)
    || hasNum(filters.max_markup_percent)
    || filters.category
  );
}

/** @param {ParsedFilters} filters */
export function buildFilterReason(filters = {}) {
  const parts = [];
  if (filters.brands?.length) parts.push(`марки ${filters.brands.join(', ')}`);
  if (filters.q) parts.push(`търсене „${filters.q}"`);
  if (filters.min_markup_percent != null) parts.push(`марж ≥ ${filters.min_markup_percent}%`);
  if (filters.max_markup_percent != null) parts.push(`марж ≤ ${filters.max_markup_percent}%`);
  if (filters.min_price) parts.push(`цена ≥ ${filters.min_price} €`);
  if (filters.max_price) parts.push(`цена ≤ ${filters.max_price} €`);
  if (filters.category) parts.push(`категория „${filters.category}"`);
  return parts.length ? `Съответства на: ${parts.join('; ')}` : 'Съответства на зададените критерии';
}

/** Обогатява index запис с UI полета за подбор. */
export function enrichSelectionEntry(item, entry) {
  if (!entry) return item;
  return {
    ...item,
    name: entry.name,
    brand: entry.brand,
    category: entry.category,
    min_price: entry.min_price,
    image: entry.image
  };
}

/** Връща продукти от филтриран индекс без AI (бърз подбор по критерии). */
export function selectionFromFilteredIndex(indexSubset, filters, limit) {
  const reason = buildFilterReason(filters);
  return indexSubset.slice(0, limit).map((entry) => enrichSelectionEntry({
    group_id: String(entry.group_id),
    reason,
    goals: [],
    tagline: ''
  }, entry));
}

/**
 * Слива UI филтри, body.filters и парснатите от prompt филтри.
 * @param {object} opts
 * @returns {object}
 */
export function mergeImportFilters({ ui = {}, body = {}, parsed = {} } = {}) {
  const brands = [
    ...(Array.isArray(body.brands) ? body.brands : []),
    ...(Array.isArray(parsed.brands) ? parsed.brands : []),
    ...(ui.brand ? [ui.brand] : [])
  ].map(String).filter(Boolean);

  const q = [ui.q, body.q, parsed.q].filter(Boolean).join(' ').trim();

  return {
    brand: ui.brand || body.brand || '',
    brands: [...new Set(brands)],
    category: ui.category || body.category || parsed.category || '',
    q,
    min_price: body.min_price || parsed.min_price || ui.min_price || '',
    max_price: body.max_price || parsed.max_price || ui.max_price || '',
    min_markup_percent: body.min_markup_percent ?? parsed.min_markup_percent ?? '',
    max_markup_percent: body.max_markup_percent ?? parsed.max_markup_percent ?? '',
    available: '1',
    sort: parsed.sort || body.sort || ui.sort || 'name'
  };
}
