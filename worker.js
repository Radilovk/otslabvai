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
 * Handles POST /ai-assistant (AI Assistant for product information extraction)
 */
async function handleAIAssistant(request, env) {
    let productData;
    try {
        productData = await request.json();
    } catch (e) {
        throw new UserFacingError("Невалиден JSON формат на заявката.", 400);
    }
    
    if (!productData || !productData.productName) {
        throw new UserFacingError("Липсва име на продукта.", 400);
    }
    
    if (!env.ACCOUNT_ID || !env.AI_TOKEN) {
        throw new UserFacingError("AI функционалността не е конфигурирана.", 500);
    }
    
    // Създаваме промпт за AI модела
    const prompt = `Ти си експерт по хранителни добавки и продукти за отслабване. Анализирай следната информация за продукт и попълни всички възможни полета в JSON формат базирайки се на твоите знания за този тип продукти.

Въведена информация:
${JSON.stringify(productData, null, 2)}

Моля попълни JSON обект със следните полета (на български език):
{
  "name": "Пълно име на продукта",
  "manufacturer": "Производител (ако е известен)",
  "price": "Приблизителна цена в лева като число (или null ако не знаеш)",
  "tagline": "Кратък маркетингов слоган (до 60 символа)",
  "description": "Подробно маркетингово описание (100-200 думи)",
  "packaging_info": {
    "capsules_or_grams": "Брой капсули или грамаж",
    "doses_per_package": "Брой дози в опаковка"
  },
  "effects": [
    {
      "label": "Ефект 1",
      "value": "Стойност от 0 до 10"
    },
    {
      "label": "Ефект 2", 
      "value": "Стойност от 0 до 10"
    },
    {
      "label": "Ефект 3",
      "value": "Стойност от 0 до 10"
    }
  ],
  "about_content": {
    "title": "За продукта",
    "description": "Подробно описание",
    "benefits": [
      {
        "icon": "✓",
        "text": "Полза 1"
      },
      {
        "icon": "✓",
        "text": "Полза 2"
      }
    ]
  },
  "ingredients": [
    {
      "name": "Съставка 1",
      "amount": "Количество",
      "description": "Описание на съставката"
    }
  ],
  "recommended_intake": "Препоръчителен прием и дозировка",
  "contraindications": "Противопоказания и предупреждения",
  "additional_advice": "Допълнителни съвети и информация",
  "faq": [
    {
      "question": "Често задаван въпрос 1",
      "answer": "Отговор"
    }
  ]
}

ВАЖНО:
- Отговори САМО с валиден JSON обект
- Не добавяй коментари или друг текст извън JSON
- Използвай български език
- Бъди точен, грамотен и маркетингово компетентен
- Ако липсва информация за поле, използвай null или празен масив []
- Базирай се на твоите знания за подобни продукти`;

    try {
        const model = '@cf/meta/llama-3.1-70b-instruct';
        const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/ai/run/${model}`;
        
        const payload = {
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4096,
            temperature: 0.3
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
            console.error("AI API Request Failed. Status:", response.status, "Body:", resultText);
            throw new UserFacingError("AI сървърът върна грешка. Моля, опитайте отново.", 500);
        }
        
        const aiEnvelope = JSON.parse(resultText);
        if (!aiEnvelope.result || !aiEnvelope.result.response) {
            throw new Error("AI response is missing the 'result.response' field.");
        }
        
        let aiResponseText = aiEnvelope.result.response;
        
        // Извличаме JSON от отговора
        let extractedData;
        if (typeof aiResponseText === 'string') {
            // Use non-greedy match to find the first complete JSON object
            const jsonMatch = aiResponseText.match(/{[^{}]*(?:{[^{}]*}[^{}]*)*}/);
            if (!jsonMatch) {
                console.error("AI returned a string without JSON structure:", aiResponseText);
                throw new UserFacingError('AI отговори с текст без JSON структура. Моля опитайте отново или опростете заявката.');
            }
            try {
                extractedData = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                console.error("Failed to parse JSON from AI response:", jsonMatch[0], parseError);
                throw new UserFacingError('AI отговори с невалиден JSON формат. Моля опитайте отново.');
            }
        } else {
            extractedData = aiResponseText;
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
        throw new UserFacingError("Грешка при обработка на AI заявката.", 500);
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
