import { jest } from '@jest/globals';
import {
  ADVISOR_STEPS,
  GOAL_BRANCH_STEPS,
  GOAL_IDS,
  buildActiveAdvisorSteps,
} from './portfolio-advisor-config.js';
import { PORTFOLIO_GOALS } from './portfolio-goals.js';

describe('portfolio-advisor-config', () => {
  test('priority options match PORTFOLIO_GOALS ids', () => {
    const priorityStep = ADVISOR_STEPS.find((s) => s.field === 'priority');
    const optionIds = priorityStep.options.filter((o) => o.value !== 'other').map((o) => o.value);
    expect(optionIds).toEqual(PORTFOLIO_GOALS.map((g) => g.id));
  });

  test('GOAL_BRANCH_STEPS cover all portfolio goals', () => {
    for (const id of GOAL_IDS) {
      expect(GOAL_BRANCH_STEPS[id]).toBeDefined();
    }
  });

  test('buildActiveAdvisorSteps inserts branch right after priority', () => {
    const steps = buildActiveAdvisorSteps({ priority: 'muscle', sex: 'male' });
    const priorityIdx = steps.findIndex((s) => s.field === 'priority');
    expect(steps[priorityIdx + 1]?.id).toBe('branch_muscle');
    expect(steps.findIndex((s) => s.field === 'activity')).toBeGreaterThan(priorityIdx);
  });

  test('buildActiveAdvisorSteps adds pregnancy for female', () => {
    const steps = buildActiveAdvisorSteps({ priority: 'health', sex: 'female' });
    expect(steps.some((s) => s.id === 'pregnancy')).toBe(true);
  });
});
