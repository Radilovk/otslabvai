# Архитектурен дневник — Radilovk/otslabvai

> Този файл трябва да се чете от ВСЕКИ агент преди да прави каквито и да е промени.
> Актуализира се след всяка значима промяна.

---

## Архитектура (ОКОНЧАТЕЛНА — не се променя без причина)

### Фронтенд
- HTML/JS/CSS файловете са в root-а на репото и се сервират като **Cloudflare Workers Assets** (`[assets] directory="."` в `wrangler.toml`).
- Главният сайт е на домейн `daotslabna.com` (GitHub Pages / Cloudflare Pages — вижте `CNAME`).
- **HTML файловете НИКОГА не се сервират от worker.js.** Никога не се качват в KV.

### Бекенд (worker.js)
- Чист API worker на `https://port.radilov-k.workers.dev`
- Обработва само следните routes:
  - `GET/POST /page_content.json` — съдържание на главната страница (KV: `page_content`)
  - `GET/POST /life_page_content.json` — съдържание на Life страницата (KV: `life_page_content`)
  - `GET/POST /orders` — поръчки (KV namespace: `ORDERS`)
  - `PUT /orders` — обновяване на статус на поръчка
  - `GET/POST /contacts` — контакти (KV: `contacts`)
  - `GET/POST/PUT/DELETE /promo-codes` — промо кодове (KV: `promo_codes`)
  - `POST /validate-promo` — валидиране на промо код
  - `POST /quest-submit` — questing form submit
  - `POST /ai-assistant` — AI асистент
  - `GET/POST /ai-settings` — AI настройки
  - `GET /api-token` — API token
  - `GET/POST /bio_content.json` — bio страница съдържание (KV: `bio_content`); POST автоматично комитва в GitHub
  - `POST /bio_rebake` — ръчен синхрон на bio_content от KV към GitHub (вече рядко нужен)

### KV съхранение
- KV `PAGE_CONTENT` namespace съхранява:
  - `page_content` — JSON данни за главната страница
  - `life_page_content` — JSON данни за Life страницата
  - `bio_content` — JSON данни за bio страницата
  - `static_backend_page_content.json` — fallback при празен `page_content`
  - `static_backend_life_page_content.json` — fallback при празен `life_page_content`
- KV `ORDERS` namespace — поръчки (по ID)
- **НИКОГА не се качват HTML файлове в KV.**

### upload-static-files.js
- Качва САМО JSON data файлове в KV (fallback-ове за page_content и life_page_content)
- HTML/JS/CSS НЕ се качват — сервират се директно като Assets

### GitHub Actions workflows
| Workflow | Trigger | Цел |
|----------|---------|-----|
| `deploy.yml` | push to main | Deploy worker.js + assets към Cloudflare |

### Speedy офиси — архитектура (АКТУАЛНА)
- `checkout.html` и `life-checkout.html` използват **директно** Speedy's iframe widget (`office_locator_widget_v3/office_locator.php`) в модален прозорец.
- Офисите **не се кешират в KV**. Няма `/speedy-offices` или `/speedy-refresh` endpoints.
- Слушат `postMessage` от iframe → попълват `#final-speedy-id`.
- **speedy.html** — отделна тестова страница за iframe widget-а.

---

## Хронология на промените

### 2026-03-29 — Пълно почистване: Speedy KV кеш → директен iframe widget

**Промяна:** Завършване на миграцията от текстово търсене към интерактивна карта. Всички Speedy KV-caching инфраструктура е премахната.

**Детайли:**
- `life-checkout.html`: мигрирана от текстово търсене (`loadSpeedyOffices`, `fetch('/speedy-offices')`) към iframe карта (същото като `checkout.html`)
- `admin.html` / `admin.js`: премахнат бутонът "Синхронизирай офиси сега" и свързания handler
- `worker.js`: премахнати `handleGetSpeedyOffices`, `handleRefreshSpeedyOffices`, `refreshSpeedyOfficesCache`, `triggerSpeedyGithubSync`, routes `/speedy-offices` и `/speedy-refresh`, и `scheduled` cron handler
- `wrangler.toml`: премахнат `[triggers] crons`
- `.github/workflows/speedy-offices-sync.yml`: изтрит (вече не е нужен)

**Файлове:** `life-checkout.html`, `admin.html`, `admin.js`, `worker.js`, `wrangler.toml`

---

### 2026-03-29 — checkout.html: Speedy офис — интерактивна карта като модален прозорец

**Промяна:** Текстовото поле за търсене на офиси на Спиди (search input + dropdown) е заменено с бутон, който отваря интерактивната карта на Спиди (`office_locator_widget_v3`) в модален прозорец.

