/**
 * Sila.bg Distro API v1 – catalog fetch, normalization, order submission.
 * API docs: https://distro.silabg.com (B2B profile → API tab)
 */

import { FITNESS1_CATALOG_CATEGORIES } from './portfolio-fitness1-categories.js';

const SILA_BASE_URL = 'https://distro.silabg.com/api/v1';
const SILA_PUBLIC_ORIGIN = 'https://www.silabg.com';
const SILA_BRANDFEED_CONCURRENCY = 6;
export const KV_SILA_TOKEN = 'sila_api_token';
export const DISTRIBUTOR_SILA = 'sila';
export const DISTRIBUTOR_FITNESS1 = 'fitness1';

/** Numeric namespace for Sila-only catalog rows (avoids collisions with Fitness1 ids). */
export const SILA_GROUP_ID_OFFSET = 90000000;
export const SILA_BRAND_ID_OFFSET = 9000000;
export const SILA_SKU_ID_OFFSET = 9000000000;

function normalizeBrandKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[™®©]/g, '')
    .replace(/\s+/g, ' ');
}

/** Map Sila category strings into the same taxonomy as the main catalog (for filters/goals). */
export function mapSilaCategoryToCatalogTaxonomy(rawCategory) {
  const raw = String(rawCategory || '').trim();
  if (!raw || /^sila\b/i.test(raw)) return 'Други';

  const parts = raw.split('>').map((p) => p.trim()).filter(Boolean);
  const top = parts[0] || '';
  const lowerTop = top.toLowerCase();

  for (const cat of FITNESS1_CATALOG_CATEGORIES) {
    if (top === cat) {
      return parts.length > 1 ? parts.join(' > ') : cat;
    }
    if (lowerTop === cat.toLowerCase()) {
      parts[0] = cat;
      return parts.join(' > ');
    }
  }

  const lowerRaw = raw.toLowerCase();
  for (const cat of FITNESS1_CATALOG_CATEGORIES) {
    if (lowerRaw.includes(cat.toLowerCase())) {
      const idx = lowerRaw.indexOf(cat.toLowerCase());
      const tail = raw.slice(idx + cat.length).replace(/^[>\s/|-]+/, '').trim();
      return tail ? `${cat} > ${tail}` : cat;
    }
  }

  /** @type {[RegExp, string][]} */
  const SYNONYMS = [
    [/протеин|whey|casein|изолат/i, 'Протеини'],
    [/креатин/i, 'Креатин'],
    [/витамин/i, 'Витамини'],
    [/минерал|магнезий|цинк|калций/i, 'Минерали'],
    [/аминокиселин|bcaa|eaa|glutamine|глутамин/i, 'Аминокиселини'],
    [/мазнин|fat\s*burn|термо|липо/i, 'Отслабване и контрол на теглото'],
    [/предтрен|pre.?workout/i, 'Предтренировъчни добавки'],
    [/став|колаген|глюкозамин/i, 'Стави и сухожилия'],
    [/билк|herb/i, 'Билки и растителни екстракти'],
    [/анти.?ейдж|anti.?aging/i, 'Дълголетие / Anti-Aging'],
    [/маса|gainer|bulk/i, 'Качване на маса и възстановяване'],
    [/аксесоар|шейкър|belt|колан/i, 'Спортни аксесоари и уреди'],
  ];
  for (const [pattern, cat] of SYNONYMS) {
    if (pattern.test(raw)) return cat;
  }

  return 'Други';
}

/**
 * Категориите от Sila brandfeed (плоски, ~190) → горно ниво на текущото дърво на Fitness1.
 * Резултатът е „<горно ниво> > <категория от Sila>“, за да работят и филтрите по подкатегория.
 * @type {[RegExp, string][]}
 */
const SILA_FEED_CATEGORY_RULES = [
  [/продуктови каталози/i, 'Други'],
  [/ръкавици за бокс|ръкавици за mma|протектори за уста|каски|бойни изкуства|бинтове/i, 'Аксесоари за бокс и ММА'],
  [/спортни дрехи|тениски|клинове|потници|къси гащи|шапки|текстилни/i, 'Тениски и облекло'],
  [/шейкъри|бутилки|раници|чанти|сакове|кутии за хапчета|колани|накитници|кинезио|фитнес оборудване|наколенки|ръкавици|подложки|за бедро|фитили|с отделения|без отделения/i, 'Спортни аксесоари и уреди'],
  [/козмет|лична грижа/i, 'Козметика'],
  [/барове|фитнес и био храни|фъстъчени масла|сосове|подсладители|чипс|спрейове за готвене|заместители на хранене|високопротеинови/i, 'Функционални храни'],
  [/изотонични|гелове и желета/i, 'Хидратация и електролити'],
  [/гейнъри|въглехидрати|vitargo|следтренировъчни|post workout/i, 'Качване на маса и възстановяване'],
  [/креатин|монохидрат|creapure|кре-алкалин|микронизиран|хидрохлорид|етил естер|magna power/i, 'Креатин'],
  [/контролиране на теглото|отслабване|фет бърнъри|л-карнитин|carnipure|л-тартрат|\bcla\b|диуретици|water-out|зелено кафе|блокър|малинови кетони|синефрин|инсулинови имитатори/i, 'Отслабване и контрол на теглото'],
  [/предтренировъчни|pre workout|напомпващи|енергийни|intra workout|по време на тренировка/i, 'Предтренировъчни добавки'],
  [/хормонно|хардкор|тестостерон|екдистерон|аспарагинова|растежния хормон|естроген|igf|трибулус|либидо/i, 'Хардкор продукти и стимулатори'],
  [/протеин|суроватъчни|изолат|концентрат|хидролиз|казеин|млечн|телешки|матрич|растителни|грахов|оризов|соев|мицелар/i, 'Протеини'],
  [/амино|глутамин|bcaa|\d:\d:\d|аргинин|цитрулин|лизин|тирозин|аланин|левцин|заменими|триптофан|цистеин|фенилаланин|пролин|хистидин|еднокомпонентни|all in one/i, 'Аминокиселини'],
  [/ставно|глюкозамин|метилсулфонилметан|msm/i, 'Стави и сухожилия'],
  [/колаген|хиалуронова/i, 'Красота и подмладяване'],
  [/омега|мастни киселини|кокосово масло|ленено масло/i, 'Мастни киселини'],
  [/антиоксиданти/i, 'Антиоксиданти'],
  [/детски витамини/i, 'Здраве за цялото семейство'],
  [/мултивитамини|комплексни формули|формули за мъже|формули за жени|суплементи за жени/i, 'Мултивитамини'],
  [/витамини/i, 'Витамини'],
  [/минерали|\bzma\b|ефервесцентни/i, 'Минерали'],
  [/екстракти|адаптогени|зелени храни|билкови|алое вера/i, 'Билки и растителни екстракти'],
  [/здраве и тонус|хранителни добавки|имуностимулатори|пробиотици|ензими|сън|черния дроб|сърцето|простата|зрение|мисловната|фокус и концентрация|пчелни|фибри|веган продукти/i, 'Добавки по здравна цел'],
];

