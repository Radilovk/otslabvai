# GitHub API Token Configuration

## Общо описание

Този функционал позволява съхранение на GitHub Personal Access Token за автоматично използване от админ панела при качване на изображения, вместо да се иска от потребителя всеки път.

## Как работи

1. **API Token се съхранява сигурно**: Токенът може да се съхранява като environment variable (препоръчително) или в KV хранилището
2. **Admin панелът извлича токена**: При опит за качване на изображение, `admin.js` първо проверява sessionStorage, след това извлича от backend API
3. **Fallback на prompt**: Ако токенът не е конфигуриран или е невалиден, потребителят може да го въведе ръчно

## Стъпки за конфигуриране

### 1. Генериране на GitHub Personal Access Token

1. Отидете на GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Кликнете "Generate new token (classic)"
3. Дайте име на токена (например: "otslabvai-image-upload")
4. Изберете scope: **`repo`** (пълен достъп до repositories)
5. Генерирайте токена и копирайте го
6. **ВАЖНО**: Запазете токена на сигурно място - не може да бъде видян отново

### 2. Задаване на токена

Има два начина да зададете токена:

#### Опция А: Environment Variable (Препоръчително - по-сигурно)

Задайте токена като Cloudflare Workers secret:

```bash
wrangler secret put GITHUB_API_TOKEN
```

След това въведете токена когато бъдете подканени.

**Предимства:**
- По-високо ниво на сигурност (secrets са криптирани)
- Не се съхранява в KV (който е достъпен през API)
- Автоматично се инжектира в worker environment

#### Опция Б: KV Storage (За разработка/тестване)

**Метод 1**: Използване на скрипта
```bash
./set-api-token.sh
```

Скриптът включва валидация на token формата и безопасно въвеждане.

**Метод 2**: Директно с wrangler
```bash
echo "your_github_token_here" | wrangler kv:key put --binding="PAGE_CONTENT" "api_token" --path=-
```

**Забележка**: При използване на KV, endpoint-ът `/api-token` трябва да бъде защитен с Cloudflare Access или подобен механизъм, за да се предотврати неоторизиран достъп.

### 3. Проверка

След като сте задали токена:
1. Отворете админ панела (`/admin.html`)
2. Отидете на "Съдържание" таб
3. Редактирайте продукт и опитайте да качите изображение
4. Изображението трябва да се качи **без да ви се иска токен**

## API Документация

### GET /api-token

Връща съхранения GitHub API token.

**Priority:** 
1. Environment variable `GITHUB_API_TOKEN` (most secure)
2. KV storage `api_token` (fallback)

**Response:**
```json
{
  "api_token": "ghp_YourTokenHere..." или null
}
```

## Промени в кода

### worker.js
- Добавен нов endpoint `/api-token` за извличане на токена
- Функция `handleGetApiToken()` с двоен fallback:
  1. Първо проверява environment variable `GITHUB_API_TOKEN`
  2. При липса, проверява KV storage `api_token`

### admin.js
- Актуализирана функция `uploadImageToGitHub()`:
  1. Проверява sessionStorage
  2. Ако няма токен там, извлича от backend API
  3. Кеширва токена в sessionStorage
  4. Fallback на prompt ако не е налице

### set-api-token.sh (НОВ)
- Скрипт за лесно задаване на токена в KV
- Валидация на token формат (ghp_ или github_pat_ prefix)

## Сигурност

### Препоръки за Production

**Използвайте Environment Variables (Workers Secrets):**
- По-високо ниво на сигурност (криптирани secrets)
- Не са достъпни през публични API endpoints
- Автоматично се инжектират в worker environment
- Командa: `wrangler secret put GITHUB_API_TOKEN`

### За Development/Testing (KV Storage)

Ако използвате KV storage за съхранение на токена:
- **ЗАДЪЛЖИТЕЛНО**: Защитете `/api-token` endpoint с Cloudflare Access или подобен механизъм
- Токенът е достъпен през API endpoint без authentication
- Подходящо само за вътрешна употреба или зад authentication слой

### Общи мерки за сигурност

- sessionStorage кеширане намалява API заявките
- При невалиден токен (401/403 грешка), sessionStorage се изчиства автоматично
- Token се връща само през backend API (не е видим директно в frontend кода)
- Валидация на token формат в set-api-token.sh скрипта

## Съвети за използване

1. **Използвайте Secrets за Production**: Винаги използвайте `wrangler secret put` за production environment
2. **Редовна ротация**: Сменяйте токена периодично за по-добра сигурност
3. **Минимални права**: Използвайте токен само с `repo` права, без допълнителни scopes
4. **Monitoring**: Проверявайте GitHub audit log за неочаквана активност
5. **Backup**: Запазете токена на сигурно място (password manager)
6. **Access Control**: Ако използвате KV storage, конфигурирайте Cloudflare Access за админ панела

## Troubleshooting

### Токенът не работи
- Проверете дали токенът има `repo` permissions
- Проверете дали токенът не е изтекъл
- Опитайте да го зададете отново с `./set-api-token.sh`

### Все още се иска токен
- Изчистете sessionStorage в браузъра (Developer Tools → Application → Session Storage)
- Презаредете страницата
- Проверете дали токенът е правилно записан в KV:
  ```bash
  wrangler kv:key get --binding="PAGE_CONTENT" "api_token"
  ```

### API грешка 401/403
- Токенът е невалиден или е изтекъл
- Генерирайте нов токен и го задайте отново
