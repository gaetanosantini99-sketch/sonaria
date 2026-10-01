import { describe, expect, it } from 'vitest';
import { parseEventForm } from './event-form';

function form(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const values = {
    title: 'Sabato Latino',
    venue_name: 'Bar Centrale',
    starts_at: '2026-10-24T23:00',
    ends_at: '2026-10-25T04:00',
    coupon_title: 'Drink a 5€',
    coupon_description: '',
    pin: '1234',
    ...overrides,
  };
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe('parseEventForm', () => {
  it('accetta una serata che finisce dopo mezzanotte e converte in UTC', () => {
    const r = parseEventForm(form(), { pinRequired: true });
    expect(r).toEqual({
      ok: true,
      data: {
        title: 'Sabato Latino',
        venue_name: 'Bar Centrale',
        starts_at: '2026-10-24T21:00:00.000Z',
        ends_at: '2026-10-25T03:00:00.000Z',
        coupon_title: 'Drink a 5€',
        coupon_description: '',
        pin: '1234',
      },
    });
  });
  it('segnala il titolo mancante', () => {
    const r = parseEventForm(form({ title: '  ' }), { pinRequired: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.title).toBe('Titolo obbligatorio');
  });
  it('rifiuta una fine precedente all\'inizio', () => {
    const r = parseEventForm(form({ ends_at: '2026-10-24T22:00' }), { pinRequired: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.ends_at).toBe("La fine deve essere dopo l'inizio");
  });
  it('richiede il PIN in creazione', () => {
    const r = parseEventForm(form({ pin: '' }), { pinRequired: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.pin).toBe('PIN obbligatorio');
  });
  it('rifiuta PIN non numerici', () => {
    const r = parseEventForm(form({ pin: 'abc' }), { pinRequired: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.pin).toBe('Il PIN deve avere da 4 a 8 cifre');
  });
  it('non lancia con date impossibili', () => {
    const a = parseEventForm(form({ starts_at: '2026-13-45T99:99' }), { pinRequired: true });
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.errors.starts_at).toBe('Data e ora non valide');
    const b = parseEventForm(form({ ends_at: '2026-13-45T99:99' }), { pinRequired: true });
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.errors.ends_at).toBe('Data e ora non valide');
    const c = parseEventForm(form({ starts_at: '2026-02-31T10:00' }), { pinRequired: true });
    expect(c.ok).toBe(false);
  });
  it('PIN vuoto in modifica significa invariato', () => {
    const r = parseEventForm(form({ pin: '' }), { pinRequired: false });
    expect(r.ok && r.data.pin).toBe(null);
  });
});
