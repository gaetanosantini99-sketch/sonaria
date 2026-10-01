import { describe, expect, it } from 'vitest';
import { couponStatus, isRegistrationOpen } from './event-window';

const event = { status: 'live', starts_at: '2026-10-24T21:00:00Z', ends_at: '2026-10-25T03:00:00Z' };

describe('finestre serata', () => {
  it('registrazioni aperte da 12 ore prima fino alla fine', () => {
    expect(isRegistrationOpen(event, new Date('2026-10-24T09:00:00Z'))).toBe(true);
    expect(isRegistrationOpen(event, new Date('2026-10-24T08:59:00Z'))).toBe(false);
    expect(isRegistrationOpen(event, new Date('2026-10-25T03:01:00Z'))).toBe(false);
  });
  it('chiuse se la serata non è live', () => {
    expect(isRegistrationOpen({ ...event, status: 'closed' }, new Date('2026-10-24T22:00:00Z'))).toBe(false);
  });
  it('stato del coupon', () => {
    expect(couponStatus(null, event.ends_at, new Date('2026-10-25T03:30:00Z'))).toBe('valid');
    expect(couponStatus(null, event.ends_at, new Date('2026-10-25T04:01:00Z'))).toBe('expired');
    expect(couponStatus('2026-10-24T23:00:00Z', event.ends_at, new Date('2026-10-24T23:05:00Z'))).toBe('redeemed');
  });
});
