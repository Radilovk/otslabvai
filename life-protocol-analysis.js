/**
 * Анимиран „лабораторен“ лог докато се генерира протоколът.
 * Работи паралелно с реалния API — минимално време за усещане за дълбок анализ.
 */

const SITE_FOCUS = {
  life: { engine: 'подбора на Life Protocols', catalog: 'антиейджинг каталога', focus: 'антиейджинг', tiers: 'Базов (3–4) · Оптимален (5–6) · Премиум (6–8)' },
  main: { engine: 'подбора на „Да отслабна“', catalog: 'каталога за отслабване', focus: 'отслабване и метаболизъм', tiers: 'Базов (2–3) · Оптимален (3–5) · Премиум (4–6)' },
};

const ACTIVITY_LABELS = {
  regular: 'регулярна активност',
  moderate: 'умерена активност',
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

function buildLogSequence(answers, siteId = 'life') {
  const site = SITE_FOCUS[siteId] || SITE_FOCUS.life;
  const bmi = calcBmi(answers.height_cm, answers.weight_kg);
  const activity = ACTIVITY_LABELS[answers.activity] || answers.activity || '—';
  const conditions = formatAnswerList(answers.conditions, answers.conditions_other);
  const meds = formatAnswerList(answers.medications, answers.medications_other);
  const symptoms = formatAnswerList(answers.symptoms, answers.symptoms_other);
  const allergies = formatAnswerList(answers.allergies, answers.allergies_other);

  const lines = [
    { type: 'system', text: `Стартиране на ${site.engine}…`, delay: 200 },
    { type: 'info', text: `Зареждане на ${site.catalog} (добавки за прием през устата)…`, delay: 280 },
    { type: 'ok', text: 'Наличностите са проверени', delay: 220 },
    { type: 'info', text: `Профил: ${answers.sex === 'male' ? 'мъж' : 'жена'}, ${answers.age_band || '—'} г.`, delay: 180 },
  ];

  if (bmi) {
    lines.push({ type: 'data', text: `Индекс на телесна маса: ${bmi}`, delay: 420 });
  }

  lines.push(
    { type: 'info', text: `Насоченост: ${site.focus}`, delay: 380 },
    { type: 'info', text: `Физическа активност: ${activity}`, delay: 300 },
    { type: 'warn', text: 'Проверка за безопасност: лекарства, алергии и състояния…', delay: 520 },
  );

  if (meds.length) {
    lines.push({ type: 'warn', text: `Взаимодействия с лекарства: ${meds.length} проверки`, delay: 340 });
  }
  if (conditions.length) {
    lines.push({ type: 'warn', text: `Ограничения заради здравословни състояния: ${conditions.length}`, delay: 340 });
  }

  lines.push(
    { type: 'info', text: 'Само добавки за прием през устата — без инжекции…', delay: 400 },
    { type: 'ok', text: 'Подходящите продукти са отделени', delay: 450 },
    { type: 'info', text: 'Оценка по цели, оплаквания и действие…', delay: 500 },
  );

  if (symptoms.length) {
    lines.push({ type: 'data', text: `Оплаквания: ${symptoms.join(', ')}`, delay: 380 });
  }
  if (allergies.length) {
    lines.push({ type: 'warn', text: `Алергии / непоносимости: ${allergies.join(', ')}`, delay: 320 });
  }
  if (answers.diet === 'other' && answers.diet_other) {
    lines.push({ type: 'info', text: `Хранителен модел (друго): ${answers.diet_other}`, delay: 280 });
  }

  lines.push(
    { type: 'info', text: 'Подреждане на 25-те най-подходящи продукта…', delay: 460 },
    { type: 'system', text: 'Проверка как съставките действат заедно…', delay: 540 },
    { type: 'info', text: `Три варианта: ${site.tiers}`, delay: 480 },
    { type: 'info', text: 'Изчисляване на месечната цена в евро…', delay: 400 },
    { type: 'info', text: 'Разпределяне на приема сутрин и вечер…', delay: 420 },
    { type: 'system', text: 'Съпоставяне с вашия профил…', delay: 600 },
    { type: 'info', text: 'Сверяване с каталога…', delay: 450 },
    { type: 'info', text: 'Подготовка на трите варианта…', delay: 500 },
    { type: 'ok', text: 'Протоколът е готов за преглед', delay: 400 },
  );

  return lines;
}

export class ProtocolAnalysisAnimator {
  constructor({ logEl, progressEl, statusEl, minDurationMs = 5500, siteId = 'life' } = {}) {
    this.logEl = logEl;
    this.progressEl = progressEl;
    this.statusEl = statusEl;
    this.minDurationMs = minDurationMs;
    this.siteId = siteId;
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
    this.lines = buildLogSequence(answers, this.siteId);
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
