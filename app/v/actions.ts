'use server';

import { redirect } from 'next/navigation';
import { isValidCode, normalizeCode } from '@/lib/codes';
import { clearStaffSession, getStaffSession, setStaffSession } from '@/lib/staff-session';
import { createAdminClient } from '@/lib/supabase/admin';

export type PinState = { error?: string };
export type RedeemStatus = 'ok' | 'already_used' | 'not_found' | 'out_of_window' | 'unauthorized' | 'error';
export type RedeemResult = { status: RedeemStatus; code: string; couponTitle?: string; firstName?: string; redeemedAt?: string };
export type RedeemState = { result?: RedeemResult };

export async function verifyPin(staffToken: string, _prev: PinState, formData: FormData): Promise<PinState> {
  const pin = String(formData.get('pin') ?? '').trim();
  // input malformato: non consuma tentativi nel DB
  if (!/^\d{4,8}$/.test(pin)) return { error: 'PIN errato' };

  const { data, error } = await createAdminClient().rpc('verify_event_pin', { p_staff_token: staffToken, p_pin: pin });
  if (error) {
    console.error('verify_event_pin fallita', error);
    return { error: 'Errore imprevisto, riprova' };
  }
  if (!data || typeof data !== 'object') {
    console.error('verify_event_pin: payload inatteso', data);
    return { error: 'Errore imprevisto, riprova' };
  }
  const { status, session_key: sessionKey } = data as unknown as { status: string; session_key?: unknown };
  if (status === 'ok' && typeof sessionKey === 'string') {
    await setStaffSession({ staffToken, sessionKey });
    redirect(`/v/${staffToken}`);
  }
  if (status === 'ok') {
    console.error('verify_event_pin: session_key mancante');
    return { error: 'Errore imprevisto, riprova' };
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
    p_session_key: session.sessionKey,
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

  const r = data as unknown as {
    status: RedeemStatus | 'session_expired';
    coupon_title?: string;
    first_name?: string;
    redeemed_at?: string;
  };
  if (r.status === 'session_expired' || r.status === 'unauthorized') {
    await clearStaffSession();
    redirect(`/v/${session.staffToken}?expired=1`);
  }
  return { result: { status: r.status, code, couponTitle: r.coupon_title, firstName: r.first_name, redeemedAt: r.redeemed_at } };
}

export async function logoutStaff(staffToken: string): Promise<void> {
  await clearStaffSession();
  redirect(`/v/${staffToken}`);
}
