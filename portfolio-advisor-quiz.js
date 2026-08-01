import { API_URL } from './config.js';
import { PortfolioAdvisorAnimator } from './portfolio-advisor-analysis.js';
import { persistAdvisorResult, DRAFT_KEY, RESULT_KEY, LEAD_KEY } from './portfolio-advisor-store.js';
import { buildActiveAdvisorSteps, FALLBACK_CATALOG_CATEGORIES, getDefaultAdvisorCategoryNames, pruneAdvisorAnswers } from './portfolio-advisor-config.js';

const form = document.getElementById('lpq-form');
const progressEl = document.getElementById('lpq-progress');
const prevBtn = document.getElementById('lpq-prev');
const nextBtn = document.getElementById('lpq-next');
const formCard = document.getElementById('lpq-form-card');
const loadingCard = document.getElementById('lpq-loading');

const answers = loadDraft();
const OTHER_VALUE = 'other';
const OTHER_MAX_WORDS = 8;
let catalogCategories = [];
let catalogCategoriesReady = false;

function otherFieldKey(field) {
  return `${field}_other`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function syncOtherInputs() {
  form.querySelectorAll('.lpq-other-text').forEach((input) => {
    const field = input.dataset.otherField;
    if (field) answers[otherFieldKey(field)] = input.value.trim();
  });
}

function setOtherInputVisible(field, visible) {
  const wrap = form.querySelector(`[data-other-for="${field}"]`);
  if (!wrap) return;
  if (visible) wrap.removeAttribute('hidden');
  else wrap.setAttribute('hidden', '');
}

function clearOtherField(field) {
  answers[otherFieldKey(field)] = '';
  const input = form.querySelector(`.lpq-other-text[data-other-field="${field}"]`);
  if (input) input.value = '';
  setOtherInputVisible(field, false);
}

function loadDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveDraft() {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
}

function syncCategoryDefaults() {
  const defaults = getDefaultAdvisorCategoryNames(catalogCategories, answers.priority || 'other');
  if (!defaults.length) return;

  if (answers.selection_mode === 'single') {
    if (!defaults.includes(answers.product_category)) {
      answers.product_category = defaults[0];
    }
    return;
  }

  const current = Array.isArray(answers.product_categories) ? answers.product_categories : [];
  const valid = current.filter((name) => defaults.includes(name));
  answers.product_categories = valid.length ? valid : [...defaults];
}

function profileFieldsChanged(field) {
  return ['sex', 'age_band', 'priority'].includes(field);
}

function handleProfileChange(field) {
  pruneAdvisorAnswers(answers);
  if (field === 'priority' || field === 'selection_mode') {
    delete answers.product_categories;
    delete answers.product_category;
  }
  syncCategoryDefaults();
  saveDraft();
  renderSteps();
  showStep(stepIndex);
}

function getActiveSteps() {
  syncCategoryDefaults();
  return buildActiveAdvisorSteps(answers, catalogCategories);
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
    const hasOtherSelected = selected.includes(OTHER_VALUE);
    inner += `<div class="lpq-options" data-field="${step.field}" data-type="${step.type}">`;
    for (const opt of step.options) {
      const checked = selected.includes(opt.value);
      inner += `<label class="lpq-option${checked ? ' selected' : ''}${opt.allowsText ? ' lpq-option-other' : ''}">
        <input type="${inputType}" name="${step.field}" value="${opt.value}"${checked ? ' checked' : ''}${opt.exclusive ? ' data-exclusive' : ''}${opt.allowsText ? ' data-allows-text' : ''}>
        <span>${opt.label}</span>
      </label>`;
    }
    inner += `</div>
      <div class="lpq-other-input" data-other-for="${step.field}"${hasOtherSelected ? '' : ' hidden'}>
        <label class="lpq-other-label" for="other-${step.field}">Опишете накратко</label>
        <input type="text" class="lpq-other-text" id="other-${step.field}" data-other-field="${step.field}" maxlength="80" placeholder="До няколко думи" value="${escapeHtml(answers[otherFieldKey(step.field)] || '')}">
      </div>`;
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
    <p class="lpq-disclaimer">С натискане на „Виж моята препоръка“ приемате, че информацията не е медицински съвет. При хронични заболявания се консултирайте с лекар.</p>`;
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
          if (field === 'selection_mode') {
            delete answers.product_categories;
            delete answers.product_category;
            saveDraft();
            handleProfileChange(field);
            return;
          }
          if (profileFieldsChanged(field)) {
            saveDraft();
            handleProfileChange(field);
            return;
          }
          group.querySelectorAll('.lpq-option').forEach((l) => l.classList.remove('selected'));
          input.closest('.lpq-option')?.classList.add('selected');
          if (input.value === OTHER_VALUE) {
            setOtherInputVisible(field, true);
            form.querySelector(`.lpq-other-text[data-other-field="${field}"]`)?.focus();
          } else {
            clearOtherField(field);
          }
        } else {
          let vals = [...group.querySelectorAll('input:checked')].map((i) => i.value);
          if (input.dataset.exclusive && input.checked) {
            vals = [input.value];
            group.querySelectorAll('input').forEach((i) => { if (i !== input) i.checked = false; });
            if (input.value === 'none' || input.value === 'all') clearOtherField(field);
          } else if (input.checked && input.value !== 'none' && input.value !== 'all') {
            const exclusive = group.querySelector('input[data-exclusive]');
            if (exclusive?.checked) exclusive.checked = false;
            vals = [...group.querySelectorAll('input:checked')].map((i) => i.value);
          }
          if (input.value === OTHER_VALUE && !input.checked) clearOtherField(field);
          answers[field] = vals.filter((v) => v !== 'none' || vals.length === 1);
          group.querySelectorAll('.lpq-option').forEach((l) => {
            l.classList.toggle('selected', l.querySelector('input')?.checked);
          });
          setOtherInputVisible(field, answers[field].includes(OTHER_VALUE));
        }
        saveDraft();
      });
    });
  });

  form.querySelectorAll('.lpq-other-text').forEach((input) => {
    input.addEventListener('input', () => {
      answers[otherFieldKey(input.dataset.otherField)] = input.value.trim();
      saveDraft();
    });
  });
}

function stepsDomOutOfSync() {
  const domSteps = form.querySelectorAll('.lpq-step');
  if (domSteps.length !== activeSteps.length) return true;
  return [...domSteps].some((el, i) => el.id !== `step-${activeSteps[i]?.id}`);
}

function showStep(index) {
  activeSteps = getActiveSteps();
  if (stepsDomOutOfSync()) {
    renderSteps();
    index = Math.min(index, activeSteps.length - 1);
  }
  if (index >= activeSteps.length) index = activeSteps.length - 1;
  if (index < 0) index = 0;
  stepIndex = index;

  form.querySelectorAll('.lpq-step').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  progressEl.style.width = `${((index + 1) / activeSteps.length) * 100}%`;
  prevBtn.hidden = index === 0;
  nextBtn.textContent = index === activeSteps.length - 1 ? 'Виж моята препоръка' : 'Напред';
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

function validateOtherText(step) {
  syncOtherInputs();
  const field = step.field;
  if (!field) return true;
  const selected = step.type === 'single'
    ? [answers[field]]
    : (Array.isArray(answers[field]) ? answers[field] : []);
  if (!selected.includes(OTHER_VALUE)) return true;
  const text = answers[otherFieldKey(field)]?.trim() || '';
  if (!text) {
    showError(step.id, 'При „Друго“ въведете кратко описание.');
    return false;
  }
  if (wordCount(text) > OTHER_MAX_WORDS) {
    showError(step.id, `Моля, съкратете описанието (макс. ${OTHER_MAX_WORDS} думи).`);
    return false;
  }
  return true;
}

function validateCurrentStep() {
  clearErrors();
  const step = activeSteps[stepIndex];

  if (step.type === 'single' && !answers[step.field]) {
    showError(step.id, 'Моля, изберете опция.');
    return false;
  }
  if (step.type === 'single' && !validateOtherText(step)) return false;
  if (step.type === 'multi' && !answers[step.field]?.length) {
    showError(step.id, 'Моля, изберете поне една опция или „Нищо от изброените“.');
    return false;
  }
  if ((step.field === 'product_categories' || step.field === 'product_category') && !catalogCategoriesReady) {
    showError(step.id, 'Категориите се зареждат. Моля, изчакайте секунда и опитайте отново.');
    return false;
  }
  if (step.type === 'multi' && !validateOtherText(step)) return false;
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
  syncOtherInputs();
  syncCategoryDefaults();
  saveDraft();

  formCard.hidden = true;
  loadingCard.hidden = false;

  const animator = new PortfolioAdvisorAnimator({
    logEl: document.getElementById('lpq-analysis-log'),
    progressEl: document.getElementById('lpq-analysis-progress'),
    statusEl: document.getElementById('lpq-loading-status'),
    minDurationMs: 5000,
  });
  animator.start(answers);

  try {
    const res = await fetch(`${API_URL}/portfolio-advisor-submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
    });

    animator.notifyApiComplete();
    await animator.waitUntilReady();

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error || data.message || 'Грешка при генериране.';
      if (res.status === 503) throw new Error('Консултантът е временно изключен. Опитайте по-късно.');
      throw new Error(msg);
    }

    localStorage.setItem(LEAD_KEY, JSON.stringify({
      email: answers.email,
      name: answers.name || '',
      sessionId: data.sessionId,
      timestamp: Date.now(),
    }));
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(data));
    persistAdvisorResult(data);
    sessionStorage.removeItem(DRAFT_KEY);

    window.location.href = 'portfolio-advisor-result.html';
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
  if (stepIndex < activeSteps.length - 1) showStep(stepIndex + 1);
  else await submitQuiz();
});

