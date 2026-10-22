import { API_URL } from './config.js';
import { ProtocolAnalysisAnimator } from './life-protocol-analysis.js';
import { persistAdvisorResult } from './main-advisor-store.js';
import { createSiteAdvisorQuiz } from './site-advisor-quiz-ui.js';
import { rememberQuizAnswers } from './nutriplan-link.js';

createSiteAdvisorQuiz({
  siteId: 'main',
  submitUrl: `${API_URL}/main-advisor-submit`,
  resultUrl: 'main-advisor-result.html',
  leadStorageKey: 'mainAdvisorLead',
  resultStorageKey: 'mainAdvisorResult',
  AnimatorClass: ProtocolAnalysisAnimator,
  onBeforeSubmit(data, payload) {
    persistAdvisorResult(data);
    rememberQuizAnswers('main', payload);
  },
});
