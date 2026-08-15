import { resolveApiUrl, WORKER_API_ORIGIN } from './config.js';

describe('resolveApiUrl', () => {
  test('localhost:8080 uses backend proxy', () => {
    expect(resolveApiUrl('localhost', '8080', 'http://localhost:8080')).toBe('http://localhost:8080/backend');
  });

  test('workers.dev uses same origin', () => {
    expect(resolveApiUrl('port.radilov-k.workers.dev', '', 'https://port.radilov-k.workers.dev'))
      .toBe('https://port.radilov-k.workers.dev');
  });

  test('GitHub Pages host uses worker API', () => {
    expect(resolveApiUrl('daotslabna.com', '', 'https://daotslabna.com'))
      .toBe(WORKER_API_ORIGIN);
  });
});