**Детайли:**
- Премахнато: `#speedy-office-search`, `#speedy-offices-dropdown`, `#speedy-status-text`, всички свързани CSS класове и JS логика (`loadSpeedyOffices`, `showSpeedyRetry`, `escapeHtml`, `speedyOfficesLoaded` и др.)
- Добавено: бутон "🗺️ Избери от картата" → отваря `#speedy-map-modal` с `<iframe>` към `https://services.speedy.bg/office_locator_widget_v3/office_locator.php`
- Добавено: `window.addEventListener('message', ...)` слуша `postMessage` от iframe → попълва `#final-speedy-id` и показва избрания офис под бутона
- Модалът е responsive: `min(92vw, 700px)` × `min(85vh, 620px)`, на мобилен `96vw` × `88vh`
- `checkout.html` вече не прави `fetch('/speedy-offices')` — офисите се избират директно от картата на Спиди
- След избор на офис: бутонът сменя текста на "🗺️ Смени офиса"; валидационното съобщение коригирано на "от картата"
- Почистено мъртво JS: `ekontWidget.classList.add/remove('expanded')` (без CSS правило); мъртва CSS переменна `--ekont-dropdown-expansion-height`

**Файлове:** `checkout.html`

### 2026-03-27 (PR #270) — Refactor: Cloudflare Workers Assets
**Проблем:** worker.js сервираше HTML от KV (`serveStaticFile`, `serveBioHtml`), което беше грешен подход.

**Поправка:**
- Премахнато: `CONTENT_TYPES`, `STATIC_FILES`, `serveStaticFile()`, `serveBioHtml()`
- Добавено: `.assetsignore` — изключва нe-web файлове от assets
- Добавено: `[assets] directory="."` в `wrangler.toml`
- `upload-static-files.js` — оставя само JSON data файлове

**Резултат:** Worker = чист API. HTML/JS/CSS = Cloudflare Assets.

---

### 2026-03-27 — Cleanup след рефактора
**Проблем:**
1. `CACHE_CONFIG.STATIC_FILE_MAX_AGE` беше dead code (static files вече не се сервират от KV).
2. Коментари в `handleSaveBioContent` и `handleBioRebake` споменаваха несъществуваща `baked_bio.html`.
3. `console.error` се логваше за всеки `GET /` от бот/браузър — очаквано 404, не е грешка.

**Поправки:**
- Премахнато: `STATIC_FILE_MAX_AGE` от `CACHE_CONFIG`
- Поправени коментари в `handleSaveBioContent` и `handleBioRebake`
- `console.error` в catch блока вече логва само за non-404 грешки

---

### 2026-03-28 — Speedy офиси: публичен endpoint

**Проблем:** `https://services.speedy.bg/offices_list/offices.json` върна 404 — Спиди премахнаха публичния JSON dump.

**Грешен опит (НЕ ПРАВЕТЕ ТОВА):** Предишен агент смени endpoint-а на `POST https://api.speedy.bg/v1/location/office/` с `SPEEDY_USERNAME` + `SPEEDY_PASSWORD` secrets — **ГРЕШНО**, защото целта е да работи БЕЗ credentials.

**Правилно решение:**
- Endpoint: `GET https://services.speedy.bg/office_locator_widget_v3/offices_list.php?lang=bg`
- Публичен, без authentication, без API key
- Връща JSON масив директно: `[{ id, name, address, city }, ...]`
- Нужни са само вече съществуващите `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`

**Файлове променени:**
- `.github/workflows/speedy-offices-sync.yml` — GET към публичния widget endpoint
- `worker.js` → `refreshSpeedyOfficesCache()` — GET към публичния widget endpoint

---

### 2026-03-29 — Speedy офиси: Playwright headless browser вместо curl

**Проблем:** `speedy-offices-sync.yml` използваше `curl` за да изтегли офисите от Speedy. Cloudflare разпозна заявките като "роботизирани" и върна 403.

**Решение:** Заменихме `curl` с Playwright (headless Chromium) в GitHub Actions:
- Истински Chrome браузър отваря endpoint-а
- Изчаква 5 секунди (Cloudflare минча валидацията)
- Чете `document.body.innerText` (JSON-а) и го записва в файл
- Следващите стъпки (нормализиране + KV запис) остават непроменени

**Файлове:** `.github/workflows/speedy-offices-sync.yml` — стъпката "Fetch Speedy offices" сменена с Playwright Node.js скрипт. Timeout увеличен на 15 минути.

---

### 2026-03-28 — Поправка: handleBioRebake — bio.html > 1 MB

**Проблем:** `POST /bio_rebake` хвърляше грешка "bio.html bake markers not found".
Причина: bio.html е 1.3 MB — GitHub Contents API връща **празно** `content` поле за файлове > 1 MB.

**Поправка:** Двустъпков fetch:
1. GET `/repos/.../contents/bio.html?ref=main` → взима само `sha` (blob SHA)
2. GET `/repos/.../git/blobs/{sha}` → взима пълното съдържание на файла (без ограничение)

