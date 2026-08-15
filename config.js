export const WORKER_API_ORIGIN = 'https://port.radilov-k.workers.dev';

/** API base URL: same-origin on worker host; worker fallback on static/GitHub Pages hosts. */
export function resolveApiUrl(hostname, port = '', origin = '') {
  const host = String(hostname || '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') {
    return port === '8080' ? 'http://localhost:8080/backend' : origin;
  }
  if (host.endsWith('.workers.dev')) return origin;
  return WORKER_API_ORIGIN;
}

export const API_URL = typeof window !== 'undefined'
  ? resolveApiUrl(window.location.hostname, window.location.port, window.location.origin)
  : WORKER_API_ORIGIN;
