# Changelog

Документация на направените промени по проекта.

---

## [Unreleased]

### Changed
- `worker.js` — `serveBioHtml()`: добавен `request` параметър; добавен ETag (SHA-256 хаш на финалния HTML) и `Cache-Control: no-cache`.  Браузърът кешира bio.html локално и при всяко зареждане праща `If-None-Match`; когато съдържанието не е променено Worker връща **304 Not Modified** без тяло, т.е. страницата се свързва с бекенда, но изтегля пълни данни само когато има реална промяна в `bio_content`.

---

## 2026-03-25

### Fixed
- `worker.js` — `serveBioHtml()`: сменен `Cache-Control: public, max-age=3600` → `no-store`.  **Причина:** Cloudflare CDN кешираше bio.html за 1 час с вградения стар `bio_content`; след запис в bioadmin KV се обновяваше, но CDN продължаваше да сервира старата версия, дори след изчистване на браузър-кеша.  `no-store` осигурява, че всяка заявка минава през Worker и получава свежи данни.

---

## Архитектура (бел. за бъдещи агенти)

### bio.html — как се сервира и обновява

| Компонент | Роля |
|-----------|------|
| `static_bio.html` (KV) | Статичен HTML шаблон, качен при deploy |
| `bio_content` (KV) | JSON с редактираното съдържание, пишe се от bioadmin |
| `serveBioHtml(env, request)` | Worker функция: чете и двете от KV, инжектира `bio_content` като `window.__bioContent` в `<script id="bio-content-injection-point">`, генерира ETag и отговаря с 200/304 |
| bioadmin | Записва в `/bio_content.json` (POST → `handleSaveBioContent`) |
| bio.html (клиент) | `applyBioContent(window.__bioContent)` прилага данните върху DOM при зареждане |

### Кеширане
- `Cache-Control: no-cache` — браузърът кешира, но винаги прави conditional GET
- `ETag` — SHA-256 хаш на финалния HTML (включва `static_bio.html` + `bio_content`)
- 304 Not Modified — връща се когато съдържанието не е сменено (без тяло = бърз отговор)
- 200 — само когато `bio_content` или `static_bio.html` са реално сменени

### Static файлове (не bio.html)
- Обслужват се от `serveStaticFile()` с `Cache-Control: public, max-age=3600` + ETag/304

### Останало съдържание
- `page_content` / `life_page_content` — JSON endpoints с `max-age=300, stale-while-revalidate=60`
- `orders` — KV ключ `orders`, CRUD от Worker
