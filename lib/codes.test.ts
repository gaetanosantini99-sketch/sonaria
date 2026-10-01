import { describe, expect, it } from 'vitest';
import { isValidCode, normalizeCode } from './codes';

describe('codici coupon', () => {
  it('normalizza minuscole, spazi e trattini', () => {
    expect(normalizeCode(' k7m-4qx ')).toBe('K7M4QX');
    expect(normalizeCode('k7 m4 qx')).toBe('K7M4QX');
  });
  it('valida l\'alfabeto e la lunghezza', () => {
    expect(isValidCode('K7M4QX')).toBe(true);
    expect(isValidCode('K7M4Q')).toBe(false);
    expect(isValidCode('K7M4Q0')).toBe(false);
    expect(isValidCode('IIIIII')).toBe(false);
  });
});
