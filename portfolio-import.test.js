import { jest } from '@jest/globals';
import {
  stripHtml,
  htmlToStructuredContent,
  portfolioGroupToSiteProduct,
  applyProductOverrides,
  mergeProductsIntoContent,
  collectImportedGroupIds,
  refreshImportedProductsInContent,
  buildAiSelectionMessages,
  normalizeAiSelection,
  parseAiSelectResponse,
  handlePortfolioImportRoute,
  refreshImportedProjects,
  IMPORT_PROJECTS
} from './portfolio-import.js';

const sampleGroup = {
  group_id: '100',
  name: 'Test Protein',
  brand: 'TestBrand',
  brand_id: '749',
  category: 'Протеини > Whey',
  image: 'http://example.com/img.jpg',
  label: 'http://example.com/label.jpg',
  description: '<p>Качествен &amp; чист протеин.</p><br><div>За мускулна маса.</div>',
  variants: [
    {
      sku_id: '1', barcode: '123', pack: '1 кг', option: 'Шоколад',
      b2b_price: 10, retail_price: 15.9, available: true, image: 'http://example.com/v1.jpg'
    },
    {
      sku_id: '2', barcode: '456', pack: '2 кг', option: 'Ванилия',
      b2b_price: 18, retail_price: 27.8, available: false, image: ''
    }
  ]
};

describe('stripHtml', () => {
  test('премахва тагове и декодира entities', () => {
    expect(stripHtml('<p>Качествен &amp; чист.</p>')).toBe('Качествен & чист.');
  });

  test('запазва нови редове от блокови тагове', () => {
    expect(stripHtml('<p>Първи</p><br>Втори')).toContain('\n');
  });

  test('празен вход', () => {
    expect(stripHtml('')).toBe('');
    expect(stripHtml(null)).toBe('');
  });
});

describe('htmlToStructuredContent', () => {
  test('първи параграф → кратко описание, останалите → about_content', () => {
    const html = '<p>Кратко интро за продукта.</p><p>Втори параграф с детайли.</p><p>Трети параграф.</p>';
    const result = htmlToStructuredContent(html, 'Тест');
    expect(result.description).toBe('Кратко интро за продукта.');
    expect(result.about.title).toBe('За Тест');
    expect(result.about.description).toBe('Втори параграф с детайли.\n\nТрети параграф.');
  });

  test('bullet списъци → ползи с title/text', () => {
    const html = '<p>Интро.</p><ul><li>Енергия: повишава издръжливостта</li><li>Кратка полза</li></ul>';
    const result = htmlToStructuredContent(html, 'X');
    expect(result.about.benefits).toEqual([
      { title: 'Енергия', text: 'повишава издръжливостта' },
      { title: 'Кратка полза', text: '' }
    ]);
  });

  test('заглавие от HTML става заглавие на секцията', () => {
    const html = '<h2>Защо този продукт?</h2><p>Интро.</p><p>Детайли.</p>';
    const result = htmlToStructuredContent(html, 'X');
    expect(result.about.title).toBe('Защо този продукт?');
  });

  test('дълъг първи параграф се срязва на граница на изречение', () => {
    const first = `${'Изречение едно е тук. '.repeat(40)}`;
    const html = `<p>${first}</p>`;
    const result = htmlToStructuredContent(html, 'X');
    expect(result.description.length).toBeLessThanOrEqual(481);
    expect(result.description.endsWith('.')).toBe(true);
    expect(result.about.description.length).toBeGreaterThan(0);
  });

  test('само един параграф → без about', () => {
    const result = htmlToStructuredContent('<p>Само това.</p>', 'X');
    expect(result.description).toBe('Само това.');
    expect(result.about).toBeNull();
  });

  test('празен вход', () => {
    expect(htmlToStructuredContent('', 'X')).toEqual({ description: '', about: null });
  });
});

