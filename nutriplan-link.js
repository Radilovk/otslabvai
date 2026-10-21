/**
 * Връзка към NutriPlan (biocode.website) — персонален хранителен план.
 *
 * След теста отговорите и препоръчаният протокол отиват към NutriPlan като
 * еднократна пратка (/api/handoff): там попълват въпросника, а клиентът ги
 * вижда и може да ги смени. Без връзка — линк към въпросника без данни.
 * Обратно към сайта не идва нищо.
 */

export const NUTRIPLAN_SITE = 'https://biocode.website';
export const NUTRIPLAN_HANDOFF_URL = 'https://aidiet.radilov-k.workers.dev/api/handoff';

/** Сайт (main / life) → източник за NutriPlan и utm. */
export const NUTRIPLAN_SOURCE = { main: 'daotslabna', life: 'lifeprotocols' };

const ANSWERS_KEY = { main: 'mainAdvisorAnswers', life: 'lifeProtocolAnswers' };

/** Отговорите от теста — само за тази сесия на браузъра. */
export function rememberQuizAnswers(siteId, payload) {
  try {
    sessionStorage.setItem(ANSWERS_KEY[siteId], JSON.stringify(payload || {}));
  } catch {
    // без sessionStorage — CTA води към въпросника без данни
  }
}

function readQuizAnswers(siteId) {
  try {
    return JSON.parse(sessionStorage.getItem(ANSWERS_KEY[siteId]) || 'null');
  } catch {
    return null;
  }
}

export function nutriPlanUrl(siteId, medium = 'cta') {
  const src = NUTRIPLAN_SOURCE[siteId] || 'site';
  return `${NUTRIPLAN_SITE}/?utm_source=${src}&utm_medium=${encodeURIComponent(medium)}`;
}

/** Пратката: отговорите (без бюджета) и продуктите от препоръчания вариант. */
export function buildNutriPlanHandoff(siteId, answers, result) {
  const tierKey = result?.recommended_tier;
  const tier = (tierKey && result?.tiers?.[tierKey]) || null;
  const { budget_band, site_id, ...rest } = answers || {};
  return {
    source: NUTRIPLAN_SOURCE[siteId],
    completedAt: new Date().toISOString(),
    answers: rest,
    protocol: {
      tier: tier?.name || '',
      products: (tier?.products || []).slice(0, 10).map((p) => ({ name: p.name, dose: p.dose || '', timing: p.timing || '' })),
    },
  };
}

const LINK_KEY = 'nutriplanHandoffLink';

async function createLink(siteId, result) {
  const src = NUTRIPLAN_SOURCE[siteId];
  const fallback = `${NUTRIPLAN_SITE}/questionnaire2.html?from=${src}&utm_source=${src}&utm_medium=quiz_result`;
  const answers = readQuizAnswers(siteId);
  if (!answers) return fallback;
  // Повторен клик за същия резултат — същата пратка (не нов запис и нов брояч).
  const resultId = String(result?.sessionId || '');
  try {
    const saved = JSON.parse(sessionStorage.getItem(LINK_KEY) || 'null');
    if (saved && saved.site === siteId && saved.resultId === resultId && saved.url) return saved.url;
  } catch {
    // без sessionStorage — нова пратка
  }
  try {
    const res = await fetch(NUTRIPLAN_HANDOFF_URL, {
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildNutriPlanHandoff(siteId, answers, result)),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.url === 'string' && data.url.startsWith(`${NUTRIPLAN_SITE}/`)) {
      try { sessionStorage.setItem(LINK_KEY, JSON.stringify({ site: siteId, resultId, url: data.url })); } catch { /* без кеш */ }
      return data.url;
    }
  } catch {
    // към въпросника без пратка
  }
  return fallback;
}

/** Препратка в горната част на резултата — към блока за хранителен план (видима без превъртане). */
export function renderNutriPlanTeaser() {
  return `
    <a class="lpr-np-teaser" href="#lpr-np-title">
      <span class="lpr-np-logo">N</span>
      <span><strong>Безплатно към протокола:</strong> персонален хранителен план в NutriPlan</span>
      <span class="lpr-np-teaser__go" aria-hidden="true">↓</span>
    </a>`;
}

/** Блок за страницата с резултата — предложението за индивидуален хранителен план. */
export function renderNutriPlanCta() {
  const check = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const arrow = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  return `
    <section class="lpr-nutriplan" aria-labelledby="lpr-np-title">
      <span class="lpr-np-eyebrow"><span class="lpr-np-logo">N</span>Следваща стъпка · NutriPlan</span>
      <h3 id="lpr-np-title">Индивидуален хранителен план към протокола</h3>
      <p>Добавките дават най-много, когато храненето е наред. NutriPlan съставя меню по вашите цели и здраве, а отговорите от този тест се пренасят автоматично.</p>
      <ul class="lpr-np-list">
        <li>${check}Без повторни въпроси за това, което вече отговорихте (пол, ръст, тегло и др.)</li>
        <li>${check}Седмично меню и замени за всяко ястие</li>
        <li>${check}Асистент, който отговаря на въпроси за храната</li>
      </ul>
      <button type="button" class="lpr-np-btn" data-action="nutriplan">Направи ми хранителен план${arrow}</button>
      <p class="lpr-np-fine">С бутона отговорите от теста (вкл. име и имейл) се пренасят в NutriPlan, само за да попълнят въпросника.</p>
    </section>`;
}

