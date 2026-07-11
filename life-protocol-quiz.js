import { API_URL } from './config.js';
import { ProtocolAnalysisAnimator } from './life-protocol-analysis.js';

const STORAGE_KEY = 'lifeProtocolLead';
const RESULT_KEY = 'lifeProtocolResult';

const STEPS = [
  {
    id: 'sex',
    title: 'Пол',
    hint: 'Влияе на хормоналните и метаболитни препоръки.',
    type: 'single',
    field: 'sex',
    options: [
      { value: 'female', label: 'Жена' },
      { value: 'male', label: 'Мъж' },
    ],
  },
  {
    id: 'age',
    title: 'Възрастова група',
    type: 'single',
    field: 'age_band',
    options: [
      { value: '25-34', label: '25–34' },
      { value: '35-44', label: '35–44' },
      { value: '45-54', label: '45–54' },
      { value: '55-64', label: '55–64' },
      { value: '65+', label: '65+' },
    ],
  },
  {
    id: 'body',
    title: 'Ръст и тегло',
    hint: 'Използваме ги за изчисляване на ИТМ и дозови насоки.',
    type: 'body',
  },
  {
    id: 'priority',
    title: 'Основен приоритет',
    hint: 'Изберете едно — фокусът на протокола.',
    type: 'single',
    field: 'priority',
    options: [
      { value: 'skin', label: 'Кожа и еластичност' },
      { value: 'joints', label: 'Стави и подвижност' },
      { value: 'energy', label: 'Енергия и метаболизъм' },
      { value: 'sleep', label: 'Сън и възстановяване' },
      { value: 'cognition', label: 'Умствена концентрация и памет' },
      { value: 'longevity', label: 'Обща жизненост и дълголетие' },
    ],
  },
  {
    id: 'conditions',
    title: 'Медицински състояния',
    hint: 'Отбележете всички приложими. Не спира процеса.',
    type: 'multi',
    field: 'conditions',
    options: [
      { value: 'hypertension', label: 'Хипертония' },
      { value: 'diabetes', label: 'Диабет / инсулинова резистентност' },
      { value: 'thyroid', label: 'Заболяване на щитовидната жлеза' },
      { value: 'autoimmune', label: 'Автоимунно заболяване' },
      { value: 'kidney', label: 'Бъбречно или чернодробно заболяване' },
      { value: 'cardiovascular', label: 'Сърдечно-съдово заболяване' },
      { value: 'none', label: 'Нищо от изброените', exclusive: true },
    ],
  },
  {
    id: 'medications',
    title: 'Медикаменти',
    type: 'multi',
    field: 'medications',
    options: [
      { value: 'anticoagulants', label: 'Антикоагуланти / кръворазреждащи' },
      { value: 'statins', label: 'Статини' },
      { value: 'ssri', label: 'SSRI / SNRI (антидепресанти)' },
      { value: 'hormone_therapy', label: 'Хормонална терапия / контрацепция' },
      { value: 'thyroid_meds', label: 'Медикаменти за щитовидна жлеза' },
      { value: 'none', label: 'Нищо от изброените', exclusive: true },
    ],
  },
  {
    id: 'activity',
    title: 'Физическа активност',
    type: 'single',
    field: 'activity',
    options: [
      { value: 'regular', label: 'Тренирам редовно (3+ пъти седмично)' },
      { value: 'rare', label: 'Не тренирам / тренирам рядко' },
    ],
  },
  {
    id: 'diet',
    title: 'Хранителен модел',
    type: 'single',
    field: 'diet',
    options: [
      { value: 'omnivore', label: 'Всеяден' },
      { value: 'vegetarian', label: 'Вегетарианец' },
      { value: 'vegan', label: 'Веган' },
      { value: 'keto', label: 'Кето / нисковъглехидратен' },
    ],
  },
  {
    id: 'symptoms',
    title: 'Симптоми',
    hint: 'Индикатори за възможен дефицит — не заместват лабораторни изследвания.',
    type: 'multi',
    field: 'symptoms',
    options: [
      { value: 'cramps', label: 'Чести мускулни крампи' },
      { value: 'fatigue', label: 'Постоянна умора' },
      { value: 'hair_nails', label: 'Косопад / чупливи нокти' },
      { value: 'concentration', label: 'Затруднена концентрация' },
      { value: 'none', label: 'Нищо от изброените', exclusive: true },
    ],
  },
  {
    id: 'allergies',
    title: 'Алергии и непоносимости',
    type: 'multi',
    field: 'allergies',
    options: [
      { value: 'shellfish', label: 'Миди / ракообразни' },
      { value: 'soy', label: 'Соя' },
      { value: 'gluten', label: 'Глутен' },
      { value: 'lactose', label: 'Лактоза' },
      { value: 'nuts', label: 'Ядки' },
      { value: 'none', label: 'Нищо от изброените', exclusive: true },
    ],
  },
];

const form = document.getElementById('lpq-form');
const progressEl = document.getElementById('lpq-progress');
const prevBtn = document.getElementById('lpq-prev');
const nextBtn = document.getElementById('lpq-next');
const formCard = document.getElementById('lpq-form-card');
const loadingCard = document.getElementById('lpq-loading');

