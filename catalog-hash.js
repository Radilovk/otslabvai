import { createHash } from 'crypto';

/** Short stable version token for catalog artifacts. */
export function catalogHash(input) {
  const raw = typeof input === 'string' ? input : JSON.stringify(input);
  return createHash('sha256').update(raw).digest('hex').slice(0, 8);
}
