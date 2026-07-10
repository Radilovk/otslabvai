/**
 * Резолвира AI настройки и API ключ от KV, Worker secrets и заявка.
 * Приоритет за apiKey: заявка → ai_settings в KV → provider KV → Worker secret.
 */

export async function resolveAIApiKey(env, aiSettings) {
  if (aiSettings?.apiKey) return aiSettings.apiKey;

  const provider = aiSettings?.provider;
  if (provider === 'openai' && env.OPENAI_API_KEY) return env.OPENAI_API_KEY;
  if (provider === 'google' && (env.GOOGLE_AI_API_KEY || env.GEMINI_API_KEY)) {
    return env.GOOGLE_AI_API_KEY || env.GEMINI_API_KEY;
  }

  if (!env.PAGE_CONTENT) return '';

  if (provider) {
    const providerKey = await env.PAGE_CONTENT.get(`ai_${provider}_api_key`);
    if (providerKey) return providerKey;
  }
  const genericKey = await env.PAGE_CONTENT.get('ai_api_key');
  return genericKey || '';
}

export async function loadResolvedAISettings(env, settingsOverride = null, getDefaultAISettings) {
  const settingsJson = await env.PAGE_CONTENT?.get('ai_settings');
  const kvSettings = settingsJson ? JSON.parse(settingsJson) : getDefaultAISettings();
  const merged = settingsOverride ? { ...kvSettings, ...settingsOverride } : { ...kvSettings };
  const apiKey = await resolveAIApiKey(env, merged);
  return { ...merged, apiKey };
}

export async function persistAISettings(env, settings, ctx) {
  const toSave = { ...settings };
  const puts = [env.PAGE_CONTENT.put('ai_settings', JSON.stringify(toSave, null, 2))];
  if (settings.apiKey) {
    puts.push(env.PAGE_CONTENT.put('ai_api_key', settings.apiKey));
    if (settings.provider) {
      puts.push(env.PAGE_CONTENT.put(`ai_${settings.provider}_api_key`, settings.apiKey));
    }
  }
  if (ctx?.waitUntil) {
    puts.forEach((p) => ctx.waitUntil(p));
  } else {
    await Promise.all(puts);
  }
}
