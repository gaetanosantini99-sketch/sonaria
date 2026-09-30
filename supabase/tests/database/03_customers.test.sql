begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');

insert into public.events (id, slug, title, venue_name, starts_at, ends_at, coupon_title, status) values
  ('00000000-0000-0000-0000-00000000e101', 'merge-uno', 'Uno', 'Locale', now() - interval '1 hour', now() + interval '4 hours', 'Drink', 'live'),
  ('00000000-0000-0000-0000-00000000e102', 'merge-due', 'Due', 'Locale', now() - interval '1 hour', now() + interval '4 hours', 'Drink', 'live');

-- c1 e c2 sono la stessa persona (maiuscole e spazi diversi), c4 ha lo stesso nome ma un altro telefono
insert into public.customers (id, first_name, last_name, phone_e164, marketing_consent_until, last_activity_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'Mario', 'Rossi', null, now() + interval '10 days', now()),
  ('00000000-0000-0000-0000-0000000000c2', 'mario ', 'ROSSI', '+393330000001', now() + interval '20 days', now()),
  ('00000000-0000-0000-0000-0000000000c3', 'Vecchio', 'Cliente', null, null, now() - interval '13 months'),
  ('00000000-0000-0000-0000-0000000000c4', 'Mario', 'Rossi', '+393330000002', null, now());

insert into public.registrations (event_id, customer_id, coupon_code, redeemed_at, consent_privacy_at, consent_coupon_at, consent_marketing, privacy_version) values
  ('00000000-0000-0000-0000-00000000e101', '00000000-0000-0000-0000-0000000000c1', 'AAAAAA', null, now(), now(), false, 'v1'),
  ('00000000-0000-0000-0000-00000000e101', '00000000-0000-0000-0000-0000000000c2', 'BBBBBB', now(), now(), now(), true, 'v1'),
  ('00000000-0000-0000-0000-00000000e102', '00000000-0000-0000-0000-0000000000c2', 'CCCCCC', null, now(), now(), true, 'v1');

-- 1-2: candidati doppioni
select is((select count(*)::int from public.duplicate_candidates
            where '00000000-0000-0000-0000-0000000000c1' in (a_id, b_id)), 2, 'c1 ha due possibili doppioni');
select is((select count(*)::int from public.duplicate_candidates
            where a_id in ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4')
              and b_id in ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4')),
  0, 'due telefoni diversi non sono doppioni');

-- 3: solo l'admin può unire
select throws_ok($$ select public.merge_customers('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2') $$,
  '42501', 'forbidden', 'merge rifiutato ai non admin');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- 4-10: unione c2 dentro c1
select lives_ok($$ select public.merge_customers('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2') $$, 'merge eseguito');
select is((select count(*)::int from public.registrations where customer_id = '00000000-0000-0000-0000-0000000000c1'), 2, 'registrazioni spostate');
select is((select coupon_code from public.registrations
            where customer_id = '00000000-0000-0000-0000-0000000000c1' and event_id = '00000000-0000-0000-0000-00000000e101'),
  'BBBBBB', 'conflitto sulla stessa serata: tenuta la registrazione già usata');
select is((select phone_e164 from public.customers where id = '00000000-0000-0000-0000-0000000000c1'), '+393330000001', 'telefono spostato');
select is((select marketing_consent_until from public.customers where id = '00000000-0000-0000-0000-0000000000c1'),
  now() + interval '20 days', 'tenuto il consenso più lungo');
select is((select merged_into_id from public.customers where id = '00000000-0000-0000-0000-0000000000c2'),
  '00000000-0000-0000-0000-0000000000c1'::uuid, 'c2 marcato come unito');
select is((select count(*)::int from public.duplicate_candidates
            where '00000000-0000-0000-0000-0000000000c1' in (a_id, b_id)), 0, 'nessun doppione residuo per c1');

-- 11-13: vista riepilogo
select is((select events_count from public.customer_overview where id = '00000000-0000-0000-0000-0000000000c1'), 2, 'serate contate');
select is((select redeemed_count from public.customer_overview where id = '00000000-0000-0000-0000-0000000000c1'), 1, 'coupon usati contati');
select is((select count(*)::int from public.customer_overview where id = '00000000-0000-0000-0000-0000000000c2'), 0, 'i clienti uniti sono nascosti');

-- 14: dopo l'unione, il telefono porta al cliente tenuto
select is(public.register_for_event(p_slug => 'merge-due', p_first_name => 'Mario', p_last_name => 'Rossi',
    p_consent_privacy => true, p_consent_coupon => true, p_consent_marketing => false, p_privacy_version => 'v1',
    p_phone_e164 => '+393330000001')->>'coupon_token',
  (select coupon_token from public.registrations where coupon_code = 'CCCCCC'), 'telefono unito riconosciuto');

-- 15: statistiche serata
select is((select redeemed from public.event_stats where event_id = '00000000-0000-0000-0000-00000000e101'), 1, 'event_stats conta gli usati');

-- 16-17: pulizia GDPR
select is(public.purge_inactive_customers(), 1, 'un cliente inattivo da 13 mesi cancellato');
select ok(exists (select 1 from public.customers where id = '00000000-0000-0000-0000-0000000000c1'), 'cliente attivo conservato');

-- 18: job schedulato
select is((select count(*)::int from cron.job where jobname = 'purge-inactive-customers'), 1, 'job di pulizia schedulato');

-- 19: merge su sé stesso
select throws_ok($$ select public.merge_customers('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1') $$,
  '22023', 'same_customer', 'non si unisce un cliente con sé stesso');

-- 20: permessi
select ok(not has_function_privilege('authenticated', 'public.purge_inactive_customers()', 'execute'), 'authenticated non lancia la pulizia');

select * from finish();
rollback;
