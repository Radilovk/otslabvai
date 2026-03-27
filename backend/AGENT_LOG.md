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
  - `GET/POST /bio_content.json` — bio страница съдържание (KV: `bio_content`)
  - `POST /bio_rebake` — no-op, запазен за съвместимост

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

---

## Хронология на промените

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

## Правила за бъдещи агенти

1. **НЕ добавяй HTML файлове в KV.** HTML е в GitHub и се сервира от Cloudflare Assets.
2. **НЕ добавяй `serveStaticFile()` или подобни функции в worker.js.** Worker е само API.
3. **НЕ добавяй нови routes без да провериш дали вече съществуват.**
4. **Актуализирай AGENT_LOG.md** след всяка значима промяна.
5. Когато поправяш грешка, провери дали не е симптом на по-голям проблем.
6. Преди да промениш архитектурата, прочети целия `worker.js` и `wrangler.toml`.

---

## Чести грешки (от предишни агенти)

| Грешка | Защо е грешна | Правилното |
|--------|--------------|------------|
| Добавяне на `baked_bio.html` в KV | HTML не трябва в KV | Bio данните са само JSON в `bio_content` |
| `serveBioHtml()` в worker | Worker не сервира HTML | Cloudflare Assets сервира bio.html |
| `STATIC_FILES` map в worker | Static файлове не са в KV | Cloudflare Assets |
| Качване на bio.html в KV | HTML не е в KV | bio.html е като asset |
| `console.error` за 404 на `/` | Не е реална грешка | Бот/браузър удря API URL директно |
