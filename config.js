const host = window.location.hostname;
const isLocalDev = host === 'localhost' || host === '127.0.0.1';
export const API_URL = isLocalDev
  ? (window.location.port === '8080'
    ? 'http://localhost:8080/backend'
    : window.location.origin)
  : 'https://port.radilov-k.workers.dev';