describe('portfolioGroupToSiteProduct', () => {
  test('конвертира група към хомогенната схема', () => {
    const p = portfolioGroupToSiteProduct(sampleGroup);

    expect(p.product_id).toBe('prod-pf-100');
    expect(p.public_data.name).toBe('Test Protein');
    expect(p.public_data.brand).toBe('TestBrand');
    expect(p.public_data.image_url).toBe('http://example.com/img.jpg');
    expect(p.public_data.label_url).toBe('http://example.com/label.jpg');
    expect(p.public_data.additional_images).toBe('http://example.com/label.jpg');
    expect(p.public_data.description).toContain('Качествен & чист протеин.');
    expect(p.public_data.packaging.capsules_or_grams).toBe('1 кг / 2 кг');
    expect(p.system_data.manufacturer).toBe('TestBrand');
    expect(p.system_data.source).toBe('portfolio');
    expect(p.system_data.portfolio.group_id).toBe('100');
    expect(p.system_data.portfolio.category).toBe('Протеини > Whey');
  });

  test('цената е минималната от наличните варианти', () => {
    const p = portfolioGroupToSiteProduct(sampleGroup);
    expect(p.public_data.price).toBe(15.9);
  });

  test('вариантите са в схемата на редактора (option_name, sku, ean, available)', () => {
    const p = portfolioGroupToSiteProduct(sampleGroup);
    expect(p.public_data.variants).toHaveLength(2);
    expect(p.public_data.variants[0]).toEqual({
      option_name: '1 кг • Шоколад',
      sku: '1',
      price: 15.9,
      ean: '123',
      image_url: 'http://example.com/v1.jpg',
      available: true
    });
    expect(p.public_data.variants[1].available).toBe(false);
  });

  test('без налични варианти → inventory 0 и цена от всички варианти', () => {
    const group = {
      ...sampleGroup,
      variants: sampleGroup.variants.map(v => ({ ...v, available: false }))
    };
    const p = portfolioGroupToSiteProduct(group);
    expect(p.system_data.inventory).toBe(0);
    expect(p.public_data.price).toBe(15.9);
  });

  test('с налични варианти → inventory > 0', () => {
    const p = portfolioGroupToSiteProduct(sampleGroup);
    expect(p.system_data.inventory).toBeGreaterThan(0);
  });
});

describe('applyProductOverrides', () => {
  test('прилага tagline, goals и effects', () => {
    const p = portfolioGroupToSiteProduct(sampleGroup);
    applyProductOverrides(p, {
      tagline: 'Мощен протеин',
      goals: ['мускулна маса', ' възстановяване '],
      effects: [{ label: 'Сила', value: 120 }, { label: '', value: 50 }]
    });
    expect(p.public_data.tagline).toBe('Мощен протеин');
    expect(p.system_data.goals).toEqual(['мускулна маса', 'възстановяване']);
    expect(p.public_data.effects).toEqual([{ label: 'Сила', value: 100 }]);
  });

  test('без override не променя нищо', () => {
    const p = portfolioGroupToSiteProduct(sampleGroup);
    const before = JSON.stringify(p);
    applyProductOverrides(p, undefined);
    expect(JSON.stringify(p)).toBe(before);
  });
});

function makeContent() {
  return {
    settings: {},
    page_content: [
      { type: 'hero_banner', title: 'Hero' },
      {
        id: 'weight-loss-products',
        type: 'product_category',
        title: 'ТОП продукти',
        products: [
          {
            product_id: 'prod-manual',
            display_order: 0,
            public_data: { name: 'Ръчен продукт', price: 20, tagline: 'Ръчен слоган', variants: [] },
            system_data: { inventory: 5, goals: ['отслабване'] }
          }
        ]
      }
    ]
  };
}

