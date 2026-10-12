/**
 * Диагностика (само четене) на трите AI консултанта върху реалните каталози в KV:
 * типични клиентски профили → филтри → точкуване → съставени пакети (без AI извикване).
 * Нищо не се записва. Профилите са измислени — без лични данни.
 *
 * Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 */
import { kvGet } from '../catalog-kv-client.mjs';
import { prepareSiteAdvisorSubmission, getSiteComposeOptions } from '../site-advisor-engine.js';
import { composeCoreSupportStacks, composeProtocolStacks } from '../protocol-stack-composer.js';
import {
  extractProductsFromContent,
  filterEligibleProducts,
  getProductPriceEur,
  getPackDaysSupply,
} from '../protocol-quiz-engine.js';
import {
  preparePortfolioAdvisorSubmission,
  getPortfolioComposeOptions,
  loadPortfolioCatalogProducts,
  filterPortfolioEligibleProducts,
  buildPortfolioAdvisorProfile,
} from '../portfolio-advisor-engine.js';
import { composePortfolioAdvisorStacks } from '../portfolio-advisor-compose.js';
import { resolveAdvisorCompositionStrategy } from '../site-advisor-shared.js';
import {
  STACK_CONFLICT_GROUPS,
  classifyProductSlot,
  getProductConflictGroups,
} from '../portfolio-stack-slots.js';
import { productSearchText, productMatchesAnyKeyword } from '../protocol-safety-rules.js';
import { buildSiteAdvisorProfile } from '../site-advisor-engine.js';
import { filterOrderableCartSkus, loadPortfolioGroupsByIds } from '../portfolio-api.js';

const section = (title) => console.log(`\n\n######## ${title} ########`);

function kvEnv() {
  const cache = new Map();
  return {
    PAGE_CONTENT: {
      get: async (key) => {
        if (cache.has(key)) return cache.get(key);
        const v = await kvGet(key);
        const out = v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v));
        cache.set(key, out);
        return out;
      },
    },
  };
}

const env = kvEnv();
const loadProjectContent = async (_env, project) => {
  const raw = await env.PAGE_CONTENT.get(project === 'life' ? 'life_page_content' : 'page_content');
  return raw ? JSON.parse(raw) : null;
};

const name = (p) => String(p?.public_data?.name || p?.product_id || '').slice(0, 60);

function matchedKeyword(product, keywords) {
  const text = productSearchText(product);
  return keywords.find((kw) => productMatchesAnyKeyword(text, [kw])) || null;
}

/** Класификация на каталога: слотове, конфликтни групи и откъде идва съвпадението (име или само описание). */
function classificationReport(label, products) {
  section(`КЛАСИФИКАЦИЯ: ${label} (${products.length} продукта)`);
  const slots = {};
  for (const p of products) {
    const s = classifyProductSlot(p);
    slots[s] = (slots[s] || 0) + 1;
  }
  console.log('слотове:', JSON.stringify(slots));

  for (const group of ['stimulant', 'thermogenic', 'omega3', 'protein']) {
    const kws = STACK_CONFLICT_GROUPS[group];
    const flagged = products.filter((p) => getProductConflictGroups(p).includes(group));
    const byDescOnly = flagged.filter((p) => !productMatchesAnyKeyword(String(p.public_data?.name || '').toLowerCase(), kws));
    const kwCount = {};
    for (const p of byDescOnly) {
      const kw = matchedKeyword(p, kws) || '?';
      kwCount[kw] = (kwCount[kw] || 0) + 1;
    }
    console.log(`\n[${group}] маркирани: ${flagged.length}; само по описание: ${byDescOnly.length}; думи: ${JSON.stringify(kwCount)}`);
    for (const p of byDescOnly.slice(0, 8)) console.log(`   - ${name(p)}  ← „${matchedKeyword(p, kws)}“`);
  }
}

