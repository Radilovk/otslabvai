# Инструкции за поправка на проблема с липсващия frontend

## Проблем
Backend worker-ът на Cloudflare връща грешка "Not Found" защото **не обслужва статичните HTML/JS/CSS файлове**. Worker-ът е конфигуриран само за API endpoints (`/page_content.json`, `/quest-submit`, `/orders`), но не и за frontend файловете.

## Решение
Добавихме функционалност в `worker.js` за обслужване на статичните файлове от Cloudflare KV storage. Сега трябва да качите файловете в KV и да деплойнете worker-а.

## Стъпки за поправка

### Вариант 1: Използвайте bash скрипта (Препоръчително)

1. **Инсталирайте wrangler** (ако не е инсталиран):
   ```bash
   npm install -g wrangler
   ```

2. **Влезте в Cloudflare акаунта си**:
   ```bash
   wrangler login
   ```

3. **Качете статичните файлове в KV**:
   ```bash
   ./upload-static-to-kv.sh
   ```

4. **Деплойнете worker-а**:
   ```bash
   npm run deploy
   ```

5. **Посетете вашия worker URL**: `https://port.radilov-k.workers.dev/`

### Вариант 2: Използвайте Node.js скрипта

Ако не искате да използвате wrangler CLI, можете да качите файловете чрез Cloudflare API:

1. **Задайте environment variables**:
   ```bash
   export CLOUDFLARE_ACCOUNT_ID="your-account-id"
   export CLOUDFLARE_API_TOKEN="your-api-token"
   ```

2. **Стартирайте скрипта**:
   ```bash
   node upload-static-files.js
   ```

3. **Деплойнете worker-а**:
   ```bash
   npm run deploy
   ```

### Вариант 3: Ръчно качване чрез Cloudflare Dashboard

1. Отворете **Cloudflare Dashboard** → **Workers & Pages** → **KV**
2. Изберете namespace `PAGE_CONTENT`
3. Качете всеки файл с ключ във формат `static_filename`:
   - `static_index.html` → съдържанието на `index.html`
   - `static_index.js` → съдържанието на `index.js`
   - `static_index.css` → съдържанието на `index.css`
   - `static_config.js` → съдържанието на `config.js`
   - `static_admin.html` → съдържанието на `admin.html`
   - `static_admin.js` → съдържанието на `admin.js`
   - `static_admin.css` → съдържанието на `admin.css`
   - `static_checkout.html` → съдържанието на `checkout.html`
   - `static_quest.html` → съдържанието на `quest.html`
   - `static_questionnaire.js` → съдържанието на `questionnaire.js`
   - `static_questionnaire.css` → съдържанието на `questionnaire.css`

4. Деплойнете worker-а чрез Dashboard или:
   ```bash
   npm run deploy
   ```

## Проверка на резултата

След деплоя на worker-а:

1. **Отворете** `https://port.radilov-k.workers.dev/` в браузъра
2. **Трябва да видите** frontend-а с всички продукти
3. **Проверете** дали продуктите се зареждат от backend-а

## Какво беше променено

### 1. `worker.js`
- Добавени routes за всички статични файлове (`/`, `/index.html`, `/index.js`, etc.)
- Добавена функция `serveStaticFile()` за четене от KV
- Файловете се съхраняват в KV с префикс `static_`

### 2. Нови скриптове
- `upload-static-to-kv.sh` - Bash скрипт за качване чрез wrangler CLI
- `upload-static-files.js` - Node.js скрипт за качване чрез Cloudflare API

## Важно!

- Продуктите вече са актуализирани в backend-а (в `page_content` KV key)
- След качване на статичните файлове, frontend-ът автоматично ще ги зареди
- При промени в HTML/JS/CSS файловете, трябва да ги качите отново в KV

## Алтернатива: GitHub Pages

Ако не искате да качвате статичните файлове в KV, можете да:

1. Хоствате статичните файлове на GitHub Pages
2. Оставете worker-а само за API endpoints
3. Уверете се, че `config.js` сочи към правилния API URL

За повече информация, вижте `README.md`.
