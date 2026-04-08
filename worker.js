// ==== ВЕРСИЯ 4.0: ФУНКЦИОНАЛЕН АДМИН ПАНЕЛ ====

// Cache configuration constants
const CACHE_CONFIG = {
    PAGE_CONTENT_MAX_AGE: 300,        // 5 minutes
    PAGE_CONTENT_STALE_WHILE_REVALIDATE: 60,  // 1 minute
};

// GitHub sync configuration – keeps backend/page_content.json in the repo in sync with KV
const GITHUB_SYNC_CONFIG = {
    owner: 'Radilovk',
    repo: 'otslabvai',
    branch: 'main',
    filePath: 'backend/page_content.json'
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
    
    try {
      let response;
      
      switch (url.pathname) {
          case '/quest-submit':
            response = await handleQuestSubmit(request, env, ctx);
            break;

          case '/quest-ai-followup':
            if (request.method === 'POST') {
              response = await handleQuestAIFollowup(request, env);
            } else {
              response = methodNotAllowed();
            }
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
          
          case '/life_page_content.json':
            if (request.method === 'GET') {
                response = await handleGetLifePageContent(request, env);
            } else if (request.method === 'POST') {
                response = await handleSaveLifePageContent(request, env, ctx);
            } else {
                throw new UserFacingError('Method Not Allowed.', 405);
            }
            break;

          case '/orders':
              if (request.method === 'GET') {
                  response = await handleGetOrders(request, env);
              } else if (request.method === 'POST') {
                  response = await handleCreateOrder(request, env);
              } else if (request.method === 'PUT') {
                  response = await handleUpdateOrderStatus(request, env);
              } else {
                  throw new UserFacingError('Method Not Allowed.', 405);
              }
              break;
          
          case '/contacts':
              if (request.method === 'GET') {
                  response = await handleGetContacts(request, env);
              } else if (request.method === 'POST') {
                  response = await handleCreateContact(request, env);
              } else {
                  throw new UserFacingError('Method Not Allowed.', 405);
              }
              break;
          
          case '/promo-codes':
              if (request.method === 'GET') {
                  response = await handleGetPromoCodes(request, env);
              } else if (request.method === 'POST') {
                  response = await handleCreatePromoCode(request, env, ctx);
              } else if (request.method === 'PUT') {
                  response = await handleUpdatePromoCode(request, env, ctx);
              } else if (request.method === 'DELETE') {
                  response = await handleDeletePromoCode(request, env, ctx);
              } else {
                  throw new UserFacingError('Method Not Allowed.', 405);
              }
              break;
          
          case '/validate-promo':
              if (request.method === 'POST') {
                  response = await handleValidatePromo(request, env, ctx);
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
          
          case '/api-token':
              if (request.method === 'GET') {
                  response = await handleGetApiToken(env);
              } else {
                  throw new UserFacingError('Method Not Allowed.', 405);
              }
              break;

          case '/bio_content.json':
              if (request.method === 'GET') {
                  response = await handleGetBioContent(request, env);
              } else if (request.method === 'POST') {
                  response = await handleSaveBioContent(request, env, ctx);
              } else {
                  throw new UserFacingError('Method Not Allowed.', 405);
              }
              break;

          case '/bio_rebake':
              if (request.method === 'POST') {
                  response = await handleBioRebake(env);
              } else {
                  throw new UserFacingError('Method Not Allowed.', 405);
              }
              break;

          default:
            throw new UserFacingError('Not Found', 404);
        }

      // Добавяме CORS хедъри към всеки успешен отговор
      Object.keys(corsHeaders).forEach(key => {
        response.headers.set(key, corsHeaders[key]);
      });
      return response;

    } catch (e) {
      const statusCode = e instanceof UserFacingError ? e.status : 500;
      // Log unexpected server errors; skip logging for expected 404s (e.g. bots hitting the API root).
      if (statusCode !== 404) {
        console.error("Top-level error:", e.stack);
      }
      const userErrorMessage = (e instanceof UserFacingError) 
        ? e.message 
        : "An unexpected internal error occurred.";
        
      const errorResponse = new Response(JSON.stringify({ error: userErrorMessage }), { 
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      return errorResponse;
    }
  },
};


// --- СПЕЦИФИЧНИ ОБРАБОТЧИЦИ НА ЕНДПОЙНТИ ---

/**
 * Handles GET /page_content.json
 * Falls back to static_backend_page_content.json if the dynamic KV key is not set.
 */
async function handleGetPageContent(request, env) {
    let pageContent = await env.PAGE_CONTENT.get('page_content');
    if (pageContent === null) {
        // Fallback: use the static copy uploaded from backend/page_content.json
        pageContent = await env.PAGE_CONTENT.get('static_backend_page_content.json');
    }
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
 * Syncs the page_content JSON to backend/page_content.json in the GitHub repository.
 * Uses ctx.waitUntil so it runs after the response is sent and does not block the user.
 * Requires GITHUB_API_TOKEN env var or 'api_token' KV key to be set.
 * @param {string} content - The JSON content to sync
 * @param {object} env - Worker environment bindings
 */
async function syncPageContentToGitHub(content, env) {
    try {
        const token = env.GITHUB_API_TOKEN || await env.PAGE_CONTENT.get('api_token');
        if (!token) {
            console.warn('syncPageContentToGitHub: no GitHub token available, skipping sync');
            return;
        }

        const { owner, repo, branch, filePath } = GITHUB_SYNC_CONFIG;
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

        // Fetch current file SHA (required by GitHub API to update an existing file)
        const getResponse = await fetch(`${apiUrl}?ref=${branch}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Cloudflare-Worker'
            }
        });

        let sha = null;
        if (getResponse.ok) {
            const fileData = await getResponse.json();
            sha = fileData.sha;
        }

        // base64-encode the UTF-8 content for the GitHub API
        const bytes = new TextEncoder().encode(content);
        const base64Content = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));

        const payload = {
            message: 'sync: update page_content from admin panel [skip ci]',
            content: base64Content,
            branch
        };
        if (sha) payload.sha = sha;

        const putResponse = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Cloudflare-Worker'
            },
            body: JSON.stringify(payload)
        });

        if (!putResponse.ok) {
            const errText = await putResponse.text();
            console.error(`syncPageContentToGitHub failed: ${putResponse.status} - ${errText}`);
        } else {
            console.log('syncPageContentToGitHub: GitHub sync successful');
        }
    } catch (err) {
        console.error('syncPageContentToGitHub error:', err);
    }
}

/**
 * Handles POST /page_content.json
 * Saves content to KV and asynchronously syncs it to the GitHub repository.
 */
async function handleSavePageContent(request, env, ctx) {
    const contentToSave = await request.text();
    try {
        // Проверяваме дали е валиден JSON, преди да запишем
        JSON.parse(contentToSave);
        ctx.waitUntil(Promise.all([
            env.PAGE_CONTENT.put('page_content', contentToSave),
            syncPageContentToGitHub(contentToSave, env)
        ]));
        return new Response(JSON.stringify({ success: true, message: 'Content saved.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        if (e instanceof UserFacingError) throw e;
        throw new UserFacingError("Invalid JSON provided in the request body.", 400);
    }
}

/**
 * Handles GET /life_page_content.json
 * Falls back to static_backend_life_page_content.json if the dynamic KV key is not set.
 */
async function handleGetLifePageContent(request, env) {
    let pageContent = await env.PAGE_CONTENT.get('life_page_content');
    if (pageContent === null) {
        pageContent = await env.PAGE_CONTENT.get('static_backend_life_page_content.json');
    }
    if (pageContent === null) {
        throw new UserFacingError("Life content not found.", 404);
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
 * Handles POST /life_page_content.json
 * Saves life content to KV and asynchronously syncs it to the GitHub repository.
 */
async function handleSaveLifePageContent(request, env, ctx) {
    const contentToSave = await request.text();
    try {
        JSON.parse(contentToSave);
        ctx.waitUntil(Promise.all([
            env.PAGE_CONTENT.put('life_page_content', contentToSave),
            syncLifePageContentToGitHub(contentToSave, env)
        ]));
        return new Response(JSON.stringify({ success: true, message: 'Life content saved.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        if (e instanceof UserFacingError) throw e;
        throw new UserFacingError("Invalid JSON provided in the request body.", 400);
    }
}

/**
 * Syncs life_page_content JSON to backend/life_page_content.json in the GitHub repository.
 */
async function syncLifePageContentToGitHub(content, env) {
    try {
        const token = env.GITHUB_API_TOKEN || await env.PAGE_CONTENT.get('api_token');
        if (!token) {
            console.warn('syncLifePageContentToGitHub: no GitHub token available, skipping sync');
            return;
        }

        const { owner, repo, branch } = GITHUB_SYNC_CONFIG;
        const filePath = 'backend/life_page_content.json';
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

        const getResponse = await fetch(`${apiUrl}?ref=${branch}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Cloudflare-Worker'
            }
        });

        let sha = null;
        if (getResponse.ok) {
            const fileData = await getResponse.json();
            sha = fileData.sha;
        }

        const bytes = new TextEncoder().encode(content);
        const base64Content = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));

        const payload = {
            message: 'sync: update life_page_content from admin panel [skip ci]',
            content: base64Content,
            branch
        };
        if (sha) payload.sha = sha;

        const putResponse = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Cloudflare-Worker'
            },
            body: JSON.stringify(payload)
        });

        if (!putResponse.ok) {
            const errText = await putResponse.text();
            console.error(`syncLifePageContentToGitHub failed: ${putResponse.status} - ${errText}`);
        } else {
            console.log('syncLifePageContentToGitHub: GitHub sync successful');
        }
    } catch (err) {
        console.error('syncLifePageContentToGitHub error:', err);
    }
}