/** Категория от Sila brandfeed → „горно ниво > категория“ в дървото на Fitness1; null ако няма съвпадение. */
export function mapSilaFeedCategory(rawCategory) {
  const raw = String(rawCategory || '').trim();
  if (!raw) return null;
  for (const [pattern, top] of SILA_FEED_CATEGORY_RULES) {
    if (pattern.test(raw)) return top === 'Други' ? 'Други' : `${top} > ${raw}`;
  }
  return null;
}

/**
 * Sila API не подава категория → класифициране по име на продукта в текущото дърво на Fitness1.
 * Редът има значение: аксесоари и храни преди хранителните вещества (напр. „Protein Bar“ е храна).
 * @type {[RegExp, string][]}
 */
const SILA_NAME_CATEGORY_RULES = [
  [/shaker|шейкър|bottle|бутилка|tumbler|\bcup\b|glove|ръкавиц|belt|колан|wrap|strap|chalk|towel|кърпа|\bbag\b|чанта|раница|pill box|кутия за|jump rope|въже|grip|knee|elbow|wrist|resistance band|booty band|ластик|foam roller/i, 'Спортни аксесоари и уреди'],
  [/boxing|бокс|\bmma\b|hand wraps/i, 'Аксесоари за бокс и ММА'],
  [/t-?shirt|тениска|hoodie|суитчър|шорти|shorts|leggings|клин|tank top|\bcap\b|шапка|чорапи|socks/i, 'Тениски и облекло'],
  [/erythritol|еритритол|stevia|стевия|rice cakes|cream of rice|оризов|\bbar\b|bars|cookie|бисквит|brownie|peanut butter|nut butter|фъстъчено|\boats\b|овес|pancake|палачинк|syrup|сироп|sauce|сос|chips|wafer|вафл|snack|cereal|jam|конфитюр|spread|zero calorie|complete meal|meal replacement|crunchy/i, 'Функционални храни'],
  [/\bcream\b|крем|serum|серум|lotion|лосион|шампоан|shampoo|body oil|\bbalm\b/i, 'Козметика'],
  [/creatine|креатин|\bcrea|kre-alkalyn|creakong|creage/i, 'Креатин'],
  [/electrolyte|електролит|isotonic|изотон|(?<!mono)hydrat|хидрат|\bgel\b|гел|energy drink|sparkling|\bshot\b|shots/i, 'Хидратация и електролити'],
  [/carb blocker|fat blocker|fat burn|burner|бърнър|carnitine|карнитин|\bcla\b|garcinia|гарциния|\bhca\b|thermo|термо|\blipo|glucomannan|глюкоманан|\bshred|\bcuts?\b|slim|diet|отслаб|green coffee|raspberry ketone|chromium|\bchrom|хром|\bburn|caffeine|кофеин|\bdry\b|chitosan|хитозан|forskohl|форсколин/i, 'Отслабване и контрол на теглото'],
  [/gainer|гейнър|mass\b|bulk|carb-?x|cluster dextrin|dextrose|maltodextrin|vitargo/i, 'Качване на маса и възстановяване'],
  [/whey|protein|протеин|isolate|изолат|casein|казеин/i, 'Протеини'],
  [/pre-?workout|предтрен|\bpump\b|nitric|\bn\.?o\.?\b|\bc4\b|\bstim\b|hardcore|хардкор|dmaa|testo|тесто|\btest\b|tribulus|трибулус|ecdy|екди|anadrol|turkesterone|black blood|blood and guts/i, 'Хардкор продукти и стимулатори'],
  [/bcaa|\beaa\b|glutamine|глутамин|amino|амино|taurine|таурин|arginine|аргинин|aakg|citrul|цитрулин|beta.?alanine|бета.?аланин|\bhmb\b|leucine|левцин|tyrosine|тирозин/i, 'Аминокиселини'],
  [/collagen|колаген|hyaluron|хиалурон|biotin|биотин|hair|коса|skin|кожа|nails|нокти|keratin|кератин/i, 'Красота и подмладяване'],
  [/glucosamine|глюкозамин|chondroitin|хондроитин|\bmsm\b|joint|стави|cartilage|cissus/i, 'Стави и сухожилия'],
  [/omega|омега|fish oil|рибено|krill|крил|\bdha\b|\bepa\b|\bmct\b|cod liver|flax|ленено|coconut oil|кокосово масло/i, 'Мастни киселини'],
  [/\bnmn\b|\bnad\b|nad\+|\bpqq\b|spermidine|спермидин|urolithin|уролитин|anti-?aging|антиейдж|longevity|nicotinamide riboside/i, 'Дълголетие / Anti-Aging'],
  [/coq10|co-q10|q10|ubiquinol|убихинол|resveratrol|ресвератрол|quercetin|кверцетин|alpha lipoic|\bala\b|glutathione|глутатион|astaxanthin|астаксантин|antioxid|антиоксид|grape seed|lycopene|lutein|лутеин|acai|асаи/i, 'Антиоксиданти'],
  [/multi-?vit|мултивит|active (wo)?man|daily vit|for women|for men|vita-?min pack|animal pak/i, 'Мултивитамини'],
  [/magnesium|магнез|chela-?mag|\bmag\b|\bzinc\b|цинк|calcium|калций|\biron\b|желязо|selenium|селен|potassium|калий|iodine|йод|\bzma\b|boron|бор\b|copper|мед\b|minerals?\b|cal-?mag|colloidal silver/i, 'Минерали'],
  [/vitamin|витамин|\bd3\b|\bk2\b|b-?12|b-complex|b complex|folate|folic|фолиева|niacin|ниацин|\bb-?6\b/i, 'Витамини'],
  [/extract|екстракт|herb|билк|ginseng|жен-?шен|maca|мака|ginkgo|гинко|turmeric|куркум|curcumin|berberine|берберин|shilajit|шиладжит|mushroom|гъби|lion'?s mane|reishi|рейши|cordyceps|кордицепс|saw palmetto|ashwagandha|ашваганда|rhodiola|родиола|milk thistle|бял трън|garlic|чесън|echinacea|ехинацея|fenugreek|сминдух|nettle|коприва|tongkat|moringa|spirulina|спирулина|chlorella|хлорела|boswellia|босвелия|bromelain|бромелаин|black cohosh|black cumin|черен кимион|walnut|орех|greens|beta glucan|бета глюкан|nigella|chlorophyll|хлорофил/i, 'Билки и растителни екстракти'],
  [/melatonin|мелатонин|\bgaba\b|5-htp|sleep|сън|probiotic|пробиот|acidophilus|enzyme|ензим|digest|храносмил|fiber|фибри|psyllium|псилиум|detox|детокс|liver|черен дроб|vision|зрение|immune|имун|colostrum|коластра|l-theanine|теанин|same\b|sam-e|cranberry|червена боровинка|prostate|простат|estriol|hormone|хормон|betaine|бетаин|pepsin|пепсин|\bhcl\b|choline|холин|inositol|инозитол|cognium|memory|памет|focus/i, 'Добавки по здравна цел'],
];

/** brandfeed категория → таксономия на Fitness1 → име на продукта → „Други“. */
export function resolveSilaCategory(rawCategory, productName) {
  const fromFeed = mapSilaFeedCategory(rawCategory);
  if (fromFeed) return fromFeed;
  const mapped = mapSilaCategoryToCatalogTaxonomy(rawCategory);
  if (mapped !== 'Други') return mapped;
  return classifySilaProductByName(productName) || 'Други';
}

/**
 * Sila пише разфасовката в името: „HCA / 150 Caps.“, „Omega 3 / 100 Softgels“.
 * Fitness1 я държи отделно — разделяме, за да изглеждат продуктите еднакво.
 */
export function splitSilaPackFromName(name) {
  const raw = String(name || '').trim();
  const m = raw.match(/^(.*\S)\s*\/\s*([^/]*\d[^/]*)$/);
  if (!m) return { name: raw, pack: '' };
  const pack = m[2].trim().replace(/\.$/, '');
  if (!/\d/.test(pack) || !/\d\s*(caps?|capsules?|vcaps?|tabs?|tablets?|softgels?|soft|serv\w*|g|gr|kg|ml|l|lbs?|packs?|sachets?|pcs|бр|капс\w*|табл\w*|гр|мл|дози)\b|\d\s*x\s*\d/i.test(pack)) {
    return { name: raw, pack: '' };
  }
  return { name: m[1].trim(), pack };
}

/** „OPTIMUM NUTRITION“ → „Optimum Nutrition“; съкращения до 3 букви остават (USA). */
export function displayBrandName(brand) {
  const raw = String(brand || '').trim();
  if (!raw || raw !== raw.toUpperCase() || !/[A-ZА-Я]{2}/.test(raw)) return raw;
  return raw.split(/(\s+)/).map((w) => (w.length <= 3 ? w : w.toLowerCase().replace(/(^|[\-.&/])([a-zа-я])/g, (_, p, c) => p + c.toUpperCase()))).join('');
}

/** Категория по име на продукта; null ако няма съвпадение. */
export function classifySilaProductByName(name) {
  const text = String(name || '');
  for (const [pattern, category] of SILA_NAME_CATEGORY_RULES) {
    if (pattern.test(text)) return category;
  }
  return null;
}

function silaGroupId(modelId) {
  const n = parseInt(String(modelId), 10) || 0;
  return String(SILA_GROUP_ID_OFFSET + n);
}

function silaBrandId(brandId) {
  const n = parseInt(String(brandId), 10) || 0;
  return String(SILA_BRAND_ID_OFFSET + n);
}

function silaSkuId(modelId, tasteId, sizeId) {
  const m = parseInt(String(modelId), 10) || 0;
  const t = parseInt(String(tasteId), 10) || 0;
  const s = parseInt(String(sizeId), 10) || 0;
  return String(SILA_SKU_ID_OFFSET + m * 100000 + t * 1000 + s);
}

export function normalizeSilaApiToken(raw) {
  if (!raw) return '';
  let token = String(raw).trim();
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(token)) {
    token = token.replace(/^bearer\s+/i, '').trim();
  }
  const apiTokenMatch = token.match(/(?:^|[?&])api_token=([^&\s#]+)/i);
  if (apiTokenMatch) {
    try {
      token = decodeURIComponent(apiTokenMatch[1]);
    } catch {
      token = apiTokenMatch[1];
    }
  }
  if (token.includes('\n')) {
    const line = token.split('\n').map((l) => l.trim()).find((l) => l.length >= 20);
    if (line) token = line;
  }
  return token.trim();
}

/** Sila distro API tokens are alphanumeric (often ~32 or ~80 chars from B2B profile → API tab). */
export function isValidSilaApiToken(token) {
  const normalized = normalizeSilaApiToken(token);
  return /^[A-Za-z0-9]{24,96}$/.test(normalized);
}

/**
 * All configured Sila tokens, preferring valid-format KV over invalid worker secret.
 * @param {object} env
 * @returns {Promise<string[]>}
 */
export async function listSilaApiTokenCandidates(env) {
  /** @type {{ source: string, token: string }[]} */
  const entries = [
    { source: 'worker_secret', token: normalizeSilaApiToken(env.SILA_API_TOKEN) },
    { source: 'kv', token: normalizeSilaApiToken(await env.PAGE_CONTENT?.get(KV_SILA_TOKEN)) },
  ].filter((entry) => entry.token);

  const seen = new Set();
  const unique = [];
  for (const entry of entries) {
    if (seen.has(entry.token)) continue;
    seen.add(entry.token);
    unique.push(entry);
  }

  unique.sort((a, b) => {
    const aValid = isValidSilaApiToken(a.token) ? 1 : 0;
    const bValid = isValidSilaApiToken(b.token) ? 1 : 0;
    if (bValid !== aValid) return bValid - aValid;
    const aKv = a.source === 'kv' ? 1 : 0;
    const bKv = b.source === 'kv' ? 1 : 0;
    return bKv - aKv;
  });

  return unique.map((entry) => entry.token);
}

/** Best Sila token for API calls (valid KV preferred over invalid worker secret). */
export async function getSilaApiToken(env) {
  const candidates = await listSilaApiTokenCandidates(env);
  return candidates[0] || null;
}

/**
 * Fetch Sila catalog, trying each token until one succeeds.
 * @param {string[]} tokens
 * @returns {Promise<{ products: object[], error: Error|null, token_used: string|null }>}
 */
export async function fetchSilaProductsWithFallback(tokens) {
  const list = [...new Set((tokens || []).map(normalizeSilaApiToken).filter(Boolean))];
  if (!list.length) return { products: [], error: null, token_used: null };

  /** @type {Error|null} */
  let lastError = null;
  for (const token of list) {
    try {
      const products = await fetchSilaProducts(token);
      return { products, error: null, token_used: token };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (e instanceof SilaError && (e.status === 401 || e.status === 403)) {
        continue;
      }
      throw e;
    }
  }
  return { products: [], error: lastError, token_used: null };
}

/** @param {object} env */
export async function fetchSilaProductsForEnv(env) {
  const tokens = await listSilaApiTokenCandidates(env);
  return fetchSilaProductsWithFallback(tokens);
}

export class SilaError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'SilaError';
    this.status = status;
  }
}

async function silaRequest(apiToken, path, { method = 'GET', body = null } = {}) {
  const url = `${SILA_BASE_URL}/${path.replace(/^\//, '')}?api_token=${encodeURIComponent(apiToken)}`;
  const options = {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; BiocodePortfolio/1.0; +https://daotslabna.com)',
    },
  };
  if (body != null) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const preview = text.replace(/\s+/g, ' ').slice(0, 120);
    throw new SilaError(
      `Sila API грешка: ${response.status} (невалиден JSON)${preview ? ` — ${preview}` : ''}`,
      502
    );
  }

  if (!response.ok || (data.status && data.status !== 200 && data.status !== '200')) {
    const detail = data?.message || data?.error || '';
    throw new SilaError(
      `Sila API грешка: ${response.status}${detail ? ` — ${detail}` : ''}`,
      response.status >= 400 && response.status < 600 ? response.status : 502
    );
  }

  return data;
}

