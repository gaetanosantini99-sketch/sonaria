'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getOrCreateDeviceId } from '@/lib/device';
import { env } from '@/lib/env';
import { getClientIp, hashIp } from '@/lib/ip';
import { PRIVACY_VERSION } from '@/lib/privacy';
import { parseRegistration } from '@/lib/registration';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTurnstile } from '@/lib/turnstile';

export type RegisterState = { errors: Record<string, string>; values?: Record<string, string> };

const RPC_ERRORS: Record<string, string> = {
  consent_required: 'Devi accettare privacy e condizioni del coupon',
  event_not_found: 'Serata non trovata',
  event_closed: 'Le registrazioni per questa serata sono chiuse',
  rate_limited: 'Troppe registrazioni da questa rete, riprova tra qualche minuto',
};

const VALUE_KEYS = ['first_name', 'last_name', 'phone', 'consent_privacy', 'consent_coupon', 'consent_marketing'];

export async function register(slug: string, _prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const values = Object.fromEntries(VALUE_KEYS.map((k) => [k, String(formData.get(k) ?? '')]));
  const parsed = parseRegistration(formData);
  if (!parsed.ok) return { errors: parsed.errors, values };

  const ip = getClientIp(await headers());
  const human = await verifyTurnstile(String(formData.get('cf-turnstile-response') ?? ''), env('TURNSTILE_SECRET'), ip);
  if (!human) return { errors: { form: 'Verifica anti-bot non riuscita, riprova' }, values };

  const deviceId = await getOrCreateDeviceId();
  const { data, error } = await createAdminClient().rpc('register_for_event', {
    p_slug: slug,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_consent_privacy: true,
    p_consent_coupon: true,
    p_consent_marketing: parsed.data.consentMarketing,
    p_privacy_version: PRIVACY_VERSION,
    p_phone_e164: parsed.data.phone ?? undefined,
    p_device_id: deviceId,
    p_ip_hash: ip ? hashIp(ip, env('IP_HASH_SALT')) : undefined,
  });
  if (error || !data || typeof data !== 'object') {
    console.error('register_for_event failed', error);
    return { errors: { form: 'Errore imprevisto, riprova' }, values };
  }

  const result = data as unknown as { status: string; coupon_token?: string };
  if ((result.status === 'created' || result.status === 'existing') && result.coupon_token) {
    redirect(`/c/${result.coupon_token}`);
  }
  return { errors: { form: RPC_ERRORS[result.status] ?? 'Errore imprevisto, riprova' }, values };
}