/**
 * Handles GET /bio_content.json
 * Returns bio page overrides stored in KV, or empty object if none exist yet.
 */
async function handleGetBioContent(request, env) {
    const bioContent = await env.PAGE_CONTENT.get('bio_content');
    const body = bioContent !== null ? bioContent : '{}';
    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        }
    });
}

/**
 * Handles POST /bio_content.json
 * Saves bio page overrides to KV AND commits bio_content.json to GitHub.
 * This ensures both KV and repo are always in sync, and triggers deploy
 * which bakes the content into bio.html for static serving.
 */
async function handleSaveBioContent(request, env, ctx) {
    const contentToSave = await request.text();
    let parsed;
    try {
        // Validate that the body is valid JSON before storing
        parsed = JSON.parse(contentToSave);
        if (typeof parsed !== 'object' || parsed === null) {
            throw new UserFacingError('Expected a JSON object in the request body.', 400);
        }
    } catch (e) {
        if (e instanceof UserFacingError) throw e;
        throw new UserFacingError('Invalid JSON provided in the request body.', 400);
    }

    // 1. Save to KV immediately (for fast reads)
    await env.PAGE_CONTENT.put('bio_content', contentToSave);

    // 2. Commit to GitHub (triggers deploy which bakes into bio.html)
    // Use ctx.waitUntil to ensure this completes even after response is sent
    const token = env.GITHUB_API_TOKEN || await env.PAGE_CONTENT.get('api_token');
    let message = 'Bio content saved to KV.';
    
    if (token && ctx) {
        ctx.waitUntil(
            commitBioContentToGitHub(env, token, parsed).catch(err => {
                console.error('Background GitHub commit failed:', err);
            })
        );
        message = 'Bio content saved. Changes will be baked into site shortly.';
    } else if (!token) {
        message = 'Bio content saved to KV. GitHub sync not configured (no token).';
        console.warn('handleSaveBioContent: GitHub token not configured, skipping auto-commit');
    }

    return new Response(JSON.stringify({ 
        success: true, 
        message 
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Helper function to commit bio_content.json to GitHub.
 * Used by both handleSaveBioContent (fire-and-forget) and handleBioRebake (sync).
 * @throws {UserFacingError} when GitHub API calls fail
 */
async function commitBioContentToGitHub(env, token, parsed) {
    const { owner, repo, branch } = GITHUB_SYNC_CONFIG;
    const filePath = 'bio_content.json';
    const apiHeaders = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Cloudflare-Worker'
    };

    // Get current sha of bio_content.json from GitHub (required for the PUT)
    const metaResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
        { headers: apiHeaders }
    );
    if (!metaResponse.ok) {
        throw new UserFacingError('Failed to read bio_content.json metadata from GitHub.', 502);
    }
    const fileMeta = await metaResponse.json();
    const sha = fileMeta.sha;

    // Commit bio_content.json to GitHub
    const prettyJson = JSON.stringify(parsed, null, 2);
    const encodedBytes = new TextEncoder().encode(prettyJson);
    const base64Content = btoa(Array.from(encodedBytes, b => String.fromCharCode(b)).join(''));

    const putResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Cloudflare-Worker'
        },
        body: JSON.stringify({
            message: 'sync: update bio_content.json from admin panel',
            content: base64Content,
            branch,
            sha
        })
    });

    if (!putResponse.ok) {
        const errText = await putResponse.text();
        console.error(`commitBioContentToGitHub failed: ${putResponse.status} - ${errText}`);
        throw new UserFacingError('Failed to commit bio_content.json to GitHub.', 502);
    }

    console.log('commitBioContentToGitHub: bio_content.json committed to GitHub — deploy will bake into bio.html');
}

