/**
 * Анимиран лог за Portfolio AI консултант.
 */

import { PRIORITY_LABELS } from './portfolio-advisor-config.js';

const ACTIVITY_LABELS = {
  regular: 'регулярна активност',
  moderate: 'умерена активност',
  rare: 'ниска активност',
};

const MODE_LABELS = {
  package: 'пълен пакет',
  single: 'единичен продукт',
};

function calcBmi(heightCm, weightKg) {
  if (!heightCm || !weightKg) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

function formatAnswerList(values, otherText) {
  const items = (values || []).filter((v) => v && v !== 'none' && v !== 'other');
  if (otherText) items.push(`друго: ${otherText}`);
  return items;
}

function buildLogSequence(answers) {
  const bmi = calcBmi(answers.height_cm, answers.weight_kg);
  const priority = answers.priority === 'other'
    ? (answers.priority_other || 'друго')
    : (PRIORITY_LABELS[answers.priority] || answers.priority || 'общо здраве');
  const mode = MODE_LABELS[answers.selection_mode] || 'пакет';
  const activity = ACTIVITY_LABELS[answers.activity] || answers.activity || '—';
  const conditions = formatAnswerList(answers.conditions, answers.conditions_other);
  const meds = formatAnswerList(answers.medications, answers.medications_other);
  const symptoms = formatAnswerList(answers.symptoms, answers.symptoms_other);
  const allergies = formatAnswerList(answers.allergies, answers.allergies_other);

  const lines = [
    { type: 'system', text: 'Инициализиране на Portfolio AI Advisor…', delay: 200 },
    { type: 'info', text: 'Зареждане на каталог (протеини, витамини, добавки)…', delay: 280 },
    { type: 'ok', text: 'Синхронизация с наличности — активна', delay: 220 },
    { type: 'info', text: `Режим: ${mode}`, delay: 260 },
    { type: 'info', text: `Профил: ${answers.sex === 'male' ? 'мъж' : 'жена'}, ${answers.age_band || '—'} г.`, delay: 180 },
  ];

  if (bmi) {
    lines.push({ type: 'data', text: `ИТМ: ${bmi} — корекция на препоръките`, delay: 420 });
  }

  lines.push(
    { type: 'info', text: `Основна цел: ${priority}`, delay: 380 },
    { type: 'info', text: `Физическа активност: ${activity}`, delay: 300 },
    { type: 'warn', text: 'Прилагане на safety матрица (лекарства × алергии × състояния)…', delay: 520 },
  );

  if (meds.length) lines.push({ type: 'warn', text: `Медикаментни взаимодействия: ${meds.length} филтъра`, delay: 340 });
  if (conditions.length) lines.push({ type: 'warn', text: `Клинични ограничения: ${conditions.length} правила`, delay: 340 });

  lines.push(
    { type: 'info', text: 'Изключване на пептиди и инжектируеми форми…', delay: 400 },
    { type: 'ok', text: 'Кандидати от каталога — филтрирани', delay: 450 },
    { type: 'info', text: 'Скориране по цел, симптоми и категория…', delay: 500 },
  );

  if (symptoms.length) lines.push({ type: 'data', text: `Симптомна корелация: ${symptoms.join(', ')}`, delay: 380 });
  if (allergies.length) lines.push({ type: 'warn', text: `Алергии / непоносимости: ${allergies.join(', ')}`, delay: 320 });

  lines.push(
    { type: 'info', text: answers.selection_mode === 'single' ? 'Ранкиране на топ продукти…' : 'Съставяне на 3 пакета (старт / оптимален / пълен)…', delay: 480 },
    { type: 'ok', text: 'Генериране на персонализирана препоръка…', delay: 600 },
  );

  return lines;
}

export class PortfolioAdvisorAnimator {
  constructor({ logEl, progressEl, statusEl, minDurationMs = 5000 } = {}) {
    this.logEl = logEl;
    this.progressEl = progressEl;
    this.statusEl = statusEl;
    this.minDurationMs = minDurationMs;
    this._lines = [];
    this._index = 0;
    this._timer = null;
    this._startTime = 0;
    this._apiDone = false;
    this._resolveReady = null;
    this._readyPromise = null;
  }

  start(answers) {
    this._lines = buildLogSequence(answers);
    this._index = 0;
    this._startTime = Date.now();
    this._apiDone = false;
    this._readyPromise = new Promise((resolve) => { this._resolveReady = resolve; });
    if (this.logEl) this.logEl.innerHTML = '';
    this._tick();
  }

  _tick() {
    if (this._index >= this._lines.length) {
      this._checkReady();
      return;
    }
    const line = this._lines[this._index++];
    if (this.statusEl && this._index === 1) this.statusEl.textContent = line.text;
    if (this.logEl) {
      const el = document.createElement('div');
      el.className = `lpq-log-line lpq-log-${line.type}`;
      el.textContent = `> ${line.text}`;
      this.logEl.appendChild(el);
      this.logEl.scrollTop = this.logEl.scrollHeight;
    }
    const pct = Math.min(95, (this._index / this._lines.length) * 90);
    if (this.progressEl) this.progressEl.style.width = `${pct}%`;
    this._timer = setTimeout(() => this._tick(), line.delay || 300);
  }

  notifyApiComplete() {
    this._apiDone = true;
    this._checkReady();
  }

  _checkReady() {
    const elapsed = Date.now() - this._startTime;
    if (this._apiDone && elapsed >= this.minDurationMs) {
      if (this.progressEl) this.progressEl.style.width = '100%';
      if (this.statusEl) this.statusEl.textContent = 'Препоръката е готова';
      if (this._resolveReady) this._resolveReady();
      return;
    }
    if (this._apiDone && this._index >= this._lines.length) {
      const wait = Math.max(0, this.minDurationMs - elapsed);
      setTimeout(() => this._checkReady(), wait);
    }
  }

  waitUntilReady() {
    return this._readyPromise || Promise.resolve();
  }

  stop() {
    if (this._timer) clearTimeout(this._timer);
  }
}
