/**
 * Live audit: difficult advisor profiles → physiological/dietetic adequacy check.
 * Usage: node e2e/advisor-live-profile-audit.mjs
 */
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API = process.env.ADVISOR_API || 'https://port.radilov-k.workers.dev';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const profiles = [
  {
    id: 'P1_obese_diabetic_hypertension',
    label: 'Жена 52, отслабване, BMI~34, диабет+хипертония, лактоза, статини',
    answers: {
      selection_mode: 'package',
      sex: 'female',
      age_band: '45-54',
      priority: 'otshalvane',
      height_cm: 165,
      weight_kg: 92,
      product_categories: ['all'],
      activity: 'moderate',
      diet: 'omnivore',
      conditions: ['diabetes', 'hypertension'],
      medications: ['statins'],
      symptoms: ['fatigue'],
      allergies: ['lactose'],
      email: `audit-p1-${Date.now()}@test.local`,
      name: 'Audit P1',
    },
    checks: {
      mustNotContainKeywords: ['йохимбин', 'yohimbine', 'ефедра', 'ephedra', 'берберин', 'berberine', 'хром', 'chromium', 'суроватк', 'whey', 'казеин', 'casein', 'лактоз', 'lactose'],
      shouldPreferKeywords: ['carnitine', 'карнитин', 'protein isolate', 'изолат', 'coq10', 'коензим'],
    },
  },
  {
    id: 'P2_kidney_muscle',
    label: 'Мъж 28, мускули, бъбречно, веган, тренира редовно',
    answers: {
      selection_mode: 'package',
      sex: 'male',
      age_band: '25-34',
      priority: 'muscle',
      height_cm: 178,
      weight_kg: 75,
      product_categories: ['all'],
      activity: 'regular',
      diet: 'vegan',
      conditions: ['kidney'],
      medications: ['none'],
      symptoms: ['none'],
      allergies: ['none'],
      email: `audit-p2-${Date.now()}@test.local`,
      name: 'Audit P2',
    },
    checks: {
      mustNotContainKeywords: ['креатин', 'creatine', 'суроватк', 'whey', 'казеин', 'casein', 'протеин', 'protein', 'gelatin', 'желатин'],
    },
  },
  {
    id: 'P3_pregnancy_health',
    label: 'Бременна жена 32, общо здраве, витамини',
    answers: {
      selection_mode: 'package',
      sex: 'female',
      age_band: '25-34',
      priority: 'health',
      product_categories: ['Витамини', 'Билки'],
      activity: 'moderate',
      diet: 'vegetarian',
      conditions: ['pregnancy'],
      medications: ['none'],
      symptoms: ['none'],
      allergies: ['none'],
      email: `audit-p3-${Date.now()}@test.local`,
      name: 'Audit P3',
    },
    checks: {
      mustNotContainKeywords: ['мелатонин', 'melatonin', 'ашваганда', 'ashwagandha', 'берберин', 'berberine', 'фитоестроген'],
    },
  },
  {
    id: 'P4_thyroid_ssri_energy',
    label: 'Жена 40, енергия, щитовидна+SSRI, без стимуланти/йод',
    answers: {
      selection_mode: 'package',
      sex: 'female',
      age_band: '35-44',
      priority: 'energy',
      product_categories: ['all'],
      activity: 'rare',
      diet: 'omnivore',
      conditions: ['thyroid'],
      medications: ['ssri'],
      symptoms: ['fatigue', 'low_mood'],
      allergies: ['none'],
      email: `audit-p4-${Date.now()}@test.local`,
      name: 'Audit P4',
    },
    checks: {
      mustNotContainKeywords: ['йод', 'iodine', 'келп', 'kelp', '5-htp', 'триптофан', 'tryptophan', 'йохимбин', 'ефедра'],
    },
  },
  {
    id: 'P5_anticoagulant_antiaging',
    label: 'Мъж 58, антиейдж, антикоагуланти — без омега-3/куркумин',
    answers: {
      selection_mode: 'package',
      sex: 'male',
      age_band: '55-64',
      priority: 'antiaging',
      product_categories: ['all'],
      activity: 'moderate',
      diet: 'omnivore',
      conditions: ['cardiovascular'],
      medications: ['anticoagulants'],
      symptoms: ['joint_pain'],
      allergies: ['none'],
      email: `audit-p5-${Date.now()}@test.local`,
      name: 'Audit P5',
    },
    checks: {
      mustNotContainKeywords: ['йохимбин', 'yohimbine', 'омега-3', 'omega-3', 'рибено масло', 'fish oil', 'куркумин', 'curcumin', 'витамин e', 'vitamin e'],
    },
  },
  {
    id: 'P6_keto_recovery_complex',
    label: 'Мъж 35, възстановяване, кето, автоимунно, без ехинацея',
    answers: {
      selection_mode: 'package',
      sex: 'male',
      age_band: '35-44',
      priority: 'recovery',
      height_cm: 182,
      weight_kg: 88,
      product_categories: ['all'],
      activity: 'regular',
      diet: 'keto',
      conditions: ['autoimmune'],
      medications: ['none'],
      symptoms: ['joint_pain', 'poor_sleep'],
      allergies: ['none'],
      email: `audit-p6-${Date.now()}@test.local`,
      name: 'Audit P6',
    },
    checks: {
      mustNotContainKeywords: ['ехинацея', 'echinacea', 'астрагал', 'astragalus'],
    },
  },
];