const answers = loadDraft();

function loadDraft() {
  try {
    return JSON.parse(sessionStorage.getItem('lifeProtocolDraft') || '{}');
  } catch {
    return {};
  }
}

function saveDraft() {
  sessionStorage.setItem('lifeProtocolDraft', JSON.stringify(answers));
}

function getActiveSteps() {
  const steps = [...STEPS];
  const priority = answers.priority;

  if (priority === 'skin') {
    steps.push({
      id: 'branch_skin',
      title: 'Изложеност на слънце',
      type: 'single',
      field: 'sun_exposure',
      options: [
        { value: 'rare', label: 'Рядко' },
        { value: 'moderate', label: 'Умерено' },
        { value: 'frequent', label: 'Често' },
      ],
    });
  } else if (priority === 'joints') {
    steps.push({
      id: 'branch_joints',
      title: 'Дискомфорт в ставите',
      type: 'single',
      field: 'joint_duration',
      options: [
        { value: 'under_6m', label: 'По-малко от 6 месеца' },
        { value: '6_24m', label: '6–24 месеца' },
        { value: 'over_2y', label: 'Над 2 години' },
      ],
    });
  }

  if (answers.sex === 'female') {
    steps.push({
      id: 'pregnancy',
      title: 'Бременност / кърмене',
      type: 'single',
      field: 'pregnancy',
      options: [
        { value: 'no', label: 'Не' },
        { value: 'yes', label: 'Да' },
        { value: 'na', label: 'Не е приложимо' },
      ],
    });
  }

  steps.push({
    id: 'contact',
    title: 'Вашият протокол е почти готов',
    hint: 'Въведете имейл, за да видите резултата. Ще го използваме при поръчка.',
    type: 'contact',
  });

  return steps;
}

let stepIndex = 0;
let activeSteps = getActiveSteps();

function renderSteps() {
  activeSteps = getActiveSteps();
  const prevIndex = stepIndex;
  form.innerHTML = activeSteps.map((step) => renderStep(step)).join('');
  bindStepEvents();
  showStep(prevIndex);
}

function renderStep(step) {
  let inner = step.hint ? `<p class="lpq-hint">${step.hint}</p>` : '';

  if (step.type === 'single' || step.type === 'multi') {
    const inputType = step.type === 'single' ? 'radio' : 'checkbox';
    const current = answers[step.field];
    const selected = step.type === 'single' ? [current] : (Array.isArray(current) ? current : []);
    inner += `<div class="lpq-options" data-field="${step.field}" data-type="${step.type}">`;
    for (const opt of step.options) {
      const checked = selected.includes(opt.value);
      inner += `<label class="lpq-option${checked ? ' selected' : ''}">
        <input type="${inputType}" name="${step.field}" value="${opt.value}"${checked ? ' checked' : ''}${opt.exclusive ? ' data-exclusive' : ''}>
        <span>${opt.label}</span>
      </label>`;
    }
    inner += '</div>';
  } else if (step.type === 'body') {
    inner += `<div class="lpq-grid-2">
      <div class="lpq-field"><label for="height_cm">Ръст (см)</label>
        <input type="number" id="height_cm" min="100" max="250" value="${answers.height_cm || ''}"></div>
      <div class="lpq-field"><label for="weight_kg">Тегло (кг)</label>
        <input type="number" id="weight_kg" min="30" max="300" value="${answers.weight_kg || ''}"></div>
    </div>`;
  } else if (step.type === 'contact') {
    inner += `<div class="lpq-field" style="margin-bottom:1rem">
      <label for="lpq-name">Име (по избор)</label>
      <input type="text" id="lpq-name" value="${answers.name || ''}" autocomplete="name">
    </div>
    <div class="lpq-field">
      <label for="lpq-email">Имейл *</label>
      <input type="email" id="lpq-email" required value="${answers.email || ''}" autocomplete="email">
    </div>
    <p class="lpq-disclaimer">С натискане на „Виж моя протокол“ приемате, че информацията не е медицински съвет. При хронични заболявания се консултирайте с лекар.</p>`;
  }

  return `<div class="lpq-step" id="step-${step.id}">
    <h2>${step.title}</h2>
    ${inner}
    <p class="lpq-error" id="err-${step.id}"></p>
  </div>`;
}

function bindStepEvents() {
  form.querySelectorAll('.lpq-options').forEach((group) => {
    const field = group.dataset.field;
    const type = group.dataset.type;
    group.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', () => {
        if (type === 'single') {
          answers[field] = input.value;
          group.querySelectorAll('.lpq-option').forEach((l) => l.classList.remove('selected'));
          input.closest('.lpq-option')?.classList.add('selected');
        } else {
          let vals = [...group.querySelectorAll('input:checked')].map((i) => i.value);
          if (input.dataset.exclusive && input.checked) {
            vals = [input.value];
            group.querySelectorAll('input').forEach((i) => { if (i !== input) i.checked = false; });
          } else if (input.checked && input.value !== 'none') {
            const none = group.querySelector('input[value="none"]');
            if (none) none.checked = false;
          }
          answers[field] = vals.filter((v) => v !== 'none' || vals.length === 1);
          group.querySelectorAll('.lpq-option').forEach((l) => {
            l.classList.toggle('selected', l.querySelector('input')?.checked);
          });
        }
        saveDraft();
      });
    });
  });
}

