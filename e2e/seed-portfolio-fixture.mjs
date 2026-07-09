/**
 * Seed minimal catalog fixture for local E2E when backend/portfolio/ is missing.
 * Usage: node e2e/seed-portfolio-fixture.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { groupRawProducts, buildCatalogMeta, DEFAULT_SETTINGS } from '../portfolio-api.js';

const OUT_DIR = 'backend/portfolio';

function buildSampleProducts() {
  const categories = [
    'Протеини > Whey',
    'Протеини > Казеин',
    'Витамини > Мултивитамини',
    'Аминокиселини > BCAA'
  ];
  const brands = [
    { id: '749', name: 'Optimum Nutrition' },
    { id: '800', name: 'BioTech USA' }
  ];
  const products = [];
  let sku = 1;

  for (let g = 1; g <= 48; g++) {
    const groupId = String(18000 + g);
    const cat = categories[g % categories.length];
    const brand = brands[g % brands.length];
    const name = g <= 12 ? `Gold Standard Whey ${g}` : `Test Product ${g}`;
    for (const option of ['Шоколад', 'Ванилия']) {
      products.push({
        id: String(sku++),
        group_id: groupId,
        product_id: g,
        product_name: name,
        brand_id: brand.id,
        brand_name: brand.name,
        pack: g % 2 === 0 ? '2 кг' : '1 кг',
        option,
        category: cat,
        image: '',
        label: '',
        barcode: String(100000 + sku),
        b2b_price: (8 + (g % 5)).toFixed(2),
        regular_price: '20.00',
        sale_price: '0.00',
        available: option === 'Шоколад' || g % 4 !== 0,
        description: `<p>${name} – тестово описание за E2E.</p>`
      });
    }
  }
  return products;
}

export function seedPortfolioFixture({ force = false } = {}) {
  if (!force && existsSync(`${OUT_DIR}/portfolio_meta.json`)) {
    return false;
  }

  const settings = {
    ...DEFAULT_SETTINGS,
    global_markup_percent: 30,
    brand_markups: { 749: 25 }
  };

  const groups = groupRawProducts(buildSampleProducts(), settings);
  const meta = buildCatalogMeta(groups);
  meta.synced_at = new Date().toISOString();

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/portfolio_meta.json`, JSON.stringify(meta));
  writeFileSync(`${OUT_DIR}/portfolio_settings.json`, JSON.stringify({
    ...settings,
    last_sync: meta.synced_at,
    last_sync_count: groups.length
  }, null, 2));

  for (let i = 0; i < meta.chunk_count; i++) {
    const slice = groups.slice(i * meta.chunk_size, (i + 1) * meta.chunk_size);
    writeFileSync(`${OUT_DIR}/portfolio_chunk_${i}.json`, JSON.stringify(slice));
  }

  console.log(`Seeded ${groups.length} product groups to ${OUT_DIR}/`);
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedPortfolioFixture({ force: true });
}
