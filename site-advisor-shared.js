/**
 * Споделена логика за AI консултанти на всички сайтове (life, main, portfolio).
 */

import { profileHasPregnancyOrBreastfeeding } from './protocol-safety-rules.js';

const CLINICAL_FLAG_VALUES = new Set(['none', 'all', 'other']);

export const SITE_ADVISOR_CONTEXT = {
  life: {
    defaultPriority: 'longevity',
    siteLine: 'Контекст: Life Protocols — антиейджинг, дълголетие, клетъчна регенерация. Продуктите в каталога са за този фокус; не питай за „цел“ — тя е зададена от сайта.',
  },
  main: {
    defaultPriority: 'otshalvane',
    siteLine: 'Контекст: ДА ОТСЛАБНА — отслабване, контрол на апетита, метаболизъм. Продуктите са за отслабване; не питай за „цел“ — тя е зададена от сайта.',
  },
};

function listClinicalFlags(values = []) {
  return values.filter((v) => v && !CLINICAL_FLAG_VALUES.has(v));
}

export function finalizeSiteAnswers(raw = {}, siteId = 'life') {
  const ctx = SITE_ADVISOR_CONTEXT[siteId] || SITE_ADVISOR_CONTEXT.life;
  return {
    ...raw,
    priority: ctx.defaultPriority,
    site_id: siteId,
  };
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

/** Един автоматичен режим — без ръчен избор. */
export function resolveAdvisorCompositionStrategy(profile = {}) {
  return hasAdvisorClinicalComplexity(profile) ? 'ai_pick' : 'compose_narrate';
}

/** Динамични клинични guardrails за prompt. */
export function buildAdvisorClinicalGuardrails(profile = {}, siteId = 'life') {
  const lines = [];
  const siteCtx = SITE_ADVISOR_CONTEXT[siteId];
  if (siteCtx?.siteLine) lines.push(siteCtx.siteLine);

  const conditions = listClinicalFlags(profile.conditions);
  const medications = listClinicalFlags(profile.medications);
  const allergies = listClinicalFlags(profile.allergies);
  const symptoms = listClinicalFlags(profile.symptoms);

  if (profile.sex) lines.push(`Пол: ${profile.sex === 'female' ? 'жена' : 'мъж'}, възраст ${profile.age_band || 'неуточнена'}.`);
  if (profile.bmi) lines.push(`BMI: ${profile.bmi} (ръст ${profile.height_cm || '?'} см, тегло ${profile.weight_kg || '?'} кг).`);
  if (profile.diet && profile.diet !== 'omnivore') {
    lines.push(`Хранителен модел: ${profile.diet_other || profile.diet} — избягвай несъвместни източници.`);
  }

  if (profileHasPregnancyOrBreastfeeding(profile)) {
    lines.push('Бременност/кърмене: без стимуланти, мелатонин, ашваганда, берберин, saw palmetto, мъжки мултивитамини, високи дози витамин A.');
  }

  for (const cond of conditions) {
    if (cond === 'hypertension' || cond === 'cardiovascular') {
      lines.push('Хипертония/сърдечно: без термогенни fat burners, йохимбин, ефедра, агресивни pre-workout.');
    } else if (cond === 'diabetes') {
      lines.push('Диабет: без берберин и хром пиколинат в комбинация с лекарства.');
    } else if (cond === 'thyroid') {
      lines.push('Щитовидна: без йод, келп, стимуланти.');
    } else if (cond === 'kidney') {
      lines.push('Бъбречно: без високи дози протеин, креатин, гейнъри.');
    } else if (cond === 'autoimmune') {
      lines.push('Автоимунно: без ехинацея, астрагал и имуностимуланти.');
    } else if (cond === 'liver') {
      lines.push('Чернодробно: без високи дози ниацин/желязо без нужда.');
    }
  }

  for (const med of medications) {
    if (med === 'statins') lines.push('Статини: включи CoQ10/убихинол ако има в каталога.');
    if (med === 'anticoagulants') lines.push('Антикоагуланти: без омега-3, рибено масло, krill, витамин E, куркумин на високи дози.');
    if (med === 'ssri') lines.push('SSRI: без 5-HTP, триптофан.');
    if (med === 'thyroid_meds') lines.push('Тироидни лекарства: без йод/келп.');
    if (med === 'hormone_therapy') lines.push('Хормонална терапия: без фитоестрогени.');
  }

  for (const allergy of allergies) {
    lines.push(`Алергия ${allergy}: избягвай типични източници в имена и съставки.`);
  }

  if (symptoms.includes('joint_pain')) lines.push('Болки в ставите: колаген, глюкозамин/MSM, омега-3 (ако няма антикоагуланти).');
  if (symptoms.includes('poor_sleep')) lines.push('Лош сън: магнезий, билки за сън — без стимуланти в същия пакет.');
  if (symptoms.includes('fatigue')) lines.push('Умора: желязо/B12/CoQ10 според контекста, не само кофеин.');
  if (profile.activity === 'regular') lines.push('Редовни тренировки: протеин/BCAA само ако няма бъбречно/бременност ограничения.');

  if (siteId === 'main' && profile.bmi >= 30) {
    lines.push('BMI ≥30: фокус върху ситост, метаболизъм, протеин — без агресивни стимуланти при хипертония/диабет.');
  }
  if (siteId === 'main' && (profile.symptoms || []).includes('cravings')) {
    lines.push('Cravings/апетит: приоритет ситост и метаболизъм — без агресивни стимуланти при кардио риск.');
  }
  if (siteId === 'life') {
    lines.push('Anti-aging фокус: антиоксиданти, колаген, NAD/CoQ10, омега-3, сън и когниция — комплементарни роли в стека.');
  }

  if (profile.conditions_other) lines.push(`Доп. състояние: ${profile.conditions_other}`);
  if (profile.medications_other) lines.push(`Доп. медикаменти: ${profile.medications_other}`);
  if (profile.allergies_other) lines.push(`Доп. алергии: ${profile.allergies_other}`);

  return lines.join('\n');
}

export function withClinicalGuardrails(template, profile, siteId = 'life') {
  const guardrails = buildAdvisorClinicalGuardrails(profile, siteId);
  if (!guardrails) return template;
  return `${template}\n\nКЛИНИЧНИ GUARDRAILS (приоритет над маркетинг):\n${guardrails}`;
}
