/**
 * AI prompts за Portfolio AI консултант — пакети и единични продукти.
 */

import { getProductPriceEur } from './protocol-quiz-engine.js';
import { profileHasPregnancyOrBreastfeeding } from './protocol-safety-rules.js';

const CLINICAL_FLAG_VALUES = new Set(['none', 'all', 'other']);

function listClinicalFlags(values = []) {
  return values.filter((v) => v && !CLINICAL_FLAG_VALUES.has(v));
}

/** Профили с множество клинични фактори → AI pick вместо само compose. */
export function hasAdvisorClinicalComplexity(profile = {}) {
  const conditions = listClinicalFlags(profile.conditions);
  const medications = listClinicalFlags(profile.medications);
  const allergies = listClinicalFlags(profile.allergies);

  if (profileHasPregnancyOrBreastfeeding(profile)) return true;
  if (conditions.length >= 2) return true;
  if (conditions.length && (medications.length || allergies.length)) return true;
  if (medications.length >= 2) return true;
  if (profile.diet && profile.diet !== 'omnivore' && (conditions.length || medications.length)) return true;
  if (profile.priority === 'otshalvane' && Number(profile.bmi) >= 30) return true;
  return false;
}

/**
 * Един автоматичен режим: compose за прости профили, AI pick при клинична сложност.
 * @returns {'ai_pick' | 'compose_narrate'}
 */
export function resolveAdvisorCompositionStrategy(profile = {}) {
  return hasAdvisorClinicalComplexity(profile) ? 'ai_pick' : 'compose_narrate';
}

/** Динамични клинични guardrails за prompt — не keyword blacklist, а контекст за модела. */
export function buildAdvisorClinicalGuardrails(profile = {}) {
  const lines = [];
  const conditions = listClinicalFlags(profile.conditions);
  const medications = listClinicalFlags(profile.medications);
  const allergies = listClinicalFlags(profile.allergies);
  const symptoms = listClinicalFlags(profile.symptoms);

  if (profile.sex) lines.push(`Пол: ${profile.sex === 'female' ? 'жена' : 'мъж'}, възраст ${profile.age_band || 'неуточнена'}.`);
  if (profile.bmi) lines.push(`BMI: ${profile.bmi} (ръст ${profile.height_cm || '?'} см, тегло ${profile.weight_kg || '?'} кг).`);
  if (profile.priority) lines.push(`Основна цел: ${profile.priority_other || profile.priority}.`);
  if (profile.diet && profile.diet !== 'omnivore') {
    lines.push(`Хранителен модел: ${profile.diet_other || profile.diet} — избягвай несъвместни източници (месо/желатин/суроватка при веган и т.н.).`);
  }

  if (profileHasPregnancyOrBreastfeeding(profile)) {
    lines.push('Бременност/кърмене: без стимуланти, мелатонин, ашваганда, берберин, saw palmetto, мъжки мултивитамини, високи дози витамин A; предпочитай безопасни основни витамини/минерали.');
  }

  for (const cond of conditions) {
    if (cond === 'hypertension' || cond === 'cardiovascular') {
      lines.push('Хипертония/сърдечно: без термогенни fat burners, йохимбин, ефедра, агресивни pre-workout; внимание с кофеин.');
    } else if (cond === 'diabetes') {
      lines.push('Диабет: без берберин и хром пиколинат в комбинация с лекарства; фокус върху протеин, омега-3, магнезий, алфа-липоична киселина ако е подходяща.');
    } else if (cond === 'thyroid') {
      lines.push('Щитовидна: без йод, келп, стимуланти; умерена енергия чрез B-витамини, желязо, CoQ10.');
    } else if (cond === 'kidney') {
      lines.push('Бъбречно: без високи дози протеин, креатин, гейнъри; умерени аминокиселини само ако са подходящи.');
    } else if (cond === 'autoimmune') {
      lines.push('Автоимунно: без ехинацея, астрагал и имуностимуланти; фокус върху антиоксиданти, омега-3, колаген за стави.');
    } else if (cond === 'liver') {
      lines.push('Чернодробно: без високи дози ниацин/желязо без нужда.');
    }
  }

  for (const med of medications) {
    if (med === 'statins') lines.push('Статини: включи CoQ10/убихинол ако има в каталога; не комбинирай с рискови стимуланти.');
    if (med === 'anticoagulants') lines.push('Антикоагуланти: без омега-3, рибено масло, krill, витамин E, куркумин на високи дози.');
    if (med === 'ssri') lines.push('SSRI: без 5-HTP, триптофан; внимание със стимуланти и седативни комбинации.');
    if (med === 'thyroid_meds') lines.push('Тироидни лекарства: без йод/келп.');
    if (med === 'hormone_therapy') lines.push('Хормонална терапия: без фитоестрогени и isoflavone.');
  }

  for (const allergy of allergies) {
    lines.push(`Алергия ${allergy}: избягвай продукти с типични източници за тази алергия (провери имена и съставки).`);
  }

  if (symptoms.includes('joint_pain')) lines.push('Болки в ставите: предпочитай колаген, глюкозамин/MSM, омега-3 (ако няма антикоагуланти).');
  if (symptoms.includes('poor_sleep')) lines.push('Лош сън: магнезий, билки за сън — без стимуланти в същия пакет.');
  if (symptoms.includes('fatigue')) lines.push('Умора: желязо/B12/CoQ10 според контекста, не само кофеин.');
  if (profile.activity === 'regular') lines.push('Редовни тренировки: протеин/креатин/BCAA са релевантни само ако няма бъбречно/бременност ограничения.');

  if (profile.conditions_other) lines.push(`Доп. състояние (клиент): ${profile.conditions_other}`);
  if (profile.medications_other) lines.push(`Доп. медикаменти (клиент): ${profile.medications_other}`);
  if (profile.allergies_other) lines.push(`Доп. алергии (клиент): ${profile.allergies_other}`);

  return lines.join('\n');
}

function withClinicalGuardrails(template, profile) {
  const guardrails = buildAdvisorClinicalGuardrails(profile);
  if (!guardrails) return template;
  return `${template}\n\nКЛИНИЧНИ GUARDRAILS ЗА ТОЗИ КЛИЕНТ (приоритет над маркетинг):\n${guardrails}`;
}

export function getDefaultPortfolioAdvisorPrompt() {
  return `Експерт по хранителни добавки (протеини, витамини, аминокиселини, фитнес и здраве).
Избери САМО product_id от candidate_products. БЕЗ reasoning извън JSON.

СПАЗВАЙ client_profile и clinical_guardrails. При противоречие избери друг product_id — не „най-печеливият“, а клинично подходящият.
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
    clinical_guardrails: buildAdvisorClinicalGuardrails(profile),
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
