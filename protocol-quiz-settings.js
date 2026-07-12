import { getDefaultProtocolQuizPrompt, getDefaultNarratorPrompt } from './protocol-quiz-prompt.js';

export function getDefaultLifeProtocolSettings() {
  return {
    enabled: true,
    composition_mode: 'compose_narrate',
    prompt: getDefaultProtocolQuizPrompt(),
    narrator_prompt: getDefaultNarratorPrompt(),
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
      composition_mode: parsed.composition_mode === 'ai_pick' ? 'ai_pick' : 'compose_narrate',
      prompt: typeof parsed.prompt === 'string' && parsed.prompt.trim()
        ? parsed.prompt
        : defaults.prompt,
      narrator_prompt: typeof parsed.narrator_prompt === 'string' && parsed.narrator_prompt.trim()
        ? parsed.narrator_prompt
        : defaults.narrator_prompt,
    };
  } catch {
    return getDefaultLifeProtocolSettings();
  }
}

export async function saveLifeProtocolSettings(env, settings, ctx) {
  const toSave = {
    enabled: settings.enabled !== false,
    composition_mode: settings.composition_mode === 'ai_pick' ? 'ai_pick' : 'compose_narrate',
    prompt: String(settings.prompt || getDefaultProtocolQuizPrompt()),
    narrator_prompt: String(settings.narrator_prompt || getDefaultNarratorPrompt()),
  };
  const put = env.PAGE_CONTENT.put('life_protocol_settings', JSON.stringify(toSave, null, 2));
  if (ctx?.waitUntil) ctx.waitUntil(put);
  else await put;
  return toSave;
}
