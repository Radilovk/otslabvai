import { initPortfolioPage } from './portfolio-shared.js';

export async function initAdvisorPage({ active = 'advisor', wide = false } = {}) {
  await initPortfolioPage({ active, showMobileBar: true });
  const main = document.querySelector('.pfa-main');
  if (main && wide) main.classList.add('pfa-main--wide');
}
