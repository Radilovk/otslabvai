# Описание на проектите — Radilovk/otslabvai

Репото съдържа **три самостоятелни уеб проекта**, споделящи един бекенд (Cloudflare Worker), един KV namespace и един admin панел. Всичко се деплойва автоматично при `git push` към `main` чрез GitHub Actions → Cloudflare Workers + Assets.

---

## ПРОЕКТ 1: „ДА ОТСЛАБНА"

### Цел
Е-commerce платформа за хранителни добавки и продукти за отслабване, насочена към масовия пазар. Слоган: **„Мисията възможна"**. Основен домейн: `daotslabna.com`.

### Файлова структура
| Файл | Роля |
|------|------|
| `index.html` | Начална страница — продуктов каталог |
| `index.js` | Логика на началната страница |
| `index.css` | Стилове (111 KB) |
| `product.html` / `product.js` | Детайлна страница на продукт |
| `checkout.html` / `checkout.js` | Количка и форма за поръчка |
| `questionnaire.html` / `questionnaire.js` | AI въпросник |
| `questionnaire.css` | Стилове за въпросника |
| `contact.html` | Контактна форма |
| `about-us.html` | За нас |
| `policy.html` / `shipping.html` / `terms.html` | Правна информация |

### Архитектура
- **Рендиране**: Клиентска страна — данните идват от `GET /page_content.json`
- **Количка**: `localStorage['cart']`
- **Тема**: `localStorage['theme']`, CSS атрибут `data-theme` на `<html>`
- **Бекенд**: `https://port.radilov-k.workers.dev`
- **KV ключ за съдържание**: `page_content`

### Основни функции
1. **Продуктов каталог** — категории, снимки, ефект-барове, инвентар
2. **Количка и checkout** — localStorage за кошница, форма (имена, тел., адрес), Speedy офис от iframe widget
3. **Промо кодове** — валидация срещу `/validate-promo`, % или фиксирана отстъпка
4. **AI въпросник** — профил на потребителя → POST `/quest-submit` → AI препоръки
5. **AI помощник** — автоматично генериране на описания на продукти (3 провайдъра)

### Стил и дизайн
- **Шрифтове**: Poppins (заглавия), Montserrat (текст)
- **Основен цвят**: `#E4007C` (наситено розово), поддръжка на светла/тъмна тема
- **Тон**: Достъпен, масов, с акцент на резултати и трансформация

---

## ПРОЕКТ 2: „Life Protocols" (Life BioHack)

### Цел
Premium е-commerce за биохакинг продукти — пептиди, клетъчна регенерация, дълголетие. Насочен към напреднали потребители. Брандинг: **„Протоколи за Здраве и Дълголетие"**. Достъпен на `daotslabna.com/life.html`.

### Файлова структура
| Файл | Роля |
|------|------|
| `life.html` | Начална страница — продуктов каталог |
| `life.js` | Логика на началната страница |
| `life.css` | Стилове (185 KB) |
| `life-product.html` / `life-product.js` | Детайлна страница на продукт |
| `life-checkout.html` | Количка и форма за поръчка |
| `life-about.html` | За нас |
| `life-contact.html` | Контактна форма |
| `life-policy.html` / `life-shipping.html` / `life-terms.html` | Правна информация |

### Архитектура
Идентична с Проект 1, с разликите:
| Аспект | Проект 1 | Проект 2 |
|--------|----------|----------|
| localStorage ключ | `cart` | `lifeCart` |
| KV ключ | `page_content` | `life_page_content` |
| API ендпойнт | `/page_content.json` | `/life_page_content.json` |

### Основни функции
Идентични с Проект 1. Допълнително:
- По-детайлни описания на съставки и биологични механизми
- Синергийни препоръки между продукти

### Стил и дизайн
- **Шрифтове**: Playfair Display (serif, луксозен), Space Grotesk, DM Sans
- **Тон**: Premium, научен, ориентиран към дълголетие и оптимизация
- **Цветова палитра**: По-тъмна и сдържана в сравнение с Проект 1

---

## ПРОЕКТ 3: Bio (Профилна страница на д-р Константин Радилов)

### Цел
Самостоятелна авторитетна страница на **д-р Константин Радилов** — диетолог, нутриционист, специалист по спортна медицина. Служи за изграждане на доверие и медицински кредитет.

### Файлова структура
| Файл | Роля |
|------|------|
| `bio.html` | Пълната профилна страница (~1.3 MB, embedded CSS + JS) |
| `bioadmin.html` | Редактор на съдържанието |

### Архитектура
- **Рендиране**: `bio.html` е статичен Cloudflare Asset (не се сервира от worker)
- **Динамично съдържание**: При load изпълнява вградения JS, при нужда прилага override-и от `/bio_content.json` (само при admin команда или `"update"` в контактната форма)
- **KV ключ**: `bio_content`
- **Всичко в един файл**: CSS и JS са вградени директно в `bio.html` — няма отделни файлове

### Основни функции
1. **Биографичен дисплей** — медицински квалификации, сертификати, опит, специализации
2. **Контактна форма** → POST `/contacts`
3. **`bioadmin.html`** — редактира `bio_content` (POST `/bio_content.json`), без deploy
4. **`/bio_rebake` ендпойнт** — no-op, запазен за обратна съвместимост