function pickFirst(obj, keys, fallback = '') {
  for (const key of keys) {
    const val = obj?.[key];
    if (val != null && val !== '') return val;
  }
  return fallback;
}

const SILA_IMAGE_FIELD_KEYS = [
  'image', 'image_url', 'img', 'thumb', 'thumbnail',
  'product_image', 'model_image', 'photo', 'picture',
  'img_url', 'image_small', 'image_large', 'image_path',
  'small_image', 'large_image', 'product_thumb', 'model_thumb',
];

/** Normalize Sila image paths to absolute URLs (often /uf/product/... on silabg.com). */
export function resolveSilaImageUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `${SILA_PUBLIC_ORIGIN}${raw}`;
  return `${SILA_PUBLIC_ORIGIN}/${raw.replace(/^\//, '')}`;
}

/** Extract image URL from a Sila API row (product list, brandfeed, or barcode detail). */
export function extractSilaImageFromItem(item) {
  return resolveSilaImageUrl(pickFirst(item, SILA_IMAGE_FIELD_KEYS, ''));
}

function collectSilaFeedRows(data) {
  /** @type {object[]} */
  const rows = [];
  const visit = (node) => {
    if (node == null) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== 'object') return;
    rows.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) visit(value);
    }
  };
  visit(data?.data ?? data);
  return rows;
}