describe('mergeProductsIntoContent', () => {
  test('добавя нови продукти в съществуваща категория', () => {
    const content = makeContent();
    const product = portfolioGroupToSiteProduct(sampleGroup);
    const result = mergeProductsIntoContent(content, {
      categoryId: 'weight-loss-products',
      products: [product]
    });

    expect(result.added).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.createdCategory).toBe(false);
    const cat = content.page_content[1];
    expect(cat.products).toHaveLength(2);
    expect(cat.products[1].product_id).toBe('prod-pf-100');
    expect(cat.products[1].display_order).toBe(1);
  });

  test('създава нова категория при category_title', () => {
    const content = makeContent();
    const result = mergeProductsIntoContent(content, {
      categoryTitle: 'Нова категория',
      products: [portfolioGroupToSiteProduct(sampleGroup)]
    });

    expect(result.createdCategory).toBe(true);
    expect(result.added).toBe(1);
    const created = content.page_content[2];
    expect(created.type).toBe('product_category');
    expect(created.title).toBe('Нова категория');
    expect(created.products).toHaveLength(1);
  });

  test('хвърля грешка без категория и без заглавие', () => {
    expect(() => mergeProductsIntoContent(makeContent(), {
      categoryId: 'missing',
      products: []
    })).toThrow(/не е намерена/);
  });

  test('повторен импорт обновява търговските полета, но пази ръчните текстове', () => {
    const content = makeContent();
    const first = portfolioGroupToSiteProduct(sampleGroup);
    mergeProductsIntoContent(content, { categoryId: 'weight-loss-products', products: [first] });

    // Админът редактира текстовете ръчно
    const imported = content.page_content[1].products[1];
    imported.public_data.tagline = 'Ръчно редактиран слоган';
    imported.public_data.description = 'Ръчно описание';

    // Нова версия от каталога с друга цена
    const updatedGroup = {
      ...sampleGroup,
      variants: [{ ...sampleGroup.variants[0], retail_price: 19.9 }]
    };
    const result = mergeProductsIntoContent(content, {
      categoryId: 'weight-loss-products',
      products: [portfolioGroupToSiteProduct(updatedGroup)]
    });

    expect(result.added).toBe(0);
    expect(result.updated).toBe(1);
    expect(content.page_content[1].products).toHaveLength(2);
    expect(imported.public_data.price).toBe(19.9);
    expect(imported.public_data.tagline).toBe('Ръчно редактиран слоган');
    expect(imported.public_data.description).toBe('Ръчно описание');
    expect(imported.system_data.portfolio.refreshed_at).toBeTruthy();
  });

  test('не дублира продукт, импортиран в друга категория', () => {
    const content = makeContent();
    mergeProductsIntoContent(content, { categoryId: 'weight-loss-products', products: [portfolioGroupToSiteProduct(sampleGroup)] });
    const result = mergeProductsIntoContent(content, {
      categoryTitle: 'Втора категория',
      products: [portfolioGroupToSiteProduct(sampleGroup)]
    });

    expect(result.added).toBe(0);
    expect(result.updated).toBe(1);
    expect(content.page_content[2].products).toHaveLength(0);
  });

  test('осигурява уникален product_id при съвпадение с ръчен продукт', () => {
    const content = makeContent();
    const product = portfolioGroupToSiteProduct(sampleGroup);
    product.product_id = 'prod-manual'; // конфликт с ръчния продукт
    product.system_data.portfolio.group_id = '999';

    mergeProductsIntoContent(content, { categoryId: 'weight-loss-products', products: [product] });
    const ids = content.page_content[1].products.map(p => p.product_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('prod-manual-copy');
  });
});

