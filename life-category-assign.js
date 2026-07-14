/**
 * Life Protocols — автоматично разпределяне на продукти в категории.
 * Използва се от portfolio-import.js при AI/API импорт.
 */

export const LIFE_CATEGORY_DEFS = [
  {
    id: 'anti-aging-beauty',
    category_id: 'anti-aging-beauty',
    title: 'Антиейджинг и Красота',
    description: 'Формули за клетъчно подмладяване, теломерна подкрепа и естетично здраве.',
    icon: 'dna',
    goalPattern: /анти[\s-]?ейджинг|anti[\s-]?aging|красота|кожа|колаген|хормонално|теломер/i,
    keywords: [
      'anti-aging', 'антиейджинг', 'красота', 'кожа', 'теломер', 'колаген',
      'клетъчна регенерация', 'хормонално', 'flavonoid', 'апигенин', 'стареене',
      'anti-aging /', 'против стареене'
    ]
  },
  {
    id: 'brain-cognition',
    category_id: 'brain-cognition',
    title: 'Мозъчна дейност',
    description: 'Нутрацевтици за когнитивна функция, фокус, памет и невропластичност.',
    icon: 'brain',
    goalPattern: /когнитив|мозъч|памет|фокус|невро|ноотроп|brain|nootropic|cognition|ментал/i,
    keywords: [
      'когнитив', 'мозък', 'brain', 'neuro', 'фокус', 'памет', 'nootropic',
      'ноотроп', 'cognition', 'ментал'
    ]
  },
  {
    id: 'health-longevity',
    category_id: 'health-longevity',
    title: 'Здраве и дълголетие',
    description: 'Подкрепа за митохондриална енергия, имунитет и дългосрочно благосъстояние.',
    icon: 'mitochondria',
    goalPattern: /дълголетие|longevity|имун|енергия|виталност|клетъчна регенерация|здраве|митохондри|wellness/i,
    keywords: [
      'дълголетие', 'longevity', 'митохондри', 'имун', 'здраве', 'енергия',
      'виталност', 'wellness', 'biohack'
    ]
  }
];

const DEFAULT_CATEGORY_ID = 'health-longevity';

function productGoalsText(product) {
  const goals = product.system_data?.goals;
  return Array.isArray(goals) ? goals.join(' ') : String(goals || '');
}

function productSearchText(product) {
  return [
    product.public_data?.name,
    product.public_data?.description,
    product.public_data?.tagline,
    productGoalsText(product),
    product.system_data?.portfolio?.category,
    product.system_data?.protocol_hint
  ].filter(Boolean).join(' ').toLowerCase();
}

/**
 * Определя основната life категория за продукт.
 * Приоритет: 1) goals (целите от базата), 2) portfolio категория + текст.
 * @param {object} product
 * @returns {string} category id
 */
export function assignLifeProductCategory(product) {
  const goalsText = productGoalsText(product);

  // 1) Целите от базата са източник на истина
  if (goalsText) {
    let bestId = null;
    let bestScore = 0;
    for (const cat of LIFE_CATEGORY_DEFS) {
      const matches = goalsText.match(new RegExp(cat.goalPattern.source, 'gi'));
      const score = matches ? matches.length : 0;
      if (score > bestScore) {
        bestScore = score;
        bestId = cat.id;
      }
    }
    if (bestId) return bestId;
  }

  // 2) Fallback: ключови думи в име/описание/portfolio path
  const text = productSearchText(product);
  let bestId = DEFAULT_CATEGORY_ID;
  let bestScore = 0;
  for (const cat of LIFE_CATEGORY_DEFS) {
    let score = 0;
    for (const kw of cat.keywords) {
      if (text.includes(kw.toLowerCase())) score += kw.length > 8 ? 3 : 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = cat.id;
    }
  }
  return bestId;
}

