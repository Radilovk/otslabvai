/**
 * Текстове за продуктовите карти (daotslabna, Life): чисто име, подзаглавие и кратък текст до цяла дума.
 * Импортираните продукти идват с имена „Име | Описание [60 капсули, 30 Дози]“ и HTML ентитита от доставчика.
 */

const ENTITIES = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };

export function decodeEntities(value) {
  let out = String(value || '');
  // Двойно кодирани („&amp;amp;“) — до два прохода.
  for (let i = 0; i < 2; i += 1) out = out.replace(/&(amp|quot|#39|apos|lt|gt|nbsp);/g, (m) => ENTITIES[m] || m);
  return out;
}

/**
 * „Lean | Lipotropic Fat Burner [60 капсули, 30 Дози]“ → { title: 'Lean', subtitle: 'Lipotropic Fat Burner', pack: '60 капсули, 30 Дози' }.
 */
export function splitProductName(name) {
  let text = decodeEntities(name).replace(/\s+/g, ' ').trim();
  let pack = '';
  const bracket = text.match(/\s*\[([^\]]+)\]\s*$/);
  if (bracket) {
    pack = bracket[1].trim();
    text = text.slice(0, bracket.index).trim();
  }
  const [title, ...rest] = text.split(/\s+\|\s+/);
  return { title: title.trim(), subtitle: rest.join(' · ').trim(), pack };
}

/** Кратък текст: без HTML, отрязан до цяла дума, с „…“. */
export function cardSnippet(text, max = 90) {
  const clean = decodeEntities(String(text || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).replace(/[\s,.;:–-]+$/, '')}…`;
}

/** Текстът под името на картата: слоган или първото изречение/начало на описанието. */
export function cardTaglineText(publicData, max = 90) {
  if (publicData?.tagline) return cardSnippet(publicData.tagline, max);
  const first = String(publicData?.description || '').split(/\n/)[0];
  return first ? cardSnippet(first, max) : '';
}
