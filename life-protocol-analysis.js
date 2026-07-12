/**
 * Анимиран „лабораторен“ лог докато се генерира протоколът.
 * Работи паралелно с реалния API — минимално време за усещане за дълбок анализ.
 */

const PRIORITY_LABELS = {
  skin: 'Кожа и еластичност',
  joints: 'Стави и подвижност',
  energy: 'Енергия и метаболизъм',
  sleep: 'Сън и възстановяване',
  cognition: 'Концентрация и памет',
  longevity: 'Жизненост и дълголетие',
};

const ACTIVITY_LABELS = {
  regular: 'регулярна активност',
  rare: 'ниска активност',
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
  const activity = ACTIVITY_LABELS[answers.activity] || answers.activity || '—';
  const conditions = formatAnswerList(answers.conditions, answers.conditions_other);
  const meds = formatAnswerList(answers.medications, answers.medications_other);
  const symptoms = formatAnswerList(answers.symptoms, answers.symptoms_other);
  const allergies = formatAnswerList(answers.allergies, answers.allergies_other);

  const lines = [
    { type: 'system', text: 'Инициализиране на Life Protocol Engine v2.4…', delay: 200 },
    { type: 'info', text: 'Зареждане на anti-aging каталог (орални добавки)…', delay: 280 },
    { type: 'ok', text: 'Синхронизация с наличности — активна', delay: 220 },
    { type: 'info', text: `Профил: ${answers.sex === 'male' ? 'мъж' : 'жена'}, ${answers.age_band || '—'} г.`, delay: 180 },
  ];

  if (bmi) {
    lines.push({ type: 'data', text: `ИТМ: ${bmi} — корекция на дозови насоки`, delay: 420 });
  }

  lines.push(
    { type: 'info', text: `Приоритетен вектор: ${priority}`, delay: 380 },
    { type: 'info', text: `Физическа активност: ${activity}`, delay: 300 },
    { type: 'warn', text: 'Прилагане на safety матрица (лекарства × алергии × състояния)…', delay: 520 },
  );

  if (meds.length) {
    lines.push({ type: 'warn', text: `Медикаментни взаимодействия: ${meds.length} филтъра`, delay: 340 });
  }
  if (conditions.length) {
    lines.push({ type: 'warn', text: `Клинични ограничения: ${conditions.length} правила`, delay: 340 });
  }

  lines.push(
    { type: 'info', text: 'Изключване на пептиди и инжектируеми форми…', delay: 400 },
    { type: 'ok', text: 'Орални кандидати — филтрирани', delay: 450 },
    { type: 'info', text: 'Скориране по цели, симптоми и ефект-профил…', delay: 500 },
  );

  if (symptoms.length) {
    lines.push({ type: 'data', text: `Симптомна корелация: ${symptoms.join(', ')}`, delay: 380 });
  }
  if (allergies.length) {
    lines.push({ type: 'warn', text: `Алергии / непоносимости: ${allergies.join(', ')}`, delay: 320 });
  }
  if (answers.diet === 'other' && answers.diet_other) {
    lines.push({ type: 'info', text: `Хранителен модел (друго): ${answers.diet_other}`, delay: 280 });
  }

  lines.push(
    { type: 'info', text: 'Ранжиране на топ 25 кандидата за AI стак…', delay: 460 },
    { type: 'system', text: 'Обмисляне на синергии между активни вещества…', delay: 540 },
    { type: 'info', text: 'Оптимизация: Basic (3–4) · Optimal (5–6) · Premium (6–8)', delay: 480 },
    { type: 'info', text: 'Калкулиране на месечен бюджет в EUR…', delay: 400 },
    { type: 'info', text: 'Балансиране на сутрешен / вечерен прием…', delay: 420 },
    { type: 'system', text: 'AI анализ на персонални корелации…', delay: 600 },
    { type: 'info', text: 'Валидиране на product_id срещу каталог…', delay: 450 },
    { type: 'info', text: 'Финализиране на 3-tier препоръка…', delay: 500 },
    { type: 'ok', text: 'Протоколът е готов за преглед', delay: 400 },
  );

  return lines;
}

export class ProtocolAnalysisAnimator {
  constructor({ logEl, progressEl, statusEl, minDurationMs = 5500 } = {}) {
    this.logEl = logEl;
    this.progressEl = progressEl;
    this.statusEl = statusEl;
    this.minDurationMs = minDurationMs;
    this.startedAt = 0;
    this.stopped = false;
    this.resolveDone = null;
    this.donePromise = new Promise((r) => { this.resolveDone = r; });
    this.lineIndex = 0;
    this.lines = [];
    this.apiFinished = false;
  }

  start(answers) {
    this.startedAt = Date.now();
    this.lines = buildLogSequence(answers);
    this.stopped = false;
    this.lineIndex = 0;
    this.apiFinished = false;
    if (this.logEl) this.logEl.innerHTML = '';
    this._scheduleNext();
    return this.donePromise;
  }

  notifyApiComplete() {
    this.apiFinished = true;
  }

  stop() {
    this.stopped = true;
    if (this.resolveDone) this.resolveDone();
  }

  async waitUntilReady() {
    const elapsed = Date.now() - this.startedAt;
    const remaining = this.minDurationMs - elapsed;
    if (remaining > 0) {
      await new Promise((r) => setTimeout(r, remaining));
    }
    while (!this.stopped && this.lineIndex < this.lines.length) {
      await new Promise((r) => setTimeout(r, 120));
    }
    this.stop();
  }

  _scheduleNext() {
    if (this.stopped || this.lineIndex >= this.lines.length) {
      if (this.apiFinished) this.stop();
      return;
    }

    const line = this.lines[this.lineIndex];
    this.lineIndex += 1;

    const delay = this.apiFinished
      ? Math.min(line.delay, 80)
      : line.delay;

    setTimeout(() => {
      this._appendLine(line);
      this._updateProgress();
      this._scheduleNext();
    }, delay);
  }

  _appendLine(line) {
    if (!this.logEl) return;
    const row = document.createElement('div');
    row.className = `lpq-log-line lpq-log-${line.type}`;
    const time = new Date().toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    row.innerHTML = `<span class="lpq-log-time">${time}</span><span class="lpq-log-text">${line.text}</span>`;
    this.logEl.appendChild(row);
    this.logEl.scrollTop = this.logEl.scrollHeight;

    if (this.statusEl) {
      this.statusEl.textContent = line.text.replace(/^[►\s]+/, '');
    }
  }

  _updateProgress() {
    if (!this.progressEl) return;
    const base = (this.lineIndex / this.lines.length) * 88;
    const apiBoost = this.apiFinished ? 12 : 0;
    this.progressEl.style.width = `${Math.min(100, base + apiBoost)}%`;
  }
}
