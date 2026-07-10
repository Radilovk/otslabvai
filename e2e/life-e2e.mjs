/**
 * E2E тест на пълния потребителски път в Life Protocols:
 * вход → разглеждане → продукт (варианти) → количка → checkout
 * (валидация, промо, доставка, всички разклонения) → поръчка → потвърждение.
 *
 * Единият продукт минава през portfolio-import конверсията, за да се тества
 * че импортиран от B2B каталога продукт се показва пълноценно на сайта.
 *
 * Run: node e2e/life-e2e.mjs
 */
import express from 'express';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import { portfolioGroupToSiteProduct } from '../portfolio-import.js';

// Порт 8080 + hostname localhost → страниците сочат API-то към
// http://localhost:8080/backend (вж. config.js и inline API_URL в life.html)
const PORT = 8080;
const BASE = `http://localhost:${PORT}`;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const issues = [];
const passes = [];
const logPass = (msg) => { passes.push(msg); console.log(`  ✓ ${msg}`); };
const logIssue = (msg) => { issues.push(msg); console.log(`  ✗ ${msg}`); };
const check = (cond, msg) => (cond ? logPass(msg) : logIssue(msg));

// --- Фикстура: продукт, импортиран от portfolio каталога (пълния pipeline) ---
const importedProduct = portfolioGroupToSiteProduct({
  group_id: '4242',
  name: 'NAD+ Cell Regenerator',
  brand: 'BioLab',
  brand_id: '9',
  category: 'Антиейджинг > NAD+',
  image: '',
  label: '',
  description: '<h2>Клетъчна регенерация</h2><p>NAD+ е ключов коензим за клетъчната енергия и дълголетието.</p>' +
    '<p>С напредване на възрастта нивата му спадат — добавката ги възстановява.</p>' +
    '<ul><li>Енергия: подобрява митохондриалната функция</li><li>Подкрепя ДНК възстановяването</li></ul>',
  variants: [
    { sku_id: '91', barcode: '3800001', pack: '30 капс.', option: '', b2b_price: 30, retail_price: 45.9, available: true, image: '' },
    { sku_id: '92', barcode: '3800002', pack: '60 капс.', option: '', b2b_price: 55, retail_price: 79.9, available: true, image: '' }
  ]
});
importedProduct.system_data.goals = ['anti-aging'];

const simpleProduct = {
  product_id: 'prod-simple',
  display_order: 1,
  public_data: {
    name: 'Collagen Peptides',
    price: 39.9,
    tagline: 'Пептиден колаген за кожа и стави',
    description: 'Хидролизиран колаген тип I и III.',
    image_url: '',
    effects: [{ label: 'Кожа', value: 90 }],
    variants: []
  },
  system_data: { inventory: 5, goals: ['anti-aging'] }
};

const lifeContent = {
  settings: {
    site_name: 'Life Protocols',
    site_slogan: 'Протоколи за Здраве и Дълголетие',
    logo_url: 'images/lifelogo3.png'
  },
  navigation: [],
  page_content: [
    {
      id: 'antiaging-products',
      type: 'product_category',
      title: 'Антиейджинг протоколи',
      description: 'Тестова категория',
      options: { is_collapsible: false, is_expanded_by_default: true },
      products: [importedProduct, simpleProduct]
    }
  ],
  footer: { columns: [], copyright_text: '© Life Protocols' }
};

// --- Стъб бекенд + статични файлове ---
const capturedOrders = [];
function startServer() {
  const app = express();
  app.use(express.json());
  app.get('/backend/life_page_content.json', (req, res) => res.json(lifeContent));
  app.post('/backend/orders', (req, res) => {
    capturedOrders.push(req.body);
    res.status(200).json({ success: true });
  });
  app.post('/backend/validate-promo', (req, res) => {
    if ((req.body?.code || '').toUpperCase() === 'LIFE10') {
      res.json({ valid: true, promoCode: { code: 'LIFE10', discount: 10, discountType: 'percentage', description: '10% отстъпка' } });
    } else {
      res.json({ valid: false, error: 'Невалиден промо код.' });
    }
  });
  app.use(express.static(ROOT));
  return new Promise((resolve) => {
    const server = app.listen(PORT, () => resolve(server));
  });
}