/**
 * Проверява дали продукт принадлежи (по цели) към дадена категория.
 * Използва се за многокатегорийно извеждане на витрината.
 * @param {object} product
 * @param {object} categoryDef - запис от LIFE_CATEGORY_DEFS
 * @returns {boolean}
 */
export function productMatchesCategory(product, categoryDef) {
  if (!categoryDef?.goalPattern) return false;
  const goalsText = productGoalsText(product);
  if (goalsText && categoryDef.goalPattern.test(goalsText)) return true;
  // Ако продуктът няма goals — падаме на текстово съвпадение
  if (!goalsText) {
    return categoryDef.goalPattern.test(productSearchText(product));
  }
  return false;
}

/**
 * Събира всички продукти от life page_content, които по цели принадлежат
 * към дадената категория (независимо в коя категория са записани в CMS).
 * Дедупликира по product_id и пази display_order.
 * @param {Array} pageContent - масивът page_content
 * @param {object} categoryDef - запис от LIFE_CATEGORY_DEFS
 * @returns {Array} продукти
 */
export function collectProductsForCategory(pageContent, categoryDef) {
  const seen = new Set();
  const out = [];
  for (const comp of pageContent || []) {
    if (comp.type !== 'product_category' || !Array.isArray(comp.products)) continue;
    for (const p of comp.products) {
      if (!p?.product_id || seen.has(p.product_id)) continue;
      if (productMatchesCategory(p, categoryDef)) {
        seen.add(p.product_id);
        out.push(p);
      }
    }
  }
  return out;
}

/**
 * Гарантира, че трите life категории съществуват в page_content.
 * @param {object} pageContent
 */
export function ensureLifeCategories(pageContent) {
  if (!Array.isArray(pageContent.page_content)) {
    pageContent.page_content = [];
  }

  for (const def of LIFE_CATEGORY_DEFS) {
    let comp = pageContent.page_content.find(
      (c) => c.type === 'product_category' && (c.id === def.id || c.category_id === def.id)
    );
    if (!comp) {
      comp = {
        type: 'product_category',
        component_id: `life-cat-${def.id}`,
        id: def.id,
        category_id: def.category_id,
        title: def.title,
        description: def.description,
        options: { is_collapsible: false, is_expanded_by_default: true },
        products: []
      };
      pageContent.page_content.push(comp);
    } else {
      comp.id = def.id;
      comp.category_id = def.category_id;
      if (!comp.title) comp.title = def.title;
      if (!comp.description) comp.description = def.description;
      if (!Array.isArray(comp.products)) comp.products = [];
    }
  }
}

/**
 * Премахва legacy anti-aging категория и разпределя продуктите ѝ.
 * @param {object} pageContent
 */
export function migrateLegacyLifeCategories(pageContent) {
  ensureLifeCategories(pageContent);
  const legacy = pageContent.page_content.find(
    (c) => c.type === 'product_category' && (c.id === 'anti-aging' || c.category_id === 'anti-aging')
  );
  if (!legacy?.products?.length) {
    if (legacy) {
      pageContent.page_content = pageContent.page_content.filter((c) => c !== legacy);
    }
    return;
  }

  const products = [...legacy.products];
  pageContent.page_content = pageContent.page_content.filter((c) => c !== legacy);

  for (const product of products) {
    const catId = assignLifeProductCategory(product);
    const target = pageContent.page_content.find(
      (c) => c.type === 'product_category' && c.id === catId
    );
    if (target) {
      const exists = target.products.some((p) => p.product_id === product.product_id);
      if (!exists) target.products.push(product);
    }
  }
}

/**
 * Слива продукти в правилната life категория (авто или изрично category_id).
 */
export function mergeLifeProductsAuto(pageContent, products, explicitCategoryId) {
  migrateLegacyLifeCategories(pageContent);
  const buckets = new Map();
  for (const p of products) {
    const catId = explicitCategoryId || assignLifeProductCategory(p);
    if (!buckets.has(catId)) buckets.set(catId, []);
    buckets.get(catId).push(p);
  }
  return buckets;
}
