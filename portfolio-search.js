/**
 * Smart catalog search – BG/EN synonyms, multi-word, categories, packs.
 */

const SYNONYMS = {
  протеин: ['protein', 'whey', 'уей', 'казеин', 'casein', 'isolate', 'изолат', 'whey protein'],
  protein: ['протеин', 'уей', 'whey'],
  whey: ['протеин', 'уей', 'protein', 'суроватъчен'],
  казеин: ['casein', 'казеинов'],
  casein: ['казеин'],
  креатин: ['creatine', 'creatin'],
  creatine: ['креатин'],
  витамин: ['vitamin', 'vitamins', 'витамини'],
  vitamin: ['витамин', 'витамини'],
  амино: ['amino', 'bcaa', 'eaa', 'аминокиселини'],
  amino: ['амино', 'аминокиселини', 'bcaa'],
  bcaa: ['амино', 'bcaa'],
  маса: ['mass', 'gainer', 'гейнър', 'гейнер'],
  gainer: ['маса', 'гейнър', 'mass'],
  бар: ['bar', 'bars', 'батон', 'батонче'],
  bar: ['бар', 'батон'],
  шейк: ['shake', 'shaker'],
  shake: ['шейк'],
  омега: ['omega', 'fish oil', 'рибено'],
  omega: ['омега', 'рибено'],
  кофеин: ['caffeine', 'caffein'],
  caffeine: ['кофеин'],
  глутамин: ['glutamine'],
  glutamine: ['глутамин'],
  preworkout: ['pre-workout', 'pre workout', 'предтрен', 'предтренировъчен'],
  предтрен: ['preworkout', 'pre-workout'],
  zma: ['зма'],
  collagen: ['колаген'],
  колаген: ['collagen'],
  magnesium: ['магнезий'],
  магнезий: ['magnesium'],
  zinc: ['цинк'],
  цинк: ['zinc']
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s.+~-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeQuery(query) {
  return normalizeText(query).split(/\s+/).filter((t) => t.length >= 2);
}

export function expandToken(token) {
  const variants = new Set([token]);
  const direct = SYNONYMS[token];
  if (direct) direct.forEach((s) => variants.add(normalizeText(s)));
  for (const [key, values] of Object.entries(SYNONYMS)) {
    if (key.includes(token) || token.includes(key)) variants.add(key);
    if (values.some((v) => v.includes(token) || token.includes(v))) {
      variants.add(key);
      values.forEach((v) => variants.add(normalizeText(v)));
    }
  }
  return [...variants];
}

export function buildSearchText(item) {
  if (item.search_text) return item.search_text;
  return normalizeText(
    [
      item.name,
      item.brand,
      item.category,
      item.category_top,
      ...(item.category_path || []),
      ...(item.packs || []),
      ...(item.options || [])
    ].filter(Boolean).join(' ')
  );
}

export function matchesSearchQuery(item, rawQuery, categories = []) {
  const query = normalizeText(rawQuery);
  if (!query) return true;

  const tokens = tokenizeQuery(query);
  if (!tokens.length) {
    const hay = buildSearchText(item);
    return hay.includes(query);
  }

  const hay = buildSearchText(item);

  // Whole-query category match (e.g. "протеини" → category)
  const catMatch = categories.find(
    (c) => normalizeText(c.name) === query || normalizeText(c.name).startsWith(query)
  );
  if (catMatch) {
    return item.category_top === catMatch.name || item.category.startsWith(catMatch.name);
  }

  return tokens.every((token) => {
    const variants = expandToken(token);
    return variants.some((v) => hay.includes(v));
  });
}

function stripHtmlForSearch(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function enrichIndexEntry(entry, group) {
  const options = group
    ? [...new Set(group.variants.map((v) => v.option).filter(Boolean))]
    : (entry.options || []);
  const descriptionSnippet = group?.description
    ? stripHtmlForSearch(group.description).slice(0, 600)
    : '';
  const search_text = normalizeText(
    [
      entry.name,
      entry.brand,
      entry.category,
      entry.category_top,
      ...(entry.packs || []),
      ...options,
      descriptionSnippet
    ].filter(Boolean).join(' ')
  );
  return { ...entry, options, search_text };
}