**Файлове:** `worker.js` → `handleBioRebake()`

---

## Правила за бъдещи агенти

1. **НЕ добавяй HTML файлове в KV.** HTML е в GitHub и се сервира от Cloudflare Assets.
2. **НЕ добавяй `serveStaticFile()` или подобни функции в worker.js.** Worker е само API.
3. **НЕ добавяй нови routes без да провериш дали вече съществуват.**
4. **Актуализирай AGENT_LOG.md** след всяка значима промяна.
5. Когато поправяш грешка, провери дали не е симптом на по-голям проблем.
6. Преди да промениш архитектурата, прочети целия `worker.js` и `wrangler.toml`.
7. **Speedy офиси се изтеглят от ПУБЛИЧЕН endpoint — БЕЗ API key.** Не добавяй credentials.

---

## Чести грешки (от предишни агенти)

| Грешка | Защо е грешна | Правилното |
|--------|--------------|------------|
| Добавяне на `baked_bio.html` в KV | HTML не трябва в KV | Bio данните са само JSON в `bio_content` |
| `serveBioHtml()` в worker | Worker не сервира HTML | Cloudflare Assets сервира bio.html |
| `STATIC_FILES` map в worker | Static файлове не са в KV | Cloudflare Assets |
| Качване на bio.html в KV | HTML не е в KV | bio.html е като asset |
| `console.error` за 404 на `/` | Не е реална грешка | Бот/браузър удря API URL директно |
| Speedy офиси с `SPEEDY_USERNAME`/`SPEEDY_PASSWORD` | Не нужни, има публичен endpoint | `GET office_locator_widget_v3/offices_list.php` |
| Speedy `POST api.speedy.bg/v1/location/office/` | Изисква платен акаунт | Публичният widget endpoint е безплатен |

---

### 2026-03-29 — Централизиране на текст от bio.html в bio_content.json

**Проблем:** Много текстови полета в bio.html бяха hardcoded и не се съдържаха в bio_content.json. Редактирането на текст ставаше само чрез admin панела (за 22 текстови полета), а директното редактиране на bio_content.json не покриваше всички текстове. Освен това: KV и bio_content.json файла не бяха синхронизирани — admin промени чрез "update" се губеха при следващ deploy (deploy.yml преписваше bio.html от старото bio_content.json).

**Решение:**

1. **bio_content.json** — добавени 35 нови текстови полета в `textOverrides` (stat-1-num, stat-2-num, stat-3-num, cta-primary, cta-outline, badge-num, badge-label, pillar-1/2/3-title, creds-section-title, philosophy-*, approach-*, step-1/2/3/4-*, services-label/title/sub, testimonials-label/title, contact-label/title/sub). Всего: 57 textOverrides.

2. **deploy.yml** — добавена стъпка "Sync bio_content.json to KV" (curl PUT към Cloudflare KV API след bake). Осигурява, че директно редактиране на bio_content.json (и push) се отразява и в KV, което чете admin панелът.

3. **worker.js → handleBioRebake** — преписана функцията: вместо да бейква bio_content в bio.html и да комитва bio.html (което след това deploy.yml презаписваше с file данните), сега:
   - Чете bio_content от KV
   - Комитва bio_content.json в GitHub (pretty-printed, за четимост)
   - Deploy workflow автоматично бейква в bio.html и ъплоудва в KV

**Резултат — два начина за редакция, напълно синхронизирани:**
- **Файлов начин**: редакция на `bio_content.json` → push → deploy бейква в bio.html + ъплоудва в KV
- **Admin начин**: admin панел → запис в KV → "update" → handleBioRebake комитва bio_content.json → deploy бейква в bio.html + ъплоудва в KV

**Файлове:** `bio_content.json`, `.github/workflows/deploy.yml`, `worker.js`

---

### 2026-04-01 — Автоматичен синхрон на admin промени към GitHub

**Проблем:** След запис на промени в bio admin панела и повторно отваряне, се зареждаше старата версия. Причината: admin записваше само в KV, но не и в GitHub repo. Следващият deploy (от друг push) презаписваше KV с файловата версия от repo.

**Решение:**
- **worker.js → handleSaveBioContent** — Сега записва в KV **И** комитва bio_content.json в GitHub автоматично (чрез `ctx.waitUntil()`).
- Новата helper функция `commitBioContentToGitHub()` се използва от `handleSaveBioContent` и `handleBioRebake`.
- Командата "update" в контактната форма вече не е задължителна — промените се синхронизират автоматично при запис.

**Резултат:**
- Admin запис → KV + GitHub → deploy → baked HTML
- Няма нужда от ръчно въвеждане на "update" за синхронизиране

**Файлове:** `worker.js`