function tierProducts(data) {
  const tiers = data.tiers || {};
  const out = [];
  for (const key of ['basic', 'optimal', 'premium']) {
    const products = tiers[key]?.products || [];
    for (const p of products) {
      out.push({ tier: key, name: p.name || '', brand: p.brand || '', dose: p.dose, timing: p.timing, why: p.why_for_you });
    }
  }
  return out;
}

function allProductText(data) {
  return tierProducts(data).map((p) => `${p.name} ${p.brand} ${p.dose} ${p.timing} ${p.why}`).join(' ').toLowerCase();
}

function auditProfile(profile, data) {
  const issues = [];
  const passes = [];
  const text = allProductText(data);
  const products = tierProducts(data);

  if (!data.tiers?.basic?.products?.length) issues.push('Липсват продукти в basic tier');
  if (!data.tiers?.optimal?.products?.length) issues.push('Липсват продукти в optimal tier');
  if (!data.tiers?.premium?.products?.length) issues.push('Липсват продукти в premium tier');

  for (const kw of profile.checks.mustNotContainKeywords || []) {
    if (text.includes(kw.toLowerCase())) {
      issues.push(`Забранен/неподходящ компонент „${kw}" в препоръката`);
    }
  }

  // Duplicate active slots across optimal tier
  const optimal = (data.tiers?.optimal?.products || []).map((p) => p.name).join(', ');
  if (optimal) passes.push(`Optimal: ${optimal}`);

  // Statins → CoQ10 for P1
  if (profile.id === 'P1_obese_diabetic_hypertension') {
    const hasCoq = /coq|коензим|ubiquinol|убихинол/i.test(text);
    if (!hasCoq) issues.push('При статини липсва CoQ10/убихинол в някой tier');
  }

  return { issues, passes, products, recommended: data.recommended_tier, analysis: data.analysis };
}

async function submitProfile(profile) {
  const res = await fetch(`${API}/portfolio-advisor-submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile.answers),
  });
  const raw = await res.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { parse_error: raw.slice(0, 200) }; }
  return { status: res.status, data };
}

async function main() {
  console.log(`Advisor live audit → ${API}\n`);
  const report = { api: API, timestamp: new Date().toISOString(), profiles: [] };

  for (const profile of profiles) {
    console.log(`\n=== ${profile.id}: ${profile.label} ===`);
    const { status, data } = await submitProfile(profile);
    if (status !== 200) {
      console.log(`  FAIL HTTP ${status}: ${data.error || data.message || JSON.stringify(data).slice(0, 200)}`);
      report.profiles.push({ id: profile.id, label: profile.label, error: data.error || status });
      continue;
    }
    const audit = auditProfile(profile, data);
    console.log(`  Recommended: ${audit.recommended}`);
    for (const p of audit.passes) console.log(`  ✓ ${p}`);
    for (const issue of audit.issues) console.log(`  ✗ ${issue}`);
    report.profiles.push({
      id: profile.id,
      label: profile.label,
      recommended: audit.recommended,
      analysis: audit.analysis,
      products: audit.products,
      issues: audit.issues,
      passes: audit.passes,
    });
  }

  const outPath = path.join(ROOT, 'e2e', 'advisor-live-audit-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved: ${outPath}`);

  const totalIssues = report.profiles.reduce((s, p) => s + (p.issues?.length || 0), 0);
  if (totalIssues) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
