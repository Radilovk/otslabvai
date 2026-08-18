/**
 * AI prompts за site-specific консултанти (life, main).
 */

import { getProductPriceEur } from './protocol-quiz-engine.js';
import { buildAdvisorClinicalGuardrails, withClinicalGuardrails } from './site-advisor-shared.js';

const SITE_PROMPT_CONTEXT = {
  life: {
    expertLine: 'Експерт по anti-aging протоколи и хранителни добавки за дълголетие.',
    tierLine: '3 tier-а: basic (3-4 продукта), optimal (5-6, препоръчан), premium (6-8).',
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
Избери САМО product_id от candidate_products. БЕЗ reasoning извън JSON.

СПАЗВАЙ client_profile и clinical_guardrails. Целта е зададена от сайта — не питай за нея.
При противоречие с guardrails избери друг product_id — клинична адекватност пред маркетинг.

${ctx.tierLine}
${ctx.benefitLine}
${ctx.focusLine}
Кратки dose/timing/why_for_you (макс. 12 думи).
Ако в профила има *_other полета, използвай ги при персонализацията.

Върни САМО JSON:
{"analysis":"2 изречения","recommended_tier":"optimal","tiers":{"basic":{"name":"...","tagline":"...","benefits":["..."],"strategy":"...","products":[{"product_id":"...","role":"core","dose":"...","timing":"сутрин","why_for_you":"..."}]},"optimal":{...},"premium":{...}},"protocol_schedule":{"morning":["..."],"evening":["..."],"weekly_notes":"..."},"lifestyle_tips":["..."],"disclaimer":"Информацията не замества лекарска консултация."}

НЕ попълвай monthly_total — ще се изчисли автоматично.`;
}

export function getDefaultSiteNarratorPrompt(siteId = 'life') {
  const ctx = SITE_PROMPT_CONTEXT[siteId] || SITE_PROMPT_CONTEXT.life;
  return `Copywriter и клиничен ревизор за ${siteId === 'main' ? 'програми за отслабване' : 'anti-aging протоколи'}.
Продуктите в стека са ФИКСИРАНИ — НЕ добавяй, махай или сменяй product_id.

Прочети profile и clinical_guardrails. Ако фиксиран продукт противоречи на профила:
- why_for_you: честно, с умерен тон
- disclaimer: спомени нужда от лекарска консултация

${ctx.benefitLine}

Върни САМО JSON:
{"analysis":"2 изречения","recommended_tier":"optimal","tier_copy":{"basic":{"benefits":["..."],"strategy":"кратко"},"optimal":{"benefits":["..."],"strategy":"..."},"premium":{"benefits":["..."],"strategy":"..."}},"product_copy":{"PRODUCT_ID":{"why_for_you":"макс 12 думи","dose":"...","timing":"сутрин|вечер"}},"protocol_schedule":{"morning":["..."],"evening":["..."],"weekly_notes":"..."},"lifestyle_tips":["..."],"disclaimer":"Информацията не замества лекарска консултация."}

Dose = само по етикет на продукта. БЕЗ синонимно повторение на ползи.`;
}

export function buildSiteNarratorPayload(profile, composed, eligibleProducts, siteId = 'life') {
  const productMap = new Map(eligibleProducts.map((p) => [p.product_id, p]));
  const stacks = {};

  for (const key of ['basic', 'optimal', 'premium']) {
    const tier = composed.tiers[key];
    stacks[key] = {
      name: tier.name,
      tagline: tier.tagline,
      products: (tier.products || []).map((item) => {
        const p = productMap.get(item.product_id);
        return {
          id: item.product_id,
          name: p?.public_data?.name || item.product_id,
          eur: Math.round(getProductPriceEur(p) * 100) / 100,
          role: item.role,
        };
      }),
    };
  }

  return {
    profile: {
      sex: profile.sex,
      age_band: profile.age_band,
      bmi: profile.bmi,
      height_cm: profile.height_cm,
      weight_kg: profile.weight_kg,
      priority: profile.priority,
      symptoms: profile.symptoms,
      symptoms_other: profile.symptoms_other || '',
      activity: profile.activity,
      diet: profile.diet,
      diet_other: profile.diet_other || '',
      conditions: profile.conditions,
      conditions_other: profile.conditions_other || '',
      medications: profile.medications,
      medications_other: profile.medications_other || '',
      allergies: profile.allergies,
      allergies_other: profile.allergies_other || '',
      pregnancy: profile.pregnancy,
      menopause_context: profile.menopause_context,
    },
    stacks,
    meta: composed.meta,
    clinical_guardrails: buildAdvisorClinicalGuardrails(profile, siteId),
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
    products: (payload.candidate_products || []).map((item) => ({
      id: item.product_id,
      name: item.name,
      eur: item.price_eur,
      goals: (item.goals || []).slice(0, 2),
    })),
    excluded: payload.constraints?.excluded_product_ids || [],
    must_include: payload.constraints?.must_include_keywords || [],
    clinical_guardrails: payload.clinical_guardrails,
    site_id: siteId,
  });
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