/**
 * Build model_id / barcode → image lookup from brandfeed payload.
 * @param {object[]|object} feedPayload
 */
export function buildSilaImageLookup(feedPayload) {
  const byModel = new Map();
  const byBarcode = new Map();
  /** Категория, описание и етикет на модела — product list на Sila ги няма, brandfeed ги има. */
  const metaByModel = new Map();
  for (const item of collectSilaFeedRows(feedPayload)) {
    const modelId = String(pickFirst(item, ['model_id', 'product_model_id', 'id'], '')).trim();
    const category = String(pickFirst(item, ['category', 'category_name'], '')).trim();
    const description = String(pickFirst(item, ['description', 'desc'], '')).trim();
    const label = resolveSilaImageUrl(pickFirst(item, ['label', 'label_url'], ''));
    if (modelId && item.model_id != null && (category || description || label)) {
      metaByModel.set(modelId, { category, description, label });
    }
    const image = extractSilaImageFromItem(item);
    if (!image) continue;
    const barcode = String(pickFirst(item, ['barcode_ean', 'ean', 'barcode'], '')).trim();
    if (modelId) byModel.set(modelId, image);
    if (barcode) byBarcode.set(barcode, image);
  }
  return { byModel, byBarcode, metaByModel };
}

/**
 * @param {object} item
 * @param {{ byModel: Map<string, string>, byBarcode: Map<string, string>, metaByModel?: Map<string, { category: string, description: string, label: string }> }} lookup
 */
