'use server';

import { redirect } from 'next/navigation';
import { isValidCode, normalizeCode } from '@/lib/codes';
import { clearStaffSession, getStaffSession, setStaffSession } from '@/lib/staff-session';
import { createAdminClient } from '@/lib/supabase/admin';

export type PinState = { error?: string };
export type RedeemStatus = 'ok' | 'already_used' | 'not_found' | 'out_of_window' | 'wrong_pin' | 'locked' | 'unauthorized' | 'error';
export type RedeemResult = { status: RedeemStatus; code: string; couponTitle?: string; firstName?: string; redeemedAt?: string };
export type RedeemState = { result?: RedeemResult };

export async function verifyPin(staffToken: string, _prev: PinState, formData: FormData): Promise<PinState> {
  const pin = String(formData.get('pin') ?? '').trim();
  const { data, error } = await createAdminClient().rpc('verify_event_pin', { p_staff_token: staffToken, p_pin: pin });
  if (error) {
    console.error('verify_event_pin fallita', error);
    return { error: 'Errore imprevisto, riprova' };
  }
  if (!data || typeof data !== 'object') {
    console.error('verify_event_pin: payload inatteso', data);
    return { error: 'Errore imprevisto, riprova' };
  }
  const { status } = data as unknown as { status: string };
  if (status === 'ok') {
    await setStaffSession({ staffToken, pin });
    redirect(`/v/${staffToken}`);
  }
  return { error: status === 'locked' ? 'Troppi tentativi: riprova tra 15 minuti' : 'PIN errato' };
}

export async function redeem(_prev: RedeemState, formData: FormData): Promise<RedeemState> {
  const code = normalizeCode(String(formData.get('code') ?? ''));
  const session = await getStaffSession();
  if (!session) return { result: { status: 'unauthorized', code } };
  if (!isValidCode(code)) return { result: { status: 'not_found', code } };

  const { data, error } = await createAdminClient().rpc('redeem_event_coupon', {
    p_staff_token: session.staffToken,
    p_pin: session.pin,
    p_code: code,
  });
  if (error) {
    console.error('redeem_event_coupon fallita', error);
    return { result: { status: 'error', code } };
  }
  if (!data || typeof data !== 'object') {
    console.error('redeem_event_coupon: payload inatteso', data);
    return { result: { status: 'error', code } };
  }

  const r = data as unknown as { status: RedeemStatus; coupon_title?: string; first_name?: string; redeemed_at?: string };
  if (r.status === 'wrong_pin' || r.status === 'locked' || r.status === 'unauthorized') await clearStaffSession();
  return { result: { status: r.status, code, couponTitle: r.coupon_title, firstName: r.first_name, redeemedAt: r.redeemed_at } };
}

export async function logoutStaff(staffToken: string): Promise<void> {
  await clearStaffSession();
  redirect(`/v/${staffToken}`);
}
