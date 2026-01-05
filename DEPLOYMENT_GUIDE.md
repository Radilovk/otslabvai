# Бърз Старт - Деплой на Frontend и Backend

## Стъпки за пълен деплой

### 1. Подготовка

Уверете се, че имате инсталиран `wrangler`:
```bash
npm install -g wrangler
```

### 2. Влизане в Cloudflare

```bash
wrangler login
```

### 3. Качване на статични файлове

Изпълнете един от следните команди:

**С npm:**
```bash
npm run upload-static
```

**Или директно:**
```bash
./upload-static-to-kv.sh
```

Това ще качи следните файлове в KV:
- index.html, index.js, index.css
- admin.html, admin.js, admin.css
- checkout.html
- quest.html, questionnaire.js, questionnaire.css
- config.js

### 4. Деплой на Worker

```bash
npm run deploy
```

### 5. Проверка

Отворете браузър и посетете:
```
https://port.radilov-k.workers.dev/
```

Трябва да видите:
- ✅ Frontend се зарежда
- ✅ Продуктите се показват
- ✅ Всички секции работят

## Какво прави всяка команда?

### `npm run upload-static`
Качва HTML/JS/CSS файловете в Cloudflare KV storage с префикс `static_`.

### `npm run deploy`
Деплойва worker.js на Cloudflare Workers, който:
- Обслужва статичните файлове от KV
- Предоставя API endpoints за продукти и поръчки
- Обработва въпросници и препоръки

## Ако има проблем

1. **Проверете дали сте влезли в Cloudflare:**
   ```bash
   wrangler whoami
   ```

2. **Проверете KV namespaces:**
   ```bash
   wrangler kv:namespace list
   ```

3. **Проверете логовете на worker-а:**
   ```bash
   wrangler tail
   ```

4. **Проверете дали файловете са качени в KV:**
   - Отворете Cloudflare Dashboard
   - Workers & Pages → KV
   - Изберете `PAGE_CONTENT`
   - Търсете ключове започващи с `static_`

## Актуализация на съдържание

### Промяна в HTML/JS/CSS файлове:
1. Редактирайте файловете локално
2. Качете отново в KV: `npm run upload-static`
3. Деплойнете worker-а: `npm run deploy`

### Промяна в продукти:
1. Редактирайте `backend/products.json`
2. Качете в KV:
   ```bash
   wrangler kv:key put --binding=PAGE_CONTENT products --path=backend/products.json
   ```
3. Презаредете frontend-а в браузъра

### Промяна в page_content (настройки, навигация, footer):
1. Редактирайте `backend/page_content.json`
2. Качете в KV:
   ```bash
   wrangler kv:key put --binding=PAGE_CONTENT page_content --path=backend/page_content.json
   ```
3. Презаредете frontend-а в браузъра

## Полезни команди

```bash
# Локално тестване на worker-а
npm start

# Локално тестване на API-то
npm run local

# Деплой на worker-а
npm run deploy

# Качване на статични файлове
npm run upload-static

# Преглед на логове в реално време
wrangler tail
```

## Структура на проекта

```
/
├── index.html          → Frontend (качва се в KV като static_index.html)
├── index.js            → Frontend логика
├── index.css           → Frontend стилове
├── worker.js           → Backend Worker (деплойва се с wrangler)
├── backend/
│   ├── products.json      → Продукти (качва се в KV като products)
│   └── page_content.json  → Настройки и съдържание (качва се в KV като page_content)
└── upload-static-to-kv.sh → Скрипт за качване на статични файлове
```

## Пълен workflow

1. **Първоначален setup:**
   ```bash
   npm install -g wrangler
   wrangler login
   npm run upload-static
   npm run deploy
   ```

2. **При промени във frontend:**
   ```bash
   npm run upload-static
   npm run deploy
   ```

3. **При промени в продукти:**
   ```bash
   wrangler kv:key put --binding=PAGE_CONTENT products --path=backend/products.json
   ```

4. **При промени в настройки/съдържание (page_content):**
   ```bash
   wrangler kv:key put --binding=PAGE_CONTENT page_content --path=backend/page_content.json
   ```

4. **При промени във worker.js:**
   ```bash
   npm run deploy
   ```

Готово! 🎉