/**
 * Handles POST /bio_rebake
 * Reads bio_content from KV and commits it as bio_content.json to GitHub.
 * The deploy workflow then bakes bio_content.json into bio.html automatically
 * and syncs it back to KV — keeping repo file, KV, and deployed site in sync.
 * 
 * Note: Since handleSaveBioContent now auto-commits to GitHub, this endpoint
 * is mainly for manual re-sync if needed.
 */
async function handleBioRebake(env) {
    const token = env.GITHUB_API_TOKEN || await env.PAGE_CONTENT.get('api_token');
    if (!token) {
        throw new UserFacingError('GitHub token not configured.', 503);
    }

    // 1. Read latest bio_content from KV and validate
    const bioContentRaw = await env.PAGE_CONTENT.get('bio_content');
    if (!bioContentRaw) {
        throw new UserFacingError('No bio content found in KV.', 404);
    }
    const parsed = JSON.parse(bioContentRaw); // Validate JSON

    // 2. Commit to GitHub using the helper function
    await commitBioContentToGitHub(env, token, parsed);

    return new Response(JSON.stringify({ 
        success: true, 
        message: 'Bio content committed as bio_content.json to GitHub — deploy workflow will bake it into bio.html automatically.' 
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
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
async function handleCreateOrder(request, env) {
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
    
    // Запазваме обратно в KV – await гарантира, че записът е завършен преди да върнем 201,
    // така поръчката не може да бъде изгубена дори при нестандартно прекратяване на Worker-а.
    await env.PAGE_CONTENT.put('orders', JSON.stringify(orders, null, 2));
    
    return new Response(JSON.stringify({ success: true, order: newOrder }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * --- НОВА ФУНКЦИЯ ---
 * Handles PUT /orders (за промяна на статус)
 */
async function handleUpdateOrderStatus(request, env) {
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
    
    await env.PAGE_CONTENT.put('orders', JSON.stringify(orders, null, 2));
    
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
async function handleCreateContact(request, env) {
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
        source: contactData.source || '',
        status: 'Нов'
    };
    
    // Четем съществуващите контакти
    const contactsJson = await env.PAGE_CONTENT.get('contacts');
    let contacts = contactsJson ? JSON.parse(contactsJson) : [];
    
    // Добавяме новия контакт
    contacts.push(newContact);
    
    // Запазваме обратно в KV – await гарантира, че записът е завършен преди да върнем 201.
    await env.PAGE_CONTENT.put('contacts', JSON.stringify(contacts, null, 2));
    
    return new Response(JSON.stringify({ success: true, contact: newContact }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * --- НОВА ФУНКЦИЯ ---
 * Handles GET /promo-codes
 */
async function handleGetPromoCodes(request, env) {
    const promoCodesJson = await env.PAGE_CONTENT.get('promo_codes');
    const promoCodes = promoCodesJson ? JSON.parse(promoCodesJson) : [];
    return new Response(JSON.stringify(promoCodes), {
        status: 200,
        headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
    });
}

/**
 * --- НОВА ФУНКЦИЯ ---
 * Handles POST /promo-codes (създаване на нов промо код)
 */
async function handleCreatePromoCode(request, env, ctx) {
    let promoData;
    try {
        promoData = await request.json();
    } catch (e) {
        throw new UserFacingError("Невалиден JSON формат на заявката.", 400);
    }
    
    if (!promoData || !promoData.code || promoData.discount === undefined) {
        throw new UserFacingError("Липсват задължителни данни за промо кода.", 400);
    }
    
    // Генерираме уникален ID
    const newPromoCode = {
        id: `promo-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        code: promoData.code.toUpperCase().trim(),
        discount: parseFloat(promoData.discount),
        discountType: promoData.discountType || 'percentage',
        description: promoData.description || '',
        validFrom: promoData.validFrom || new Date().toISOString(),
        validUntil: promoData.validUntil || null,
        maxUses: promoData.maxUses ? parseInt(promoData.maxUses) : null,
        usedCount: 0,
        active: promoData.active !== false,
        createdAt: new Date().toISOString()
    };
    
    // Четем съществуващите промо кодове
    const promoCodesJson = await env.PAGE_CONTENT.get('promo_codes');
    let promoCodes = promoCodesJson ? JSON.parse(promoCodesJson) : [];
    
    // Проверяваме дали кодът вече съществува
    if (promoCodes.some(pc => pc.code === newPromoCode.code)) {
        throw new UserFacingError("Промо код с такъв код вече съществува.", 400);
    }
    
    // Добавяме новия промо код
    promoCodes.push(newPromoCode);
    
    // Запазваме обратно в KV
    ctx.waitUntil(env.PAGE_CONTENT.put('promo_codes', JSON.stringify(promoCodes, null, 2)));
    
    return new Response(JSON.stringify({ success: true, promoCode: newPromoCode }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * --- НОВА ФУНКЦИЯ ---
 * Handles PUT /promo-codes (актуализация на промо код)
 */
async function handleUpdatePromoCode(request, env, ctx) {
    const updateData = await request.json();
    if (!updateData || !updateData.id) {
        throw new UserFacingError("Липсва ID на промо кода.", 400);
    }
    
    const promoCodesJson = await env.PAGE_CONTENT.get('promo_codes');
    let promoCodes = promoCodesJson ? JSON.parse(promoCodesJson) : [];
    
    const promoIndex = promoCodes.findIndex(pc => pc.id === updateData.id);
    if (promoIndex === -1) {
        throw new UserFacingError(`Промо код с ID ${updateData.id} не е намерен.`, 404);
    }
    
    // Ако се променя кодът, проверяваме дали новият код не съществува вече
    if (updateData.code && updateData.code.toUpperCase() !== promoCodes[promoIndex].code) {
        if (promoCodes.some(pc => pc.code === updateData.code.toUpperCase() && pc.id !== updateData.id)) {
            throw new UserFacingError("Промо код с такъв код вече съществува.", 400);
        }
    }
    
    // Актуализираме полетата
    promoCodes[promoIndex] = {
        ...promoCodes[promoIndex],
        code: updateData.code ? updateData.code.toUpperCase().trim() : promoCodes[promoIndex].code,
        discount: updateData.discount !== undefined ? parseFloat(updateData.discount) : promoCodes[promoIndex].discount,
        discountType: updateData.discountType || promoCodes[promoIndex].discountType,
        description: updateData.description !== undefined ? updateData.description : promoCodes[promoIndex].description,
        validFrom: updateData.validFrom || promoCodes[promoIndex].validFrom,
        validUntil: updateData.validUntil !== undefined ? updateData.validUntil : promoCodes[promoIndex].validUntil,
        maxUses: updateData.maxUses !== undefined ? (updateData.maxUses ? parseInt(updateData.maxUses) : null) : promoCodes[promoIndex].maxUses,
        active: updateData.active !== undefined ? updateData.active : promoCodes[promoIndex].active,
        usedCount: updateData.usedCount !== undefined ? parseInt(updateData.usedCount) : promoCodes[promoIndex].usedCount
    };
    
    ctx.waitUntil(env.PAGE_CONTENT.put('promo_codes', JSON.stringify(promoCodes, null, 2)));
    
    return new Response(JSON.stringify({ success: true, promoCode: promoCodes[promoIndex] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * --- НОВА ФУНКЦИЯ ---
 * Handles DELETE /promo-codes (изтриване на промо код)
 */
async function handleDeletePromoCode(request, env, ctx) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
        throw new UserFacingError("Липсва ID на промо кода за изтриване.", 400);
    }
    
    const promoCodesJson = await env.PAGE_CONTENT.get('promo_codes');
    let promoCodes = promoCodesJson ? JSON.parse(promoCodesJson) : [];
    
    const promoIndex = promoCodes.findIndex(pc => pc.id === id);
    if (promoIndex === -1) {
        throw new UserFacingError(`Промо код с ID ${id} не е намерен.`, 404);
    }
    
    const deletedPromoCode = promoCodes[promoIndex];
    promoCodes.splice(promoIndex, 1);
    
    ctx.waitUntil(env.PAGE_CONTENT.put('promo_codes', JSON.stringify(promoCodes, null, 2)));
    
    return new Response(JSON.stringify({ success: true, deletedPromoCode }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * --- НОВА ФУНКЦИЯ ---
 * Handles POST /validate-promo (валидация на промо код при поръчка)
 */
async function handleValidatePromo(request, env, ctx) {
    let validationData;
    try {
        validationData = await request.json();
    } catch (e) {
        throw new UserFacingError("Невалиден JSON формат на заявката.", 400);
    }
    
    if (!validationData || !validationData.code) {
        throw new UserFacingError("Липсва промо код за валидация.", 400);
    }
    
    const code = validationData.code.toUpperCase().trim();
    
    // Четем промо кодовете
    const promoCodesJson = await env.PAGE_CONTENT.get('promo_codes');
    let promoCodes = promoCodesJson ? JSON.parse(promoCodesJson) : [];
    
    const promoCode = promoCodes.find(pc => pc.code === code);
    
    if (!promoCode) {
        return new Response(JSON.stringify({ 
            valid: false, 
            error: 'Невалиден промо код.' 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Проверяваме дали е активен
    if (!promoCode.active) {
        return new Response(JSON.stringify({ 
            valid: false, 
            error: 'Промо кодът не е активен.' 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Проверяваме валидност по дата
    const now = new Date();
    if (promoCode.validFrom && new Date(promoCode.validFrom) > now) {
        return new Response(JSON.stringify({ 
            valid: false, 
            error: 'Промо кодът все още не е валиден.' 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    if (promoCode.validUntil && new Date(promoCode.validUntil) < now) {
        return new Response(JSON.stringify({ 
            valid: false, 
            error: 'Промо кодът е изтекъл.' 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Проверяваме използвания
    if (promoCode.maxUses && promoCode.usedCount >= promoCode.maxUses) {
        return new Response(JSON.stringify({ 
            valid: false, 
            error: 'Промо кодът е изчерпан.' 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Ако трябва да увеличим броя използвания
    if (validationData.incrementUsage) {
        // Re-fetch to minimize race condition window
        const freshPromoCodesJson = await env.PAGE_CONTENT.get('promo_codes');
        const freshPromoCodes = freshPromoCodesJson ? JSON.parse(freshPromoCodesJson) : [];
        const promoIndex = freshPromoCodes.findIndex(pc => pc.id === promoCode.id);
        
        if (promoIndex !== -1) {
            // Double-check usage limit with fresh data
            if (freshPromoCodes[promoIndex].maxUses && 
                freshPromoCodes[promoIndex].usedCount >= freshPromoCodes[promoIndex].maxUses) {
                return new Response(JSON.stringify({ 
                    valid: false, 
                    error: 'Промо кодът е изчерпан.' 
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            freshPromoCodes[promoIndex].usedCount += 1;
            // Note: In high-traffic scenarios, consider using Durable Objects for atomic operations
            ctx.waitUntil(env.PAGE_CONTENT.put('promo_codes', JSON.stringify(freshPromoCodes, null, 2)));
        }
    }
    
    return new Response(JSON.stringify({ 
        valid: true, 
        promoCode: {
            code: promoCode.code,
            discount: promoCode.discount,
            discountType: promoCode.discountType,
            description: promoCode.description
        }
    }), {
        status: 200,
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
 * Handles GET /api-token (Get GitHub API token for image upload)
 * Returns token from environment variable (more secure than KV)
 */
async function handleGetApiToken(env) {
    // First try to get from environment variable (most secure)
    let apiToken = env.GITHUB_API_TOKEN || null;
    
    // Fallback to KV storage for backward compatibility
    if (!apiToken) {
        apiToken = await env.PAGE_CONTENT.get('api_token');
    }
    
    return new Response(JSON.stringify({ 
        api_token: apiToken || null 
    }), {
        status: 200,
        headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        }
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
        maxTokens: 8192,
        promptTemplate: `Ти си експерт по хранителни добавки и продукти за отслабване. Ще получиш информация за продукт и трябва да попълниш ВСИЧКИ възможни полета в JSON формат, базирайки се на твоите знания за този тип продукти.

ФОРМАТ НА ОТГОВОРА:
- Отговори САМО с валиден JSON обект - БЕЗ текст, коментари или обяснения
- Започни директно с { и завърши с }
- НЕ използвай markdown code blocks

ПРИМЕР ЗА ВАЛИДЕН JSON С МАСИВИ (забележи запетаите между елементите):
{
  "effects": [
    {"label": "Първи ефект", "value": 80},
    {"label": "Втори ефект", "value": 90},
    {"label": "Трети ефект", "value": 70}
  ],
  "ingredients": [
    {"name": "Първа съставка", "amount": "100mg", "description": "Описание 1"},
    {"name": "Втора съставка", "amount": "200mg", "description": "Описание 2"}
  ]
}

Пълен пример за правилно форматиран JSON обект:


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
      "value": 80
    },
    {
      "label": "Енергия и издръжливост",
      "value": 90
    },
    {
      "label": "Възстановяване след тренировка",
      "value": 70
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

НАЙ-ВАЖНО: Провери отговора си 3 пъти преди да го изпратиш!
✅ ИМА ЛИ ЗАПЕТАЯ след всеки елемент в масива "effects" освен последния?
✅ ИМА ЛИ ЗАПЕТАЯ след всеки елемент в масива "ingredients" освен последния?
✅ ИМА ЛИ ЗАПЕТАЯ след всеки елемент в масива "benefits" освен последния?
✅ ИМА ЛИ ЗАПЕТАЯ след всеки елемент в масива "faq" освен последния?
✅ НЯМА ЛИ ЗАПЕТАЯ след последния елемент в който и да е масив или обект?

КРИТИЧНО ВАЖНО - СИСТЕМНИ ДАННИ (задължителни полета):
✅ "manufacturer" - винаги попълни с разумен производител (ако не е известен, използвай типичен производител за този тип продукт)
✅ "application_type" - задължително едно от: "Oral", "Injectable", "Intranasal", "Topical", "Injectable / Oral / Topical"
✅ "inventory" - ВИНАГИ задай положително число (минимум 10, препоръчително 50-100). НИКОГА не използвай 0!
✅ "goals" - задължително попълни с подходящи цели, разделени с запетая
✅ "target_profile" - задължително опиши идеалния потребителски профил
✅ "protocol_hint" - задължително дай технически насоки за употреба
✅ "safety_warnings" - задължително дай предупреждения за безопасност

КРИТИЧНО ВАЖНО - ПРАВИЛА ЗА ЛИПСВАЩА ИНФОРМАЦИЯ:
⚠️ НИКОГА не използвай думи като "неуточнено", "не е посочено", "липсва информация", "неизвестно" или подобни в полета за количества, опаковка или други данни
⚠️ Ако липсва информация за количества (capsules_or_grams, doses_per_package, amount), използвай null или празен низ ""
⚠️ Винаги бъди професионален и маркетингово компетентен - не пиши нищо, което би намалило доверието на клиента
⚠️ Ако не знаеш информация, по-добре е да оставиш полето празно (null или "") отколкото да пишеш нещо непрофесионално
✅ Добре: "capsules_or_grams": null или "capsules_or_grams": ""
❌ Лошо: "capsules_or_grams": "неуточнено" или "capsules_or_grams": "не е посочено"

Използвай СЪЩАТА структура и форматиране за твоя отговор. Попълни с подходящи данни за продукта, описан от потребителя.`
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
    
    // Create messages array using system/user split when possible, with legacy fallback.
    const productDataJson = JSON.stringify(productData, null, 2);
    const messages = buildAIMessages(aiSettings.promptTemplate, productDataJson);
    
    try {
        let extractedData;
        
        // Call appropriate AI provider
        switch (aiSettings.provider) {
            case 'cloudflare':
                extractedData = await callCloudflareAI(env, aiSettings, messages);
                break;
            case 'openai':
                extractedData = await callOpenAI(aiSettings, messages);
                break;
            case 'google':
                extractedData = await callGoogleAI(aiSettings, messages);
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
 * Build the messages array for an AI API call.
 *
 * New-style templates (no {{productData}} placeholder) receive the instructions
 * as a system message and the product data as a separate user message.  Keeping
 * instructions and data in separate roles prevents the AI from confusing product
 * text with formatting directives and lets the provider's JSON-mode constraint
 * apply cleanly to the assistant turn.
 *
 * Legacy templates that still embed {{productData}} in the body are sent as a
 * single user message so that existing stored configurations keep working.
 */
function buildAIMessages(template, productDataJson) {
    if (template.includes('{{productData}}')) {
        // Legacy mode: single user message with full combined prompt.
        // Use a function replacement so special $ patterns in the data are not
        // interpreted as replacement specifiers by String.replace().
        const prompt = template.replace('{{productData}}', () => productDataJson);
        return [{ role: 'user', content: prompt }];
    }
    // New mode: system instructions + user data (clean separation)
    return [
        { role: 'system', content: template },
        { role: 'user', content: `Въведена информация за продукта:\n${productDataJson}` }
    ];
}

/**
 * Call Cloudflare AI
 */
async function callCloudflareAI(env, settings, messages) {
    const model = settings.model || '@cf/meta/llama-3.1-70b-instruct';
    const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/ai/run/${model}`;
    
    const payload = {
        messages: messages,
        max_tokens: settings.maxTokens || 4096,
        temperature: settings.temperature || 0.3,
        // Instruct the model's sampler to produce only valid JSON tokens.
        // This is the primary prevention: invalid JSON cannot be generated.
        response_format: { type: 'json_object' }
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
    
    return JSON.parse(aiEnvelope.result.response);
}

/**
 * Call OpenAI API
 */
async function callOpenAI(settings, messages) {
    const model = settings.model || 'gpt-4';
    const endpoint = 'https://api.openai.com/v1/chat/completions';
    
    const payload = {
        model: model,
        messages: messages,
        max_tokens: settings.maxTokens || 4096,
        temperature: settings.temperature || 0.3,
        // Force the model to output only valid JSON — primary prevention mechanism.
        response_format: { type: 'json_object' }
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
    
    if (result.choices[0].finish_reason === 'length') {
        throw new UserFacingError(
            "AI отговорът е прекъснат поради ограничение на токените. Увеличете 'Максимум токени' в настройките на AI асистента (препоръчително: 8192).",
            500
        );
    }
    
    return JSON.parse(result.choices[0].message.content);
}

/**
 * Call Google AI (Gemini)
 */
async function callGoogleAI(settings, messages) {
    const model = settings.model || 'gemini-2.0-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.apiKey}`;

    // Map the messages array to Google's format.
    // A system-role message becomes a top-level systemInstruction.
    const systemMsg = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');
    
    const payload = {
        ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg.content }] } } : {}),
        // Google's REST API only accepts 'user' and 'model' turn roles in `contents`;
        // all non-system messages therefore map to 'user'.
        contents: userMessages.map(m => ({ role: 'user', parts: [{ text: m.content }] })),
        generationConfig: {
            temperature: settings.temperature || 0.3,
            maxOutputTokens: settings.maxTokens || 4096,
            // Instruct Gemini to produce only valid JSON — primary prevention mechanism.
            responseMimeType: 'application/json'
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
    
    const candidate = result.candidates[0];
    if (candidate.finishReason === 'MAX_TOKENS') {
        throw new UserFacingError(
            "AI отговорът е прекъснат поради ограничение на токените. Увеличете 'Максимум токени' в настройките на AI асистента (препоръчително: 8192).",
            500
        );
    }
    
    const textContent = candidate.content.parts[0].text;
    return JSON.parse(textContent);
}

/**
 * Handles POST /quest-ai-followup
 * Receives all questionnaire data and generates 2-3 clarifying AI questions
 */
async function handleQuestAIFollowup(request, env) {
  const formData = await request.json();
  if (!formData) {
    throw new UserFacingError("Липсват данни от въпросника.", 400);
  }

  if (!env.ACCOUNT_ID || !env.AI_TOKEN) {
    throw new Error("Cloudflare Account/AI credentials are not configured.");
  }

  const model = '@cf/meta/llama-3.1-70b-instruct';
  const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/ai/run/${model}`;

  const systemPrompt = `Ти си експерт-нутриционист и здравен консултант. Получаваш попълнен въпросник от клиент, който иска персонализирана програма включваща: хранителен план, протокол за прием на хранителни добавки, психологическа подкрепа, общи здравни съвети и начин на живот.

Твоята задача е да зададеш 2-3 допълнителни уточняващи въпроса, които ще ти помогнат да изготвиш по-точна и персонализирана програма. 

ПРАВИЛА:
- НЕ повтаряй въпроси, на които клиентът вече е отговорил
- Въпросите трябва да са конкретни и релевантни на базата на дадените отговори
- Фокусирай се върху неясноти или области, които изискват повече детайли
- Въпросите трябва да са на български език
- Бъди учтив и професионален

Отговори САМО с валиден JSON в следния формат:
{"questions": ["Въпрос 1?", "Въпрос 2?", "Въпрос 3?"]}`;

  const payload = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Ето данните от въпросника на клиента:\n${JSON.stringify(formData, null, 2)}` }
    ],
    max_tokens: 512,
    temperature: 0.4,
    response_format: { type: 'json_object' }
  };

  const response = await fetch(cfEndpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.AI_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const resultText = await response.text();
  if (!response.ok) {
    console.error("AI followup request failed. Status:", response.status, "Body:", resultText);
    throw new UserFacingError("AI сървърът върна грешка при генериране на допълнителни въпроси.");
  }

  try {
    const aiEnvelope = JSON.parse(resultText);
    if (!aiEnvelope.result || !aiEnvelope.result.response) {
      throw new Error("AI response missing 'result.response'.");
    }
    let data = aiEnvelope.result.response;
    if (typeof data === 'string') {
      const jsonMatch = data.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in AI response string.");
      data = JSON.parse(jsonMatch[0]);
    }
    if (!data.questions || !Array.isArray(data.questions)) {
      data = { questions: [] };
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error("Failed to parse AI followup response:", resultText, e);
    // Return empty questions on parse failure so user can still proceed
    return new Response(JSON.stringify({ questions: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handles POST /quest-submit
 */
async function handleQuestSubmit(request, env, ctx) {
  const formData = await request.json();
  if (!formData || !formData.name || !formData.age) {
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
  // Use function replacements to prevent special $ patterns in the data
  // (e.g. $', $&, $`) from being interpreted as replacement specifiers by String.replace().
  const finalPrompt = mainPromptTemplate
    .replace('{{productList}}', () => JSON.stringify(productList, null, 2))
    .replace('{{clientData}}', () => JSON.stringify(formData, null, 2));
  const model = '@cf/meta/llama-3.1-70b-instruct';
  const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/ai/run/${model}`;
  const payload = {
    messages: [{ role: 'system', content: finalPrompt }],
    max_tokens: 2048,
    temperature: 0.2,
    // Force valid JSON output — primary prevention mechanism.
    response_format: { type: 'json_object' }
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