function describeTiers(composed, productMap) {
  for (const key of ['basic', 'optimal', 'premium']) {
    const tier = composed.tiers[key];
    let sum = 0;
    const rows = tier.products.map((item) => {
      const p = productMap.get(item.product_id);
      const price = getProductPriceEur(p);
      sum += price;
      const days = getPackDaysSupply(p);
      return `      ${name(p)} | ${classifyProductSlot(p)} | ${price.toFixed(2)} € | ${days ? `${days} дни` : 'дни ?'} | ${item.timing || ''}`;
    });
    console.log(`   ${key}: ${tier.products.length} бр., ${sum.toFixed(2)} €`);
    for (const r of rows) console.log(r);
  }
}

function exclusionSummary(exclusionMap) {
  const reasons = {};
  for (const list of Object.values(exclusionMap || {})) {
    for (const r of list) reasons[r] = (reasons[r] || 0) + 1;
  }
  return reasons;
}

const SITE_PROFILES = {
  main: [
    { label: 'жена 35-44, BMI≈31, апетит, кофеин ок, 30-60 €', sex: 'female', age_band: '35-44', height_cm: 165, weight_kg: 85, activity: 'rare', diet: 'omnivore', conditions: ['none'], medications: ['none'], symptoms: ['cravings'], stimulant_tolerance: 'ok', allergies: ['none'], weight_goal: '10-20', budget_band: '30-60' },
    { label: 'жена 45-54, хипертония, чувствителна към кофеин, до 30 €', sex: 'female', age_band: '45-54', height_cm: 162, weight_kg: 74, activity: 'moderate', diet: 'omnivore', conditions: ['hypertension'], medications: ['none'], symptoms: ['fatigue'], stimulant_tolerance: 'sensitive', allergies: ['none'], weight_goal: '5-10', budget_band: 'up30' },
    { label: 'мъж 25-34, тренира, без стимуланти, 60-100 €', sex: 'male', age_band: '25-34', height_cm: 182, weight_kg: 92, activity: 'regular', diet: 'omnivore', conditions: ['none'], medications: ['none'], symptoms: ['none'], stimulant_tolerance: 'avoid', allergies: ['lactose'], weight_goal: '5-10', budget_band: '60-100' },
    { label: 'жена 25-34, кърми', sex: 'female', age_band: '25-34', height_cm: 168, weight_kg: 72, activity: 'rare', diet: 'omnivore', conditions: ['breastfeeding'], medications: ['none'], symptoms: ['fatigue'], stimulant_tolerance: 'ok', allergies: ['none'], weight_goal: '5-10', budget_band: '30-60' },
    { label: 'мъж 55-64, антикоагуланти + статини', sex: 'male', age_band: '55-64', height_cm: 176, weight_kg: 98, activity: 'rare', diet: 'omnivore', conditions: ['cardiovascular'], medications: ['anticoagulants', 'statins'], symptoms: ['joint_pain'], stimulant_tolerance: 'ok', allergies: ['none'], weight_goal: '10-20', budget_band: '60-100' },
  ],
  life: [
    { label: 'жена 45-54, кожа', sex: 'female', age_band: '45-54', height_cm: 165, weight_kg: 62, priority: 'skin', activity: 'moderate', diet: 'omnivore', conditions: ['none'], medications: ['none'], symptoms: ['hair_nails'], allergies: ['none'] },
    { label: 'мъж 55-64, памет, статини', sex: 'male', age_band: '55-64', height_cm: 178, weight_kg: 84, priority: 'cognition', activity: 'rare', diet: 'omnivore', conditions: ['none'], medications: ['statins'], symptoms: ['concentration'], allergies: ['none'] },
    { label: 'жена 35-44, сън, SSRI', sex: 'female', age_band: '35-44', height_cm: 170, weight_kg: 60, priority: 'sleep', activity: 'moderate', diet: 'omnivore', conditions: ['none'], medications: ['ssri'], symptoms: ['poor_sleep'], allergies: ['none'] },
    { label: 'жена 25-34, веган, енергия', sex: 'female', age_band: '25-34', height_cm: 164, weight_kg: 55, priority: 'energy', activity: 'regular', diet: 'vegan', conditions: ['none'], medications: ['none'], symptoms: ['fatigue'], allergies: ['none'] },
    { label: 'мъж 65+, стави, антикоагуланти', sex: 'male', age_band: '65+', height_cm: 172, weight_kg: 80, priority: 'joints', activity: 'rare', diet: 'omnivore', conditions: ['none'], medications: ['anticoagulants'], symptoms: ['joint_pain'], allergies: ['none'] },
  ],
};

