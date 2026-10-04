import { describe, expect, it } from 'vitest';
import { consentLabel } from './consent';

describe('consentLabel', () => {
  const now = new Date('2026-10-01T10:00:00Z');
  it('attivo', () => {
    expect(consentLabel('2026-10-20T10:00:00Z', now)).toBe('Fino al 20/10/2026');
  });
  it('scaduto o assente', () => {
    expect(consentLabel('2026-09-20T10:00:00Z', now)).toBe('Non attivo');
    expect(consentLabel(null, now)).toBe('Non attivo');
  });
});
