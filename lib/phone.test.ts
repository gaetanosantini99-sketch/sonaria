import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('numero italiano senza prefisso', () => {
    expect(normalizePhone('333 123 4567')).toEqual({ ok: true, value: '+393331234567' });
  });
  it('stesso numero con +39 dà lo stesso risultato', () => {
    expect(normalizePhone('+39 333 1234567')).toEqual({ ok: true, value: '+393331234567' });
  });
  it('numero estero', () => {
    expect(normalizePhone('+44 7911 123456')).toEqual({ ok: true, value: '+447911123456' });
  });
  it('vuoto = nessun telefono', () => {
    expect(normalizePhone('  ')).toEqual({ ok: true, value: null });
  });
  it('rifiuta numeri non validi', () => {
    expect(normalizePhone('123')).toEqual({ ok: false });
    expect(normalizePhone('ciao')).toEqual({ ok: false });
  });
});
