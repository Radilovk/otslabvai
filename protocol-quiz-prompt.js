/**
 * AI prompt за Life Protocol Quiz — 3 ценови стака с маркетингова обосновка.
 */

import { getProductPriceEur } from './protocol-quiz-engine.js';

export function getDefaultProtocolQuizPrompt() {
  return `Експерт по anti-aging протоколи. Избери САМО product_id от списъка. БЕЗ reasoning, БЕЗ обяснения извън JSON.

3 tier-а: basic (3-4 продукта), optimal (5-6, препоръчан), premium (6-8).
Ползите (benefits) са КУМУЛАТИВНИ: basic = 3-4 базови ползи; optimal = всички от basic + 2-3 НОВИ в различни посоки; premium = всички от optimal + 3-4 НОВИ премиум ползи. Всяка нова полза трябва да разширява контекста (различна тема: сън, кожа, когниция, стави и т.н.) — БЕЗ синоними или парафрази на вече изброените ползи.
Кратки dose/timing/why_for_you (макс. 12 думи).
Ако в профила има *_other полета (свободен текст от „Друго“), използвай ги при персонализацията на анализа и why_for_you.

Върни САМО JSON:
{"analysis":"2 изречения","recommended_tier":"optimal","tiers":{"basic":{"name":"Базов старт","tagline":"...","benefits":["..."],"strategy":"...","products":[{"product_id":"...","role":"core","dose":"1 капс","timing":"сутрин","why_for_you":"..."}]},"optimal":{...},"premium":{...}},"protocol_schedule":{"morning":["..."],"evening":["..."],"weekly_notes":"..."},"lifestyle_tips":["..."],"disclaimer":"Информацията не замества лекарска консултация."}

НЕ попълвай monthly_total — ще се изчисли автоматично.`;
}

/** Prompt за compose-then-narrate: AI пише само текст, не избира продукти */
export function getDefaultNarratorPrompt() {
  return `Copywriter за персонални health протоколи. Продуктите в стека са ФИКСИРАНИ — НЕ добавяй, махай или сменяй product_id.

Върни САМО JSON:
{"analysis":"2 изречения","recommended_tier":"optimal","tier_copy":{"basic":{"benefits":["..."],"strategy":"кратко"},"optimal":{"benefits":["..."],"strategy":"..."},"premium":{"benefits":["..."],"strategy":"..."}},"product_copy":{"PRODUCT_ID":{"why_for_you":"макс 12 думи","dose":"...","timing":"сутрин|вечер"}},"protocol_schedule":{"morning":["..."],"evening":["..."],"weekly_notes":"..."},"lifestyle_tips":["..."],"disclaimer":"Информацията не замества лекарска консултация."}

Ползите са кумулативни: optimal включва basic + нови теми; premium включва optimal + нови премиум теми. БЕЗ синонимно повторение.`;
}

export function buildNarratorPayload(profile, composed, eligibleProducts) {
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
      priority: profile.priority,
      priority_other: profile.priority_other || '',
      symptoms: profile.symptoms,
      symptoms_other: profile.symptoms_other || '',
      conditions: profile.conditions,
      conditions_other: profile.conditions_other || '',
    },
    stacks,
    meta: composed.meta,
  };
}

export function buildNarratorMessages(template, profile, composed, eligibleProducts) {
  const payload = buildNarratorPayload(profile, composed, eligibleProducts);
  const dataJson = JSON.stringify(payload);
  const system = `${template}\n\nВАЖНО: Без chain-of-thought. Само финален JSON. Не променяй product_id.`;
  if (template.includes('{{protocolData}}')) {
    return [{ role: 'user', content: template.replace('{{protocolData}}', () => dataJson) }];
  }
  return [
    { role: 'system', content: system },
    { role: 'user', content: dataJson },
  ];
}

export function buildCompactProtocolPayload(payload) {
  const p = payload.client_profile || {};
  return {
    profile: {
      sex: p.sex,
      age_band: p.age_band,
      bmi: p.bmi,
      priority: p.priority,
      priority_other: p.priority_other || '',
      conditions: p.conditions,
      conditions_other: p.conditions_other || '',
      medications: p.medications,
      medications_other: p.medications_other || '',
      symptoms: p.symptoms,
      symptoms_other: p.symptoms_other || '',
      allergies: p.allergies,
      allergies_other: p.allergies_other || '',
      activity: p.activity,
      diet: p.diet,
      diet_other: p.diet_other || '',
    },
    products: (payload.candidate_products || []).map((item) => ({
      id: item.product_id,
      name: item.name,
      eur: item.price_eur,
      goals: (item.goals || []).slice(0, 2),
    })),
    excluded: payload.constraints?.excluded_product_ids || [],
    must_include: payload.constraints?.must_include_keywords || [],
  };
}

export function buildProtocolQuizMessages(template, payload) {
  const compact = buildCompactProtocolPayload(payload);
  const dataJson = JSON.stringify(compact);
  const system = `${template}\n\nВАЖНО: Без chain-of-thought. Само финален JSON.`;
  if (template.includes('{{protocolData}}')) {
    return [{ role: 'user', content: template.replace('{{protocolData}}', () => dataJson) }];
  }
  return [
    { role: 'system', content: system },
    { role: 'user', content: dataJson },
  ];
}
