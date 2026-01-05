# Консолидация на продуктите - Обобщение

## Цел
Направихме `backend/products.json` **единственото място** за съхранение на продуктите. Премахнахме дублирането на продукти в различни KV ключове.

## Направени промени

### 1. Backend структура
- ✅ `backend/products.json` - единствен източник на продукти (9 продукта в 2 категории)
- ✅ `backend/page_content.json` - съдържа настройки, навигация, footer, но БЕЗ продукти

### 2. Worker API (worker.js)
- ✅ Нов endpoint: `GET /products` - връща продуктите от KV ключ 'products'
- ✅ Нов endpoint: `POST /products` - записва продукти в KV ключ 'products'
- ✅ AI логиката чете продукти от 'products' вместо от 'page_content'

### 3. Frontend (index.js)
- ✅ Зарежда продукти от `/products` endpoint
- ✅ Обединява продуктите с категории от page_content.json при рендиране
- ✅ Работи правилно когато продуктите идват от отделен endpoint

### 4. Детайлна страница (product.js)
- ✅ Зарежда продукти от `/products` endpoint
- ✅ Търси конкретен продукт по ID в продуктовите категории

### 5. Админ панел (admin.js)
- ✅ Зарежда продукти отделно от `/products`
- ✅ Записва продукти отделно чрез `POST /products`
- ✅ При редакция на product_category - зарежда продукти от productsData
- ✅ При добавяне на product_category - създава запис в productsData

### 6. Deployment
- ✅ Нов скрипт: `upload-backend-to-kv.sh` за качване на backend файлове
- ✅ Нова команда: `npm run upload-backend`
- ✅ Обновена документация: DEPLOYMENT_GUIDE.md, DEPLOYMENT_CHECKLIST.md
- ✅ Добавена документация: backend/README.md

## Как работи

### Зареждане на данни:
1. Frontend прави 2 заявки:
   - `GET /page_content.json` - настройки, навигация, структура на страницата
   - `GET /products` - всички продукти

2. Frontend обединява данните:
   - Категориите от page_content.json имат празни `products` масиви
   - Продуктите от `/products` се съпоставят по `id` на категорията
   - Резултатът е пълна страница с продукти

### Запазване на данни (от админ панела):
1. При промяна на настройки/съдържание - `POST /page_content.json`
2. При промяна на продукти - `POST /products`
3. И двете се записват в KV под различни ключове

## Команди за deployment

### Качване на backend файлове в KV:
```bash
# Автоматично - качва и двата файла
npm run upload-backend

# Ръчно - само продукти
wrangler kv:key put --binding=PAGE_CONTENT products --path=backend/products.json

# Ръчно - само page_content
wrangler kv:key put --binding=PAGE_CONTENT page_content --path=backend/page_content.json
```

### Пълен deployment:
```bash
# 1. Качване на статични файлове
npm run upload-static

# 2. Качване на backend файлове
npm run upload-backend

# 3. Deployment на worker
npm run deploy
```

## Структура на KV ключовете

След промените:

```
KV Namespace: PAGE_CONTENT
├── products            -> backend/products.json (9 продукта)
├── page_content        -> backend/page_content.json (настройки, без продукти)
├── static_index.html   -> index.html
├── static_index.js     -> index.js
├── static_index.css    -> index.css
├── ... (други статични файлове)
├── orders              -> Поръчки
├── contacts            -> Контакти
└── bot_prompt          -> AI prompt
```

## Проверка

Всичко е валидирано:
- ✅ JavaScript файлове - синтаксис OK
- ✅ JSON файлове - валиден формат
- ✅ products.json - 9 продукта в 2 категории
- ✅ page_content.json - 0 продукта (само структура на категории)

## Следващи стъпки за deployment

1. **Качване на backend файлове в KV:**
   ```bash
   npm run upload-backend
   ```

2. **Deployment на worker:**
   ```bash
   npm run deploy
   ```

3. **Тестване:**
   - Отворете https://port.radilov-k.workers.dev/
   - Проверете че продуктите се зареждат
   - Проверете `/products` endpoint
   - Проверете админ панела

## Бележки

- Промените са **обратно несъвместими** - трябва да се качи products.json в KV
- Без `products` ключ в KV, frontend няма да покаже продукти
- Admin панелът също няма да работи без products ключ
- След deployment, препоръчително е да се тества всичко внимателно

## Проблеми, които решихме

1. ❌ **Преди:** Продуктите бяха дублирани в page_content.json
2. ❌ **Преди:** Големият размер на page_content.json (1236 линии)
3. ❌ **Преди:** Трудна поддръжка - промени в продукти изискваха редакция на целия page_content

4. ✅ **Сега:** Продуктите са само в products.json
5. ✅ **Сега:** page_content.json е малък (133 линии)
6. ✅ **Сега:** Лесна поддръжка - редакция на продукти е независима от съдържанието
