/**
 * AI prompts за Portfolio AI консултант — пакети и единични продукти.
 */

import { getProductPriceEur } from './protocol-quiz-engine.js';
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
Избери САМО product_id от candidate_products. БЕЗ reasoning извън JSON.

СПАЗВАЙ client_profile и clinical_guardrails. При противоречие избери друг product_id — не „най-печеливший“, а клинично подходящият.
При равна клинична стойност предпочитай продукт с по-добра печалба за магазина (candidate_products са вече филтрирани).
Комбинирай продукти с различни роли (без дублиране на еднакви активни вещества в един tier).

3 tier-а: basic (стартов пакет), optimal (препоръчан), premium (пълен пакет).
Ако selection_mode е "single" — всеки tier съдържа ТОЧНО 1 продукт (различни ценови нива).
Ползите (benefits) са кумулативни: optimal включва basic + нови теми; premium включва optimal + нови.
При selection_mode "single" — ползите и strategy са САМО за единичния продукт в tier-а (без кумулативност).
Кратки dose/timing/why_for_you (макс. 12 думи).

Върни САМО JSON:
{"analysis":"2 изречения","recommended_tier":"optimal","tiers":{"basic":{"name":"...","tagline":"...","benefits":["..."],"strategy":"...","products":[{"product_id":"...","role":"core","dose":"...","timing":"сутрин","why_for_you":"..."}]},"optimal":{...},"premium":{...}},"protocol_schedule":{"morning":["..."],"evening":["..."],"weekly_notes":"..."},"lifestyle_tips":["..."],"disclaimer":"Информацията не замества лекарска консултация."}

НЕ попълвай monthly_total — ще се изчисли автоматично.`;
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

Ползите са НЕЗАВИСИМИ за всеки tier (не кумулативни). Всеки tier е отделен пакет.
Обясни ролята на всеки продукт като допълващ другите — без повтарящи се активни вещества.
БЕЗ синонимно повторение.`;
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
      height_cm: profile.height_cm,
      weight_kg: profile.weight_kg,
      priority: profile.priority,
      priority_other: profile.priority_other || '',
      selection_mode: profile.selection_mode || 'package',
      product_categories: profile.product_categories,
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
    clinical_guardrails: buildAdvisorClinicalGuardrails(profile, 'portfolio'),
  };
}

export function buildPortfolioNarratorMessages(template, profile, composed, eligibleProducts) {
  const payload = buildPortfolioNarratorPayload(profile, composed, eligibleProducts);
  const dataJson = JSON.stringify(payload);
  const singleModeNote = profile.selection_mode === 'single'
    ? '\n\nSINGLE MODE: Всеки tier съдържа ТОЧНО 1 продукт. Ползите и strategy са САМО за този продукт — без кумулативни пакетни ползи и без други артикули.'
    : '\n\nPACKAGE MODE: Трите tier-а са НЕЗАВИСИМИ пакети с различни продукти. Ползите НЕ са кумулативни. Всеки продукт има допълваща роля. Dose = само по етикет, без увеличаване заради други продукти в пакета.';
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
  const dataJson = JSON.stringify(payload);
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