async function runTests() {
  console.log('\n=== Life Protocols E2E: пълен потребителски път ===\n');
  const server = await startServer();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (err) => logIssue(`JS грешка на страницата: ${err.message}`));

  try {
    // ---------- 1. ВХОД И РАЗГЛЕЖДАНЕ ----------
    console.log('— Вход и разглеждане —');
    await page.goto(`${BASE}/life.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.product-card', { timeout: 10000 });

    const cards = await page.$$('.product-card');
    check(cards.length === 2, `Каталогът показва ${cards.length}/2 продукта`);

    const importedCard = page.locator(`.product-card[data-product-id="${importedProduct.product_id}"]`);
    const cardPrice = (await importedCard.locator('.product-price').textContent()).trim();
    check(cardPrice.includes('от') && cardPrice.includes('45.90'), `Импортиран продукт с варианти показва „от 45.90 €" (реално: "${cardPrice}")`);
    check(!cardPrice.includes('NaN'), 'Няма NaN в цената на картата');

    const cardTagline = (await importedCard.locator('.product-title p').textContent()).trim();
    check(cardTagline.length > 0, `Карта без слоган показва откъс от описанието ("${cardTagline.slice(0, 40)}…")`);

    // ---------- 2. ПРОДУКТОВА СТРАНИЦА (импортиран продукт, варианти) ----------
    console.log('— Продуктова страница —');
    await page.goto(`${BASE}/life-product.html?id=${importedProduct.product_id}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#add-to-cart-detail-btn', { timeout: 10000 });

    const title = await page.textContent('.product-detail-header h1');
    check(title.includes('NAD+'), 'Заглавието на продукта се показва');

    const descParas = await page.$$('.product-detail-description p');
    check(descParas.length >= 1, `Описанието е разбито на параграфи (${descParas.length})`);

    const aboutTitle = await page.textContent('.product-about-section h3').catch(() => '');
    check(aboutTitle.includes('Клетъчна регенерация'), `Секция „За продукта" със заглавие от описанието ("${aboutTitle}")`);
    const benefitTitles = await page.$$eval('.product-benefits-full .benefit-item h4', els => els.map(e => e.textContent.trim()));
    check(benefitTitles.includes('Енергия'), `Ползите от bullet списъка се показват (${JSON.stringify(benefitTitles)})`);

    const variantOptions = await page.$$eval('#variant-select option', els => els.map(e => e.textContent.trim()));
    check(variantOptions.length === 2, `Вариантите се показват в селектора (${JSON.stringify(variantOptions)})`);

    // Добавяне на вариант 2 (60 капс.)
    await page.selectOption('#variant-select', '1');
    await page.click('#add-to-cart-detail-btn', { force: true });
    await page.waitForFunction(() => document.getElementById('cart-count')?.textContent === '1');
    logPass('Добавяне на вариант в количката → броячът стана 1');

    // Добавяне на втория (прост) продукт
    await page.goto(`${BASE}/life-product.html?id=prod-simple`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#add-to-cart-detail-btn', { timeout: 10000 });
    await page.click('#add-to-cart-detail-btn', { force: true });
    await page.waitForFunction(() => document.getElementById('cart-count')?.textContent === '2');
    logPass('Втори продукт в количката → броячът стана 2');

    // ---------- 3. CHECKOUT: количка ----------
    console.log('— Checkout: количка —');
    await page.goto(`${BASE}/life-checkout.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#product-list .product-item', { timeout: 10000 });

    let items = await page.$$('#product-list .product-item');
    check(items.length === 2, `Количката показва ${items.length}/2 артикула`);

    const variantItemName = await page.textContent('#product-list .product-item:first-child h3');
    check(variantItemName.includes('60 капс'), `Избраният вариант е записан в количката ("${variantItemName.trim()}")`);

    // Промяна на количество
    await page.click('#product-list .product-item:first-child .quantity-btn[data-action="increase"]');
    const qty = await page.textContent('#product-list .product-item:first-child .quantity');
    check(qty.trim() === '2', 'Увеличаването на количество работи');

    // Премахване на артикул — без confirm(), с тост
    await page.click('#product-list .product-item:nth-child(2) .remove-item-btn');
    await page.waitForSelector('#toast-container .toast', { timeout: 5000 });
    items = await page.$$('#product-list .product-item');
    check(items.length === 1, 'Премахването на артикул работи (с тост, без confirm)');

    // Субтотал 159.80 € (>100) → безплатна доставка, без подсказка
    const shippingText = (await page.textContent('#summary-shipping')).trim();
    check(shippingText.includes('Безплатна'), `Над 100 € → доставката е безплатна ("${shippingText}")`);
    check(!(await page.isVisible('#free-shipping-hint')), 'Подсказката е скрита при достигнат праг');

    // ---------- 4. ПРОМО КОД ----------
    console.log('— Промо код —');
    await page.fill('#promo-code', 'GRESHEN');
    await page.click('#apply-promo');
    await page.waitForSelector('#promo-message.error', { timeout: 5000 });
    logPass('Невалиден промо код → inline съобщение за грешка');

    await page.fill('#promo-code', 'LIFE10');
    await page.click('#apply-promo');
    await page.waitForSelector('#promo-message.success', { timeout: 5000 });
    check(await page.isVisible('#discount-row'), 'Валиден промо код → отстъпката се вижда в резюмето');

    const removeBtnText = await page.textContent('#apply-promo');
    check(removeBtnText.includes('Премахни'), 'Бутонът става „Премахни" след прилагане');
    await page.click('#apply-promo');
    check(!(await page.isVisible('#discount-row')), 'Премахването на промо кода връща сумата');

    // Прилагаме отново за финалната поръчка
    await page.fill('#promo-code', 'LIFE10');
    await page.click('#apply-promo');
    await page.waitForSelector('#promo-message.success', { timeout: 5000 });

    // ---------- 5. ВАЛИДАЦИЯ НА ФОРМАТА ----------
    console.log('— Валидация —');
    await page.click('.btn-submit');
    await page.waitForSelector('#checkout-form .is-invalid', { timeout: 5000 });
    check(capturedOrders.length === 0, 'Празна форма → няма изпратена поръчка, полетата са маркирани');

    await page.fill('#email', 'test@example.com');
    await page.fill('#first-name', 'Иван');
    await page.fill('#last-name', 'Тестов');
    await page.fill('#phone', '0888123456');
    await page.check('#policy-consent');
    await page.check('#terms');

    // Куриер (Speedy по подразбиране) без избран офис → inline грешка, без поръчка
    await page.click('.btn-submit');
    await page.waitForSelector('#speedy-widget.is-invalid-section', { timeout: 5000 });
    check(capturedOrders.length === 0, 'Липсващ офис на Speedy → грешка, без изпратена поръчка');

    // Избор на офис през Speedy widget-а (симулираме postMessage от iframe-а)
    await page.evaluate(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://services.speedy.bg',
        data: { id: 777, name: 'Спиди офис Тест', address: { fullAddressString: 'София, ул. Тестова 1' } }
      }));
    });
    await page.waitForFunction(() => document.getElementById('final-speedy-id')?.value === '777');
    check(await page.isVisible('#speedy-selected-info'), 'Избраният Speedy офис се показва');

    // ---------- 6. ИЗПРАЩАНЕ И ПОТВЪРЖДЕНИЕ ----------
    console.log('— Поръчка —');
    await page.click('.btn-submit');
    await page.waitForSelector('#success-modal.active', { timeout: 10000 });
    logPass('Успешна поръчка → модал за потвърждение');

    check(capturedOrders.length === 1, `Изпратена е точно 1 поръчка (${capturedOrders.length})`);
    const order = capturedOrders[0] || {};
    check(order.promoCode === 'LIFE10', 'Промо кодът е в поръчката');
    check(order.customer?.courierOfficeName === 'Спиди офис Тест', 'Speedy офисът е в поръчката');
    check((order.products || []).length === 1 && order.products[0].quantity === 2, 'Продуктите и количествата са коректни');

    const cartAfter = await page.evaluate(() => localStorage.getItem('lifeCart'));
    check(!cartAfter, 'Количката е изчистена след поръчка');
    check(await page.isDisabled('.btn-submit'), 'Бутонът е блокиран срещу двойно изпращане');

    // ---------- 7. РАЗКЛОНЕНИЯ ----------
    console.log('— Разклонения —');

    // Празна количка → празно състояние + блокиран бутон
    await page.goto(`${BASE}/life-checkout.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.cart-empty-state', { timeout: 5000 });
    check(await page.isDisabled('.btn-submit'), 'Празна количка → блокиран бутон и празно състояние с линк към магазина');

    // Доставка до адрес: полетата се показват и изискват
    await page.evaluate(() => localStorage.setItem('lifeCart', JSON.stringify([
      { id: 'prod-simple', name: 'Collagen Peptides', price: 39.9, quantity: 1, inventory: 5, image: '' }
    ])));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#product-list .product-item', { timeout: 5000 });

    // Субтотал 39.90 € (<100) → подсказка колко остава до безплатна доставка
    const hintText = (await page.textContent('#free-shipping-hint')).trim();
    check(await page.isVisible('#free-shipping-hint') && hintText.includes('60.10'),
      `Подсказка за безплатна доставка под прага: "${hintText}"`);

    await page.check('#delivery-address');
    check(await page.isVisible('#address'), 'Изборът „до адрес" показва адресните полета');

    await page.fill('#email', 'test2@example.com');
    await page.fill('#first-name', 'Мария');
    await page.fill('#last-name', 'Тестова');
    await page.fill('#phone', '0899123456');
    await page.fill('#address', 'ул. Примерна 5');
    await page.fill('#city', 'Пловдив');
    await page.fill('#postcode', '4000');
    await page.check('#policy-consent');
    await page.check('#terms');
    await page.click('.btn-submit');
    await page.waitForSelector('#success-modal.active', { timeout: 10000 });
    check(capturedOrders.length === 2 && capturedOrders[1].customer?.deliveryMethod === 'address',
      'Поръчка с доставка до адрес минава успешно');

    // Мобилен изглед: каталогът се рендира
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(`${BASE}/life.html`, { waitUntil: 'networkidle' });
    await mobile.waitForSelector('.product-card', { timeout: 10000 });
    check((await mobile.$$('.product-card')).length === 2, 'Мобилен изглед: каталогът се рендира');
    await mobile.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n=== Резултат: ${passes.length} ✓ / ${issues.length} ✗ ===\n`);
  if (issues.length) {
    issues.forEach((i) => console.log(`ISSUE: ${i}`));
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('E2E тестът се провали:', err);
  process.exit(1);
});
