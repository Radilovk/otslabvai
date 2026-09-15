# AEO / GEO — AI видимост за трите домейна

Този проект използва **Cloudflare Worker edge слой** (`seo-aeo-serve.js`) за Answer Engine Optimization (AEO) и Generative Engine Optimization (GEO).

## Какво е имплементирано

| Насока от ръководството | Статус | Къде |
|-------------------------|--------|------|
| `robots.txt` с AI crawlers (2026) | ✅ per-domain | Worker → `/robots.txt` |
| `sitemap.xml` per домейн | ✅ динамичен + продукти | Worker → `/sitemap.xml` |
| `llms.txt` карта за AI | ✅ per-domain | Worker → `/llms.txt` |
| `max-snippet:-1` | ✅ | Edge HTML injection + `_headers` |
| Canonical per hostname | ✅ | Edge injection + FAQ страници |
| JSON-LD Organization | ✅ | Edge injection |
| JSON-LD Product (clean URLs) | ✅ | `/products/{slug}` |
| FAQPage schema | ✅ | `faq.html`, `life-faq.html`, `portfolio-faq.html` |
| Видим HTML каталог (без JS) | ✅ | `llms.txt`, `sitemap.xml`, FAQ страници (не inject в body) |
| IndexNow | ⏳ ръчно / CI secret | виж по-долу |
| Bot Fight Mode изключен | ⚠️ Cloudflare Dashboard | Security → Bots |

## Домейни

| Site ID | Apex | Марка |
|---------|------|-------|
| `main` | daotslabna.com | ДА ОТСЛАБНА |
| `life` | life-protocols.com | Life Protocols |
| `portfolio` | biocode-bg.com | BIOCODE |

## Проверка след deploy

```bash
npm run validate:worker
npm run test:platform-production   # включва AEO checks след deploy
curl -s https://daotslabna.com/robots.txt | head
curl -s https://life-protocols.com/llms.txt | head
curl -s https://biocode-bg.com/sitemap.xml | head
```

## Cloudflare (ръчно)

**Пълен handoff за Cloudflare админ:** [`CLOUDFLARE_AEO_SETUP.md`](./CLOUDFLARE_AEO_SETUP.md)

1. **Bot Fight Mode** — изключете или allowlist за verified bots.
2. **WAF** — няма правило блокиращо `*bot*` User-Agent.
3. **SSL** — Full (strict).

## IndexNow (опционално)

След значим deploy с нови URL, ping към Bing:

```bash
curl -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json" \
  -d '{"host":"daotslabna.com","key":"YOUR_KEY","urlList":["https://daotslabna.com/faq.html"]}'
```

Ключът се съхранява като `{key}.txt` в root или като GitHub secret `INDEXNOW_KEY`.

## Съдържание с най-висок ROI

1. **FAQ страници** — обновявайте въпросите в `faq.html` / `life-faq.html` / `portfolio-faq.html`.
2. **Цени в plain text** — edge каталогът показва EUR цени в HTML таблица.
3. **Entity консистентност** — еднакво име + домейн във видим текст, schema и llms.txt.
