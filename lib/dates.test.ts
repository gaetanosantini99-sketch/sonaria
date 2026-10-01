import { describe, expect, it } from 'vitest';
import { formatRome, romeLocalToUtcIso, utcToRomeLocalInput } from './dates';

describe('date Europe/Rome', () => {
  it('converte ora legale (UTC+2)', () => {
    expect(romeLocalToUtcIso('2026-07-10T23:00')).toBe('2026-07-10T21:00:00.000Z');
  });
  it('converte ora solare (UTC+1)', () => {
    expect(romeLocalToUtcIso('2026-12-10T23:00')).toBe('2026-12-10T22:00:00.000Z');
  });
  it('gestisce la notte del cambio ora (25/10/2026)', () => {
    expect(romeLocalToUtcIso('2026-10-24T23:00')).toBe('2026-10-24T21:00:00.000Z');
    expect(romeLocalToUtcIso('2026-10-25T04:00')).toBe('2026-10-25T03:00:00.000Z');
  });
  it('rifiuta input non validi', () => {
    expect(() => romeLocalToUtcIso('boh')).toThrow();
  });
  it('riconverte per gli input datetime-local', () => {
    expect(utcToRomeLocalInput('2026-07-10T21:00:00.000Z')).toBe('2026-07-10T23:00');
  });
  it('formatta a cavallo di capodanno', () => {
    expect(formatRome('2026-12-31T23:30:00Z')).toBe('01/01/2027 00:30');
  });
});
