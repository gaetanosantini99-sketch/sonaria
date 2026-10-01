import { describe, expect, it } from 'vitest';
import { makeEventSlug, randomSuffix, slugify } from './slug';

describe('slug', () => {
  it('toglie accenti e simboli', () => {
    expect(slugify('Notte Città — Latina!')).toBe('notte-citta-latina');
  });
  it('restituisce stringa vuota per soli spazi', () => {
    expect(slugify('   ')).toBe('');
  });
  it('tronca a 40 caratteri senza trattino finale', () => {
    const s = slugify('a'.repeat(39) + ' bbbbbb');
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith('-')).toBe(false);
  });
  it('aggiunge il suffisso', () => {
    expect(makeEventSlug('Sabato Latino', 'ab12')).toBe('sabato-latino-ab12');
  });
  it('usa "serata" se il titolo non ha caratteri validi', () => {
    expect(makeEventSlug('!!!', 'ab12')).toBe('serata-ab12');
  });
  it('suffisso casuale di 4 caratteri sicuri', () => {
    expect(randomSuffix()).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{4}$/);
  });
});
