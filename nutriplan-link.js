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

async function createLink(siteId, result) {
  const src = NUTRIPLAN_SOURCE[siteId];
  const fallback = `${NUTRIPLAN_SITE}/questionnaire2.html?from=${src}&utm_source=${src}&utm_medium=quiz_result`;
  const answers = readQuizAnswers(siteId);
  if (!answers) return fallback;
  try {
    const res = await fetch(NUTRIPLAN_HANDOFF_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildNutriPlanHandoff(siteId, answers, result)),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.url === 'string' && data.url.startsWith(`${NUTRIPLAN_SITE}/`)) return data.url;
  } catch {
    // към въпросника без пратка
  }
  return fallback;
}

/** Блок за страницата с резултата. */
export function renderNutriPlanCta() {
  return `
    <section class="lpr-schedule lpr-nutriplan" aria-label="Персонален хранителен план">
      <h3>Добавките работят най-добре с правилното хранене</h3>
      <p>NutriPlan съставя персонален хранителен план по вашите цели и здравословно състояние. Отговорите от този тест ще попълнят въпросника — няма да ги въвеждате отново.</p>
      <button type="button" class="lpq-btn lpq-btn-primary" data-action="nutriplan">Направи ми хранителен план</button>
    </section>`;
}

export function bindNutriPlanCta(root, siteId, result) {
  const btn = root?.querySelector('[data-action="nutriplan"]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Подготвяме…';
    const url = await createLink(siteId, result);
    window.location.href = url;
    setTimeout(() => { btn.disabled = false; btn.textContent = label; }, 4000);
  });
}

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const NUTRIPLAN_PROMO_DEFAULTS = {
  title: 'Персонален хранителен план — NutriPlan',
  content: 'Хранителен режим по вашите цели, здраве и навици: седмично меню, замени, списък за пазаруване и асистент, който отговаря денонощно. Добавките работят най-добре с правилното хранене.',
  image: `${NUTRIPLAN_SITE}/icon-512x512.png`,
  button: { text: 'Създай моя план' },
};

/**
 * Рекламен блок за страниците на сайтовете (тип компонент „nutriplan_cta“).
 * Празните полета взимат стойности по подразбиране; линкът носи utm на сайта.
 */
export function renderNutriPlanPromo(component, siteId) {
  const c = component || {};
  const d = NUTRIPLAN_PROMO_DEFAULTS;
  const url = c.button?.url || nutriPlanUrl(siteId, 'page');
  const align = c.options?.image_align === 'right' ? 'right' : 'left';
  return `
    <section ${c.id ? `id="${esc(c.id)}"` : ''} class="info-card-section nutriplan-promo fade-in-up image-align-${align}">
        <div class="container">
            <div class="info-card-image">
                <img src="${esc(c.image || d.image)}" alt="NutriPlan" loading="lazy">
            </div>
            <div class="info-card-content">
                <h2>${esc(c.title || d.title)}</h2>
                <p>${esc(c.content || d.content)}</p>
                <a href="${esc(url)}" class="btn btn-hero-primary" target="_blank" rel="noopener">${esc(c.button?.text || d.button.text)}</a>
            </div>
        </div>
    </section>`;
}
