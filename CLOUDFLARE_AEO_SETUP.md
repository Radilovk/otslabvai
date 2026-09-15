# Cloudflare — актуални предписания (AEO/GEO + multi-domain)

**Версия:** 2026-03-24  
**Repo:** `Radilovk/otslabvai`  
**Worker:** `port`  
**Deploy:** GitHub Actions → `.github/workflows/deploy.yml` (Wrangler **4+**)

Този файл е единствен източник на истина за Cloudflare настройки.  
Кодът (robots, sitemap, llms, schema, routing) идва от Worker след deploy — **не се дублира ръчно в Dashboard**.

---

## 1. Архитектура (какво управлява Cloudflare)

```
GitHub (push main / cursor/*)
    → GitHub Actions (npm ci, validate:worker, wrangler deploy)
        → Cloudflare Worker "port"
            → KV: ORDERS, PAGE_CONTENT
            → Assets binding ASSETS (run_worker_first = true)
            → Routes на 3 домейна
```

| Домейн | Site ID | Марка | Apex URL |
|--------|---------|-------|----------|
| `daotslabna.com` | `main` | ДА ОТСЛАБНА | https://daotslabna.com/ |
| `life-protocols.com` | `life` | Life Protocols | https://life-protocols.com/ |
| `biocode-bg.com` | `portfolio` | BIOCODE | https://biocode-bg.com/ |

---

## 2. Worker `port` — задължителни стойности

**Dashboard:** Workers & Pages → **port** → Settings

### 2.1 Entry point и assets

| Параметър | Точна стойност | Файл |
|-----------|----------------|------|
| Main module | `worker.js` | `wrangler.toml` → `main` |
| Assets directory | `.` (repo root) | `wrangler.toml` → `[assets] directory` |
| Assets binding | `ASSETS` | `wrangler.toml` → `binding` |
| **run_worker_first** | **`true`** | `wrangler.toml` — **задължително** |

> **Критично:** При `run_worker_first = false` (asset-first / `serve_directly: true`) Cloudflare сервира `index.html` **преди** Worker-а. Резултат: всички домейни показват main сайта; `/robots.txt` и AEO не минават през Worker.

> **Wrangler 3** тихо игнорира `run_worker_first`. Deploy **само** с Wrangler 4+ (`wranglerVersion: "4"` в CI).

### 2.2 KV namespaces (binding names и IDs)

| Binding | Namespace ID | Preview ID |
|---------|--------------|------------|
| `ORDERS` | `b2891ffe523048ae87cf9c4549d6ab49` | `b2891ffe523048ae87cf9c4549d6ab49` |
| `PAGE_CONTENT` | `d220db696e414b7cb3da2b19abd53d0f` | `d220db696e414b7cb3da2b19abd53d0f` |

**Dashboard:** Workers & Pages → port → Settings → Bindings → проверете, че двата KV binding-а са активни.

### 2.3 Worker secrets (Wrangler / Dashboard → Secrets)

| Secret | Задължително | Бележка |
|--------|--------------|---------|
| `ADMIN_PASSWORD` | Да (admin) | GitHub secret → CI `wrangler secret put` |
| `FITNESS1_API_KEY` | За portfolio catalog sync | Worker secret + KV `fitness1_api_key` |
| `SILA_API_TOKEN` | За portfolio catalog sync | Worker secret + KV `sila_api_token` |

Допълнителни API ключове (AI) се пазят в KV (`ai_openai_api_key`, `ai_google_api_key`) — виж deploy workflow.

### 2.4 Routes / Custom Domains (Wrangler замества пълния списък при deploy)

**Dashboard:** Workers & Pages → port → Settings → **Domains & Routes**

| Pattern | Тип | Zone |
|---------|-----|------|
| `daotslabna.com` | Custom Domain | — |
| `www.daotslabna.com` | Custom Domain | — |
| `biocode-bg.com` | Custom Domain | — |
| `www.biocode-bg.com` | Custom Domain | — |
| `life-protocols.com/*` | Route | `life-protocols.com` |
| `www.life-protocols.com/*` | Route | `life-protocols.com` |

**Не добавяйте** отделен Worker или Pages project за същите домейни — конфликт на routing.

**Не трийте** routes ръчно без да обновите `wrangler.toml` — следващият deploy ги възстановява.

---

## 3. DNS — три зони

Повтаря се за **всяка** zone: `daotslabna.com`, `life-protocols.com`, `biocode-bg.com`.

**Dashboard:** съответна zone → **DNS → Records**