const PORTFOLIO_PROFILES = [
  { label: 'отслабване, пакет, жена', selection_mode: 'package', priority: 'otshalvane', sex: 'female', age_band: '35-44', height_cm: 165, weight_kg: 80, activity: 'moderate', diet: 'omnivore', conditions: ['none'], medications: ['none'], symptoms: ['none'], allergies: ['none'], product_categories: ['all'] },
  { label: 'мускули, пакет, мъж тренира', selection_mode: 'package', priority: 'muscle', sex: 'male', age_band: '25-34', height_cm: 180, weight_kg: 78, activity: 'regular', diet: 'omnivore', conditions: ['none'], medications: ['none'], symptoms: ['none'], allergies: ['none'], product_categories: ['all'] },
  { label: 'здраве, един продукт, жена 55-64', selection_mode: 'single', priority: 'health', sex: 'female', age_band: '55-64', height_cm: 160, weight_kg: 66, activity: 'rare', diet: 'omnivore', conditions: ['none'], medications: ['none'], symptoms: ['fatigue'], allergies: ['none'], product_categories: ['all'] },
  { label: 'антиейджинг, пакет, веган', selection_mode: 'package', priority: 'antiaging', sex: 'female', age_band: '45-54', height_cm: 166, weight_kg: 58, activity: 'moderate', diet: 'vegan', conditions: ['none'], medications: ['none'], symptoms: ['none'], allergies: ['none'], product_categories: ['all'] },
  { label: 'възстановяване, пакет, бъбречно', selection_mode: 'package', priority: 'recovery', sex: 'male', age_band: '45-54', height_cm: 175, weight_kg: 85, activity: 'regular', diet: 'omnivore', conditions: ['kidney'], medications: ['none'], symptoms: ['joint_pain'], allergies: ['none'], product_categories: ['all'] },
];

async function diagnoseSite(siteId) {
  const content = await loadProjectContent(env, siteId);
  if (!content) {
    console.log(`${siteId}: няма съдържание в KV`);
    return;
  }
  const all = extractProductsFromContent(content);
  const eligible = filterEligibleProducts(all);
  classificationReport(`${siteId} (допустими)`, eligible);

  const deps = { loadProjectContent, loadGroupsByIds: loadPortfolioGroupsByIds, filterOrderable: filterOrderableCartSkus };
  for (const raw of SITE_PROFILES[siteId]) {
    section(`${siteId.toUpperCase()}: ${raw.label}`);
    const answers = { ...raw, email: 'diag@example.com' };
    try {
      const profile = buildSiteAdvisorProfile(answers, siteId);
      const mode = resolveAdvisorCompositionStrategy(profile);
      const prepared = await prepareSiteAdvisorSubmission(env, answers, deps, { siteId, compositionMode: 'compose_narrate' });
      const { ranked, eligible: el, exclusion_map: exMap } = prepared;
      console.log(`режим в production: ${mode}; поръчваеми: ${el.length}; след safety: ${ranked.length}`);
      console.log(`изключени: ${JSON.stringify(exclusionSummary(exMap))}`);
      console.log('топ 8:');
      for (const e of ranked.slice(0, 8)) console.log(`   ${e.score.toFixed(1)} | ${name(e.product)} | ${classifyProductSlot(e.product)} | ${getProductConflictGroups(e.product).join(',')}`);
      const opts = getSiteComposeOptions(siteId);
      const composed = (siteId === 'main' && composeCoreSupportStacks(profile, ranked, opts)) || composeProtocolStacks(profile, ranked, opts);
      console.log(`съставено (${composed.meta?.mode || 'general'}):`);
      describeTiers(composed, new Map(el.map((p) => [p.product_id, p])));
    } catch (e) {
      console.log(`ГРЕШКА: ${e.message}`);
    }
  }
}

