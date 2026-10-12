/**
 * AI prompts за site-specific консултанти (life, main).
 */

import { withClinicalGuardrails } from './site-advisor-shared.js';
import { buildProductCard, sanitizeProfileForAI } from './advisor-ai.js';

const SITE_PROMPT_CONTEXT = {
  life: {
    expertLine: 'Експерт по anti-aging протоколи и хранителни добавки за дълголетие.',
    tierLine: '3 tier-а: basic (2-3 продукта), optimal (3-5, препоръчан), premium (4-6).',
    benefitLine: 'Ползите (benefits) са КУМУЛАТИВНИ: basic = базови ползи; optimal = basic + нови теми; premium = optimal + премиум ползи. Без синоними.',
    focusLine: 'Фокус: антиоксиданти, колаген, клетъчна регенерация, сън, когниция, стави — комплементарни роли.',
  },
  main: {
    expertLine: 'Експерт по програми за отслабване с хранителни добавки и метаболитна подкрепа.',
    tierLine: '3 tier-а: basic (2-3 продукта), optimal (3-5, препоръчан), premium (4-6).',
    benefitLine: 'Ползите (benefits) са КУМУЛАТИВНИ: basic = старт; optimal = basic + нови посоки (ситост, метаболизъм); premium = optimal + пълно покритие. Без синоними.',
    focusLine: 'Фокус: контрол на апетита, метаболизъм, протеин/ситост, енергия без агресивни стимуланти при рисков профил.',
  },
};

export function getDefaultSiteAdvisorPrompt(siteId = 'life') {
  const ctx = SITE_PROMPT_CONTEXT[siteId] || SITE_PROMPT_CONTEXT.life;
  return `${ctx.expertLine}
Клиентът има сложен клиничен профил. Алгоритъмът вече е филтрирал каталога (безопасност, наличност, марж)
и е съставил пакети в suggested_tiers. Твоята задача е клиничен преглед:
- Започни от suggested_tiers. Смени продукт САМО ако профилът/clinical_guardrails го налагат,
  и то само с product_id от products (алтернативите са със същата роля).
- Не добавяй продукти извън products. Не повтаряй един и същ продукт в ниво.
- Два продукта със stimulant:true не влизат в едно ниво.
- dose = по intake/serving от картата; ако липсва — „Според етикета“. Не измисляй дози.
${ctx.tierLine}
${ctx.benefitLine}
Кратки why_for_you (макс. 12 думи), свързани с профила.

Върни САМО JSON:
{"analysis":"2 изречения","recommended_tier":"optimal","tiers":{"basic":{"name":"...","tagline":"...","benefits":["..."],"strategy":"...","products":[{"product_id":"...","role":"core","dose":"...","timing":"сутрин","why_for_you":"..."}]},"optimal":{...},"premium":{...}},"protocol_schedule":{"morning":["..."],"evening":["..."],"weekly_notes":"..."},"lifestyle_tips":["..."],"disclaimer":"Информацията не замества лекарска консултация."}`;
}

export function getDefaultSiteNarratorPrompt(siteId = 'life') {
  const ctx = SITE_PROMPT_CONTEXT[siteId] || SITE_PROMPT_CONTEXT.life;
  return `Copywriter и клиничен ревизор за ${siteId === 'main' ? 'програми за отслабване' : 'anti-aging протоколи'}.
Продуктите в пакетите са ФИКСИРАНИ от алгоритъма — НЕ добавяй, махай или сменяй product_id.
Всеки продукт има карта: role (роля в пакета), actives/category, intake/serving (етикет), stimulant, days.

Ако фиксиран продукт противоречи на профила:
- why_for_you: честно, с умерен тон
- disclaimer: спомени нужда от лекарска консултация

${ctx.benefitLine}
dose = по intake/serving от картата; ако липсва — „Според етикета“. Не измисляй дози.
timing = според ролята (сън → вечер, стимулант → сутрин).

Върни САМО JSON:
{"analysis":"2 изречения","recommended_tier":"optimal","tier_copy":{"basic":{"benefits":["..."],"strategy":"кратко"},"optimal":{"benefits":["..."],"strategy":"..."},"premium":{"benefits":["..."],"strategy":"..."}},"product_copy":{"PRODUCT_ID":{"why_for_you":"макс 12 думи","dose":"...","timing":"сутрин|вечер"}},"protocol_schedule":{"morning":["..."],"evening":["..."],"weekly_notes":"..."},"lifestyle_tips":["..."],"disclaimer":"Информацията не замества лекарска консултация."}

БЕЗ синонимно повторение на ползи.`;
}

export function buildSiteNarratorPayload(profile, composed, eligibleProducts, siteId = 'life') {
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
    site_id: siteId,
  };
}

export function buildSiteNarratorMessages(template, profile, composed, eligibleProducts, siteId = 'life') {
  const payload = buildSiteNarratorPayload(profile, composed, eligibleProducts, siteId);
  const dataJson = JSON.stringify(payload);
  const system = withClinicalGuardrails(
    `${template}\n\nВАЖНО: Без chain-of-thought. Само финален JSON. Не променяй product_id.`,
    profile,
    siteId,
  );
  if (template.includes('{{protocolData}}')) {
    return [{ role: 'user', content: template.replace('{{protocolData}}', () => dataJson) }];
  }
  return [
    { role: 'system', content: system },
    { role: 'user', content: dataJson },
  ];
}

export function buildSiteAdvisorMessages(template, payload, profile, siteId = 'life') {
  const dataJson = JSON.stringify({
    profile: payload.client_profile,
    suggested_tiers: payload.suggested_tiers,
    products: payload.candidate_products || [],
    must_include: payload.constraints?.must_include_keywords || [],
    tier_product_counts: payload.constraints?.tier_product_counts,
    site_id: siteId,
  });
  // Клиничните правила са в system съобщението (withClinicalGuardrails) — не ги дублираме в данните.
  const system = withClinicalGuardrails(
    `${template}\n\nВАЖНО: Без chain-of-thought. Само финален JSON.`,
    profile,
    siteId,
  );
  if (template.includes('{{protocolData}}')) {
    return [{ role: 'user', content: template.replace('{{protocolData}}', () => dataJson) }];
  }
  return [
    { role: 'system', content: system },
    { role: 'user', content: dataJson },
  ];
}