describe('collectImportedGroupIds / refreshImportedProductsInContent', () => {
  test('събира group_id-тата само на импортираните продукти', () => {
    const content = makeContent();
    mergeProductsIntoContent(content, { categoryId: 'weight-loss-products', products: [portfolioGroupToSiteProduct(sampleGroup)] });
    expect(collectImportedGroupIds(content)).toEqual(['100']);
  });

  test('опреснява цените и маркира липсващите като неналични', () => {
    const content = makeContent();
    const g2 = { ...sampleGroup, group_id: '200', name: 'Second' };
    mergeProductsIntoContent(content, {
      categoryId: 'weight-loss-products',
      products: [portfolioGroupToSiteProduct(sampleGroup), portfolioGroupToSiteProduct(g2)]
    });

    const updatedGroup = {
      ...sampleGroup,
      variants: [{ ...sampleGroup.variants[0], retail_price: 25.8 }]
    };
    const stats = refreshImportedProductsInContent(content, new Map([['100', updatedGroup]]));

    expect(stats.updated).toBe(1);
    expect(stats.missing).toBe(1);

    const products = content.page_content[1].products;
    const refreshed = products.find(p => p.system_data?.portfolio?.group_id === '100');
    const missing = products.find(p => p.system_data?.portfolio?.group_id === '200');
    expect(refreshed.public_data.price).toBe(25.8);
    expect(missing.system_data.inventory).toBe(0);
    expect(missing.public_data.variants.every(v => v.available === false)).toBe(true);
    // Ръчният продукт не се пипа
    const manual = products.find(p => p.product_id === 'prod-manual');
    expect(manual.system_data.inventory).toBe(5);
  });
});

describe('buildAiSelectionMessages', () => {
  const index = [
    { group_id: '100', name: 'Fat Burner X', brand: 'B1', category: 'Фет бърнъри', min_price: 19.9, available: true },
    { group_id: '200', name: 'Collagen Pro', brand: 'B2', category: 'Колаген', min_price: 29.9, available: true },
    { group_id: '300', name: 'Unavailable', brand: 'B3', category: 'Друго', min_price: 9.9, available: false }
  ];

  test('system съобщението включва каталога и лимита', () => {
    const messages = buildAiSelectionMessages({ project: 'life', index, limit: 5, prompt: 'тест', catalogTotal: 2 });
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('антиейджинг');
    expect(messages[0].content).toContain('До 5');
    expect(messages[0].content).toContain('100;Fat Burner X');
    expect(messages[0].content).not.toContain('300;Unavailable');
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'тест' });
  });

  test('включва история на диалога', () => {
    const messages = buildAiSelectionMessages({
      project: 'main',
      prompt: 'още с цинк',
      index,
      history: [{ role: 'user', content: 'продукти с цинк' }, { role: 'assistant', content: 'Ето няколко.' }]
    });
    expect(messages).toHaveLength(4);
    expect(messages[2].content).toBe('Ето няколко.');
  });

  test('невалиден проект хвърля грешка', () => {
    expect(() => buildAiSelectionMessages({ project: 'bogus', index })).toThrow(/Невалиден проект/);
  });
});

describe('parseAiSelectResponse', () => {
  test('извлича reply и selected', () => {
    const { reply, selected } = parseAiSelectResponse({
      reply: 'Ето подбор.',
      selected: [{ group_id: '100', reason: 'добър', goals: [], tagline: '' }]
    }, new Set(['100']));
    expect(reply).toBe('Ето подбор.');
    expect(selected).toHaveLength(1);
  });
});

describe('normalizeAiSelection', () => {
  const validIds = new Set(['100', '200']);

  test('приема {selected: [...]} и филтрира невалидни/дублирани', () => {
    const result = normalizeAiSelection({
      selected: [
        { group_id: '100', reason: 'добър', goals: ['отслабване'], tagline: 'Слоган' },
        { group_id: '100', reason: 'дубликат' },
        { group_id: '999', reason: 'невалиден' },
        { group_id: 200, goals: 'не-масив' }
      ]
    }, validIds);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ group_id: '100', reason: 'добър', goals: ['отслабване'], tagline: 'Слоган' });
    expect(result[1].group_id).toBe('200');
    expect(result[1].goals).toEqual([]);
  });

  test('приема и директен масив', () => {
    expect(normalizeAiSelection([{ group_id: '200' }], validIds)).toHaveLength(1);
  });

  test('невалиден вход връща празен масив', () => {
    expect(normalizeAiSelection(null, validIds)).toEqual([]);
    expect(normalizeAiSelection({ foo: 1 }, validIds)).toEqual([]);
  });
});

