// ==== ВЕРСИЯ 4.0: ФУНКЦИОНАЛЕН АДМИН ПАНЕЛ ====

// Cache configuration constants
const CACHE_CONFIG = {
    PAGE_CONTENT_MAX_AGE: 300,        // 5 minutes
    PAGE_CONTENT_STALE_WHILE_REVALIDATE: 60,  // 1 minute
    STATIC_FILE_MAX_AGE: 3600         // 1 hour
};

class UserFacingError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'UserFacingError';
    this.status = status || 500;
  }
}

// --- ОСНОВЕН РУТЕР И ОБРАБОТКА НА ЗАЯВКИ ---

export default {
  /**
   * @param {Request} request
   * @param {object} env
   * @param {object} ctx
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', // Добавяме PUT
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    
    // Content type constants
    const CONTENT_TYPES = {
      html: 'text/html; charset=utf-8',
      js: 'application/javascript; charset=utf-8',
      css: 'text/css; charset=utf-8'
    };
    
    // Static file configuration
    const STATIC_FILES = {
      '/': { file: 'index.html', type: CONTENT_TYPES.html },
      '/index.html': { file: 'index.html', type: CONTENT_TYPES.html },
      '/index.js': { file: 'index.js', type: CONTENT_TYPES.js },
      '/index.css': { file: 'index.css', type: CONTENT_TYPES.css },
      '/config.js': { file: 'config.js', type: CONTENT_TYPES.js },
      '/admin.html': { file: 'admin.html', type: CONTENT_TYPES.html },
      '/admin.js': { file: 'admin.js', type: CONTENT_TYPES.js },
      '/admin.css': { file: 'admin.css', type: CONTENT_TYPES.css },
      '/checkout.html': { file: 'checkout.html', type: CONTENT_TYPES.html },
      '/quest.html': { file: 'quest.html', type: CONTENT_TYPES.html },
      '/questionnaire.js': { file: 'questionnaire.js', type: CONTENT_TYPES.js },
      '/questionnaire.css': { file: 'questionnaire.css', type: CONTENT_TYPES.css },
      '/robots.txt': { file: 'robots.txt', type: 'text/plain; charset=utf-8' },
      '/sitemap.xml': { file: 'sitemap.xml', type: 'application/xml; charset=utf-8' }
    };
    
    try {
      let response;
      
      // Check if it's a static file request
      if (STATIC_FILES[url.pathname]) {
        const { file, type } = STATIC_FILES[url.pathname];
        response = await serveStaticFile(env, file, type);
      }
      // API endpoints
      else {
        switch (url.pathname) {
          case '/quest-submit':
            response = await handleQuestSubmit(request, env, ctx);
            break;
          
          case '/page_content.json':
            if (request.method === 'GET') {
                response = await handleGetPageContent(request, env);
            } else if (request.method === 'POST') {
                response = await handleSavePageContent(request, env, ctx);
            } else {
                throw new UserFacingError('Method Not Allowed.', 405);
            }
            break;
          
          case '/orders':
              if (request.method === 'GET') {
                  response = await handleGetOrders(request, env);
              } else if (request.method === 'POST') {
                  response = await handleCreateOrder(request, env, ctx);
              } else if (request.method === 'PUT') {
                  response = await handleUpdateOrderStatus(request, env, ctx);
              } else {
                  throw new UserFacingError('Method Not Allowed.', 405);
              }
              break;
          
          case '/contacts':
              if (request.method === 'GET') {
                  response = await handleGetContacts(request, env);
              } else if (request.method === 'POST') {
                  response = await handleCreateContact(request, env, ctx);
              } else {
                  throw new UserFacingError('Method Not Allowed.', 405);
              }
              break;
          
          case '/ai-assistant':
              if (request.method === 'POST') {
                  response = await handleAIAssistant(request, env);
              } else {
                  throw new UserFacingError('Method Not Allowed.', 405);
              }
              break;
          
          case '/ai-settings':
              if (request.method === 'GET') {
                  response = await handleGetAISettings(request, env);
              } else if (request.method === 'POST') {
                  response = await handleSaveAISettings(request, env, ctx);
              } else {
                  throw new UserFacingError('Method Not Allowed.', 405);
              }
              break;
            
          default:
            // Try to serve 404.html for unknown routes
            const notFoundFile = await env.PAGE_CONTENT.get('static_404.html');
            if (notFoundFile) {
              response = new Response(notFoundFile, {
                status: 404,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              });
            } else {
              throw new UserFacingError('Not Found', 404);
            }
        }
      }

      // Добавяме CORS хедъри към всеки успешен отговор
      Object.keys(corsHeaders).forEach(key => {
        response.headers.set(key, corsHeaders[key]);
      });
      return response;

    } catch (e) {
      console.error("Top-level error:", e.stack);
      const statusCode = e instanceof UserFacingError ? e.status : 500;
      const userErrorMessage = (e instanceof UserFacingError) 
        ? e.message 
        : "An unexpected internal error occurred.";
        
      const errorResponse = new Response(JSON.stringify({ error: userErrorMessage }), { 
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      return errorResponse;
    }
  }
};


// --- СПЕЦИФИЧНИ ОБРАБОТЧИЦИ НА ЕНДПОЙНТИ ---

/**
 * Serves static files from KV storage
 * @param {object} env - Environment with KV bindings
 * @param {string} filename - Name of the file to serve
 * @param {string} contentType - MIME type for the response
 * @returns {Promise<Response>} Response object with file content
 * @throws {UserFacingError} When file is not found in storage (404)
 */
async function serveStaticFile(env, filename, contentType) {
    const fileContent = await env.PAGE_CONTENT.get(`static_${filename}`);
    if (fileContent === null) {
        throw new UserFacingError(`File ${filename} not found in storage.`, 404);
    }
    return new Response(fileContent, {
        status: 200,
        headers: { 
            'Content-Type': contentType,
            'Cache-Control': `public, max-age=${CACHE_CONFIG.STATIC_FILE_MAX_AGE}`
        }
    });
}

/**
 * Handles GET /page_content.json
 */
async function handleGetPageContent(request, env) {
    const pageContent = await env.PAGE_CONTENT.get('page_content');
    if (pageContent === null) {
        throw new UserFacingError("Content not found.", 404);
    }
    return new Response(pageContent, {
        status: 200,
        headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${CACHE_CONFIG.PAGE_CONTENT_MAX_AGE}, stale-while-revalidate=${CACHE_CONFIG.PAGE_CONTENT_STALE_WHILE_REVALIDATE}`,
            'ETag': await generateETag(pageContent)
        }
    });
}

/**
 * Generate ETag for content-based caching
 * Creates a SHA-256 hash of the content and returns the first 16 characters as an ETag
 * @param {string} content - The content to hash
 * @returns {Promise<string>} ETag string in the format "hash" (quoted hex string)
 */
async function generateETag(content) {
    const msgBuffer = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashHex = Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');
    return `"${hashHex.substring(0, 16)}"`;
}

/**
 * Handles POST /page_content.json
 */
async function handleSavePageContent(request, env, ctx) {
    const contentToSave = await request.text();
    try {
        // Проверяваме дали е валиден JSON, преди да запишем
        JSON.parse(contentToSave);
        ctx.waitUntil(env.PAGE_CONTENT.put('page_content', contentToSave));
        return new Response(JSON.stringify({ success: true, message: 'Content saved.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        throw new UserFacingError("Invalid JSON provided in the request body.", 400);
    }
}

/**
 * --- НОВА ФУНКЦИЯ ---
 * Handles GET /orders
 */
async function handleGetOrders(request, env) {
    // Връщаме съществуващите поръчки или празен масив
    const ordersJson = await env.PAGE_CONTENT.get('orders');
    const orders = ordersJson ? JSON.parse(ordersJson) : [];
    return new Response(JSON.stringify(orders), {
        status: 200,
        headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate' // Orders should not be cached
        }
    });
}

/**
 * --- НОВА ФУНКЦИЯ ---
 * Handles POST /orders (създаване на нова поръчка от checkout)
 */
async function handleCreateOrder(request, env, ctx) {
    let orderData;
    try {
        orderData = await request.json();
    } catch (e) {
        throw new UserFacingError("Невалиден JSON формат на заявката.", 400);
    }
    
    if (!orderData || !orderData.customer || !orderData.products) {
        throw new UserFacingError("Липсват задължителни данни за поръчката.", 400);
    }
    
    // Генерираме уникален ID и timestamp за поръчката
    const newOrder = {
        id: `order-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        timestamp: new Date().toISOString(),
        customer: orderData.customer,
        products: orderData.products,
        summary: orderData.summary || {},
        status: orderData.status || 'Нова'
    };
    
    // Четем съществуващите поръчки
    const ordersJson = await env.PAGE_CONTENT.get('orders');
    let orders = ordersJson ? JSON.parse(ordersJson) : [];
    
    // Добавяме новата поръчка
    orders.push(newOrder);
    
    // Запазваме обратно в KV
    ctx.waitUntil(env.PAGE_CONTENT.put('orders', JSON.stringify(orders, null, 2)));
    
    return new Response(JSON.stringify({ success: true, order: newOrder }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * --- НОВА ФУНКЦИЯ ---
 * Handles PUT /orders (за промяна на статус)
 */
async function handleUpdateOrderStatus(request, env, ctx) {
    const updateData = await request.json();
    if (!updateData || !updateData.id || !updateData.status) {
        throw new UserFacingError("Липсват ID на поръчка или нов статус.", 400);
    }
    
    const ordersJson = await env.PAGE_CONTENT.get('orders');
    let orders = ordersJson ? JSON.parse(ordersJson) : [];
    
    const orderIndex = orders.findIndex(o => o.id === updateData.id);
    if (orderIndex === -1) {
        throw new UserFacingError(`Поръчка с ID ${updateData.id} не е намерена.`, 404);
    }
    
    orders[orderIndex].status = updateData.status;
    
    ctx.waitUntil(env.PAGE_CONTENT.put('orders', JSON.stringify(orders, null, 2)));
    
    return new Response(JSON.stringify({ success: true, updatedOrder: orders[orderIndex] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * --- НОВА ФУНКЦИЯ ---
 * Handles GET /contacts
 */
async function handleGetContacts(request, env) {
    const contactsJson = await env.PAGE_CONTENT.get('contacts');
    const contacts = contactsJson ? JSON.parse(contactsJson) : [];
    return new Response(JSON.stringify(contacts), {
        status: 200,
        headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate' // Contacts should not be cached
        }
    });
}

/**
 * --- НОВА ФУНКЦИЯ ---
 * Handles POST /contacts (създаване на нов контакт от формата за контакти)
 */
async function handleCreateContact(request, env, ctx) {
    let contactData;
    try {
        contactData = await request.json();
    } catch (e) {
        throw new UserFacingError("Невалиден JSON формат на заявката.", 400);
    }
    
    if (!contactData || !contactData.name || !contactData.email || !contactData.message) {
        throw new UserFacingError("Липсват задължителни данни за контакта.", 400);
    }
    
    // Генерираме уникален ID и timestamp за контакта
    const newContact = {
        id: `contact-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        timestamp: new Date().toISOString(),
        name: contactData.name,
        email: contactData.email,
        subject: contactData.subject || '',
        message: contactData.message,
        status: 'Нов'
    };
    
    // Четем съществуващите контакти
    const contactsJson = await env.PAGE_CONTENT.get('contacts');
    let contacts = contactsJson ? JSON.parse(contactsJson) : [];
    
    // Добавяме новия контакт
    contacts.push(newContact);
    
    // Запазваме обратно в KV
    ctx.waitUntil(env.PAGE_CONTENT.put('contacts', JSON.stringify(contacts, null, 2)));
    
    return new Response(JSON.stringify({ success: true, contact: newContact }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Handles GET /ai-settings (Get AI configuration)
 */
async function handleGetAISettings(request, env) {
    const settingsJson = await env.PAGE_CONTENT.get('ai_settings');
    const settings = settingsJson ? JSON.parse(settingsJson) : getDefaultAISettings();
    
    return new Response(JSON.stringify(settings), {
        status: 200,
        headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        }
    });
}

/**
 * Handles POST /ai-settings (Save AI configuration)
 */
async function handleSaveAISettings(request, env, ctx) {
    let settings;
    try {
        settings = await request.json();
    } catch (e) {
        throw new UserFacingError("Невалиден JSON формат на заявката.", 400);
    }
    
    // Validate settings
    if (!settings.provider || !['cloudflare', 'openai', 'google'].includes(settings.provider)) {
        throw new UserFacingError("Невалиден AI доставчик.", 400);
    }
    
    // Save to KV
    ctx.waitUntil(env.PAGE_CONTENT.put('ai_settings', JSON.stringify(settings, null, 2)));
    
    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Get default AI settings
 */
function getDefaultAISettings() {
    return {
        provider: 'cloudflare',
        model: '@cf/meta/llama-3.1-70b-instruct',
        apiKey: '',
        temperature: 0.3,
        maxTokens: 4096,
        promptTemplate: `Ти си експерт по хранителни добавки и продукти за отслабване. Анализирай следната информация за продукт и попълни ВСИЧКИ възможни полета в JSON формат базирайки се на твоите знания за този тип продукти.

Въведена информация:
{{productData}}

КРИТИЧНО ВАЖНО ЗА JSON ФОРМАТИРАНЕТО:
1. Отговори САМО с валиден JSON обект - БЕЗ текст, коментари или обяснения преди или след него
2. Използвай ЗАПЕТАЯ между всички елементи в масиви: [{"a": 1}, {"b": 2}, {"c": 3}]
3. Използвай ЗАПЕТАЯ между всички свойства в обекти: {"a": 1, "b": 2, "c": 3}
4. НЕ слагай запетая след последния елемент в масив или обект
5. Следвай ТОЧНО форматирането на примера по-долу

Пример за правилно форматиран JSON обект:

{
  "name": "L-карнитин течна форма 3000mg",
  "manufacturer": "Nutrend",
  "price": 42.50,
  "tagline": "Ефективно изгаряне на мазнини и енергия",
  "description": "L-карнитин е естествена аминокиселина, която играе ключова роля в транспортирането на мастните киселини към митохондриите, където се превръщат в енергия. Течната форма осигурява бърза абсорбция и максимална биологична достъпност. Идеален за хора, които искат да намалят мазнините, увеличат енергията и подобрят спортните си резултати.",
  "image_url": null,
  "packaging_info": {
    "capsules_or_grams": "500ml течна форма",
    "doses_per_package": "20 дози по 25ml"
  },
  "effects": [
    {
      "label": "Изгаряне на мазнини",
      "value": 8
    },
    {
      "label": "Енергия и издръжливост",
      "value": 9
    },
    {
      "label": "Възстановяване след тренировка",
      "value": 7
    }
  ],
  "about_content": {
    "title": "За L-карнитина",
    "description": "L-карнитинът е незаменим помощник в процеса на отслабване и подобряване на спортните резултати. Той работи на клетъчно ниво, като улеснява използването на мазнините като гориво. Това води до по-ефективно горене на калории, по-добра издръжливост и по-бързо възстановяване след физическа активност.",
    "benefits": [
      {
        "title": "Ускорява метаболизма на мазнините",
        "text": "Транспортира мастните киселини към митохондриите, където се използват за производство на енергия, вместо да се натрупват като мазнини."
      },
      {
        "title": "Повишава енергията и издръжливостта",
        "text": "Осигурява постоянен източник на енергия по време на тренировки, намалява умората и подобрява физическата работоспособност."
      },
      {
        "title": "Подпомага възстановяването",
        "text": "Намалява мускулните болки след тренировка и ускорява възстановителните процеси в организма."
      }
    ]
  },
  "ingredients": [
    {
      "name": "L-карнитин",
      "amount": "3000mg на доза",
      "description": "Чиста форма на L-карнитин с висока биологична достъпност, осигуряваща оптимален транспорт на мастни киселини."
    },
    {
      "name": "Витамин B6",
      "amount": "1.4mg",
      "description": "Подпомага метаболизма на протеините и аминокиселините, увеличава усвояването на L-карнитина."
    }
  ],
  "research_note": {
    "text": "Научни изследвания показват, че L-карнитинът подобрява използването на мазнините като енергиен източник и повишава физическата работоспособност.",
    "url": "https://pubmed.ncbi.nlm.nih.gov/?term=l-carnitine+fat+metabolism"
  },
  "recommended_intake": "Приемайте 1 доза (25ml) дневно, за предпочитане 30-60 минути преди тренировка. В дни без тренировка - сутрин на гладно. Разклатете добре преди употреба.",
  "contraindications": "Не е подходящ за бременни и кърмачки. Не превишавайте препоръчителната дневна доза. Не използвайте като заместител на разнообразното хранене. Съхранявайте на хладно и сухо място, далеч от достъп на деца.",
  "additional_advice": "За най-добри резултати комбинирайте L-карнитина с балансирана диета и редовна физическа активност. Пийте достатъчно вода - поне 2-3 литра дневно. Ефектът е най-силен при хора, които тренират редовно.",
  "faq": [
    {
      "question": "Кога да приемам L-карнитин - преди или след тренировка?",
      "answer": "Най-добре е да го приемете 30-60 минути преди тренировка, за да осигурите максимална концентрация в кръвта по време на физическата активност."
    },
    {
      "question": "Мога ли да комбинирам L-карнитин с други хранителни добавки?",
      "answer": "Да, L-карнитинът се комбинира добре с протеини, BCAA, витамини и други спортни добавки. Избягвайте комбинация с големи дози кофеин."
    },
    {
      "question": "След колко време ще видя резултати?",
      "answer": "При редовна употреба и правилен режим на тренировки, първите резултати се забелязват след 2-3 седмици. За оптимални резултати се препоръчва курс от поне 8-12 седмици."
    }
  ],
  "application_type": "Oral",
  "inventory": 50,
  "goals": "отслабване, енергия, спортни резултати",
  "target_profile": "Активни хора, спортуващи редовно, желаещи да намалят мазнините и да повишат енергията си",
  "protocol_hint": "Прием 30-60 минути преди тренировка или сутрин на гладно. Курс 8-12 седмици с 2 седмици почивка.",
  "synergy_products": null,
  "safety_warnings": "Не превишавайте дозата. При проблеми с щитовидната жлеза или бъбреците, консултирайте се с лекар преди употреба."
}

ВАЖНО: Твоят отговор ТРЯБВА да е валиден JSON с:
- Запетаи между всички елементи в масиви
- Запетаи между всички свойства в обекти  
- БЕЗ запетая след последния елемент
- БЕЗ коментари или текст извън JSON структурата

Използвай СЪЩАТА структура и форматиране за твоя отговор. Попълни с подходящи данни за продукта.`
    };
}

/**
 * Handles POST /ai-assistant (AI Assistant for product information extraction)
 */
async function handleAIAssistant(request, env) {
    let requestData;
    try {
        requestData = await request.json();
    } catch (e) {
        throw new UserFacingError("Невалиден JSON формат на заявката.", 400);
    }
    
    const { productData, settings } = requestData;
    
    if (!productData || !productData.productName) {
        throw new UserFacingError("Липсва име на продукта.", 400);
    }
    
    // Get AI settings (use provided settings or load from KV)
    let aiSettings = settings;
    if (!aiSettings) {
        const settingsJson = await env.PAGE_CONTENT.get('ai_settings');
        aiSettings = settingsJson ? JSON.parse(settingsJson) : getDefaultAISettings();
    }
    
    // Validate API key
    if (!aiSettings.apiKey && aiSettings.provider !== 'cloudflare') {
        throw new UserFacingError("Липсва API ключ за избрания AI доставчик.", 400);
    }
    
    // For Cloudflare, check environment variables
    if (aiSettings.provider === 'cloudflare' && (!env.ACCOUNT_ID || !env.AI_TOKEN)) {
        throw new UserFacingError("Cloudflare AI не е конфигуриран.", 500);
    }
    
    // Create prompt from template
    const prompt = aiSettings.promptTemplate.replace('{{productData}}', JSON.stringify(productData, null, 2));
    
    try {
        let extractedData;
        
        // Call appropriate AI provider
        switch (aiSettings.provider) {
            case 'cloudflare':
                extractedData = await callCloudflareAI(env, aiSettings, prompt);
                break;
            case 'openai':
                extractedData = await callOpenAI(aiSettings, prompt);
                break;
            case 'google':
                extractedData = await callGoogleAI(aiSettings, prompt);
                break;
            default:
                throw new UserFacingError("Невалиден AI доставчик.", 400);
        }
        
        return new Response(JSON.stringify({
            success: true,
            data: extractedData
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (e) {
        console.error("AI Assistant error:", e);
        if (e instanceof UserFacingError) throw e;
        throw new UserFacingError(`Грешка при обработка на AI заявката: ${e.message}`, 500);
    }
}

/**
 * Call Cloudflare AI
 */
async function callCloudflareAI(env, settings, prompt) {
    const model = settings.model || '@cf/meta/llama-3.1-70b-instruct';
    const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/ai/run/${model}`;
    
    const payload = {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: settings.maxTokens || 4096,
        temperature: settings.temperature || 0.3
    };
    
    const response = await fetch(cfEndpoint, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${env.AI_TOKEN}`, 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
    });
    
    const resultText = await response.text();
    
    if (!response.ok) {
        console.error("Cloudflare AI Request Failed. Status:", response.status, "Body:", resultText);
        throw new Error("Cloudflare AI сървърът върна грешка.");
    }
    
    const aiEnvelope = JSON.parse(resultText);
    if (!aiEnvelope.result || !aiEnvelope.result.response) {
        throw new Error("AI response is missing the 'result.response' field.");
    }
    
    return extractJSONFromResponse(aiEnvelope.result.response);
}

/**
 * Call OpenAI API
 */
async function callOpenAI(settings, prompt) {
    const model = settings.model || 'gpt-4';
    const endpoint = 'https://api.openai.com/v1/chat/completions';
    
    const payload = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: settings.maxTokens || 4096,
        temperature: settings.temperature || 0.3
    };
    
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${settings.apiKey}`, 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
    });
    
    const resultText = await response.text();
    
    if (!response.ok) {
        console.error("OpenAI Request Failed. Status:", response.status, "Body:", resultText);
        throw new Error("OpenAI API върна грешка.");
    }
    
    const result = JSON.parse(resultText);
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        throw new Error("OpenAI response is missing expected fields.");
    }
    
    return extractJSONFromResponse(result.choices[0].message.content);
}

/**
 * Call Google AI (Gemini)
 */
async function callGoogleAI(settings, prompt) {
    const model = settings.model || 'gemini-pro';
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${settings.apiKey}`;
    
    const payload = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            temperature: settings.temperature || 0.3,
            maxOutputTokens: settings.maxTokens || 4096
        }
    };
    
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
    });
    
    const resultText = await response.text();
    
    if (!response.ok) {
        console.error("Google AI Request Failed. Status:", response.status, "Body:", resultText);
        throw new Error("Google AI API върна грешка.");
    }
    
    const result = JSON.parse(resultText);
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
        throw new Error("Google AI response is missing expected fields.");
    }
    
    const textContent = result.candidates[0].content.parts[0].text;
    return extractJSONFromResponse(textContent);
}

/**
 * Extract JSON from AI response text - simplified version
 * With example-based prompt, AI should produce clean JSON, so we only need basic cleanup
 */
function extractJSONFromResponse(responseText) {
    if (typeof responseText !== 'string') {
        return responseText;
    }
    
    // Trim and extract JSON
    let jsonStr = responseText.trim();
    
    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    // Find JSON object boundaries
    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');
    
    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
        console.error("AI returned a string without JSON structure:", responseText);
        throw new UserFacingError('AI отговори с текст без JSON структура.');
    }
    
    jsonStr = jsonStr.substring(startIdx, endIdx + 1);
    
    try {
        // Try parsing as-is first
        return JSON.parse(jsonStr);
    } catch (parseError) {
        console.warn("Initial JSON parse failed, applying simple fixes:", parseError.message);
        
        try {
            // Apply only essential fixes for common AI mistakes
            let fixed = jsonStr
                // Fix: Remove trailing commas before } or ]
                .replace(/,(\s*[}\]])/g, '$1')
                // Fix: Add missing commas between } or ] and { or [
                .replace(/([}\]])(\s+)([{[])/g, '$1,$2$3')
                // Fix: Add missing commas between } or ] and " (only when there's whitespace = array/object elements)
                .replace(/([}\]])(\s+)"/g, '$1,$2"')
                // Fix: Replace smart quotes with regular quotes
                .replace(/[\u201C\u201D]/g, '"')
                .replace(/[\u2018\u2019]/g, "'");
            
            return JSON.parse(fixed);
        } catch (fixError) {
            console.error("JSON parsing failed:", parseError.message);
            throw new UserFacingError(
                `AI отговори с невалиден JSON формат. Грешка: ${parseError.message}`
            );
        }
    }
}

/**
 * Handles POST /quest-submit
 */
async function handleQuestSubmit(request, env, ctx) {
  const formData = await request.json();
  if (!formData || !formData.goals || !formData.age || !formData.name) {
    throw new UserFacingError("Липсват задължителни данни.", 400);
  }

  formData.id = `client-${Date.now()}`;
  formData.timestamp = new Date().toISOString();
  // Модификация: Запазваме данните на клиента в 'clients', а поръчката в 'orders'
  const orderData = {
      id: `order-${Date.now()}`,
      timestamp: formData.timestamp,
      customer: {
          firstName: formData.name,
          lastName: '', // Може да се добави по-късно
          phone: formData.phone || '',
          email: formData.email
      },
      products: [], // AI ще ги попълни
      status: 'Нова'
  };
  
  ctx.waitUntil(saveClientData(env, formData)); // Запазваме данните от въпросника

  const pageContentJSON = await env.PAGE_CONTENT.get('page_content');
  const mainPromptTemplate = await env.PAGE_CONTENT.get('bot_prompt');
  
  if (!pageContentJSON || !mainPromptTemplate) {
      throw new Error("Critical KV data missing: 'page_content' or 'bot_prompt' not found.");
  }
  
  const productsForAI = transformProductsForAI(JSON.parse(pageContentJSON));
  
  const recommendation = await getAIRecommendation(env, formData, productsForAI, mainPromptTemplate);
  
  // Добавяме препоръчаните продукти към поръчката
  orderData.products = recommendation.recommended_products.map(p => ({
      id: p.product_id,
      name: p.name,
      quantity: 1 // По подразбиране
  }));
  
  ctx.waitUntil(saveOrder(env, orderData)); // Запазваме новата поръчка
  ctx.waitUntil(saveAIResult(env, formData.id, recommendation));

  return new Response(JSON.stringify(recommendation), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ... останалата част от AI логиката и помощните функции остават същите ...

// --- AI И ЛОГИКА ЗА ДАННИ ---

function transformProductsForAI(pageContent) {
  if (!pageContent || !Array.isArray(pageContent.page_content)) {
    console.error("Invalid pageContent structure for transformation.");
    return [];
  }
  const allProducts = pageContent.page_content
    .filter(component => component.type === 'product_category' && Array.isArray(component.products))
    .flatMap(category => category.products);
  return allProducts.map(product => ({
    product_id: product.product_id,
    name: product.public_data.name,
    description: product.public_data.description,
    system_data: product.system_data
  }));
}

async function getAIRecommendation(env, formData, productList, mainPromptTemplate) {
  if (!env.ACCOUNT_ID || !env.AI_TOKEN) {
    throw new Error("Cloudflare Account/AI credentials are not configured.");
  }
  const finalPrompt = mainPromptTemplate
    .replace('{{productList}}', JSON.stringify(productList, null, 2))
    .replace('{{clientData}}', JSON.stringify(formData, null, 2));
  const model = '@cf/meta/llama-3.1-70b-instruct';
  const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/ai/run/${model}`;
  const payload = {
    messages: [{ role: 'system', content: finalPrompt }],
    max_tokens: 2048,
    temperature: 0.2
  };
  const response = await fetch(cfEndpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.AI_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const resultText = await response.text();
  if (!response.ok) {
    console.error("AI API Request Failed. Status:", response.status, "Body:", resultText);
    throw new UserFacingError("AI сървърът върна грешка. Моля, свържете се с администратор.");
  }
  try {
    const aiEnvelope = JSON.parse(resultText);
    if (!aiEnvelope.result || !aiEnvelope.result.response) {
      throw new Error("AI response is missing the 'result.response' field.");
    }
    let recommendationData = aiEnvelope.result.response;
    if (typeof recommendationData === 'string') {
      const jsonMatch = recommendationData.match(/{[\s\S]*}/);
      if (!jsonMatch) {
          console.error("AI returned a string, but no JSON structure was found. String:", recommendationData);
          throw new UserFacingError('AI отговори с текст, в който не се открива JSON структура.');
      }
      try {
          recommendationData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
          console.error("Failed to parse extracted JSON from AI. String:", jsonMatch[0], parseError);
          throw new UserFacingError('AI отговори с низ, който не е валиден JSON дори след извличане.');
      }
    }
    if (typeof recommendationData !== 'object' || recommendationData === null || !recommendationData.recommended_products) {
        throw new UserFacingError('AI отговори с неочакван формат на данните.');
    }
    return recommendationData;
  } catch (e) {
    if (e instanceof UserFacingError) throw e; 
    console.error("The entire AI response was not valid JSON. Raw text:", resultText, e);
    throw new UserFacingError("Цялостният отговор от AI не беше валиден JSON.");
  }
}

// --- ПОМОЩНИ ФУНКЦИИ ЗА ЗАПИС В KV ---

async function saveClientData(env, formData) {
  try {
    const list = await env.PAGE_CONTENT.get('clients', { type: 'json' }) || [];
    list.push(formData);
    await env.PAGE_CONTENT.put('clients', JSON.stringify(list, null, 2));
  } catch (e) {
    console.error("Failed to save client data to KV:", e);
  }
}

// --- НОВА ФУНКЦИЯ ЗА ЗАПИС НА ПОРЪЧКИ ---
async function saveOrder(env, orderData) {
  try {
    const list = await env.PAGE_CONTENT.get('orders', { type: 'json' }) || [];
    list.push(orderData);
    await env.PAGE_CONTENT.put('orders', JSON.stringify(list, null, 2));
  } catch (e) {
    console.error("Failed to save order data to KV:", e);
  }
}

async function saveAIResult(env, clientId, recommendation) {
  try {
    const resultsList = await env.PAGE_CONTENT.get('results', { type: 'json' }) || [];
    resultsList.push({
      clientId: clientId,
      timestamp: new Date().toISOString(),
      recommendation: recommendation
    });
    await env.PAGE_CONTENT.put('results', JSON.stringify(resultsList, null, 2));
  } catch (e) {
    console.error("Failed to save AI result to KV:", e);
  }
}
