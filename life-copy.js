/**
 * Редакция на текстовете на Life Protocols (съдържанието идва от админа / KV).
 *
 * Сменят се само точно познатите стари фрази — ако текстът е редактиран в
 * админа, новият остава. Категориите без описание получават кратко описание,
 * за да са еднакви картите на началната страница.
 */

/** Стар текст → естествен текст (точно съвпадение, без интервалите в краищата). */
const COPY = {
  // hero
  'Настройване на Биологичния Часовник.': 'Настройте биологичния си часовник',
  'Открийте силата на пептидите и иновативните добавки за подмладяване на молекулярно ниво.':
    'Персонален антиейджинг протокол — добавки, подбрани според възрастта, здравето и целите ви.',
  'Клетъчно Възстановяване': 'Клетъчно възстановяване',
  'Започнете вашия протокол': 'Създай своя протокол',
  'Клиентско доверие': 'Препоръчват ни',
  'Научни формули': 'Формули с научна основа',
  'GMP Сертифицирано': 'GMP сертифицирано',
  // категории
  'Антиейджинг и Красота': 'Антиейджинг и красота',
  'МОЗЪЧНА ДЕЙНОСТ': 'ПАМЕТ И ФОКУС',
  'Мозъчна дейност': 'Памет и фокус',
  'Формули за клетъчно подмладяване, теломерна подкрепа и естетично здраве.':
    'За стегната кожа, здрава коса и свежо излъчване.',
  'Нутрацевтици за когнитивна функция, фокус, памет и невропластичност.':
    'За ясна мисъл, добра памет и концентрация.',
  'Подкрепа за митохондриална енергия, имунитет и дългосрочно благосъстояние.':
    'За енергия на клетките, имунитет и дълголетие.',
  // инфо карта
  'Персонализиран протокол за подмладяване': 'Персонален протокол за подмладяване',
  'Всеки организъм е уникален. Нашите експерти създават индивидуални протоколи за биохакинг, базирани на последните научни открития в областта на клетъчното подмладяване и дълголетието.':
    'Всеки организъм е различен. Протоколът се съставя според възрастта, здравето и целите ви — с конкретни добавки, дози и график на приема.',
  // настройки и футър
  'Протоколи за Здраве и Дълголетие': 'Протоколи за младост и дълголетие',
  'Бързи Връзки': 'Бързи връзки',
};

/** Описания за категориите, които нямат такова в админа. */
const CATEGORY_DESCRIPTIONS = {
  'anti-aging-beauty': 'За стегната кожа, здрава коса и свежо излъчване.',
  'brain-cognition': 'За ясна мисъл, добра памет и концентрация.',
  'health-longevity': 'За енергия на клетките, имунитет и дълголетие.',
  'sleep-stress': 'За спокоен сън и по-малко напрежение.',
  'energy-vitality': 'За бодрост през целия ден — без сривове.',
  'joints-mobility': 'За гъвкави стави и лекота в движението.',
};

/** Описание на категория по id (празно, ако няма). */
export function categoryDescription(id) {
  return CATEGORY_DESCRIPTIONS[id] || '';
}

/** Естествен вариант на познат стар текст; иначе — същият текст. */
export function polishText(text) {
  if (typeof text !== 'string') return text;
  const fixed = COPY[text.trim()];
  return fixed === undefined ? text : fixed;
}

// Двойки еднакво изглеждащи букви: латиница ↔ кирилица. Част от описанията на
// доставчиците смесват азбуките в една дума („шиpoĸo“, „Маgnеѕlіfе“) — това
// чупи търсенето и изглежда небрежно.
const LAT_TO_CYR = {
  a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', k: 'к', 'ĸ': 'к',
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
};
const CYR_TO_LAT = {
  'а': 'a', 'с': 'c', 'е': 'e', 'о': 'o', 'р': 'p', 'х': 'x', 'у': 'y', 'к': 'k', 'ѕ': 's', 'і': 'i', 'ј': 'j',
  'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P', 'Т': 'T', 'Х': 'X', 'У': 'Y', 'Ѕ': 'S', 'І': 'I',
};
const IS_CYR = /[\u0400-\u04FF]/;
const IS_LAT = /[A-Za-z\u0138]/;

/** Дума със смесени азбуки → изцяло в азбуката на „истинските“ ѝ букви. */
function fixWord(word) {
  if (!IS_CYR.test(word) || !IS_LAT.test(word)) return word;
  let cyr = 0;
  let lat = 0;
  for (const ch of word) {
    if (IS_CYR.test(ch) && !(ch in CYR_TO_LAT)) cyr++;
    else if (IS_LAT.test(ch) && !(ch in LAT_TO_CYR)) lat++;
  }
  if (cyr === lat) return word;
  const map = cyr > lat ? LAT_TO_CYR : CYR_TO_LAT;
  return [...word].map((ch) => map[ch] || ch).join('');
}

/** Поправя думите със смесена кирилица и латиница. */
export function fixMixedScript(text) {
  if (typeof text !== 'string' || !IS_CYR.test(text) || !IS_LAT.test(text)) return text;
  return text.replace(/[A-Za-z\u0138\u0400-\u04FF]+/g, fixWord);
}

const SKIP_KEYS = new Set(['products', 'public_data', 'system_data']);

function walk(node) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      if (typeof node[i] === 'string') node[i] = polishText(node[i]);
      else walk(node[i]);
    }
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const value = node[key];
    if (typeof value === 'string') node[key] = polishText(value);
    else walk(value);
  }
}

/**
 * Редактира съдържанието на място: познатите фрази, описанията на категориите
 * без описание, смесените азбуки в текстовете на продуктите и годината в авторските права.
 * @param {{ settings?: object, navigation?: Array, page_content?: Array, footer?: object }} data
 */
export function polishLifeContent(data) {
  if (!data || typeof data !== 'object') return data;
  walk(data.settings);
  walk(data.navigation);
  walk(data.page_content);
  walk(data.footer);
  for (const c of data.page_content || []) {
    for (const product of c?.products || []) {
      const pd = product?.public_data;
      if (!pd) continue;
      for (const key of ['name', 'tagline', 'description']) pd[key] = fixMixedScript(pd[key]);
    }
    if (c?.type === 'product_category' && !String(c.description || '').trim()) {
      const d = categoryDescription(c.id);
      if (d) c.description = d;
    }
    if (c?.type === 'hero_banner') {
      for (const f of c.features || []) {
        if (!String(f.description || '').trim()) f.description = categoryDescription(f.category_id);
      }
    }
  }
  const year = new Date().getFullYear();
  if (data.footer && typeof data.footer.copyright_text === 'string') {
    data.footer.copyright_text = data.footer.copyright_text.replace(/©\s*20\d\d/, `© ${year}`);
  }
  return data;
}
