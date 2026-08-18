/**
 * Main site (daotslabna) advisor — client storage.
 */

export const RESULT_SESSION_KEY = 'mainAdvisorResult';
export const RESULT_PERSISTENT_KEY = 'mainAdvisorResultPersistent';
export const LEAD_KEY = 'mainAdvisorLead';

export function persistAdvisorResult(data) {
  if (!data) return;
  try {
    sessionStorage.setItem(RESULT_SESSION_KEY, JSON.stringify(data));
    localStorage.setItem(RESULT_PERSISTENT_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not persist advisor result', e);
  }
}

export function getPendingAdvisorResult() {
  try {
    return (
      JSON.parse(sessionStorage.getItem(RESULT_SESSION_KEY) || 'null')
      || JSON.parse(localStorage.getItem(RESULT_PERSISTENT_KEY) || 'null')
    );
  } catch {
    return null;
  }
}
