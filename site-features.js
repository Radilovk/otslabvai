/**
 * Акцентни секции на началните страници (daotslabna.com и life-protocols.com):
 * AI съветникът (тестът за протокол) веднага под банера и лентата на NutriPlan.
 *
 * Визията е изградена в интерфейса (примерен резултат, телефон с плана), не
 * със снимки — за да показва точно какво получава човек. Стилът е в
 * site-features.css; цветовете и шрифтовете идват от темата на сайта.
 */

import { renderNutriPlanPromo } from './nutriplan-link.js';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ICON = {
  arrow: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  spark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" opacity=".6"/></svg>',
  sun: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  noon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 17h18M6 17a6 6 0 0 1 12 0"/><path d="M12 5v3"/></svg>',
  moon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
};

/** Текстовете и примерният резултат за всеки сайт. */
export const ADVISOR_CONTENT = {
  main: {
    url: 'main-advisor-quiz.html',
    eyebrow: 'AI съветник · безплатно · 2 минути',
    title: 'Протокол за отслабване, <em>подбран за вас</em>',
    lead: 'Отговорете на кратък въпросник. AI съветникът отчита целта, тялото, здравословното състояние и лекарствата ви и подбира добавки в три варианта — с точен прием през деня.',
    steps: [
      ['Въпросник', 'цел, тяло, навици, здраве'],
      ['Анализ', 'ИТМ, противопоказания, лекарства'],
      ['Протокол', '3 варианта и дневен график'],
    ],
    trust: ['Проверка за несъвместимост с лекарства', 'Три варианта според бюджета', 'Без регистрация'],
    cta: 'Започни теста',
    mock: {
      title: 'Вашият протокол',
      rows: [
        ['sun', 'Сутрин', 'Метаболизъм', '1 капсула със закуската'],
        ['noon', 'Обяд', 'Контрол на апетита', '30 мин преди храна'],
        ['moon', 'Вечер', 'Сън и възстановяване', 'преди лягане'],
      ],
      chips: ['ИТМ отчетен', 'Цел: −5–10 кг'],
    },
  },
  life: {
    url: 'life-protocol-quiz.html',
    eyebrow: 'AI протокол · безплатно · 2 минути',
    title: 'Персонален протокол <em>за дълголетие</em>',
    lead: 'Изберете приоритет — енергия, сън, кожа, памет или стави. AI съветникът съставя протокол според възрастта, състоянията и лекарствата ви, в три нива и с график на приема.',
    steps: [
      ['Приоритет', 'какво искате да подобрите'],
      ['Анализ', 'възраст, здраве, лекарства'],
      ['Протокол', '3 нива и дневен график'],
    ],
    trust: ['Проверка за несъвместимост с лекарства', 'Научно обосновани съставки', 'Без регистрация'],
    cta: 'Получи своя протокол',
    mock: {
      title: 'Вашият протокол',
      rows: [
        ['sun', 'Сутрин', 'Клетъчна енергия', '1 капсула със закуската'],
        ['noon', 'Обяд', 'Омега-3', '2 капсули с храна'],
        ['moon', 'Вечер', 'Магнезий бисглицинат', 'преди сън'],
      ],
      chips: ['Приоритет: енергия', 'Възраст отчетена'],
    },
  },
};

export function renderAdvisorFeature(siteId) {
  const c = ADVISOR_CONTENT[siteId] || ADVISOR_CONTENT.main;
  const m = c.mock;
  return `
  <section class="sf sf--${esc(siteId)} sf-advisor" id="ai-advisor" aria-labelledby="sf-advisor-title">
    <div class="container sf-advisor__grid">
      <div class="sf-advisor__head">
        <span class="sf-eyebrow">${ICON.spark}${esc(c.eyebrow)}</span>
        <h2 class="sf-title" id="sf-advisor-title">${c.title}</h2>
        <p class="sf-lead">${esc(c.lead)}</p>
        <div class="sf-actions">
          <a class="sf-btn sf-btn--primary" href="${esc(c.url)}">${esc(c.cta)}${ICON.arrow}</a>
          <span class="sf-note">Без регистрация · резултат веднага</span>
        </div>
      </div>
      <a class="sf-advisor__visual" href="${esc(c.url)}" tabindex="-1" aria-hidden="true">
        <div class="sf-mock">
          <div class="sf-mock__head">
            <span class="sf-mock__ai">${ICON.spark}</span>
            <span class="sf-mock__title">${esc(m.title)}<small>AI съветник</small></span>
            <span class="sf-mock__badge">Препоръчан</span>
          </div>
          <div class="sf-mock__tiers"><span>Базов</span><span class="is-active">Оптимален</span><span>Премиум</span></div>
          <ul class="sf-mock__rows">
            ${m.rows.map(([ic, when, what, how]) => `<li><span class="sf-mock__when">${ICON[ic]}${esc(when)}</span><span class="sf-mock__what"><strong>${esc(what)}</strong><small>${esc(how)}</small></span></li>`).join('')}
          </ul>
          <div class="sf-mock__foot">${ICON.shield}Съвместимо с вашите лекарства</div>
        </div>
        ${m.chips.map((t, i) => `<span class="sf-chip sf-chip--${i + 1}">${ICON.check}${esc(t)}</span>`).join('')}
        <span class="sf-mock__caption">Примерен резултат</span>
      </a>
      <div class="sf-advisor__more">
        <ol class="sf-steps">
          ${c.steps.map(([t, d], i) => `<li><span class="sf-steps__n">${i + 1}</span><span><strong>${esc(t)}</strong><small>${esc(d)}</small></span></li>`).join('')}
        </ol>
        <ul class="sf-trust">
          ${c.trust.filter((t) => t !== 'Без регистрация').map((t) => `<li>${ICON.check}${esc(t)}</li>`).join('')}
        </ul>
      </div>
    </div>
  </section>`;
}

/** Картите, които водят към теста, се заместват от секцията на AI съветника. */
export function isAdvisorInfoCard(component) {
  if (component?.type !== 'info_card') return false;
  const url = String(component.button?.url || '');
  return !url || /advisor-quiz|protocol-quiz|quest\.html|\/port\/quest/i.test(url);
}

/**
 * Компонентите на началната страница + акцентите:
 * AI съветникът веднага след банера; NutriPlan след първата продуктова категория
 * (ако админът не е поставил блока сам).
 * @param {object[]} pageContent
 * @param {'main'|'life'} siteId
 * @param {(component: object, index: number) => string} renderComponent
 */
export function renderWithFeatures(pageContent, siteId, renderComponent) {
  const list = Array.isArray(pageContent) ? pageContent : [];
  const hasNutriPlan = list.some((c) => c?.type === 'nutriplan_cta');
  let advisorDone = false;
  let nutriDone = hasNutriPlan;
  let html = '';
  list.forEach((component, index) => {
    if (isAdvisorInfoCard(component)) return;
    const out = renderComponent(component, index) || '';
    html += out;
    if (!advisorDone && component?.type === 'hero_banner') {
      html += renderAdvisorFeature(siteId);
      advisorDone = true;
    }
    if (!nutriDone && component?.type === 'product_category' && out) {
      html += renderNutriPlanPromo({}, siteId);
      nutriDone = true;
    }
  });
  if (!advisorDone) html = renderAdvisorFeature(siteId) + html;
  if (!nutriDone) html += renderNutriPlanPromo({}, siteId);
  return html;
}