export function bindNutriPlanCta(root, siteId, result) {
  const btn = root?.querySelector('[data-action="nutriplan"]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const label = btn.innerHTML;
    btn.textContent = 'Подготвяме…';
    const url = await createLink(siteId, result);
    window.location.href = url;
    setTimeout(() => { btn.disabled = false; btn.innerHTML = label; }, 4000);
  });
}

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const NUTRIPLAN_PROMO_DEFAULTS = {
  eyebrow: 'NutriPlan · персонален хранителен план',
  title: 'Хранене, което работи заедно с добавките',
  content: 'Добавките дават най-много, когато храненето е наред. NutriPlan съставя меню по вашите цели, здраве и вкус — и го променя заедно с вас.',
  button: { text: 'Създай моя план' },
};

const NP_FEATURES = [
  ['Седмично меню', 'по цели, здраве и предпочитания'],
  ['Замени за всяко ястие', 'без да излизате от плана'],
  ['Асистент 24/7', 'отговаря на въпроси за храната'],
  ['Седмичен преглед', 'планът се коригира по напредъка'],
];

const NP_CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const NP_ARROW = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/** Телефонът с примерен ден от плана (илюстрация, не реални данни). */
function nutriPlanPhone() {
  const meals = [
    ['08:00', 'Закуска', 'Овесена каша с боровинки и орехи'],
    ['13:00', 'Обяд', 'Пиле на скара, киноа и зеленчуци'],
    ['19:00', 'Вечеря', 'Сьомга с печени тиквички'],
  ];
  return `
      <div class="sf-np__phone" aria-hidden="true">
        <div class="sf-phone">
          <div class="sf-phone__notch"></div>
          <div class="sf-phone__screen">
            <div class="sf-phone__top"><span>Днес</span><span class="sf-phone__day">Ден 3 от 7</span></div>
            <div class="sf-phone__ring">
              <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" class="sf-ring-track"/><circle cx="60" cy="60" r="50" class="sf-ring-val" pathLength="100" stroke-dasharray="64 100"/></svg>
              <span><strong>64%</strong><small>от дневния план</small></span>
            </div>
            <ul class="sf-phone__meals">
              ${meals.map(([t, n, d], i) => `<li class="${i === 0 ? 'is-done' : ''}"><span class="sf-phone__time">${t}</span><span><strong>${n}</strong><small>${d}</small></span>${i === 0 ? `<span class="sf-phone__tick">${NP_CHECK}</span>` : ''}</li>`).join('')}
            </ul>
            <div class="sf-phone__chat">
              <span class="sf-bubble sf-bubble--me">Мога ли да заменя сьомгата?</span>
              <span class="sf-bubble">Да — пъстърва или скумрия, същото количество.</span>
            </div>
          </div>
        </div>
      </div>`;
}

/**
 * Лентата на NutriPlan за страниците на сайтовете (и компонентът „nutriplan_cta“
 * от админа). Празните полета взимат стойности по подразбиране; линкът носи utm на сайта.
 */
export function renderNutriPlanPromo(component, siteId) {
  const c = component || {};
  const d = NUTRIPLAN_PROMO_DEFAULTS;
  const url = c.button?.url || nutriPlanUrl(siteId, 'page');
  const visual = c.image
    ? `<div class="sf-np__phone"><img class="sf-np__img" src="${esc(c.image)}" alt="NutriPlan" loading="lazy"></div>`
    : nutriPlanPhone();
  return `
  <section ${c.id ? `id="${esc(c.id)}"` : ''} class="sf sf--${esc(siteId)} sf-np nutriplan-promo" aria-labelledby="sf-np-title-${esc(c.component_id || 'auto')}">
    <div class="container sf-np__inner">
      <div class="sf-np__head">
        <span class="sf-eyebrow sf-eyebrow--np"><span class="sf-np__logo">N</span>${esc(d.eyebrow)}</span>
        <h2 class="sf-title" id="sf-np-title-${esc(c.component_id || 'auto')}">${esc(c.title || d.title)}</h2>
        <p class="sf-lead">${esc(c.content || d.content)}</p>
      </div>
      ${visual}
      <div class="sf-np__more">
        <ul class="sf-np__features">
          ${NP_FEATURES.map(([t, s]) => `<li><span class="sf-np__ic">${NP_CHECK}</span><span><strong>${t}</strong><small>${s}</small></span></li>`).join('')}
        </ul>
        <div class="sf-actions">
          <a class="sf-btn sf-btn--np" href="${esc(url)}" target="_blank" rel="noopener">${esc(c.button?.text || d.button.text)}${NP_ARROW}</a>
          <span class="sf-note">biocode.website · на телефон и в браузър</span>
        </div>
      </div>
    </div>
  </section>`;
}
