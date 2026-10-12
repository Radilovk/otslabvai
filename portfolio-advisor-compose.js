/**
 * Съставяне на пакети / единични продуктови опции за Portfolio AI консултант.
 * Логиката е обща за трите консултанта — advisor-composer.js.
 */
import { composeAdvisorStacks, composeAlternatives } from './advisor-composer.js';

/**
 * Пакет: план от слотове за целта, вложени нива (basic ⊂ optimal ⊂ premium).
 * Един продукт: 3 алтернативи за основния слот (икономичен / препоръчан / премиум).
 */
export function composePortfolioAdvisorStacks(profile, rankedEntries, options = {}) {
  if (profile.selection_mode === 'single') {
    return composeAlternatives(profile, rankedEntries, {
      tierMeta: options.tierMeta || {},
      tierLimits: options.tierLimits || null,
    });
  }
  return composeAdvisorStacks(profile, rankedEntries, {
    tierLimits: options.tierLimits,
    tierMeta: options.tierMeta || {},
    goal: profile.priority || 'health',
    siteId: 'portfolio',
  });
}
