/**
 * AI prompts за Portfolio AI консултант — пакети и единични продукти.
 */

import { getProductPriceEur } from './protocol-quiz-engine.js';

export function getDefaultPortfolioAdvisorPrompt() {
  return `Експерт по хранителни добавки (протеини, витамини, аминокиселини, фитнес и здраве).
Избери САМО product_id от списъка. БЕЗ reasoning извън JSON.

3 tier-а: basic (стартов пакет), optimal (препоръчан), premium (пълен пакет).
Ако selection_mode е "single" — всеки tier съдържа ТОЧНО 1 продукт (различни ценови нива).
Ползите (benefits) са кумулативни: optimal включва basic + нови теми; premium включва optimal + нови.
Кратки dose/timing/why_for_you (макс. 12 думи).
Приоритетът (priority) е цел от каталога: отслабване, мускули, здраве, антиейджинг, енергия, възстановяване.

Върни САМО JSON:
{"analysis":"2 изречения","recommended_tier":"optimal","tiers":{"basic":{"name":"...","tagline":"...","benefits":["..."],"strategy":"...","products":[{"product_id":"...","role":"core","dose":"...","timing":"сутрин","why_for_you":"..."}]},"optimal":{...},"premium":{...}},"protocol_schedule":{"morning":["..."],"evening":["..."],"weekly_notes":"..."},"lifestyle_tips":["..."],"disclaimer":"Информацията не замества лекарска консултация."}

НЕ попълвай monthly_total — ще се изчисли автоматично.`;
}

export function getDefaultPortfolioNarratorPrompt() {
  return `Copywriter за персонални препоръки за хранителни добавки.
Продуктите в пакета са ФИКСИРАНИ — НЕ добавяй, махай или сменяй product_id.

Върни САМО JSON:
{"analysis":"2 изречения","recommended_tier":"optimal","tier_copy":{"basic":{"benefits":["..."],"strategy":"кратко"},"optimal":{"benefits":["..."],"strategy":"..."},"premium":{"benefits":["..."],"strategy":"..."}},"product_copy":{"PRODUCT_ID":{"why_for_you":"макс 12 думи","dose":"...","timing":"сутрин|вечер"}},"protocol_schedule":{"morning":["..."],"evening":["..."],"weekly_notes":"..."},"lifestyle_tips":["..."],"disclaimer":"Информацията не замества лекарска консултация."}

Ползите са кумулативни. БЕЗ синонимно повторение.`;
}

export function buildPortfolioNarratorPayload(profile, composed, eligibleProducts) {
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
      selection_mode: profile.selection_mode || 'package',
      symptoms: profile.symptoms,
      activity: profile.activity,
      conditions: profile.conditions,
    },
    stacks,
    meta: composed.meta,
  };
}

export function buildPortfolioNarratorMessages(template, profile, composed, eligibleProducts) {
  const payload = buildPortfolioNarratorPayload(profile, composed, eligibleProducts);
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

export function buildPortfolioAdvisorMessages(template, payload) {
  const dataJson = JSON.stringify(payload);
  const system = `${template}\n\nВАЖНО: Без chain-of-thought. Само финален JSON.`;
  if (template.includes('{{protocolData}}')) {
    return [{ role: 'user', content: template.replace('{{protocolData}}', () => dataJson) }];
  }
  return [
    { role: 'system', content: system },
    { role: 'user', content: dataJson },
  ];
}