async function loadCatalogCategories() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(`${API_URL}/portfolio/bootstrap`, { cache: 'no-cache' });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data?.meta?.categories) && data.meta.categories.length) {
        catalogCategories = data.meta.categories;
        catalogCategoriesReady = true;
        return true;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  catalogCategories = FALLBACK_CATALOG_CATEGORIES.map((name) => ({ name }));
  catalogCategoriesReady = true;
  return false;
}

async function checkQuizEnabled() {
  try {
    const res = await fetch(`${API_URL}/portfolio-advisor/settings`, { cache: 'no-cache' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.enabled === false) {
      formCard.innerHTML = `<div class="lpq-step active" style="text-align:center;padding:2rem 0">
        <h2>Консултантът е временно недостъпен</h2>
        <p class="lpq-hint">Моля, опитайте по-късно или разгледайте <a href="portfolio.html">каталога</a>.</p>
      </div>`;
      prevBtn.hidden = true;
      nextBtn.hidden = true;
    }
  } catch {
    /* offline */
  }
}

async function initQuiz() {
  await loadCatalogCategories();
  renderSteps();
  await checkQuizEnabled();
}

initQuiz();

document.addEventListener('keydown', (e) => {
  if (!formCard.hidden && loadingCard.hidden && e.key === 'Enter' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault();
    nextBtn.click();
  }
});
