/**
 * Търсене по думи в текста на продукт — общо за правилата за безопасност, класификацията и точкуването.
 */

/**
 * „За продукта“ при внесените продукти е обект { title, description, benefits: [{ title, description }] } —
 * там е съставът. Досега се четеше като „[object Object]“ и стимулантите в него не се виждаха.
 */
export function aboutContentText(pd = {}) {
  const ac = pd.about_content;
  const parts = [];
  if (typeof ac === 'string') parts.push(ac);
  else if (ac && typeof ac === 'object') {
    parts.push(ac.title, ac.description);
    for (const b of Array.isArray(ac.benefits) ? ac.benefits : []) parts.push(b?.title, b?.description);
  }
  for (const k of ['additional_advice', 'contraindications', 'warnings']) {
    if (typeof pd[k] === 'string') parts.push(pd[k]);
  }
  return parts.filter(Boolean).join(' ');
}

/** Текстов пул от продукт за keyword matching */
export function productSearchText(product) {
  const pd = product.public_data || {};
  const parts = [
    pd.name,
    pd.tagline,
    pd.description,
    aboutContentText(pd),
    product.system_data?.target_profile,
    product.system_data?.portfolio?.category,
    ...(pd.ingredients || []).map((i) => `${i.name} ${i.description || ''}`),
    ...(product.system_data?.goals || []),
    ...(pd.effects || []).map((e) => e.label),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * Нормализира текст за търсене по думи: малки букви, без диакритика (й→и и от двете страни),
 * всичко освен букви/цифри → интервал.
 */
export function normalizeMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const normalizedTextCache = new Map();
function normalizedHaystack(text) {
  const key = String(text || '');
  let hit = normalizedTextCache.get(key);
  if (hit === undefined) {
    if (normalizedTextCache.size > 2000) normalizedTextCache.clear();
    hit = ` ${normalizeMatchText(key)} `;
    normalizedTextCache.set(key, hit);
  }
  return hit;
}

const keywordRegexCache = new Map();
/**
 * Ключовата дума трябва да започва в началото на дума („став“ хваща „ставите“, но „стимул“ не хваща
 * „настимул…“). Цяла дума се изисква за кратки латински токени (fat ≠ fatigue, epa ≠ repair, nad ≠ canada),
 * за думи, оградени с интервали (' men '), и за думи, завършващи на '$' ('мед$' ≠ „медицина“).
 */
function keywordRegex(keyword) {
  const raw = String(keyword || '');
  let hit = keywordRegexCache.get(raw);
  if (hit) return hit;
  const wholeMarked = /^\s|\s$/.test(raw) || raw.endsWith('$');
  const kw = normalizeMatchText(raw.replace(/\$$/, ''));
  if (!kw) {
    hit = /$^/;
  } else {
    const shortLatin = /^[a-z0-9]{1,3}$/.test(kw);
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    hit = new RegExp(` ${escaped}${wholeMarked || shortLatin ? ' ' : ''}`);
  }
  keywordRegexCache.set(raw, hit);
  return hit;
}

export function productMatchesAnyKeyword(text, keywords) {
  const haystack = normalizedHaystack(text);
  return keywords.some((kw) => keywordRegex(kw).test(haystack));
}

/** Първата съвпаднала ключова дума (за обяснения и диагностика). */
export function firstMatchingKeyword(text, keywords) {
  const haystack = normalizedHaystack(text);
  return keywords.find((kw) => keywordRegex(kw).test(haystack)) || null;
}
