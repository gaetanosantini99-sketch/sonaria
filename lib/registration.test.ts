import { describe, expect, it } from 'vitest';
import { parseRegistration } from './registration';

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const valid = { first_name: " D'Angelo ", last_name: 'Niccolò', phone: '', consent_privacy: 'on', consent_coupon: 'on' };

describe('parseRegistration', () => {
  it('accetta nomi con apostrofi e accenti, senza telefono', () => {
    expect(parseRegistration(form(valid))).toEqual({
      ok: true,
      data: { firstName: "D'Angelo", lastName: 'Niccolò', phone: null, consentMarketing: false },
    });
  });
  it('normalizza il telefono e legge il consenso offerte', () => {
    const r = parseRegistration(form({ ...valid, phone: '333 1234567', consent_marketing: 'on' }));
    expect(r.ok && r.data.phone).toBe('+393331234567');
    expect(r.ok && r.data.consentMarketing).toBe(true);
  });
  it('richiede privacy e coupon', () => {
    const r = parseRegistration(form({ first_name: 'A', last_name: 'B', phone: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.consent_privacy).toBe("Devi accettare l'informativa privacy");
      expect(r.errors.consent_coupon).toBe('Devi accettare le condizioni del coupon');
    }
  });
  it('segnala nome vuoto e telefono non valido', () => {
    const r = parseRegistration(form({ ...valid, first_name: ' ', phone: '12' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.first_name).toBe('Inserisci il nome');
      expect(r.errors.phone).toBe('Numero di telefono non valido');
    }
  });
});
