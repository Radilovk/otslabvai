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

Моля попълни JSON обект със ВСИЧКИ следните полета (на български език):
{
  "name": "Пълно име на продукта",
  "manufacturer": "Производител (ако е известен)",
  "price": "Приблизителна цена в лева като число (или null ако не знаеш)",
  "tagline": "Кратък маркетингов слоган (до 60 символа)",
  "description": "Подробно маркетингово описание (100-200 думи)",
  "image_url": "URL на основно изображение на продукта (или null)",
  "packaging_info": {
    "capsules_or_grams": "Брой капсули или грамаж",
    "doses_per_package": "Брой дози в опаковка"
  },
  "effects": [
    {
      "label": "Ефект 1",
      "value": 8
    },
    {
      "label": "Ефект 2", 
      "value": 7
    },
    {
      "label": "Ефект 3",
      "value": 9
    }
  ],
  "about_content": {
    "title": "За продукта",
    "description": "Подробно описание",
    "benefits": [
      {
        "title": "Заглавие на полза 1",
        "text": "Описание на полза 1"
      },
      {
        "title": "Заглавие на полза 2",
        "text": "Описание на полза 2"
      }
    ]
  },
  "ingredients": [
    {
      "name": "Съставка 1",
      "amount": "Количество",
      "description": "Описание на съставката"
    },
    {
      "name": "Съставка 2",
      "amount": "Количество",
      "description": "Описание на съставката"
    }
  ],
  "research_note": {
    "text": "Кратък текст за научното изследване",
    "url": "URL към научно изследване (или null)"
  },
  "recommended_intake": "Препоръчителен прием и дозировка",
  "contraindications": "Противопоказания и предупреждения",
  "additional_advice": "Допълнителни съвети и информация",
  "faq": [
    {
      "question": "Често задаван въпрос 1",
      "answer": "Отговор"
    },
    {
      "question": "Често задаван въпрос 2",
      "answer": "Отговор"
    }
  ],
  "application_type": "Injectable или Oral или Topical или Intranasal",
  "inventory": 100,
  "goals": "цел1, цел2, цел3",
  "target_profile": "Описание на идеален потребител",
  "protocol_hint": "Техническа насока за протокол на приложение",
  "synergy_products": "prod-id1, prod-id2",
  "safety_warnings": "Предупреждения за безопасност"
}

