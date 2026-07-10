/**
 * Писмени команди за Portfolio импорт: парсване и изпълнение с текстов отговор.
 */
import { filterIndex } from './portfolio-filter.js';
import {
  parseAiSelectPrompt,
  hasStructuredFilters,
  buildFilterReason,
  mergeImportFilters,
  shouldUseFilterOnly,
  selectionFromFilteredIndex,
  BRANDS_RE
} from './portfolio-import-prompt.js';

/** @typedef {'help'|'list'|'count'|'stats'|'brands'|'categories'|'select'} CatalogCommandAction */

const HELP_TEXT = `Писмени команди за каталога:
• изведи продукти от марки 1,2,3 — списък по марка (ID)
• съдържащи цинк / с колаген — търсене по съставка
• марж над 30% / продажна цена над 30% от базовата
• цена над 20 евро / под 50 евро
• колко продукта от марка 1 — брой
• средна цена на протеини — статистика
• покажи марките / покажи категориите — справки
• най-евтините / най-скъпите — сортиране
• фокус върху NAD+ и колаген — AI тематичен подбор за проекта
• помощ — този списък`;

/**
 * @param {string} prompt
 * @param {object} [meta]
 * @returns {{ action: CatalogCommandAction, filters: object, aiInstructions: string, params: object }}
 */
export function parseCatalogCommand(prompt, meta = {}) {
  const raw = String(prompt || '').trim();
  if (!raw) return { action: 'help', filters: {}, aiInstructions: '', params: {} };

  if (/^(помощ|help|\?|какви\s+команди|какво\s+можеш)/i.test(raw)) {
    return { action: 'help', filters: {}, aiInstructions: '', params: {} };
  }

  const parsed = parseAiSelectPrompt(raw, meta);

  if (/(?:^|\s)(колко|брой|count)(?=\s|$|[,.])/i.test(raw) && /продукт|артикул|бр/i.test(raw)) {
    return { action: 'count', filters: parsed.filters, aiInstructions: '', params: {} };
  }

  if (/средн[аоую]\s+цена|минималн[аоую]\s+цена|максималн[аоую]\s+цена|статистик/i.test(raw)) {
    return { action: 'stats', filters: parsed.filters, aiInstructions: '', params: {} };
  }

  if (/(?:покажи|изведи|списък|кои).*(?:марк[аи](?:те)?|brands)/i.test(raw) && !BRANDS_RE.test(raw)) {
    return { action: 'brands', filters: parsed.filters, aiInstructions: '', params: {} };
  }

  if (/(?:покажи|изведи|списък|кои).*(?:категори|categories)/i.test(raw)) {
    return { action: 'categories', filters: parsed.filters, aiInstructions: '', params: {} };
  }

  const categoryFromPrompt = resolveCategoryFromPrompt(raw, meta);
  if (categoryFromPrompt) parsed.filters.category = categoryFromPrompt;

  if (shouldUseFilterOnly(parsed, 'auto') || parsed.mode === 'filter') {
    return { action: 'list', filters: parsed.filters, aiInstructions: '', params: {} };
  }

  return {
    action: 'select',
    filters: parsed.filters,
    aiInstructions: parsed.aiInstructions || raw,
    params: {}
  };
}

function resolveCategoryFromPrompt(raw, meta = {}) {
  const categories = meta.categories || [];
  const lower = raw.toLowerCase();
  for (const cat of categories) {
    const name = String(cat.name || '').toLowerCase();
    if (name.length >= 3 && lower.includes(name)) return cat.name;
  }
  const m = raw.match(/(?:категори[яи]|category)\s+([^,.\d]+)/i);
  return m ? m[1].trim() : '';
}

function roundPrice(n) {
  return Math.round(n * 100) / 100;
}

function formatPrice(n) {
  return `${roundPrice(n).toFixed(2)} €`;
}

/**
 * Изпълнява писмена команда върху каталога.
 * @param {object} opts
 * @returns {{ action: string, answer: string, selected: Array, data?: object, mode: string, applied_filters?: object, catalog_size?: number }}
 */
