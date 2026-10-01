import { describe, expect, it } from 'vitest';
import { decodeStaffSession, encodeStaffSession } from './staff-session-codec';

describe('sessione staff', () => {
  it('andata e ritorno', () => {
    const s = { staffToken: 'abc_DEF-123', sessionKey: 'deadbeef' };
    expect(decodeStaffSession(encodeStaffSession(s))).toEqual(s);
  });
  it('non contiene il PIN anche se presente nell\'input', () => {
    const raw = Buffer.from(JSON.stringify({ staffToken: 't', sessionKey: 'k', pin: '1234' })).toString('base64url');
    expect(decodeStaffSession(raw)).toEqual({ staffToken: 't', sessionKey: 'k' });
  });
  it('null se assente, corrotta o nel vecchio formato', () => {
    expect(decodeStaffSession(undefined)).toBeNull();
    expect(decodeStaffSession('%%%non-base64')).toBeNull();
    expect(decodeStaffSession(Buffer.from('{"x":1}').toString('base64url'))).toBeNull();
    expect(decodeStaffSession(Buffer.from('{"staffToken":"t","pin":"1234"}').toString('base64url'))).toBeNull();
  });
});