| Запис | Proxy | Изискване |
|-------|-------|-----------|
| Apex `@` | 🟠 **Proxied** | Трафик през Cloudflare → Worker |
| `www` | 🟠 **Proxied** | Същото |

Custom domains за `daotslabna.com` / `biocode-bg.com` се управляват от Wrangler (`custom_domain = true`).  
Проверете в DNS, че няма „DNS only“ (сив облак) на apex/www за storefront трафик.

---

## 4. Security — задължително за AI crawl (AEO/GEO)

**Прилагайте на и трите зони.**

### 4.1 Bot Fight Mode → **OFF**

**Път:** Security → **Bots** → Bot Fight Mode → **Off**

| Ако е ON | Ефект |
|----------|-------|
| Cloudflare връща **403** на AI bots | `OAI-SearchBot`, `GPTBot`, `PerplexityBot`, `Claude-SearchBot` — **нулева AI видимост** въпреки правилен `robots.txt` |

### 4.2 WAF custom rules — без блокиране на bots

**Път:** Security → **WAF** → Custom rules

**Проверете и премахнете/изключете** правила като:
- `http.user_agent contains "bot"` → Block / Managed Challenge
- `http.user_agent contains "GPTBot"` → Block
- Generic „block likely bots“ без изключение за verified crawlers

**Позволено:** правила за `/admin.html`, `/api/`, rate limit на POST — **не** глобален bot block на `/`.

### 4.3 SSL/TLS → **Full (strict)**

**Път:** SSL/TLS → Overview → **Full (strict)**

### 4.4 Page Rules / Cache Rules

**Не задавайте** „Cache Everything“ на `/*` без изключения за HTML/API.

След deploy при stale отговори:
**Caching → Configuration → Purge Cache → Purge Everything**  
(или Purge by URL: `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/`)

---

## 5. Какво Worker-ът обслужва (не дублирайте в Dashboard)

След deploy + `run_worker_first = true`, за **всеки** от трите домейна:

| URL | Източник | Cache-Control (Worker) |
|-----|----------|------------------------|
| `/robots.txt` | `seo-aeo-serve.js` | `public, max-age=3600` |
| `/sitemap.xml` | `seo-aeo-serve.js` | `public, max-age=3600` |
| `/llms.txt` | `seo-aeo-serve.js` | `public, max-age=3600` |
| `/products/{slug}` | `seo-aeo-serve.js` | `max-age=300, stale-while-revalidate=60` |
| HTML storefront | `hostname-routing.js` + AEO inject | `max-age=300` (+ product OG) |

### 5.1 Очаквано съдържание на `/robots.txt` (пример daotslabna.com)

```txt
# AI search optimized — 2026
User-agent: OAI-SearchBot
Allow: /
...
User-agent: CCBot
Disallow: /

Sitemap: https://daotslabna.com/sitemap.xml
```

**Life / portfolio:** `Sitemap:` трябва да сочи към **същия** apex (`life-protocols.com`, `biocode-bg.com`), не към `daotslabna.com`.

### 5.2 HTTP headers от Worker (indexable HTML)

```
X-Robots-Tag: index, follow, max-snippet:-1
```

Страници с `noindex` (checkout, order-success) **не** получават този header.

### 5.3 Статичен `robots.txt` в repo root

Файлът в repo е legacy fallback. **Живият** robots идва от Worker.  
Ако виждате само Cloudflare `Content-Signal` без AI bots → Worker **не** работи първи (виж §7).

---

## 6. Deploy процедура

### 6.1 Автоматичен (production)

1. Merge в `main` (или push към `cursor/**` за preview deploy).
2. GitHub Actions: **Deploy to Cloudflare Workers**
3. CI проверява:
   - `run_worker_first = true` в `wrangler.toml`
   - Wrangler major version = **4**
   - `npm run validate:worker` (317+ теста)
4. `cloudflare/wrangler-action@v3` с `wranglerVersion: "4"`
5. Secrets sync (ADMIN_PASSWORD, FITNESS1, SILA)
6. KV sync (page content, portfolio catalog, bio)

### 6.2 Ръчен deploy (само при emergency)

```bash
npm ci
npm run validate:worker
npx wrangler deploy   # изисква CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
```

**Забранено:** paste на `worker.js` alone в Cloudflare Dashboard Quick Edit.

### 6.3 GitHub secrets (минимум за deploy)

| Secret | Употреба |
|--------|----------|
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy + KV API |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID |
| `ADMIN_PASSWORD` | Admin login |
| `FITNESS1_API_KEY` | Portfolio import (optional но нужен за catalog) |
| `SILA_API_TOKEN` | Portfolio import (optional) |

