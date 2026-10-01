import { describe, expect, it } from 'vitest';
import { getClientIp, hashIp } from './ip';

describe('ip', () => {
  it('preferisce l\'header di Netlify', () => {
    const h = new Headers({ 'x-nf-client-connection-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' });
    expect(getClientIp(h)).toBe('1.2.3.4');
  });
  it('usa il primo IP di x-forwarded-for', () => {
    expect(getClientIp(new Headers({ 'x-forwarded-for': '5.6.7.8, 10.0.0.1' }))).toBe('5.6.7.8');
  });
  it('null senza header', () => {
    expect(getClientIp(new Headers())).toBeNull();
  });
  it('hash stabile, salato, non reversibile', () => {
    expect(hashIp('1.2.3.4', 'sale')).toBe(hashIp('1.2.3.4', 'sale'));
    expect(hashIp('1.2.3.4', 'sale')).not.toBe(hashIp('1.2.3.4', 'altro'));
    expect(hashIp('1.2.3.4', 'sale')).toMatch(/^[0-9a-f]{64}$/);
  });
});
