# Changelog

Документация на направените промени по проекта.

---

## [Unreleased]

### Changed
- `worker.js` — **Архитектура "baked HTML"**: радикално икономична към бекенда.
  - Добавена `renderBioHtml(htmlTemplate, bioContent)` — helper функция, която инжектира bio_content в шаблона; може да се извиква и при save и при serve.
  - `handleSaveBioContent()`: при всяко запазване на bio_content чрез bioadmin, Worker вече рендерира финалния HTML (static_bio.html + bio_content) и го записва като `baked_bio.html` в KV — **еднократно, при save**.
  - `serveBioHtml(env, request, ctx)`: чете само `baked_bio.html` (1 KV четене). Ако `baked_bio.html` не съществува (преди първия admin save), пада на fallback: чете и двата KV ключа, рендерира и кешира резултата.
  - `Cache-Control: public, max-age=3600` + ETag → браузърът кешира bio.html за **1 пълен час без нито едно Worker извикване**. Само след изтичане прави If-None-Match заявка (1 KV четене + 304 ако няма промяна).

### Разходи (сравнение)
| Сценарий | Преди (no-cache ETag) | Сега (baked + 1h cache) |
|---|---|---|
| Зареждане в рамките на 1 час | 1 Worker + 2 KV четения | **0 Worker, 0 KV** |
| Зареждане след 1 час без промяна | 1 Worker + 2 KV четения | 1 Worker + **1 KV четене** + 304 |
| Зареждане след admin save | 1 Worker + 2 KV четения + 200 | 1 Worker + **1 KV четене** + 200 |
| Admin save | 1 KV write | 1 KV write + 1 KV read + 1 KV write (async) |

---

## 2026-03-25 (сесия 1)

### Changed
- `worker.js` — `serveBioHtml()`: добавен `request` параметър; добавен ETag (SHA-256 хаш на финалния HTML) и `Cache-Control: no-cache`. Браузърът кешира bio.html локално и при всяко зареждане праща `If-None-Match`; когато съдържанието не е променено Worker връща **304 Not Modified** без тяло. *(Подобрено в следващата сесия — вж. baked HTML по-горе)*

---

## Архитектура (бел. за бъдещи агенти)

### bio.html — как се сервира и обновява

| Компонент | Роля |
|-----------|------|
| `static_bio.html` (KV) | Статичен HTML шаблон, качен при deploy |
| `bio_content` (KV) | JSON с редактираното съдържание, пишe се от bioadmin |
| `baked_bio.html` (KV) | **Финален рендериран HTML** — генерира се при admin save; това е файлът, от който serve-ва Worker |
| `renderBioHtml(template, content)` | Helper: инжектира bio_content в шаблона |
| `serveBioHtml(env, request, ctx)` | Worker функция: чете `baked_bio.html` (1 KV четене), генерира ETag, отговаря 200/304 |
| `handleSaveBioContent()` | Записва bio_content + рендерира и записва baked_bio.html |
| bioadmin | Записва в `/bio_content.json` (POST → `handleSaveBioContent`) |
| bio.html (клиент) | `applyBioContent(window.__bioContent)` прилага данните върху DOM при зареждане |

### Кеширане
- `Cache-Control: public, max-age=3600` — браузърът кешира 1 час без нито едно Backend извикване
- `ETag` — SHA-256 хаш на `baked_bio.html`
- 304 Not Modified — след изтичане на кеша, ако нищо не е сменено (само 1 KV четене)
- 200 — само след реална промяна от admin save

### Static файлове (не bio.html)
- Обслужват се от `serveStaticFile()` с `Cache-Control: public, max-age=3600` + ETag/304

### Останало съдържание
- `page_content` / `life_page_content` — JSON endpoints с `max-age=300, stale-while-revalidate=60`
- `orders` — KV ключ `orders`, CRUD от Worker