describe('handlePortfolioImportRoute', () => {
  const env = {};
  const groupsMap = new Map([['100', sampleGroup]]);

  function makeDeps(overrides = {}) {
    return {
      callAI: jest.fn(async () => ({
        reply: 'Подбрах протеин за отслабване.',
        selected: [{ group_id: '100', reason: 'подходящ', goals: ['отслабване'], tagline: 'Топ' }]
      })),
      loadProjectContent: jest.fn(async () => makeContent()),
      saveProjectContent: jest.fn(async () => {}),
      getCatalogMeta: jest.fn(async () => ({
        index: [{ group_id: '100', name: 'Test Protein', brand: 'TestBrand', category: 'Протеини > Whey', category_top: 'Протеини', min_price: 15.9, available: true }],
        brands: [], categories: []
      })),
      loadGroupsByIds: jest.fn(async (e, ids) => {
        const m = new Map();
        ids.forEach(id => { if (groupsMap.has(String(id))) m.set(String(id), groupsMap.get(String(id))); });
        return m;
      }),
      ...overrides
    };
  }

  function req(method, path, body) {
    const url = new URL(`https://x.dev${path}`);
    return {
      request: { method, json: async () => body },
      url
    };
  }

  test('GET preview връща конвертирани продукти и not_found', async () => {
    const { request, url } = req('GET', '/portfolio/import/preview?ids=100,999');
    const res = await handlePortfolioImportRoute(request, env, url, makeDeps());
    expect(res.status).toBe(200);
    const data = JSON.parse(await res.text());
    expect(data.products).toHaveLength(1);
    expect(data.products[0].product_id).toBe('prod-pf-100');
    expect(data.not_found).toEqual(['999']);
  });

  test('GET preview без ids връща 400', async () => {
    const { request, url } = req('GET', '/portfolio/import/preview');
    const res = await handlePortfolioImportRoute(request, env, url, makeDeps());
    expect(res.status).toBe(400);
  });

  test('POST ai-select връща нормализиран подбор с каталожни данни', async () => {
    const deps = makeDeps();
    const { request, url } = req('POST', '/portfolio/import/ai-select', { project: 'main', limit: 5, prompt: 'фокус върху протеини' });
    const res = await handlePortfolioImportRoute(request, env, url, deps);
    expect(res.status).toBe(200);
    const data = JSON.parse(await res.text());
    expect(deps.callAI).toHaveBeenCalled();
    expect(data.reply).toMatch(/протеин/);
    expect(data.selected).toHaveLength(1);
    expect(data.selected[0].group_id).toBe('100');
    expect(data.selected[0].name).toBe('Test Protein');
    expect(data.selected[0].min_price).toBe(15.9);
  });

  test('POST ai-select без синхронизиран каталог връща 404', async () => {
    const deps = makeDeps({ getCatalogMeta: jest.fn(async () => null) });
    const { request, url } = req('POST', '/portfolio/import/ai-select', { project: 'life', prompt: 'тест' });
    const res = await handlePortfolioImportRoute(request, env, url, deps);
    expect(res.status).toBe(404);
  });

  test('POST ai-select изисква prompt', async () => {
    const { request, url } = req('POST', '/portfolio/import/ai-select', { project: 'main' });
    const res = await handlePortfolioImportRoute(request, env, url, makeDeps());
    expect(res.status).toBe(400);
  });

  test('POST ai-select връща ясна грешка при AI failure', async () => {
    const deps = makeDeps({
      callAI: jest.fn(async () => { throw Object.assign(new Error('Липсва API ключ за избрания AI доставчик.'), { name: 'UserFacingError', status: 400 }); })
    });
    const { request, url } = req('POST', '/portfolio/import/ai-select', { project: 'main', prompt: 'фокус върху колаген' });
    const res = await handlePortfolioImportRoute(request, env, url, deps);
    expect(res.status).toBe(400);
    const data = JSON.parse(await res.text());
    expect(data.error).toMatch(/API ключ/);
  });

  test('POST apply слива продуктите и записва проекта', async () => {
    const deps = makeDeps();
    const { request, url } = req('POST', '/portfolio/import/apply', {
      project: 'main',
      category_id: 'weight-loss-products',
      group_ids: ['100'],
      overrides: { 100: { tagline: 'От AI', goals: ['отслабване'] } }
    });
    const res = await handlePortfolioImportRoute(request, env, url, deps);
    expect(res.status).toBe(200);
    const data = JSON.parse(await res.text());
    expect(data.success).toBe(true);
    expect(data.added).toBe(1);

    expect(deps.saveProjectContent).toHaveBeenCalledTimes(1);
    const savedContent = JSON.parse(deps.saveProjectContent.mock.calls[0][2]);
    const saved = savedContent.page_content[1].products.find(p => p.product_id === 'prod-pf-100');
    expect(saved.public_data.tagline).toBe('От AI');
    expect(saved.system_data.goals).toEqual(['отслабване']);
  });

  test('POST apply слага goals по подразбиране за проекта', async () => {
    const deps = makeDeps();
    const { request, url } = req('POST', '/portfolio/import/apply', {
      project: 'life',
      category_title: 'Antiaging',
      group_ids: ['100']
    });
    const res = await handlePortfolioImportRoute(request, env, url, deps);
    expect(res.status).toBe(200);
    const savedContent = JSON.parse(deps.saveProjectContent.mock.calls[0][2]);
    const saved = savedContent.page_content[2].products[0];
    expect(saved.system_data.goals).toEqual(IMPORT_PROJECTS.life.defaultGoals);
  });

  test('POST apply с несъществуващи продукти връща 404', async () => {
    const deps = makeDeps();
    const { request, url } = req('POST', '/portfolio/import/apply', {
      project: 'main', category_id: 'weight-loss-products', group_ids: ['999']
    });
    const res = await handlePortfolioImportRoute(request, env, url, deps);
    expect(res.status).toBe(404);
  });

  test('POST refresh опреснява всички проекти', async () => {
    const deps = makeDeps({
      loadProjectContent: jest.fn(async () => {
        const content = makeContent();
        mergeProductsIntoContent(content, { categoryId: 'weight-loss-products', products: [portfolioGroupToSiteProduct(sampleGroup)] });
        return content;
      })
    });
    const { request, url } = req('POST', '/portfolio/import/refresh', {});
    const res = await handlePortfolioImportRoute(request, env, url, deps);
    expect(res.status).toBe(200);
    const data = JSON.parse(await res.text());
    expect(data.results.main.updated).toBe(1);
    expect(data.results.life.updated).toBe(1);
    expect(deps.saveProjectContent).toHaveBeenCalledTimes(2);
  });

  test('непознат маршрут връща 404', async () => {
    const { request, url } = req('GET', '/portfolio/import/bogus');
    const res = await handlePortfolioImportRoute(request, env, url, makeDeps());
    expect(res.status).toBe(404);
  });
});

describe('refreshImportedProjects', () => {
  test('пропуска проекти без импортирани продукти и не записва', async () => {
    const deps = {
      loadProjectContent: jest.fn(async () => makeContent()),
      saveProjectContent: jest.fn(async () => {}),
      loadGroupsByIds: jest.fn(async () => new Map())
    };
    const results = await refreshImportedProjects({}, ['main'], deps);
    expect(results.main.skipped).toBe(true);
    expect(deps.saveProjectContent).not.toHaveBeenCalled();
  });
});