function showStep(index) {
  activeSteps = getActiveSteps();
  const domStepCount = form.querySelectorAll('.lpq-step').length;
  if (domStepCount !== activeSteps.length) {
    renderSteps();
    index = Math.min(index, activeSteps.length - 1);
  }
  if (index >= activeSteps.length) index = activeSteps.length - 1;
  if (index < 0) index = 0;
  stepIndex = index;

  form.querySelectorAll('.lpq-step').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  const pct = ((index + 1) / activeSteps.length) * 100;
  progressEl.style.width = `${pct}%`;

  prevBtn.hidden = index === 0;
  nextBtn.textContent = index === activeSteps.length - 1 ? 'Виж моя протокол' : 'Напред';
}

function showError(stepId, msg) {
  const el = document.getElementById(`err-${stepId}`);
  if (el) {
    el.textContent = msg;
    el.classList.add('visible');
  }
}

function clearErrors() {
  form.querySelectorAll('.lpq-error').forEach((e) => e.classList.remove('visible'));
}

function validateCurrentStep() {
  clearErrors();
  const step = activeSteps[stepIndex];

  if (step.type === 'single' && !answers[step.field]) {
    showError(step.id, 'Моля, изберете опция.');
    return false;
  }
  if (step.type === 'multi' && !answers[step.field]?.length) {
    showError(step.id, 'Моля, изберете поне една опция или „Нищо от изброените“.');
    return false;
  }
  if (step.type === 'body') {
    const h = Number(document.getElementById('height_cm')?.value);
    const w = Number(document.getElementById('weight_kg')?.value);
    if (!h || h < 100 || h > 250) {
      showError(step.id, 'Въведете валиден ръст (100–250 см).');
      return false;
    }
    if (!w || w < 30 || w > 300) {
      showError(step.id, 'Въведете валидно тегло (30–300 кг).');
      return false;
    }
    answers.height_cm = h;
    answers.weight_kg = w;
    saveDraft();
  }
  if (step.type === 'contact') {
    answers.name = document.getElementById('lpq-name')?.value?.trim() || '';
    answers.email = document.getElementById('lpq-email')?.value?.trim() || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email)) {
      showError(step.id, 'Въведете валиден имейл адрес.');
      return false;
    }
    saveDraft();
  }
  return true;
}

async function submitQuiz() {
  formCard.hidden = true;
  loadingCard.hidden = false;

  const animator = new ProtocolAnalysisAnimator({
    logEl: document.getElementById('lpq-analysis-log'),
    progressEl: document.getElementById('lpq-analysis-progress'),
    statusEl: document.getElementById('lpq-loading-status'),
    minDurationMs: 5500,
  });
  animator.start(answers);

  try {
    const res = await fetch(`${API_URL}/life-protocol-submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
    });

    animator.notifyApiComplete();
    await animator.waitUntilReady();

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error || data.message || 'Грешка при генериране.';
      if (res.status === 503) throw new Error('Въпросникът е временно изключен. Опитайте по-късно.');
      throw new Error(msg);
    }

    localStorage.setItem('lifeProtocolLead', JSON.stringify({
      email: answers.email,
      name: answers.name || '',
      sessionId: data.sessionId,
      timestamp: Date.now(),
    }));
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(data));
    sessionStorage.removeItem('lifeProtocolDraft');

    window.location.href = 'life-protocol-result.html';
  } catch (e) {
    animator.stop();
    loadingCard.hidden = true;
    formCard.hidden = false;
    showError('contact', e.message || 'Възникна грешка. Опитайте отново.');
    stepIndex = activeSteps.findIndex((s) => s.id === 'contact');
    showStep(stepIndex);
  }
}

prevBtn.addEventListener('click', () => {
  if (stepIndex > 0) showStep(stepIndex - 1);
});

nextBtn.addEventListener('click', async () => {
  if (!validateCurrentStep()) return;
  if (stepIndex < activeSteps.length - 1) {
    showStep(stepIndex + 1);
  } else {
    await submitQuiz();
  }
});

renderSteps();

async function checkQuizEnabled() {
  try {
    const res = await fetch(`${API_URL}/life-protocol/settings`, { cache: 'no-cache' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.enabled === false) {
      formCard.innerHTML = `<div class="lpq-step active" style="text-align:center;padding:2rem 0">
        <h2>Въпросникът е временно недостъпен</h2>
        <p class="lpq-hint">Моля, опитайте по-късно или разгледайте <a href="life.html">продуктите ни</a>.</p>
      </div>`;
      prevBtn.hidden = true;
      nextBtn.hidden = true;
    }
  } catch {
    /* offline / not deployed */
  }
}

checkQuizEnabled();

document.addEventListener('keydown', (e) => {
  if (!formCard.hidden && loadingCard.hidden && e.key === 'Enter' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault();
    nextBtn.click();
  }
});
