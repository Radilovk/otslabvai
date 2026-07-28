export const RESULT_KEY = 'portfolioAdvisorResult';
export const DRAFT_KEY = 'portfolioAdvisorDraft';
export const LEAD_KEY = 'portfolioAdvisorLead';

export function persistAdvisorResult(data) {
  if (!data) return;
  try {
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(data));
    localStorage.setItem(`${RESULT_KEY}Persistent`, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not persist advisor result', e);
  }
}

export function loadAdvisorResult() {
  try {
    return JSON.parse(sessionStorage.getItem(RESULT_KEY) || 'null');
  } catch {
    return null;
  }
}
