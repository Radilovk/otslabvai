/**
 * AI prompts за Portfolio AI консултант — пакети и единични продукти.
 */

import { buildProductCard, sanitizeProfileForAI } from './advisor-ai.js';
export {
  hasAdvisorClinicalComplexity,
  resolveAdvisorCompositionStrategy,
  buildAdvisorClinicalGuardrails,
} from './site-advisor-shared.js';
import { buildAdvisorClinicalGuardrails, ADVISOR_AI_RULES, stripProtocolDataMarker } from './site-advisor-shared.js';

function withClinicalGuardrails(template, profile) {
  const guardrails = buildAdvisorClinicalGuardrails(profile, 'portfolio');
  const base = `${stripProtocolDataMarker(template)}\n\n${ADVISOR_AI_RULES}`;
  if (!guardrails) return base;
  return `${base}\n\nКЛИНИЧНИ GUARDRAILS ЗА ТОЗИ КЛИЕНТ (приоритет над маркетинг):\n${guardrails}`;
}

export function getDefaultPortfolioAdvisorPrompt() {
  return `Експерт по хранителни добавки (протеини, витамини, аминокиселини, фитнес и здраве).
Клиентът има сложен клиничен профил. Алгоритъмът вече е филтрирал каталога (безопасност, вид продукт, пол,
хранителен модел, наличност, марж) и е съставил пакети в suggested_tiers. Твоята задача е клиничен преглед:
- Започни от suggested_tiers. Смени продукт САМО ако профилът/клиничните правила го налагат,
  и то само с product_id от products (алтернативите са със същата роля). Не добавяй продукти извън products.
- Два продукта със stimulant:true не влизат в едно ниво; не повтаряй един продукт в ниво.
- Ако selection_mode е "single" — всеки tier съдържа ТОЧНО 1 продукт (различни ценови нива).
- Пакетите са вложени: optimal = basic + продукти; premium = optimal + продукти. Ползите са кумулативни.
- Дозата и часът на прием се попълват от системата по етикета — не ги пиши.
Кратки why_for_you (макс. 12 думи).

Върни САМО JSON:
{"analysis":"до 2 изречения","recommended_tier":"basic|optimal|premium","tiers":{"basic":{"name":"...","tagline":"...","benefits":["..."],"strategy":"...","products":[{"product_id":"...","role":"core","why_for_you":"..."}]},"optimal":{...},"premium":{...}},"protocol_schedule":{"morning":["..."],"evening":["..."],"weekly_notes":"..."},"lifestyle_tips":["..."]}`;
}

export function getDefaultPortfolioNarratorPrompt() {
  return `Copywriter за персонални препоръки за хранителни добавки.
Продуктите в пакета са ФИКСИРАНИ и вече проверени за безопасност спрямо профила — НЕ добавяй, махай или сменяй product_id.
Всеки продукт има карта: role (роля), actives/category, stimulant, days.
Обясни ролята на всеки продукт като допълваща другите и свързана с профила (цел, симптоми, хранене).
lifestyle_tips: практични съвети за храна, сън и движение — не за добавки.
Пакетите са вложени: optimal = basic + нови продукти; premium = optimal + нови. Ползите са кумулативни, без повторение и без синоними.

Върни САМО JSON:
{"analysis":"до 2 изречения","recommended_tier":"basic|optimal|premium","tier_copy":{"basic":{"benefits":["..."],"strategy":"кратко"},"optimal":{"benefits":["..."],"strategy":"..."},"premium":{"benefits":["..."],"strategy":"..."}},"product_copy":{"PRODUCT_ID":{"why_for_you":"до 12 думи"}},"protocol_schedule":{"morning":["..."],"evening":["..."],"weekly_notes":"..."},"lifestyle_tips":["..."]}`;
}

export function buildPortfolioNarratorPayload(profile, composed, eligibleProducts) {
  const productMap = new Map(eligibleProducts.map((p) => [p.product_id, p]));
  const products = {};
  const stacks = {};

  for (const key of ['basic', 'optimal', 'premium']) {
    const tier = composed.tiers[key];
    stacks[key] = {
      name: tier.name,
      tagline: tier.tagline,
      product_ids: (tier.products || []).map((item) => item.product_id),
    };
    for (const item of tier.products || []) {
      const p = productMap.get(item.product_id);
      if (p && !products[item.product_id]) products[item.product_id] = buildProductCard(p);
    }
  }

  return {
    profile: sanitizeProfileForAI(profile),
    stacks,
    products,
    composition: composed.meta?.mode,
  };
}

export function buildPortfolioNarratorMessages(template, profile, composed, eligibleProducts) {
  const payload = buildPortfolioNarratorPayload(profile, composed, eligibleProducts);
  const dataJson = JSON.stringify(payload);
  const singleModeNote = profile.selection_mode === 'single'
    ? '\n\nSINGLE MODE: Всеки tier съдържа ТОЧНО 1 продукт. Ползите и strategy са САМО за този продукт — без кумулативни пакетни ползи и без други артикули.'
    : '\n\nPACKAGE MODE: Пакетите са вложени (optimal = basic + продукти, premium = optimal + продукти). Ползите са кумулативни. Dose = само по етикет, без увеличаване заради други продукти в пакета.';
  const system = withClinicalGuardrails(
    `${template}${singleModeNote}\n\nВАЖНО: Без chain-of-thought. Само финален JSON. Не променяй product_id.`,
    profile,
  );
  return [
    { role: 'system', content: system },
    { role: 'user', content: dataJson },
  ];
}

export function buildPortfolioAdvisorMessages(template, payload, profile = null) {
  // Само нужното за избора: профил без лични данни, пакетите на алгоритъма и картите на кандидатите.
  const dataJson = JSON.stringify({
    profile: payload.client_profile,
    selection_mode: payload.selection_mode,
    suggested_tiers: payload.suggested_tiers,
    products: payload.candidate_products || [],
    must_include: payload.constraints?.must_include_keywords || [],
    tier_product_counts: payload.constraints?.tier_product_counts,
  });
  const base = withClinicalGuardrails(template, profile || {});
  const system = `${base}\n\nВАЖНО: Без chain-of-thought. Само финален JSON.`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: dataJson },
  ];
}
