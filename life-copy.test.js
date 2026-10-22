import { polishLifeContent, polishText, fixMixedScript, categoryDescription } from './life-copy.js';

describe('life-copy', () => {
  test('познатите неестествени фрази се заменят, редактираните в админа остават', () => {
    expect(polishText('Настройване на Биологичния Часовник.')).toBe('Настройте биологичния си часовник');
    expect(polishText('Мой нов текст')).toBe('Мой нов текст');
  });

  test('всички категории получават описание, ако нямат', () => {
    const data = {
      page_content: [
        { type: 'hero_banner', features: [{ category_id: 'sleep-stress', description: '' }] },
        { type: 'product_category', id: 'joints-mobility', description: '', products: [] },
        { type: 'product_category', id: 'energy-vitality', description: 'Свое описание', products: [] },
      ],
      footer: { copyright_text: '© 2025 Life Protocols.' },
    };
    polishLifeContent(data);
    expect(data.page_content[0].features[0].description).toBe(categoryDescription('sleep-stress'));
    expect(data.page_content[1].description).toBe(categoryDescription('joints-mobility'));
    expect(data.page_content[2].description).toBe('Свое описание');
    expect(data.footer.copyright_text).toBe(`© ${new Date().getFullYear()} Life Protocols.`);
  });

  test('думите със смесени азбуки стават в една азбука', () => {
    expect(fixMixedScript('билo шиpoĸo изпoлзвaнo')).toBe('било широко използвано');
    expect(fixMixedScript('Nutrеnd Маgnеѕlіfе Ѕtrоng')).toBe('Nutrend Magneslife Strong');
    expect(fixMixedScript('Omega-3 за сърцето')).toBe('Omega-3 за сърцето');
  });

  test('текстовете на продуктите се поправят, имената на марки — не се превеждат', () => {
    const data = { page_content: [{ type: 'product_category', id: 'x', products: [{ public_data: { name: 'Magnesium', description: 'Hoвият пpoдyĸт' } }] }] };
    polishLifeContent(data);
    expect(data.page_content[0].products[0].public_data.description).toBe('Новият продукт');
    expect(data.page_content[0].products[0].public_data.name).toBe('Magnesium');
  });
});
