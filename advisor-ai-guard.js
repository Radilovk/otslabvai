/**
 * Предпазител след AI за протоколите (daotslabna, life-protocols, biocode-bg.com).
 *
 * AI пише текста; продуктите, дозите и часовете на прием са на кода. Тук:
 *  - дозата и часът на прием идват от данните на продукта (етикет / роля), не от AI;
 *  - изречение от AI, което кара човек да приема вещество, което не е сред
 *    подбраните продукти (напр. „Приемайте 5-HTP вечер“ при SSRI), отпада;
 *  - предупреждението е фиксирано.
 */

export const ADVISOR_DISCLAIMER = 'Информацията е с общ характер и не замества консултация с лекар. При хронично заболяване, бременност или прием на лекарства се посъветвайте с лекар или фармацевт, преди да започнете.';

// Вещества, за които AI не бива да дава указания за прием, ако не са в подбраните продукти.
const SUBSTANCES = [
  ['5-htp', /5-?htp|5-хтп|триптофан|tryptophan/i],
  ['жълт кантарион', /жълт\s*кантарион|st\.?\s*john|hypericum/i],
  ['йохимбин', /йохимбин|yohimb/i],
  ['синефрин', /синефрин|synephrin|горчив портокал|bitter orange/i],
  ['кофеин', /кофеин|caffein|гуарана|guarana/i],
  ['зелен чай', /зелен чай|green tea|egcg/i],
  ['мелатонин', /мелатонин|melatonin/i],
  ['ашваганда', /ашваганда|ashwagandha/i],
  ['берберин', /берберин|berberin/i],
  ['хром', /хром(?![а-я])|chromium/i],
  ['гарциния', /гарциния|garcinia/i],
  ['желязо', /желязо|iron(?![a-z])/i],
  ['йод', /йод(?![а-я])|iodine|келп|kelp/i],
  ['витамин K', /витамин\s*[kк]|vitamin\s*k|mk-?7/i],
  ['гинко', /гинко|ginkgo/i],
  ['омега-3', /омега|omega|рибено масло|fish oil/i],
  ['DHEA', /dhea|дхеа/i],
  ['трибулус', /трибулус|tribulus/i],
  ['мака', /мака(?![а-я])|maca/i],
  ['L-карнитин', /карнитин|carnitin/i],
  ['CLA', /(?<![a-z])cla(?![a-z])|конюгирана линолова/i],
];
// Указание за прием (не общ съвет като „ограничете кофеина“).
const INTAKE = /приемай|приемете|вземай|вземете|пийте .*(капс|табл|добавк)|добавете|включете|започнете с|по \d+\s*(мг|mg|капс|табл)/i;

const splitSentences = (text) => String(text || '').split(/(?<=[.!?])\s+/).filter(Boolean);

/** Веществата в подбраните продукти (за тях указанията са позволени). */
export function allowedSubstances(products) {
  const text = (products || []).map((p) => `${p?.name || ''} ${p?.brand || ''} ${p?.slot || ''}`).join(' ');
  return new Set(SUBSTANCES.filter(([, re]) => re.test(text)).map(([k]) => k));
}

/** Махат се изреченията с указание за прием на вещество извън подбраните продукти. */
export function sanitizeAdviceText(text, allowed) {
  if (!text) return text || '';
  return splitSentences(text)
    .filter((s) => !(INTAKE.test(s) && SUBSTANCES.some(([k, re]) => re.test(s) && !allowed.has(k))))
    .join(' ');
}

const sanitizeList = (list, allowed) => (Array.isArray(list) ? list.map((t) => sanitizeAdviceText(String(t || ''), allowed)).filter(Boolean) : list);

/**
 * Прилага предпазителя върху готовия отговор (след AI и поправката на нивата).
 * @param {object} response — { analysis, tiers: { key: { products: [...] } }, protocol_schedule, lifestyle_tips, … }
 * @param {(productId: string) => { dose?: string, timing?: string } | null} codeItem — дозата/часът от кода за продукта
 */
export function guardAdvisorResponse(response, codeItem) {
  if (!response || typeof response !== 'object') return response;
  const allProducts = [];
  for (const key of ['basic', 'optimal', 'premium']) {
    const tier = response.tiers?.[key];
    if (!tier || !Array.isArray(tier.products)) continue;
    tier.products = tier.products.map((item) => {
      const code = codeItem(item.product_id) || {};
      allProducts.push(item);
      return {
        ...item,
        dose: code.dose || 'Според етикета',
        timing: code.timing || item.timing || 'според етикета',
      };
    });
  }
  const allowed = allowedSubstances(allProducts);
  response.analysis = sanitizeAdviceText(response.analysis, allowed);
  response.lifestyle_tips = sanitizeList(response.lifestyle_tips, allowed);
  if (response.protocol_schedule && typeof response.protocol_schedule === 'object') {
    for (const k of ['morning', 'evening']) response.protocol_schedule[k] = sanitizeList(response.protocol_schedule[k], allowed);
    if (response.protocol_schedule.weekly_notes) response.protocol_schedule.weekly_notes = sanitizeAdviceText(response.protocol_schedule.weekly_notes, allowed);
  }
  for (const key of ['basic', 'optimal', 'premium']) {
    const tier = response.tiers?.[key];
    if (!tier) continue;
    if (tier.strategy) tier.strategy = sanitizeAdviceText(tier.strategy, allowed);
    if (Array.isArray(tier.products)) {
      tier.products = tier.products.map((p) => (p.why_for_you ? { ...p, why_for_you: sanitizeAdviceText(p.why_for_you, allowed) } : p));
    }
  }
  response.disclaimer = ADVISOR_DISCLAIMER;
  return response;
}