export function executeCatalogCommand({
  command,
  index,
  meta = {},
  filters = {},
  limit = 12,
  projectLabel = ''
}) {
  const filtered = filterIndex(index, { ...filters, available: '1' }, meta);
  const applied_filters = filters;

  switch (command.action) {
    case 'help':
      return {
        action: 'help',
        answer: HELP_TEXT,
        selected: [],
        mode: 'command',
        data: { type: 'help' }
      };

    case 'count': {
      const reason = hasStructuredFilters(command.filters) ? buildFilterReason(command.filters) : 'в целия каталог';
      return {
        action: 'count',
        answer: `Намерени са ${filtered.length} налични продукта (${reason}).`,
        selected: [],
        mode: 'command',
        catalog_size: filtered.length,
        applied_filters,
        data: { count: filtered.length }
      };
    }

    case 'stats': {
      if (!filtered.length) {
        return {
          action: 'stats',
          answer: 'Няма продукти за статистика по зададените критерии.',
          selected: [],
          mode: 'command',
          applied_filters
        };
      }
      const prices = filtered.map((e) => e.min_price).filter((p) => p > 0);
      const markups = filtered.map((e) => e.max_markup_percent ?? e.min_markup_percent).filter((m) => m > 0);
      const avg = prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : 0;
      const min = prices.length ? Math.min(...prices) : 0;
      const max = prices.length ? Math.max(...prices) : 0;
      const avgMarkup = markups.length ? markups.reduce((s, m) => s + m, 0) / markups.length : 0;
      const scope = hasStructuredFilters(command.filters) ? buildFilterReason(command.filters) : 'в целия каталог';
      return {
        action: 'stats',
        answer: `Статистика (${scope}): ${filtered.length} продукта; средна цена ${formatPrice(avg)}; от ${formatPrice(min)} до ${formatPrice(max)}${avgMarkup ? `; среден марж ~${roundPrice(avgMarkup)}%` : ''}.`,
        selected: [],
        mode: 'command',
        catalog_size: filtered.length,
        applied_filters,
        data: { count: filtered.length, avg_price: roundPrice(avg), min_price: min, max_price: max, avg_markup: roundPrice(avgMarkup) }
      };
    }

    case 'brands': {
      const brandCounts = new Map();
      for (const item of filtered) {
        const key = String(item.brand_id);
        const prev = brandCounts.get(key) || { id: key, name: item.brand, count: 0 };
        prev.count += 1;
        brandCounts.set(key, prev);
      }
      const list = [...brandCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'bg'));
      const top = list.slice(0, 20);
      const lines = top.map((b) => `${b.name} (ID ${b.id}): ${b.count}`);
      return {
        action: 'brands',
        answer: list.length
          ? `Марки в каталога${hasStructuredFilters(command.filters) ? ' (филтрирано)' : ''} — ${list.length} общо:\n${lines.join('\n')}`
          : 'Няма марки по зададените критерии.',
        selected: [],
        mode: 'command',
        applied_filters,
        data: { brands: list }
      };
    }

    case 'categories': {
      const catCounts = new Map();
      for (const item of filtered) {
        const top = item.category_top || item.category || 'Други';
        catCounts.set(top, (catCounts.get(top) || 0) + 1);
      }
      const list = [...catCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'bg'));
      const lines = list.slice(0, 20).map((c) => `${c.name}: ${c.count}`);
      return {
        action: 'categories',
        answer: list.length
          ? `Категории${hasStructuredFilters(command.filters) ? ' (филтрирано)' : ''}:\n${lines.join('\n')}`
          : 'Няма категории по зададените критерии.',
        selected: [],
        mode: 'command',
        applied_filters,
        data: { categories: list }
      };
    }

    case 'list': {
      if (!filtered.length) {
        return {
          action: 'list',
          answer: 'Няма налични продукти по зададените критерии.',
          selected: [],
          mode: 'command',
          applied_filters
        };
      }
      const selected = selectionFromFilteredIndex(filtered, command.filters, limit);
      const showing = selected.length;
      const total = filtered.length;
      return {
        action: 'list',
        answer: `Показвам ${showing} от ${total} продукта. ${buildFilterReason(command.filters)}`,
        selected,
        mode: 'command',
        catalog_size: total,
        applied_filters
      };
    }

    case 'select':
    default:
      return {
        action: 'select',
        answer: projectLabel
          ? `AI подбор за ${projectLabel}…`
          : 'AI подбор…',
        selected: [],
        mode: 'ai',
        catalog_size: filtered.length,
        applied_filters,
        _needsAi: true,
        _filtered: filtered
      };
  }
}

/**
 * Пълен flow: парсва prompt, слива филтри, изпълнява командата.
 */
export function runCatalogCommand({ prompt, meta, uiFilters = {}, limit = 12, projectLabel = '' }) {
  const command = parseCatalogCommand(prompt, meta);
  const filters = mergeImportFilters({ ui: uiFilters, parsed: command.filters });
  return {
    command,
    filters,
    result: executeCatalogCommand({
      command,
      index: meta.index,
      meta,
      filters,
      limit,
      projectLabel
    })
  };
}
