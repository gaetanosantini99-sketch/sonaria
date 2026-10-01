import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers';

async function clients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const asAdmin = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { error: authError } = await asAdmin.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  expect(authError).toBeNull();
  const service = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  return { asAdmin, service };
}

async function createLive(asAdmin: Awaited<ReturnType<typeof clients>>['asAdmin'], slug: string) {
  const now = Date.now();
  const { data: event, error } = await asAdmin
    .from('events')
    .insert({
      slug,
      title: 'Concorrenza',
      venue_name: 'Test',
      starts_at: new Date(now - 3_600_000).toISOString(),
      ends_at: new Date(now + 4 * 3_600_000).toISOString(),
      coupon_title: 'Drink',
      status: 'live',
    })
    .select('id, staff_token')
    .single();
  expect(error).toBeNull();
  const { error: pinError } = await asAdmin.rpc('admin_set_event_pin', { p_event_id: event!.id, p_pin: '1357' });
  expect(pinError).toBeNull();
  return event!;
}

test('bruciature concorrenti: esattamente una va a buon fine', async () => {
  const { asAdmin, service } = await clients();
  const slug = `conc-${Date.now()}`;
  const event = await createLive(asAdmin, slug);

  const { data: reg } = await service.rpc('register_for_event', {
    p_slug: slug, p_first_name: 'Anna', p_last_name: 'Verdi',
    p_consent_privacy: true, p_consent_coupon: true, p_consent_marketing: false, p_privacy_version: 'v1',
  });
  const { data: row } = await service
    .from('registrations')
    .select('coupon_code')
    .eq('coupon_token', (reg as { coupon_token: string }).coupon_token)
    .single();

  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      service.rpc('redeem_event_coupon', { p_staff_token: event.staff_token, p_pin: '1357', p_code: row!.coupon_code }),
    ),
  );
  const statuses = results.map((r) => (r.data as { status: string }).status);
  expect(statuses.filter((s) => s === 'ok')).toHaveLength(1);
  expect(statuses.filter((s) => s === 'already_used')).toHaveLength(7);
});

test('PIN errati in parallelo: il blocco vale anche sotto concorrenza', async () => {
  const { asAdmin, service } = await clients();
  const event = await createLive(asAdmin, `pinlock-${Date.now()}`);

  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      service.rpc('verify_event_pin', { p_staff_token: event.staff_token, p_pin: '0000' }),
    ),
  );
  const statuses = results.map((r) => (r.data as { status: string }).status);
  const wrong = statuses.filter((s) => s === 'wrong_pin');
  const locked = statuses.filter((s) => s === 'locked');
  expect(wrong.length).toBeLessThanOrEqual(5);
  expect(wrong.length + locked.length).toBe(8);

  const { data } = await service.rpc('verify_event_pin', { p_staff_token: event.staff_token, p_pin: '1357' });
  expect((data as { status: string }).status).toBe('locked');
});
