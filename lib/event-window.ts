export const REGISTRATION_OPENS_BEFORE_MS = 12 * 60 * 60 * 1000;
export const REDEEM_GRACE_MS = 60 * 60 * 1000;

export function isRegistrationOpen(event: { status: string; starts_at: string; ends_at: string }, now: Date): boolean {
  const t = now.getTime();
  return event.status === 'live' && t >= Date.parse(event.starts_at) - REGISTRATION_OPENS_BEFORE_MS && t <= Date.parse(event.ends_at);
}

export type CouponStatus = 'valid' | 'redeemed' | 'expired';

export function couponStatus(redeemedAt: string | null, endsAt: string, now: Date): CouponStatus {
  if (redeemedAt) return 'redeemed';
  if (now.getTime() > Date.parse(endsAt) + REDEEM_GRACE_MS) return 'expired';
  return 'valid';
}
