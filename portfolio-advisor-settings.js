import {
  getDefaultPortfolioAdvisorPrompt,
  getDefaultPortfolioNarratorPrompt,
} from './portfolio-advisor-prompt.js';
import {
  ADVISOR_COMMERCE_DEFAULTS,
  normalizeAdvisorCommerceSettings,
} from './portfolio-advisor-commerce.js';

export function getDefaultPortfolioAdvisorSettings() {
  return {
    enabled: true,
    prompt: getDefaultPortfolioAdvisorPrompt(),
    narrator_prompt: getDefaultPortfolioNarratorPrompt(),
    commerce: { ...ADVISOR_COMMERCE_DEFAULTS },
  };
}

export { normalizeAdvisorCommerceSettings };

export async function loadPortfolioAdvisorSettings(env) {
  const raw = await env.PAGE_CONTENT?.get('portfolio_advisor_settings');
  if (!raw) return getDefaultPortfolioAdvisorSettings();
  try {
    const parsed = JSON.parse(raw);
    const defaults = getDefaultPortfolioAdvisorSettings();
    return {
      enabled: parsed.enabled !== false,
      prompt: typeof parsed.prompt === 'string' && parsed.prompt.trim()
        ? parsed.prompt
        : defaults.prompt,
      narrator_prompt: typeof parsed.narrator_prompt === 'string' && parsed.narrator_prompt.trim()
        ? parsed.narrator_prompt
        : defaults.narrator_prompt,
      commerce: normalizeAdvisorCommerceSettings(parsed),
    };
  } catch {
    return getDefaultPortfolioAdvisorSettings();
  }
}

export async function savePortfolioAdvisorSettings(env, settings, ctx) {
  const toSave = {
    enabled: settings.enabled !== false,
    // Пази се само промпт, различен от подразбиращия се — иначе подобренията в кода не стигат до сайта.
    prompt: (String(settings.prompt || '').trim() === getDefaultPortfolioAdvisorPrompt().trim() ? '' : String(settings.prompt || '').trim()),
    narrator_prompt: (String(settings.narrator_prompt || '').trim() === getDefaultPortfolioNarratorPrompt().trim() ? '' : String(settings.narrator_prompt || '').trim()),
    commerce: normalizeAdvisorCommerceSettings(settings),
  };
  const put = env.PAGE_CONTENT.put('portfolio_advisor_settings', JSON.stringify(toSave, null, 2));
  if (ctx?.waitUntil) ctx.waitUntil(put);
  else await put;
  return toSave;
}
