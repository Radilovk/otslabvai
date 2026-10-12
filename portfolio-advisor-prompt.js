/**
 * AI prompts за Portfolio AI консултант — пакети и единични продукти.
 */

import { buildProductCard, sanitizeProfileForAI } from './advisor-ai.js';
export {
  hasAdvisorClinicalComplexity,
  resolveAdvisorCompositionStrategy,
  buildAdvisorClinicalGuardrails,
} from './site-advisor-shared.js';
import { buildAdvisorClinicalGuardrails } from './site-advisor-shared.js';

function withClinicalGuardrails(template, profile) {
  const guardrails = buildAdvisorClinicalGuardrails(profile, 'portfolio');
  if (!guardrails) return template;
  return `${template}\n\nКЛИНИЧНИ GUARDRAILS ЗА ТОЗИ КЛИЕНТ (приоритет над маркетинг):\n${guardrails}`;
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
- dose = по intake/serving от картата; ако липсва — „Според етикета“. Не измисляй дози.
Кратки why_for_you (макс. 12 думи).

Върни САМО JSON:
{"analysis":"2 изречения","recommended_tier":"optimal","tiers":{"basic":{"name":"...","tagline":"...","benefits":["..."],"strategy":"...","products":[{"product_id":"...","role":"core","dose":"...","timing":"сутрин","why_for_you":"..."}]},"optimal":{...},"premium":{...}},"protocol_schedule":{"morning":["..."],"evening":["..."],"weekly_notes":"..."},"lifestyle_tips":["..."],"disclaimer":"Информацията не замества лекарска консултация."}`;
}

export function getDefaultPortfolioNarratorPrompt() {
  return `Copywriter и клиничен ревизор за персонални препоръки за хранителни добавки.
Продуктите в пакета са ФИКСИРАНИ — НЕ добавяй, махай или сменяй product_id.

Прочети profile и clinical_guardrails. Ако някой фиксиран продукт противоречи на профила, не го представяй като идеален избор:
- why_for_you: честно, с умерен тон (напр. „подкрепя целта, но при вашите ограничения консултирайте лекар").
- disclaimer: спомени нужда от лекарска консултация за конкретното ограничение.
- lifestyle_tips: практичен съвет (храна, сън, движение), не само добавки.

Върни САМО JSON:
{"analysis":"2 изречения","recommended_tier":"optimal","tier_copy":{"basic":{"benefits":["..."],"strategy":"кратко"},"optimal":{"benefits":["..."],"strategy":"..."},"premium":{"benefits":["..."],"strategy":"..."}},"product_copy":{"PRODUCT_ID":{"why_for_you":"макс 12 думи","dose":"...","timing":"сутрин|вечер"}},"protocol_schedule":{"morning":["..."],"evening":["..."],"weekly_notes":"..."},"lifestyle_tips":["..."],"disclaimer":"Информацията не замества лекарска консултация."}

ВАЖНО за dose:
- Пиши САМО дозата от етикета на конкретния продукт (напр. „1 капсула дневно").
- НИКОГА не увеличавай доза защото има друг продукт в пакета.
- Ако не знаеш точната доза — пиши „Според етикета".

Пакетите са вложени: optimal = basic + нови продукти; premium = optimal + нови. Ползите са кумулативни, без повторение.
Всеки продукт има карта: role (роля), actives/category, intake/serving (етикет), stimulant, days.
Обясни ролята на всеки продукт като допълващ другите.
БЕЗ синонимно повторение.`;
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
  if (template.includes('{{protocolData}}')) {
    return [{ role: 'user', content: template.replace('{{protocolData}}', () => dataJson) }];
  }
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
  const base = profile ? withClinicalGuardrails(template, profile) : template;
  const system = `${base}\n\nВАЖНО: Без chain-of-thought. Само финален JSON.`;
  if (template.includes('{{protocolData}}')) {
    return [{ role: 'user', content: template.replace('{{protocolData}}', () => dataJson) }];
  }
  return [
    { role: 'system', content: system },
    { role: 'user', content: dataJson },
  ];
}
