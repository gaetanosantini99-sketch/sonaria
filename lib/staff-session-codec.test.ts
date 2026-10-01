import { describe, expect, it } from 'vitest';
import { decodeStaffSession, encodeStaffSession } from './staff-session-codec';

describe('sessione staff', () => {
  it('andata e ritorno', () => {
    const s = { staffToken: 'abc_DEF-123', pin: '2468' };
    expect(decodeStaffSession(encodeStaffSession(s))).toEqual(s);
  });
  it('null se assente o corrotta', () => {
    expect(decodeStaffSession(undefined)).toBeNull();
    expect(decodeStaffSession('%%%non-base64')).toBeNull();
    expect(decodeStaffSession(Buffer.from('{"x":1}').toString('base64url'))).toBeNull();
  });
});