export function enrichSilaProductRow(item, lookup) {
  if (!item || typeof item !== 'object') return item;

  const modelId = String(pickFirst(item, ['model_id', 'product_model_id', 'id'], '')).trim();
  const barcode = String(pickFirst(item, ['barcode_ean', 'ean', 'barcode'], '')).trim();
  const out = { ...item };
  if (!extractSilaImageFromItem(item)) {
    const image = (modelId && lookup.byModel?.get(modelId))
      || (barcode && lookup.byBarcode?.get(barcode))
      || '';
    if (image) out.image = image;
  }
  const meta = modelId ? lookup.metaByModel?.get(modelId) : null;
  if (meta) {
    if (!out.category && meta.category) out.category = meta.category;
    if (!out.description && meta.description) out.description = meta.description;
    if (!out.label && meta.label) out.label = meta.label;
  }
  return out;
}

async function mapPool(items, limit, fn) {
  if (!items.length) return [];
  const results = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }));
  return results;
}

function extractSilaProductList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.data?.products)) return data.data.products;
  return [];
}

/** Product list – docs: GET /product; PHP client: POST with brand/model filters. */
async function fetchSilaProductListRaw(apiToken) {
  try {
    const getData = await silaRequest(apiToken, 'product', { method: 'GET' });
    const getItems = extractSilaProductList(getData);
    if (getItems.length) return getItems;
  } catch {
    // Fall through to POST list used by the official PHP consumer.
  }

  const postData = await silaRequest(apiToken, 'product', {
    method: 'POST',
    body: { brand_id: 0, model_id: 0, taste_id: 0, size_id: 0 },
  });
  return extractSilaProductList(postData);
}

/**
 * Brand feed – POST with brand_id (official PHP client); images + model metadata.
 * @param {string} apiToken
 * @param {string|number} brandId
 */
export async function fetchSilaBrandFeed(apiToken, brandId) {
  return silaRequest(apiToken, 'brandfeed', {
    method: 'POST',
    body: { brand_id: String(brandId) },
  });
}

/** Product detail by EAN – docs: GET /product/{barcode}. */
export async function fetchSilaProductByBarcode(apiToken, barcode) {
  const ean = String(barcode || '').trim();
  if (!ean) throw new SilaError('Липсва баркод за Sila product detail.', 400);
  return silaRequest(apiToken, `product/${encodeURIComponent(ean)}`, { method: 'GET' });
}

async function loadSilaImageLookup(apiToken, rawItems) {
  const lookup = { byModel: new Map(), byBarcode: new Map(), metaByModel: new Map() };
  // brandfeed дава и категория/описание/етикет — зареждаме го винаги, не само за липсващи снимки.
  if (!rawItems.length) return lookup;

  const brandIds = new Set();
  for (const item of rawItems) {
    const brandId = String(pickFirst(item, ['brand_id'], '')).trim();
    if (brandId && brandId !== '0') brandIds.add(brandId);
  }

  if (!brandIds.size) {
    const brands = await fetchSilaBrands(apiToken);
    for (const brand of brands) {
      const brandId = String(pickFirst(brand, ['brand_id', 'id'], '')).trim();
      if (brandId && brandId !== '0') brandIds.add(brandId);
    }
  }

  const feeds = await mapPool([...brandIds], SILA_BRANDFEED_CONCURRENCY, async (brandId) => {
    try {
      return await fetchSilaBrandFeed(apiToken, brandId);
    } catch (e) {
      console.warn(`Sila brandfeed ${brandId}: ${e?.message || e}`);
      return null;
    }
  });

  for (const feed of feeds) {
    if (!feed) continue;
    const partial = buildSilaImageLookup(feed);
    for (const [key, value] of partial.byModel) lookup.byModel.set(key, value);
    for (const [key, value] of partial.byBarcode) lookup.byBarcode.set(key, value);
    for (const [key, value] of partial.metaByModel) lookup.metaByModel.set(key, value);
  }

  return lookup;
}

function parsePrice(value) {
  if (value == null || value === '') return 0;
  const n = parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function isSilaProductAvailable(item) {
  const qty = pickFirst(item, ['qty', 'quantity', 'stock', 'available_qty'], null);
  if (qty != null && qty !== '') {
    const n = parseInt(String(qty), 10);
    if (!Number.isNaN(n)) return n > 0;
  }
  const flag = pickFirst(item, ['available', 'in_stock', 'is_available'], null);
  if (flag === true || flag === 1 || flag === '1') return true;
  if (flag === false || flag === 0 || flag === '0') return false;
  const status = String(pickFirst(item, ['status', 'availability'], '')).toLowerCase();
  if (status.includes('неналич') || status === 'out_of_stock' || status === 'unavailable') return false;
  if (status.includes('налич') || status === 'available' || status === 'in_stock') return true;
  return true;
}

/** Raw Sila API row availability (before normalization). */
export function isSilaRawProductAvailable(item) {
  return isSilaProductAvailable(item);
}

/**
 * Normalize one Sila product row to Fitness1-compatible raw SKU for groupRawProducts().
 * @param {object} item
 * @returns {object|null}
 */
export function normalizeSilaProduct(item) {
  if (!item || typeof item !== 'object') return null;

  const modelId = String(pickFirst(item, ['model_id', 'product_model_id', 'id'], '')).trim();
  const tasteId = String(pickFirst(item, ['taste_id', 'flavor_id'], '0')).trim() || '0';
  const sizeId = String(pickFirst(item, ['size_id', 'pack_id'], '0')).trim() || '0';
  if (!modelId) return null;

  const brandId = String(pickFirst(item, ['brand_id'], '0')).trim() || '0';
  const barcode = String(pickFirst(item, ['barcode_ean', 'ean', 'barcode'], '')).trim();
  const skuId = barcode || silaSkuId(modelId, tasteId, sizeId);

  // Sila подава доставната цена като partner_price (без него b2b = 0 и нито един продукт няма марж).
  const b2b = parsePrice(pickFirst(item, ['partner_price', 'price', 'b2b_price', 'dealer_price', 'wholesale_price'], ''));
  const regular = parsePrice(pickFirst(item, ['price_retail', 'regular_price', 'retail_price', 'rrp'], '')) || b2b;
  const sale = parsePrice(pickFirst(item, ['price_promo', 'sale_price', 'promo_price'], ''));

  const rawName = pickFirst(item, ['product_name', 'model_name', 'name', 'title'], 'Без име');
  const brandName = displayBrandName(pickFirst(item, ['brand_name', 'brand'], ''));
  const tasteName = pickFirst(item, ['taste_name', 'taste', 'flavor_name', 'flavor'], '');
  const split = splitSilaPackFromName(rawName);
  const productName = split.name;
  const sizeName = pickFirst(item, ['size_name', 'size', 'pack', 'packaging'], '') || split.pack;
  const rawCategory = pickFirst(item, ['category', 'category_name', 'group'], '');
  const category = resolveSilaCategory(rawCategory, productName);

  return {
    id: skuId,
    group_id: silaGroupId(modelId),
    product_id: modelId,
    product_name: productName,
    brand_id: silaBrandId(brandId),
    brand_name: brandName,
    pack: sizeName,
    option: tasteName,
    category,
    image: extractSilaImageFromItem(item),
    label: resolveSilaImageUrl(pickFirst(item, ['label', 'label_url'], '')),
    barcode,
    b2b_price: b2b > 0 ? b2b.toFixed(2) : '0.00',
    regular_price: regular > 0 ? regular.toFixed(2) : (b2b > 0 ? b2b.toFixed(2) : '0.00'),
    sale_price: sale > 0 ? sale.toFixed(2) : '0.00',
    available: isSilaProductAvailable(item),
    description: pickFirst(item, ['description', 'desc'], ''),
    distributor: DISTRIBUTOR_SILA,
    distributor_ids: {
      model_id: modelId,
      taste_id: tasteId,
      size_id: sizeId,
    },
  };
}

/**
 * @param {object[]} items - raw Sila API product rows
 * @returns {object[]}
 */
export function normalizeSilaProducts(items) {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeSilaProduct).filter(Boolean);
}

