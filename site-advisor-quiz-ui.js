/**
 * Споделена UI логика за site advisor quiz (life + main).
 */

import {
  buildSiteAdvisorSteps,
  getSiteAdvisorDraftKey,
  pruneSiteAdvisorAnswers,
} from './site-advisor-config.js';
import { finalizeSiteAnswers } from './site-advisor-shared.js';

const OTHER_VALUE = 'other';
const OTHER_MAX_WORDS = 8;

export function createSiteAdvisorQuiz(options) {
  const {
    siteId = 'life',
    submitUrl,
    resultUrl,
    leadStorageKey,
    resultStorageKey,
    AnimatorClass,
    onBeforeSubmit,
  } = options;

  const form = document.getElementById('lpq-form');
  const progressEl = document.getElementById('lpq-progress');
  const prevBtn = document.getElementById('lpq-prev');
  const nextBtn = document.getElementById('lpq-next');
  const formCard = document.getElementById('lpq-form-card');
  const loadingCard = document.getElementById('lpq-loading');
  const draftKey = getSiteAdvisorDraftKey(siteId);

  const answers = loadDraft();

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
      return JSON.parse(sessionStorage.getItem(draftKey) || '{}');
    } catch {
      return {};
    }
  }

  function saveDraft() {
    sessionStorage.setItem(draftKey, JSON.stringify(answers));
  }

  function getActiveSteps() {
    return buildSiteAdvisorSteps(siteId, answers);
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

    if (step.type === 'info') {
      inner += `<p class="lpq-info-text">Продължете напред — следващите въпроси ни помагат да персонализираме препоръката според вашия профил.</p>`;
    } else if (step.type === 'single' || step.type === 'multi') {
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
      <p class="lpq-disclaimer">С натискане на „${step.ctaLabel || 'Виж резултата'}“ приемате, че информацията не е медицински съвет. При хронични заболявания се консултирайте с лекар.</p>`;
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
            if (input.value === OTHER_VALUE) {
              setOtherInputVisible(field, true);
              form.querySelector(`.lpq-other-text[data-other-field="${field}"]`)?.focus();
            } else {
              clearOtherField(field);
            }
            if (field === 'sex') {
              pruneSiteAdvisorAnswers(answers);
              renderSteps();
              return;
            }
          } else {
            let vals = [...group.querySelectorAll('input:checked')].map((i) => i.value);
            if (input.dataset.exclusive && input.checked) {
              vals = [input.value];
              group.querySelectorAll('input').forEach((i) => { if (i !== input) i.checked = false; });
              if (input.value === 'none') clearOtherField(field);
            } else if (input.checked && input.value !== 'none') {
              const none = group.querySelector('input[value="none"]');
              if (none) none.checked = false;
              vals = [...group.querySelectorAll('input:checked')].map((i) => i.value);
            }
            if (input.value === OTHER_VALUE && !input.checked) clearOtherField(field);
            answers[field] = vals.filter((v) => v !== 'none' || vals.length === 1);
            group.querySelectorAll('.lpq-option').forEach((l) => {
              l.classList.toggle('selected', l.querySelector('input')?.checked);
            });
            setOtherInputVisible(field, answers[field].includes(OTHER_VALUE));
            if (input.value === OTHER_VALUE && input.checked) {
              form.querySelector(`.lpq-other-text[data-other-field="${field}"]`)?.focus();
            }
          }
          saveDraft();
        });
      });
    });

    form.querySelectorAll('.lpq-other-text').forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.dataset.otherField;
        answers[otherFieldKey(field)] = input.value.trim();
        saveDraft();
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
    const lastStep = activeSteps[activeSteps.length - 1];
    nextBtn.textContent = index === activeSteps.length - 1
      ? (lastStep?.ctaLabel || 'Виж резултата')
      : 'Напред';
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
      showError(step.id, 'При „Друго“ въведете кратко описание (до няколко думи).');
      setOtherInputVisible(field, true);
      form.querySelector(`.lpq-other-text[data-other-field="${field}"]`)?.focus();
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

    if (step.type === 'info') return true;

    if (step.type === 'single' && !answers[step.field]) {
      showError(step.id, 'Моля, изберете опция.');
      return false;
    }
    if (step.type === 'single' && !validateOtherText(step)) return false;
    if (step.type === 'multi' && !answers[step.field]?.length) {
      showError(step.id, 'Моля, изберете поне една опция или „Нищо от изброените“.');
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
    saveDraft();

    formCard.hidden = true;
    loadingCard.hidden = false;

    const payload = finalizeSiteAnswers(answers, siteId);
    const animator = new AnimatorClass({
      logEl: document.getElementById('lpq-analysis-log'),
      progressEl: document.getElementById('lpq-analysis-progress'),
      statusEl: document.getElementById('lpq-loading-status'),
      minDurationMs: 5500,
      siteId,
    });
    animator.start(payload);

    try {
      const res = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      animator.notifyApiComplete();
      await animator.waitUntilReady();

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || data.message || 'Грешка при генериране.';
        if (res.status === 503) throw new Error('Въпросникът е временно изключен. Опитайте по-късно.');
        throw new Error(msg);
      }

      if (onBeforeSubmit) onBeforeSubmit(data, payload);

      localStorage.setItem(leadStorageKey, JSON.stringify({
        email: payload.email,
        name: payload.name || '',
        sessionId: data.sessionId,
        timestamp: Date.now(),
      }));
      sessionStorage.setItem(resultStorageKey, JSON.stringify(data));
      sessionStorage.removeItem(draftKey);

      window.location.href = resultUrl;
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
}