API token permissions: **Account → Workers Scripts → Edit**, **Account → Workers KV Storage → Edit**, **Zone → DNS → Edit** (за custom domains).

---

## 7. Верификация след deploy

### 7.1 Бързи curl проверки

```bash
# robots — трябва OAI-SearchBot + правилен Sitemap
curl -s https://daotslabna.com/robots.txt | grep -E 'OAI-SearchBot|Sitemap'
curl -s https://life-protocols.com/robots.txt | grep Sitemap
curl -s https://biocode-bg.com/robots.txt | grep Sitemap

# llms.txt — HTTP 200
curl -sI https://daotslabna.com/llms.txt | head -1
curl -s https://life-protocols.com/llms.txt | head -5

# multi-domain routing
curl -s https://life-protocols.com/ | grep -o '<title[^>]*>[^<]*</title>'
curl -s https://biocode-bg.com/ | grep -o '<title[^>]*>[^<]*</title>'
```

**PASS примери:**

| URL | Очаквано |
|-----|----------|
| `daotslabna.com/robots.txt` | `OAI-SearchBot`, `Sitemap: https://daotslabna.com/sitemap.xml` |
| `life-protocols.com/` | title съдържа `Life Protocols`, **без** `ДА ОТСЛАБНА - Мисията` |
| `biocode-bg.com/faq.html` | title съдържа `BIOCODE` |
| `*/llms.txt` | HTTP/2 200 |

### 7.2 Пълен автоматичен smoke (от repo)

```bash
npm run test:platform-production
```

Включва **9 AEO проверки** (robots / sitemap / llms × 3 домейна) + HTML routing + API.

---

## 8. IndexNow (опционално — Bing / ChatGPT Search corpus)

1. Генерирайте ключ (32 hex chars), напр. `a1b2c3d4e5f6789012345678901234ab`
2. Добавете файл `{key}.txt` в repo root със съдържание **само ключа** → deploy
3. Ping след deploy:

```bash
curl -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "daotslabna.com",
    "key": "a1b2c3d4e5f6789012345678901234ab",
    "keyLocation": "https://daotslabna.com/a1b2c3d4e5f6789012345678901234ab.txt",
    "urlList": [
      "https://daotslabna.com/",
      "https://daotslabna.com/faq.html",
      "https://daotslabna.com/sitemap.xml"
    ]
  }'
```

Повторете с `host` / URLs за `life-protocols.com` и `biocode-bg.com`.

---

## 9. Чеклист (Cloudflare админ)

```
[ ] Worker "port" — run_worker_first = true (Wrangler 4 deploy)
[ ] KV bindings ORDERS + PAGE_CONTENT активни
[ ] Routes: 4 custom domains + 2 life-protocols zone routes
[ ] DNS apex + www — Proxied (🟠) — и трите зони
[ ] Bot Fight Mode OFF — и трите зони
[ ] WAF — няма global bot block
[ ] SSL Full (strict) — и трите зони
[ ] Deploy SUCCESS (GitHub Actions)
[ ] curl robots.txt → OAI-SearchBot + correct Sitemap per domain
[ ] npm run test:platform-production → PASS
[ ] (optional) IndexNow ping
```

---

## 10. Troubleshooting

| Симптом | Причина | Действие |
|---------|---------|----------|
| Всички домейни → main homepage | Asset-first / Wrangler 3 | Проверете CI log; `wrangler.toml` + Wrangler 4 |
| `robots.txt` без AI bots | Static asset served directly | `run_worker_first=true`; Purge cache |
| HTTP 403 от bot User-Agent | Bot Fight Mode / WAF | §4.1, §4.2 |
| `llms.txt` 404 | Стар deploy без AEO PR | Redeploy от `main` |
| life canonical → daotslabna.com | Стар HTML cache | Purge + deploy с AEO edge layer |
| Deploy warning `Unexpected fields: run_worker_first` | Wrangler 3 | Upgrade to Wrangler 4 in CI |

---

## 11. Свързани файлове в repo

| Файл | Роля |
|------|------|
| `wrangler.toml` | Worker name, assets, KV, routes |
| `worker.js` | Main router (+ `handleSeoRequest`) |
| `seo-aeo-serve.js` | robots, sitemap, llms, product URLs, HTML inject |
| `hostname-routing.js` | Multi-domain path mapping |
| `AEO_GEO_PLAYBOOK.md` | AEO съдържание и marketing ROI |
| `.github/workflows/deploy.yml` | CI deploy + KV sync |

---

*Последна актуализация: AEO/GEO edge layer (PR #503). При промяна на routes/KV IDs — обновете този файл и `wrangler.toml` заедно.*