export const SILA_SHOP_PROMO_URL = 'https://www.silabg.com/bg/list/order/6/showall/1';

const decodeEntities = (t) => String(t || '').replace(/&nbsp;/g, ' ').replace(/&euro;/g, '€').replace(/&amp;/g, '&');

/**
 * Промоциите в магазина на Sila (silabg.com) — B2B API-то ги няма. Една страница със всички промо модели:
 * model_id → { regular, price, percent }. Без тези данни продаваме на ~3% под RRP продукти, които
 * клиентът намира с 20–50% по-евтино при самата Sila.
 * @param {string} html
 * @returns {Map<string, { regular: number, price: number, percent: number }>}
 */
export function parseSilaShopPromotions(html) {
  const out = new Map();
  const text = String(html || '');
  const re = /name="model_id"[^>]*value="(\d+)"/g;
  let m;
  while ((m = re.exec(text))) {
    const block = text.slice(m.index, m.index + 2500);
    const end = block.indexOf('name="model_id"', 20);
    const scope = end > 0 ? block.slice(0, end) : block;
    const old = scope.match(/class="promo_price_old"[^>]*>([^<]+)</);
    const p1 = scope.match(/class="price_1_PL">\s*(\d+)\s*</);
    const p2 = scope.match(/class="price_2_PL">\s*(\d+)\s*</);
    const pct = scope.match(/>\s*(\d+(?:\.\d+)?)%\s*</);
    if (!old || !p1) continue;
    const regular = parseFloat(decodeEntities(old[1]).replace(/[^\d.,]/g, '').replace(',', '.'));
    const price = parseFloat(`${p1[1]}.${p2 ? p2[1] : '00'}`);
    if (!(regular > 0 && price > 0 && price < regular)) continue;
    const prev = out.get(m[1]);
    // Няколко блока за един модел (размери) — пазим най-ниската цена: тя е реалната конкуренция.
    if (!prev || price < prev.price) {
      out.set(m[1], { regular, price, percent: pct ? Number(pct[1]) : Math.round((1 - price / regular) * 1000) / 10 });
    }
  }
  return out;
}

/** @returns {Promise<Map<string, { regular: number, price: number, percent: number }>>} празна при грешка */
export async function fetchSilaShopPromotions(fetchImpl = fetch) {
  try {
    const res = await fetchImpl(SILA_SHOP_PROMO_URL, { headers: { Accept: 'text/html' } });
    if (!res.ok) return new Map();
    return parseSilaShopPromotions(await res.text());
  } catch {
    return new Map();
  }
}

/** Fetch in-stock Sila products (product list + brandfeed images for gaps). */
/** Промо цената в магазина на Sila влиза като sale_price — същият механизъм като промоциите на Fitness1. */
export function applySilaShopPromotion(item, promotions) {
  const promo = promotions?.get(String(item?.model_id ?? ''));
  if (!promo) return item;
  const regular = parsePrice(item.regular_price);
  if (regular > 0 && promo.price >= regular) return item;
  return { ...item, price_promo: promo.price.toFixed(2) };
}

export async function fetchSilaProducts(apiToken, { promotions = null } = {}) {
  const [rawItems, shopPromotions] = await Promise.all([
    fetchSilaProductListRaw(apiToken),
    promotions ? Promise.resolve(promotions) : fetchSilaShopPromotions(),
  ]);
  if (!rawItems.length) return [];

  const availableItems = rawItems.filter(isSilaProductAvailable);
  if (!availableItems.length) return [];

  const imageLookup = await loadSilaImageLookup(apiToken, availableItems);
  const enriched = availableItems.map((item) => applySilaShopPromotion(enrichSilaProductRow(item, imageLookup), shopPromotions));
  return normalizeSilaProducts(enriched).filter((p) => p.available);
}