### Стил и дизайн
- **Шрифтове**: Playfair Display, Inter, DM Mono
- **Тон**: Медицински, авторитетен, изчистен
- **Специфика**: Целият стил и логика са embedded — `bio.html` е самостоятелен артефакт

---

## СПОДЕЛЕНА ИНФРАСТРУКТУРА

### Бекенд (worker.js)
Единен Cloudflare Worker на `https://port.radilov-k.workers.dev`. Чист JSON API, ~1600 реда ES6 JS.

#### API ендпойнти
| Метод | Маршрут | Проект |
|-------|---------|--------|
| GET/POST | `/page_content.json` | П1 |
| GET/POST | `/life_page_content.json` | П2 |
| GET/POST | `/bio_content.json` | П3 |
| POST | `/bio_rebake` | П3 (no-op) |
| GET/POST | `/orders` | П1 + П2 |
| PUT | `/orders` | П1 + П2 |
| POST | `/contacts` | Всички |
| GET/POST/PUT/DELETE | `/promo-codes` | П1 + П2 |
| POST | `/validate-promo` | П1 + П2 |
| POST | `/quest-submit` | П1 |
| POST | `/ai-assistant` | П1 |
| GET/POST | `/ai-settings` | Всички |
| GET | `/api-token` | Вътрешен |

#### KV ключове (namespace `PAGE_CONTENT`)
| Ключ | Съдържание |
|------|-----------|
| `page_content` | JSON за П1 |
| `life_page_content` | JSON за П2 |
| `bio_content` | JSON override за П3 |
| `orders` | Масив от поръчки |
| `contacts` | Масив от контакти |
| `promo_codes` | Масив от промо кодове |
| `ai_settings` | AI конфигурация (провайдър, модел, ключ) |
| `clients` | Отговори от въпросника |
| `results` | AI препоръки |
| `static_backend_page_content.json` | Fallback за `page_content` |
| `static_backend_life_page_content.json` | Fallback за `life_page_content` |

### AI интеграция (3 провайдъра)
| Провайдър | Модел | Конфигурация |
|-----------|-------|-------------|
| Cloudflare AI | `@cf/meta/llama-3.1-70b-instruct` | По подразбиране |
| OpenAI | `gpt-4` с JSON mode | По избор |
| Google Gemini | REST API, `responseMimeType: application/json` | По избор |

### Admin панел (admin.html / admin.js / admin.css)
Единен управленски интерфейс за Проект 1 и 2 с **превключвател на проект**.

| Таб | Функции |
|-----|---------|
| Глобални настройки | Лого, слоган, тема, градиенти, промо банер |
| Навигация | Управление на менюто |
| Съдържание | Drag-drop builder — продуктови категории и карти |
| Footer | Секции в footer |
| Поръчки | Преглед, филтриране, промяна на статус |
| Контакти | Преглед на изпратени форми |
| Промо кодове | Създаване, редактиране, изтриване, tracking на употреба |

### Speedy Доставка
- Избор на офис чрез Speedy iframe widget (`office_locator_widget_v3/office_locator.php`)
- Данните не се кешират в KV — widget-ът е директно вграден в checkout страниците
- `postMessage` от iframe → попълва скрито поле `#final-speedy-id`

---

## ДЕПЛОЙМЕНТ

```
git push → main
     ↓
GitHub Actions (deploy.yml)
     ↓
wrangler deploy
  ├── worker.js  →  Cloudflare Workers API (port.radilov-k.workers.dev)
  └── HTML/JS/CSS  →  Cloudflare Assets (daotslabna.com)
```

`.assetsignore` изключва: `*.json`, `*.md`, `node_modules/`, `backend/`, `*.jpg`
PNG файловете **се деплойват** (не са изключени).

---

## КОД — ОБЩИ КОНВЕНЦИИ

- **Език на коментарите**: Български
- **Модулна система**: ESM (`"type": "module"` в `package.json`)
- **Стил**: ES6+ — `async/await`, arrow функции, template literals
- **XSS защита**: `escapeHtml()` хелпър преди всяко рендиране на потребителски данни
- **Обработка на грешки**: `UserFacingError` клас с HTTP статус код
- **Кеширане**: ETag + `Cache-Control` хедъри; localStorage за клиентски данни
- **GitHub синхронизация**: Worker пише в KV, след това async (`ctx.waitUntil`) sync-ва към GitHub

---

## РЕФЕРЕНТНИ ФАЙЛОВЕ

| Файл | Предназначение |
|------|---------------|
| `backend/AGENT_LOG.md` | Архитектурен дневник — **задължително четене** преди промени |
| `wrangler.toml` | Cloudflare Worker конфигурация |
| `worker.js` | Целият бекенд (API + KV логика) |
| `admin.html` | Unified admin за П1 + П2 |
| `bioadmin.html` | Admin само за П3 |
| `.assetsignore` | Изключва файлове от деплоймент като Assets |
| `.github/workflows/deploy.yml` | CI/CD pipeline |
