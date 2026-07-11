import { normalizeEffectLabel } from './effect-labels.js';

describe('normalizeEffectLabel', () => {
  test('заменя общи маркетингови клишета с конкретни формулировки', () => {
    expect(normalizeEffectLabel('Метаболитна подкрепа')).toBe('Ускорява метаболизма');
    expect(normalizeEffectLabel('Енергиен метаболизъм')).toBe('Дава повече енергия');
    expect(normalizeEffectLabel('Подкрепа за клетъчното здраве')).toBe('Подобрява клетъчното възстановяване');
    expect(normalizeEffectLabel('Имунна подкрепа')).toBe('Укрепва имунитета');
    expect(normalizeEffectLabel('Когнитивна функция')).toBe('Подобрява паметта и концентрацията');
  });

  test('запазва вече конкретни етикети', () => {
    expect(normalizeEffectLabel('Подобрява перисталтиката')).toBe('Подобрява перисталтиката');
    expect(normalizeEffectLabel('Ускорява метаболизма')).toBe('Ускорява метаболизма');
  });

  test('преобразува „Подкрепа за/на X“', () => {
    expect(normalizeEffectLabel('Подкрепа за кръвна захар')).toBe('Поддържа нормална кръвна захар');
    expect(normalizeEffectLabel('Подкрепа на нервната система')).toBe('Подкрепя нервната система');
  });

  test('връща празен низ при липсващ label', () => {
    expect(normalizeEffectLabel('')).toBe('');
    expect(normalizeEffectLabel(null)).toBe('');
  });
});