/** Fetch brand list (optional, for diagnostics). */
export async function fetchSilaBrands(apiToken) {
  const data = await silaRequest(apiToken, 'brand');
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

function productsToSilaOrderData(products) {
  return products.map((p) => {
    const ids = p.distributor_ids || {};
    if (ids.model_id && ids.taste_id) {
      const line = {
        model_id: String(ids.model_id),
        taste_id: String(ids.taste_id),
        qtty: Number(p.quantity) || 1,
      };
      // Без size_id при модел с няколко разфасовки Sila може да изпрати грешната.
      if (ids.size_id && String(ids.size_id) !== '0') line.size_id = String(ids.size_id);
      return line;
    }
    if (p.barcode) {
      return { ean: String(p.barcode), qtty: Number(p.quantity) || 1 };
    }
    throw new SilaError(`Липсват Sila идентификатори за „${p.name || p.sku_id}".`, 400);
  });
}

/** GET order/delivery/types — начините на доставка и адресите/офисите в акаунта. */
export async function fetchSilaDeliveryTypes(apiToken) {
  const data = await silaRequest(apiToken, 'order/delivery/types', { method: 'GET' });
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * Доставка за B2B поръчката. Изрична настройка има предимство; иначе „до адрес“ с първия реален
 * адрес от акаунта (опциите „До офис“ на този тип са служебни). Без адрес → грешка, не празна поръчка.
 * @param {object[]} types - отговорът на order/delivery/types
 * @param {{ delivery_type?: number|string, address_id?: string, office?: string }} [config]
 */
export function resolveSilaDelivery(types, config = {}) {
  if (config?.delivery_type) {
    const type = Number(config.delivery_type);
    if (type === 2 && !config.office) throw new SilaError('Sila: за доставка до офис е нужен офис (sila_delivery.office).', 400);
    if (type === 1 && !config.address_id) throw new SilaError('Sila: за доставка до адрес е нужен address_id (sila_delivery.address_id).', 400);
    return { delivery_type: type, address_id: config.address_id ?? null, office: config.office ?? null };
  }
  const toAddress = (types || []).find((t) => Number(t.delivery_type) === 1);
  const options = Array.isArray(toAddress?.options) ? toAddress.options : [];
  const real = options.find((o) => o?.id && o.address && !/^до офис$/i.test(String(o.address).trim()));
  if (!real) throw new SilaError('Sila: в акаунта няма адрес за доставка — задайте sila_delivery в настройките.', 400);
  return { delivery_type: 1, address_id: String(real.id), office: null };
}

/**
 * Submit order to Sila Distro API.
 * @param {string} apiToken
 * @param {object[]} products - normalized order lines with distributor_ids or barcode
 * @param {object} [options]
 */
export async function submitSilaOrder(apiToken, products, options = {}) {
  const payload = {
    delivery_type: options.delivery_type ?? null,
    office: options.office ?? null,
    address_id: options.address_id ?? null,
    invoice: options.invoice ?? null,
    data: productsToSilaOrderData(products),
  };

  const data = await silaRequest(apiToken, 'order', { method: 'POST', body: payload });
  return data;
}

/** Еднакъв баркод при двата доставчика: Sila, ако Fitness1 е изчерпан или Sila е по-евтин на едро. */
export function shouldSourceFromSila(f1Row, silaRow) {
  if (silaRow?.available !== true) return false;
  if (f1Row?.available !== true) return true;
  const silaB2b = parsePrice(silaRow.b2b_price);
  const f1B2b = parsePrice(f1Row.b2b_price);
  return silaB2b > 0 && f1B2b > 0 && silaB2b < f1B2b - 0.005;
}

/**
 * Merge catalogs: Fitness1 first, then Sila-only rows (deduped by barcode, brands unified by name).
 * При общ баркод редът остава във Fitness1 групата (SKU, категория, описание не се сменят),
 * но се снабдява от Sila, когато е по-изгодно или единствено налично (shouldSourceFromSila).
 */
export function mergeCatalogProducts(fitness1Products = [], silaProducts = []) {
  const f1 = (fitness1Products || []).map((p) => ({ ...p, distributor: DISTRIBUTOR_FITNESS1 }));

  const seenBarcodes = new Set();
  const f1ByBarcode = new Map();
  const brandByName = new Map();
  const brandDisplayByKey = new Map();
  for (const p of f1) {
    const bc = String(p.barcode || '').trim();
    if (bc) {
      seenBarcodes.add(bc);
      if (!f1ByBarcode.has(bc)) f1ByBarcode.set(bc, p);
    }
    const bk = normalizeBrandKey(p.brand_name);
    if (bk && p.brand_id) brandByName.set(bk, String(p.brand_id));
    if (bk && p.brand_name && !brandDisplayByKey.has(bk)) brandDisplayByKey.set(bk, p.brand_name);
  }

  const merged = [...f1];
  for (const raw of silaProducts || []) {
    const bc = String(raw.barcode || '').trim();
    const f1Row = bc ? f1ByBarcode.get(bc) : null;
    if (f1Row) {
      if (shouldSourceFromSila(f1Row, raw)) {
        Object.assign(f1Row, {
          distributor: DISTRIBUTOR_SILA,
          distributor_ids: raw.distributor_ids || null,
          b2b_price: raw.b2b_price,
          available: true,
        });
      }
      f1ByBarcode.delete(bc);
      continue;
    }
    if (bc && seenBarcodes.has(bc)) continue;

    const item = { ...raw, distributor: raw.distributor || DISTRIBUTOR_SILA };
    const bk = normalizeBrandKey(item.brand_name);
    if (bk && brandByName.has(bk)) {
      item.brand_id = brandByName.get(bk);
      // Клиентът вижда една марка с едно изписване, независимо от доставчика.
      if (brandDisplayByKey.has(bk)) item.brand_name = brandDisplayByKey.get(bk);
    }
    if (!item.category || /^sila\b/i.test(item.category) || item.category === 'Други') {
      item.category = classifySilaProductByName(item.product_name) || 'Други';
    } else if (!FITNESS1_CATALOG_CATEGORIES.includes(String(item.category).split(' > ')[0])) {
      item.category = resolveSilaCategory(item.category, item.product_name);
    }

    merged.push(item);
    if (bc) seenBarcodes.add(bc);
  }

  return merged;
}

const NAME_STOPWORDS = new Set(['with', 'and', 'for', 'the', 'от', 'за', 'със', 'с', 'и']);
const NAME_UNITS = /\b\d+([.,]\d+)?\s*(caps?|capsules?|softgels?|soft|vcaps?|tabs?|tablets?|serv\w*|g|gr|kg|ml|l|lbs?|mg|mcg|iu|pcs|packs?|sachets?|x)\b\.?/gi;
/** Форма или аудитория: различна стойност = различен продукт („C4 Shot“ ≠ „C4 Pre-Workout“, „Kids Melatonin“ ≠ „Melatonin“). */
const DISTINCT_WORDS = new Set(['shot', 'shots', 'gel', 'gels', 'bar', 'bars', 'gummies', 'gummy', 'liquid', 'powder', 'drink', 'cookie', 'cookies', 'box', 'rtd', 'chewable', 'effervescent', 'spray', 'kids', 'kid', 'junior', 'women', 'woman', 'men', 'man', 'vegan', 'night', 'pm', 'zero']);
const DOSE_RE = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|iu|ie)\b/gi;

/** Токени на името без марка, разфасовка, дозировка и пълнежни думи. */
export function productNameTokens(name, brand) {
  const b = normalizeBrandKey(brand).replace(/[^a-z0-9а-я]/g, '');
  return new Set(String(name || '').toLowerCase()
    .replace(/\[.*?\]|\(.*?\)/g, ' ')
    .replace(NAME_UNITS, ' ')
    .split(/[^a-z0-9а-я+%]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !/^\d+$/.test(t) && t !== b && !NAME_STOPWORDS.has(t)));
}

function tokenJaccard(a, b) {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / Math.max(1, a.size + b.size - inter);
}

function doseSet(name) {
  return new Set([...String(name || '').matchAll(DOSE_RE)].map((m) => `${m[1].replace(',', '.')}${m[2].toLowerCase()}`));
}

function distinctWords(tokens) {
  return [...tokens].filter((t) => DISTINCT_WORDS.has(t)).sort().join(',');
}

/**
 * Същият продукт при двата доставчика (марката се проверява отделно).
 * Fitness1 пише „Име | подзаглавие“ — основното име е частта преди „|“.
 * Различни дози, форма (шот/гел/бар/течен…) или аудитория (деца/жени/веган) → различни продукти.
 */
export function isSameProductName(a, b, { nameA = '', nameB = '', mainB = null } = {}) {
  if (!a.size || !b.size) return false;
  if (distinctWords(a) !== distinctWords(b)) return false;
  const dosesA = doseSet(nameA);
  const dosesB = doseSet(nameB);
  if (dosesA.size && dosesB.size && ![...dosesA].some((d) => dosesB.has(d))) return false;

  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const symDiff = a.size + b.size - 2 * inter;
  const j = inter / Math.max(1, a.size + b.size - inter);
  if (j === 1) return true;
  if (inter >= 2 && j >= 0.6 && symDiff <= 2) return true;
  // „Burn4All Extreme“ ↔ „Burn4All Extreme | High Thermogenesis“
  if (mainB && mainB.size >= 2) {
    let covered = 0;
    for (const t of mainB) if (a.has(t)) covered += 1;
    if (covered === mainB.size && a.size - covered <= 1) return true;
  }
  return false;
}

const variantKey = (v) => `${String(v.option || '').trim().toLowerCase()}|${String(v.pack || '').trim().toLowerCase()}`;

/**
 * Един продукт = една страница, независимо от доставчика. Sila група, която е същият продукт като
 * Fitness1 група (марка + име), се влива в нея: еднакъв вариант → остава по-изгодният за нас
 * (наличен, после по-ниска доставна цена) под SKU-то на Fitness1; нов вариант → добавя се.
 * Клиентът вижда името и марката на Fitness1 групата.
 * @param {object[]} groups - резултат от groupRawProducts (с цени)
 */
export function mergeCrossDistributorGroups(groups) {
  const isSilaGroup = (g) => Number(g.group_id) >= SILA_GROUP_ID_OFFSET;
  const f1ByBrand = new Map();
  for (const g of groups) {
    if (isSilaGroup(g)) continue;
    const key = normalizeBrandKey(g.brand);
    if (!key) continue;
    if (!f1ByBrand.has(key)) f1ByBrand.set(key, []);
    const main = String(g.name || '').split('|')[0];
    f1ByBrand.get(key).push({ g, tokens: productNameTokens(g.name, g.brand), mainTokens: productNameTokens(main, g.brand) });
  }

  const absorbed = new Set();
  for (const sg of groups) {
    if (!isSilaGroup(sg)) continue;
    const candidates = f1ByBrand.get(normalizeBrandKey(sg.brand)) || [];
    if (!candidates.length) continue;
    const tokens = productNameTokens(sg.name, sg.brand);
    let best = null;
    for (const c of candidates) {
      const j = tokenJaccard(tokens, c.tokens);
      if (isSameProductName(tokens, c.tokens, { nameA: sg.name, nameB: c.g.name, mainB: c.mainTokens }) && (!best || j > best.j)) best = { j, g: c.g };
    }
    if (!best) continue;

    const target = best.g;
    const byKey = new Map(target.variants.map((v) => [variantKey(v), v]));
    for (const sv of sg.variants) {
      const existing = byKey.get(variantKey(sv));
      if (!existing) {
        target.variants.push(sv);
        byKey.set(variantKey(sv), sv);
        continue;
      }
      const silaBetter = sv.available && (!existing.available || (Number(sv.b2b_price) > 0 && Number(sv.b2b_price) < Number(existing.b2b_price)));
      if (silaBetter) {
        const { sku_id: keepSku } = existing;
        Object.assign(existing, sv, { sku_id: keepSku });
      }
    }
    if (!target.image && sg.image) target.image = sg.image;
    if (!target.description && sg.description) target.description = sg.description;
    absorbed.add(sg.group_id);
  }

  return absorbed.size ? groups.filter((g) => !absorbed.has(g.group_id)) : groups;
}

export function isSilaDistributor(distributor) {
  return String(distributor || '').toLowerCase() === DISTRIBUTOR_SILA;
}

export function isFitness1Distributor(distributor) {
  const d = String(distributor || DISTRIBUTOR_FITNESS1).toLowerCase();
  return d === DISTRIBUTOR_FITNESS1 || d === 'f1';
}
