/**
 * Life Protocols — автоматично разпределяне на продукти в категории.
 * Използва се от portfolio-import.js при AI/API импорт и от клиентския рендер.
 */

export const LIFE_CATEGORY_DEFS = [
  {
    id: 'anti-aging-beauty',
    category_id: 'anti-aging-beauty',
    title: 'Антиейджинг и Красота',
    description: 'Формули за клетъчно подмладяване, теломерна подкрепа и естетично здраве.',
    icon: 'dna',
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
    keywords: [
      'дълголетие', 'longevity', 'митохондри', 'имун', 'здраве', 'енергия',
      'виталност', 'wellness', 'biohack'
    ]
  }
];

const DEFAULT_CATEGORY_ID = 'health-longevity';

function productSearchText(product) {
  const goals = product.system_data?.goals;
  const goalsStr = Array.isArray(goals) ? goals.join(' ') : String(goals || '');
  return [
    product.public_data?.name,
    product.public_data?.description,
    product.public_data?.tagline,
    goalsStr,
    product.system_data?.portfolio?.category,
    product.system_data?.protocol_hint
  ].filter(Boolean).join(' ').toLowerCase();
}

/**
 * Определя life категория за продукт по goals, име, описание и portfolio path.
 * @param {object} product
 * @returns {string} category id
 */
export function assignLifeProductCategory(product) {
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
