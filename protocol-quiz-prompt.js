/**
 * AI prompt за Life Protocol Quiz — 3 ценови стака с маркетингова обосновка.
 */

export function getDefaultProtocolQuizPrompt() {
  return `Експерт по anti-aging протоколи. Избери САМО product_id от списъка. БЕЗ reasoning, БЕЗ обяснения извън JSON.

3 tier-а: basic (3-4 продукта), optimal (5-6, препоръчан), premium (6-8).
Ползите (benefits) са КУМУЛАТИВНИ: basic = 3-4 базови ползи; optimal = всички от basic + 2-3 нови; premium = всички от optimal + 3-4 нови премиум ползи. Новите ползи да звучат ясно, категорично и маркетингово убедително.
Кратки dose/timing/why_for_you (макс. 12 думи).

Върни САМО JSON:
{"analysis":"2 изречения","recommended_tier":"optimal","tiers":{"basic":{"name":"Базов старт","tagline":"...","benefits":["..."],"strategy":"...","products":[{"product_id":"...","role":"core","dose":"1 капс","timing":"сутрин","why_for_you":"..."}]},"optimal":{...},"premium":{...}},"protocol_schedule":{"morning":["..."],"evening":["..."],"weekly_notes":"..."},"lifestyle_tips":["..."],"disclaimer":"Информацията не замества лекарска консултация."}

НЕ попълвай monthly_total — ще се изчисли автоматично.`;
}

export function buildCompactProtocolPayload(payload) {
  const p = payload.client_profile || {};
  return {
    profile: {
      sex: p.sex,
      age_band: p.age_band,
      bmi: p.bmi,
      priority: p.priority,
      conditions: p.conditions,
      medications: p.medications,
      symptoms: p.symptoms,
      allergies: p.allergies,
      activity: p.activity,
      diet: p.diet,
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
