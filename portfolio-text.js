/** Споделени текстови помощници за portfolio модули (без тежки зависимости). */

export function decodeHtmlEntities(text) {
  if (!text) return '';
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function normalizeCatalogText(text) {
  return decodeHtmlEntities(text || '').replace(/\s+/g, ' ').trim();
}
