import { API_URL } from './config.js';
import { ProtocolAnalysisAnimator } from './life-protocol-analysis.js';
import { persistProtocolResult } from './life-protocol-store.js';
import { createSiteAdvisorQuiz } from './site-advisor-quiz-ui.js';

createSiteAdvisorQuiz({
  siteId: 'life',
  submitUrl: `${API_URL}/life-protocol-submit`,
  resultUrl: 'life-protocol-result.html',
  leadStorageKey: 'lifeProtocolLead',
  resultStorageKey: 'lifeProtocolResult',
  AnimatorClass: ProtocolAnalysisAnimator,
  onBeforeSubmit(data) {
    persistProtocolResult(data);
  },
});