async function diagnosePortfolio() {
  const products = await loadPortfolioCatalogProducts(env);
  const eligible = filterPortfolioEligibleProducts(products, { selectionMode: 'package' });
  classificationReport('biocode (допустими)', eligible);

  for (const raw of PORTFOLIO_PROFILES) {
    section(`BIOCODE: ${raw.label}`);
    const answers = { ...raw, email: 'diag@example.com' };
    try {
      const profile = buildPortfolioAdvisorProfile(answers);
      const mode = resolveAdvisorCompositionStrategy(profile);
      const prepared = await preparePortfolioAdvisorSubmission(env, answers, { compositionMode: 'compose_narrate' });
      const { ranked, eligible: el, exclusion_map: exMap, payload } = prepared;
      console.log(`режим в production: ${mode}; пул: ${el.length}; работен: ${ranked.length}`);
      console.log(`изключени: ${JSON.stringify(exclusionSummary(exMap))}`);
      console.log(`stats: ${JSON.stringify(payload.catalog_stats)}`);
      console.log('топ 8:');
      for (const e of ranked.slice(0, 8)) console.log(`   ${e.score.toFixed(1)} | ${name(e.product)} | ${classifyProductSlot(e.product)} | ${getProductConflictGroups(e.product).join(',')}`);
      const composed = composePortfolioAdvisorStacks(profile, ranked, getPortfolioComposeOptions(profile));
      describeTiers(composed, new Map(el.map((p) => [p.product_id, p])));
    } catch (e) {
      console.log(`ГРЕШКА: ${e.message}`);
    }
  }
}

await diagnoseSite('main');
await diagnoseSite('life');
await diagnosePortfolio();

/** Снимка на каталозите за офлайн анализ (без клиентски данни, без доставни цени). */
async function exportSnapshot() {
  const fs = await import('node:fs');
  const out = {};
  const compact = (p) => ({
    id: p.product_id,
    name: p.public_data?.name,
    brand: p.public_data?.brand,
    cat_top: p.system_data?.portfolio?.category_top || '',
    cat: p.system_data?.portfolio?.category || '',
    goals: p.system_data?.goals || [],
    price: getProductPriceEur(p),
    inv: p.system_data?.inventory,
    margin_eligible: p.system_data?.margin_eligible,
    variants: (p.public_data?.variants || []).map((v) => [v.option_name, v.price, v.available !== false]),
    packaging: p.public_data?.packaging || null,
    intake: p.public_data?.recommended_intake || '',
    ingredients: (p.public_data?.ingredients || []).map((i) => i.name).slice(0, 15),
    text: String(p.public_data?.description || '').slice(0, 1500),
    tagline: p.public_data?.tagline || '',
  });
  for (const site of ['main', 'life']) {
    const content = await loadProjectContent(env, site);
    out[site] = extractProductsFromContent(content || {}).map(compact);
  }
  const products = await loadPortfolioCatalogProducts(env);
  out.portfolio = filterPortfolioEligibleProducts(products, { selectionMode: 'package' }).map(compact);
  fs.mkdirSync('diag-out', { recursive: true });
  fs.writeFileSync('diag-out/advisor-catalog-snapshot.json', JSON.stringify(out));
  console.log(`снимка: main ${out.main.length}, life ${out.life.length}, portfolio ${out.portfolio.length}`);
}

await exportSnapshot();
