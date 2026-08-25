# AEO / GEO Playbook — 4 сайта

Дата: 25.08.2026  
Домейни: `daotslabna.com`, `life-protocols.com`, `biocode-bg.com`, `biocode-peptides.com`

---

## Какво вече е внедрено в кода

| Компонент | Какво прави |
|-----------|-------------|
| `seo-inject.js` | JSON-LD, HTML каталог, robots/sitemap/llms генератори |
| `seo-data.js` | Зарежда продукти от KV (main/life/portfolio) и статичен peptides каталог |
| `seo-serve.js` | Edge маршрути: `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/products/<slug>` |
| `hostname-routing.js` | 4-ти сайт peptides + SEO инжекция на началните страници |
| `seo-hydration.js` | Премахва `#seo-catalog` след JS; поддръжка на clean URLs |
| 301 redirects | `product.html?id=X` → `/products/<slug>` (и life/portfolio аналози) |
| EUR schema | Product JSON-LD вече е `priceCurrency: EUR` (main + life) |

**Резултат за AI ботовете:** при `curl` без JS виждат пълен HTML каталог, цени, Product/ItemList schema, канонични URL.

---

## Твоите стъпки (задължителни)

### 1. Cloudflare — 30 мин, най-висок ROI

За **всеки** от 4-те домейна в Cloudflare Dashboard:

1. **AI Crawl Control** → Allow: `GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`
2. **Security → Bots** → **Bot Fight Mode: OFF** (на free план чупи crawler-и)
3. **SSL/TLS** → **Full (strict)** (не Flexible)
4. Включи **Crawler Hints / IndexNow** ако е налично
5. Провери WAF custom rules — няма ли блок по user-agent

> От 15.09.2026 Cloudflare блокира mixed-use AI crawler-и по подразбиране на free план. Ако домейнът е нов — override-ни ръчно.

### 2. Namecheap DNS

- Nameservers → Cloudflare
- Записите са **proxied** (оранжев облак)
- Добави `biocode-peptides.com` и `www` към Cloudflare (в `wrangler.toml` вече са добавени routes)

### 3. Deploy

```bash
npm run deploy
# или push към main / cursor branch → GitHub Actions
```

### 4. Проверка след deploy (копирай и пусни)

```bash
# Достъп
for d in daotslabna.com life-protocols.com biocode-bg.com biocode-peptides.com; do
  echo "=== $d ==="
  curl -sI -A "GPTBot/1.1" "https://$d/" | head -1
done

# Извличаемост (трябва килобайти, не стотици байта)
curl -s -A "GPTBot/1.1" https://daotslabna.com/ | wc -c
curl -s -A "GPTBot/1.1" https://daotslabna.com/ | grep -c "EUR"

# Продуктов URL
curl -s -A "GPTBot/1.1" https://daotslabna.com/products/lida-green | grep -c "application/ld+json"

# robots + sitemap + llms
curl -s https://biocode-peptides.com/robots.txt | head -5
curl -s https://biocode-peptides.com/sitemap.xml | head -10
curl -s https://biocode-peptides.com/llms.txt | head -15
```

### 5. Bing Webmaster Tools (по-важно от Google за ChatGPT)

1. https://www.bing.com/webmasters → добави **всеки** домейн
2. Подай `https://<домейн>/sitemap.xml`
3. URL Inspection за един `/products/<slug>`

### 6. Google Search Console

- Същите sitemap-и
- Провери Rich Results за Product schema

---

## План за агресивно цитиране от AI (фаза 2–3)

Техниката те прави **четим**. Цитирането идва от **уникални данни + външни сигнали**.

### Седмица 1–2: Базова линия

Запиши отговорите на тези 20 въпроса в ChatGPT, Perplexity, Gemini **преди** индексация:

1. Кои са най-добрите продукти за отслабване в България?
2. Lida Green цена и откъде да купя?
3. Какви anti-aging добавки препоръчвате за 40+?
4. CoQ10 при статини — кой продукт?
5. Протеин isolate България доставка
6. BPC-157 research peptide purity verification
7. BioCode peptides Cambridge manufacturer
8. … (допълни с реални клиентски въпроси)

Повтаряй **месечно** със същите въпроси — само така виждаш ефект.

### Седмица 2–4: Уникално съдържание (най-силен сигнал)

Създай **сравнителни страници със собствени данни** — не „топ 5“, а таблици:

| Страница | Пример | Сайт |
|----------|--------|------|
| Ценова матрица | Всички продукти × цена EUR × състав × наличност | daotslabna.com |
| Longevity stack сравнение | NAD+ vs CoQ10 vs Collagen по цена/доза | life-protocols.com |
| Протеин €/г сравнение | 50+ SKU с изчислена цена на грам | biocode-bg.com |
| Peptide purity matrix | 12 пептида × HPLC % × COA статус | biocode-peptides.com |

Формат за AI:

- H2 = въпрос („Кой е най-евтиният whey isolate в България?“)
- Първите 40 думи = директен отговор с число
- Таблица под тях
- Видима дата „Обновено: …“

### Месец 2+: Външно потвърждение

1. **Форуми/Reddit/Quora** — отговори по същество с линк към сравнителната таблица (не реклама)
2. **Директории** — български health/e-commerce каталози
3. **LinkedIn** — публикувай data insights от ценовите матрици
4. **Пресичащи линкове** — всеки сайт в footer „Част от BioCode мрежата“ с линкове към останалите 3

### Месец 3+: Автоматизация

- Cloudflare Analytics → bot user-agent breakdown (GPTBot, ClaudeBot) — седмично
- Referrer трафик от `chatgpt.com`, `perplexity.ai` — месечно
- При промяна на каталог → IndexNow ping (Cloudflare Crawler Hints)

---

## Мрежова идентичност (4 сайта = 1 граф)

Всички сайтове вече споделят `sameAs` в JSON-LD:

- daotslabna.com
- life-protocols.com
- biocode-bg.com
- biocode-peptides.com
- github.com/Radilovk/otslabvai

**Твоята задача:** добави реални социални профили (Facebook, Instagram, LinkedIn) в `BRAND_NETWORK.sameAs` в `seo-inject.js` когато ги имаш.

---

## Какво НЕ очаквай

| Мит | Реалност |
|-----|----------|
| llms.txt = магия | Ефектът е близък до нула; генерираме го „за всеки случай“ |
| Само техническа SEO | Без уникални данни и външни споменавания AI няма защо да те цитира |
| Резултат за 48 часа | Индексация 1–4 седмици; цитиране 1–3 месеца при активна фаза 3 |
| Агресивно = spam | AI системите наказват маркетингов spam; печелят таблици с реални данни |

---

## Метрики за успех

| Метрика | Цел (3 месеца) | Източник |
|---------|----------------|----------|
| GPTBot заявки/седмица | >50/домейн | Cloudflare Analytics |
| Индексирани /products/* URL | >80% от каталога | Bing WMT + GSC |
| Цитирания в 20-те тестови въпроса | ≥3 домейна споменати | Ръчен тест |
| Referral от AI | Първи кликове | Analytics |

---

## Поддръжка

- При нов продукт в admin → автоматично влиза в sitemap при следваща заявка (динамичен от KV)
- При нов peptide → редактирай `peptides-catalog.js`
- След deploy винаги пусни `curl` тестовете от §4