КРИТИЧНО ВАЖНО ЗА JSON ФОРМАТИРАНЕТО:
- Отговори САМО с валиден JSON обект - НЕ добавяй текст преди или след JSON
- ЗАДЪЛЖИТЕЛНО: Слагай запетая между ВСИЧКИ елементи в масив освен след последния
- ЗАДЪЛЖИТЕЛНО: Слагай запетая между ВСИЧКИ свойства в обект освен след последното
- НЕ слагай запетаи след последния елемент в обект или масив (преди } или ])
- НЕ слагай множество запетаи подред
- Използвай само прости двойни кавички " за стрингове (НЕ използвай ' или умни кавички)
- За числови стойности НЕ използвай кавички (например value: 8 вместо value: "8")
- Не използвай коментари в JSON
- Ако липсва информация за поле, използвай null за стрингове, [] за масиви, или {} за обекти
- Използвай български език за всички текстови полета
- Бъди точен, грамотен и маркетингово компетентен
- Попълни ВСИЧКИ полета - не пропускай нито едно
- Провери JSON-а за валидност преди да отговориш`
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
 * Extract JSON from AI response text with robust sanitization
 */
function extractJSONFromResponse(responseText) {
    if (typeof responseText !== 'string') {
        return responseText;
    }
    
    // Try to find and extract valid JSON from the response
    let jsonStr = responseText.trim();
    
    // If response starts with markdown code blocks, remove them
    if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    // Find the start and end of the JSON object
    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');
    
    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
        console.error("AI returned a string without JSON structure:", responseText);
        throw new UserFacingError('AI отговори с текст без JSON структура.');
    }
    
    // Extract the JSON substring
    jsonStr = jsonStr.substring(startIdx, endIdx + 1);
    
    try {
        // First attempt: Try parsing as-is
        return JSON.parse(jsonStr);
    } catch (parseError) {
        // If initial parse fails, try to fix common AI JSON errors
        console.warn("Initial JSON parse failed, attempting to sanitize:", parseError.message);
        console.warn("Error position:", parseError.message.match(/position (\d+)/)?.[1]);
        
        try {
            // Apply comprehensive sanitization for common AI JSON errors
            let sanitizedJson = jsonStr
                // Step 1: Remove multiple consecutive commas (2 or more)
                .replace(/,{2,}/g, ',')
                // Step 2: Remove trailing commas before } or ] (with optional whitespace/newlines)
                .replace(/,(\s*[}\]])/g, '$1')
                // Step 3: Fix missing commas between object/array closings and openings
                // Pattern: } or ] followed by { or [ (with or without whitespace)
                .replace(/([}\]])(\s*)([{[])/g, '$1,$2$3')
                // Step 4: Fix missing comma between closing brace/bracket and opening quote
                // Pattern: } or ] followed by " (with or without whitespace)
                // But NOT if it's already followed by a comma
                .replace(/([}\]])(\s*)(?!,)"/g, '$1,$2"')
                // Step 5: Fix missing comma after closing quote when followed by opening brace/bracket
                // Pattern: " followed by { or [ (with or without whitespace)
                // But NOT if there's already a comma or closing bracket
                .replace(/"(\s*)(?![,}\]])([{[])/g, '",$1$2')
                // Step 6: Fix missing comma between consecutive string values (in arrays)
                // Pattern: "value1" followed by "value2" (with or without whitespace)
                // But NOT if followed by a colon (which would indicate object property)
                // And NOT if followed by closing bracket/brace
                .replace(/"(\s*)(?![,:\]\}])"/g, '",$1"')
                // Step 7: Fix missing comma between primitives and next elements  
                // Handle numbers/bool/null followed by strings, objects, or arrays
                .replace(/(\d+|true|false|null)(\s*)(?!,)(["{[])/g, '$1,$2$3')
                // Step 8: Clean up any double commas that might have been introduced
                .replace(/,{2,}/g, ',')
                // Step 9: Remove trailing commas one more time after all fixes
                .replace(/,(\s*[}\]])/g, '$1');
            
            return JSON.parse(sanitizedJson);
        } catch (sanitizeError) {
            console.error("Failed to parse JSON even after sanitization.");
            console.error("Original error:", parseError.message);
            console.error("Sanitization error:", sanitizeError.message);
            console.error("JSON snippet around error:", jsonStr.substring(
                Math.max(0, parseInt(parseError.message.match(/position (\d+)/)?.[1] || 0) - 100),
                Math.min(jsonStr.length, parseInt(parseError.message.match(/position (\d+)/)?.[1] || 0) + 100)
            ));
            
            // Try one more aggressive fix: use a JSON repair library approach
            try {
                // Last resort: try to extract just valid parts and rebuild
                const repairedJson = attemptJSONRepair(jsonStr);
                return JSON.parse(repairedJson);
            } catch (repairError) {
                console.error("JSON repair also failed:", repairError.message);
                throw new UserFacingError(
                    `AI отговори с невалиден JSON формат. Грешка: ${parseError.message}`
                );
            }
        }
    }
}

/**
 * Attempt aggressive JSON repair for common AI mistakes
 */
function attemptJSONRepair(jsonStr) {
    // More aggressive repairs - but still conservative
    let repaired = jsonStr
        // Step 1: Remove any non-printable control characters (but keep newlines, tabs, carriage returns)
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
        // Step 2: Fix common quote issues - replace smart quotes with regular quotes
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        // Step 3: Fix escaped newlines that might confuse JSON parser
        .replace(/\\\n/g, '\\n')
        // Step 4: Remove multiple consecutive commas anywhere
        .replace(/,{2,}/g, ',')
        // Step 5: Remove all trailing commas (including multiple commas before } or ])
        .replace(/,+(\s*[}\]])/g, '$1')
        // Step 6: Fix missing commas between object/array closings and openings
        .replace(/([}\]])(\s*)(?!,)([{[])/g, '$1,$2$3')
        // Step 7: Fix missing commas between closing and opening quotes
        .replace(/([}\]])(\s*)(?!,)"/g, '$1,$2"')
        // Step 8: Fix missing commas after quotes before opening brace/bracket
        .replace(/"(\s*)(?![,:\]\}])([{[])/g, '",$1$2')
        // Step 9: Fix missing comma between consecutive string values (but not before colon or closing)
        .replace(/"(\s*)(?![,:\]\}])"/g, '",$1"')
        // Step 10: Fix missing comma between primitives and next elements
        // Handle numbers/bool/null followed by strings, objects, or arrays
        .replace(/(\d+|true|false|null)(\s*)(?!,)(["{[])/g, '$1,$2$3')
        // Step 11: Clean up any double commas introduced
        .replace(/,{2,}/g, ',')
        // Step 12: Final cleanup of trailing commas
        .replace(/,(\s*[}\]])/g, '$1');
    
    return repaired;
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
