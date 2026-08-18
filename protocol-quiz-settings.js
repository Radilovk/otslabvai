import { getDefaultSiteAdvisorPrompt, getDefaultSiteNarratorPrompt } from './site-advisor-prompt.js';
import { getDefaultProtocolQuizPrompt, getDefaultNarratorPrompt } from './protocol-quiz-prompt.js';

export function getDefaultLifeProtocolSettings() {
  return {
    enabled: true,
    prompt: getDefaultSiteAdvisorPrompt('life'),
    narrator_prompt: getDefaultSiteNarratorPrompt('life'),
  };
}

export function getDefaultMainAdvisorSettings() {
  return {
    enabled: true,
    prompt: getDefaultSiteAdvisorPrompt('main'),
    narrator_prompt: getDefaultSiteNarratorPrompt('main'),
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
      narrator_prompt: typeof parsed.narrator_prompt === 'string' && parsed.narrator_prompt.trim()
        ? parsed.narrator_prompt
        : defaults.narrator_prompt,
    };
  } catch {
    return getDefaultLifeProtocolSettings();
  }
}

export async function loadMainAdvisorSettings(env) {
  const raw = await env.PAGE_CONTENT?.get('main_advisor_settings');
  if (!raw) return getDefaultMainAdvisorSettings();
  try {
    const parsed = JSON.parse(raw);
    const defaults = getDefaultMainAdvisorSettings();
    return {
      enabled: parsed.enabled !== false,
      prompt: typeof parsed.prompt === 'string' && parsed.prompt.trim()
        ? parsed.prompt
        : defaults.prompt,
      narrator_prompt: typeof parsed.narrator_prompt === 'string' && parsed.narrator_prompt.trim()
        ? parsed.narrator_prompt
        : defaults.narrator_prompt,
    };
  } catch {
    return getDefaultMainAdvisorSettings();
  }
}

export async function saveLifeProtocolSettings(env, settings, ctx) {
  const toSave = {
    enabled: settings.enabled !== false,
    prompt: String(settings.prompt || getDefaultSiteAdvisorPrompt('life')),
    narrator_prompt: String(settings.narrator_prompt || getDefaultSiteNarratorPrompt('life')),
  };
  const put = env.PAGE_CONTENT.put('life_protocol_settings', JSON.stringify(toSave, null, 2));
  if (ctx?.waitUntil) ctx.waitUntil(put);
  else await put;
  return toSave;
}

export async function saveMainAdvisorSettings(env, settings, ctx) {
  const toSave = {
    enabled: settings.enabled !== false,
    prompt: String(settings.prompt || getDefaultSiteAdvisorPrompt('main')),
    narrator_prompt: String(settings.narrator_prompt || getDefaultSiteNarratorPrompt('main')),
  };
  const put = env.PAGE_CONTENT.put('main_advisor_settings', JSON.stringify(toSave, null, 2));
  if (ctx?.waitUntil) ctx.waitUntil(put);
  else await put;
  return toSave;
}

/** @deprecated — запазено за обратна съвместимост с admin local simulate */
export { getDefaultProtocolQuizPrompt, getDefaultNarratorPrompt };
