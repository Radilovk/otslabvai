/**
 * Диагностика (само четене) на трите AI консултанта върху реалните каталози в KV:
 * типични клиентски профили → филтри → точкуване → съставени пакети (без AI извикване).
 * Нищо не се записва. Профилите са измислени — без лични данни.
 *
 * Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 */
import { kvGet } from '../catalog-kv-client.mjs';
import { prepareSiteAdvisorSubmission } from '../site-advisor-engine.js';
import { getProductFacts } from '../advisor-product-facts.js';
import {
  extractProductsFromContent,
  filterEligibleProducts,
  getProductPriceEur,
  getPackDaysSupply,
} from '../protocol-quiz-engine.js';
import {
  preparePortfolioAdvisorSubmission,
  loadPortfolioCatalogProducts,
  filterPortfolioEligibleProducts,
  buildPortfolioAdvisorProfile,
} from '../portfolio-advisor-engine.js';
import { resolveAdvisorCompositionStrategy } from '../site-advisor-shared.js';
import { classifyProductSlot, getProductConflictGroups } from '../portfolio-stack-slots.js';
import { buildSiteAdvisorMessages } from '../site-advisor-prompt.js';
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

/** Класификация на каталога по факти: вид, слот, стимуланти, източник. */
function classificationReport(label, products) {
  section(`КЛАСИФИКАЦИЯ: ${label} (${products.length} продукта)`);
  const count = (f) => {
    const m = {};
    for (const p of products) { const k = f(getProductFacts(p)); m[k] = (m[k] || 0) + 1; }
    return JSON.stringify(m);
  };
  console.log('вид:', count((x) => x.kind));
  console.log('слот:', count((x) => x.slot));
  console.log('източник:', count((x) => x.source));
  console.log('стимуланти:', products.filter((p) => getProductFacts(p).stimulant).length);
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
      return `      ${name(p)} | ${classifyProductSlot(p)}${getProductConflictGroups(p).includes('stimulant') ? ' (стимулант)' : ''} | ${price.toFixed(2)} € | ${days ? `${days} дни` : 'дни ?'} | ${item.timing || ''}`;
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
      const prepared = await prepareSiteAdvisorSubmission(env, answers, deps, { siteId, compositionMode: mode });
      const { ranked, eligible: el, exclusion_map: exMap, composed, payload } = prepared;
      console.log(`режим: ${mode}; поръчваеми: ${el.length}; след safety: ${ranked.length}`);
      console.log(`изключени: ${JSON.stringify(exclusionSummary(exMap))}`);
      console.log(`съставено (${composed.meta?.mode}${composed.meta?.plan ? ': ' + composed.meta.plan.join(' → ') : ''}):`);
      describeTiers(composed, new Map(el.map((p) => [p.product_id, p])));
      if (mode === 'ai_pick') {
        const msgs = buildSiteAdvisorMessages('x', payload, profile, siteId);
        console.log(`AI преглед: ${payload.candidate_products.length} карти; данни към AI ≈ ${msgs[msgs.length - 1].content.length} знака; имейл в данните: ${msgs.some((m) => m.content.includes('diag@example.com'))}`);
      }
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
      const prepared = await preparePortfolioAdvisorSubmission(env, answers, { compositionMode: mode });
      const { ranked, eligible: el, exclusion_map: exMap, payload, composed } = prepared;
      console.log(`режим: ${mode}; пул: ${el.length}; след safety: ${ranked.length}`);
      console.log(`изключени: ${JSON.stringify(exclusionSummary(exMap))}`);
      console.log(`съставено (${composed.meta?.mode}${composed.meta?.plan ? ': ' + composed.meta.plan.join(' → ') : ''}):`);
      describeTiers(composed, new Map(el.map((p) => [p.product_id, p])));
      if (payload.candidate_products.length) console.log(`AI преглед: ${payload.candidate_products.length} карти`);
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
