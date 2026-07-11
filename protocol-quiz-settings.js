import { getDefaultProtocolQuizPrompt } from './protocol-quiz-prompt.js';

export function getDefaultLifeProtocolSettings() {
  return {
    enabled: true,
    prompt: getDefaultProtocolQuizPrompt(),
  };
}

export async function loadLifeProtocolSettings(env) {
  const raw = await env.PAGE_CONTENT?.get('life_protocol_settings');
  if (!raw) return getDefaultLifeProtocolSettings();
  try {
    const parsed = JSON.parse(raw);
    const defaults = getDefaultLifeProtocolSettings();
    return {
      enabled: parsed.enabled !== false,
      prompt: typeof parsed.prompt === 'string' && parsed.prompt.trim()
        ? parsed.prompt
        : defaults.prompt,
    };
  } catch {
    return getDefaultLifeProtocolSettings();
  }
}

export async function saveLifeProtocolSettings(env, settings, ctx) {
  const toSave = {
    enabled: settings.enabled !== false,
    prompt: String(settings.prompt || getDefaultProtocolQuizPrompt()),
  };
  const put = env.PAGE_CONTENT.put('life_protocol_settings', JSON.stringify(toSave, null, 2));
  if (ctx?.waitUntil) ctx.waitUntil(put);
  else await put;
  return toSave;
}
