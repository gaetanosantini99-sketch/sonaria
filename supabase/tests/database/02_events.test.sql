begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

insert into public.events (id, slug, title, venue_name, starts_at, ends_at, coupon_title, status, staff_token, staff_pin_hash) values
  ('00000000-0000-0000-0000-00000000e001', 'live-test', 'Live', 'Locale', now() - interval '1 hour', now() + interval '4 hours', 'Drink 5€', 'live', 'staff-live', extensions.crypt('1234', extensions.gen_salt('bf'))),
  ('00000000-0000-0000-0000-00000000e002', 'draft-test', 'Bozza', 'Locale', now() - interval '1 hour', now() + interval '4 hours', 'Drink', 'draft', 'staff-draft', null),
  ('00000000-0000-0000-0000-00000000e003', 'future-test', 'Futura', 'Locale', now() + interval '2 days', now() + interval '2 days 5 hours', 'Drink', 'live', 'staff-future', null),
  ('00000000-0000-0000-0000-00000000e004', 'closed-test', 'Chiusa', 'Locale', now() - interval '1 hour', now() + interval '4 hours', 'Drink', 'closed', 'staff-closed', null),
  ('00000000-0000-0000-0000-00000000e005', 'past-test', 'Passata', 'Locale', now() - interval '8 hours', now() - interval '3 hours', 'Drink', 'live', 'staff-past', extensions.crypt('1234', extensions.gen_salt('bf'))),
  ('00000000-0000-0000-0000-00000000e006', 'lock-test', 'Lock', 'Locale', now() - interval '1 hour', now() + interval '4 hours', 'Drink', 'live', 'staff-lock', extensions.crypt('9999', extensions.gen_salt('bf')));

create temp table res (k text primary key, v jsonb);
create temp table keys (k text primary key, v text);
-- chiavi di sessione (PIN 1234)
insert into keys values ('live', public.verify_event_pin('staff-live', '1234')->>'session_key');
insert into keys values ('past', public.verify_event_pin('staff-past', '1234')->>'session_key');

-- 1: consensi obbligatori
select is(
  public.register_for_event(p_slug => 'live-test', p_first_name => 'Mario', p_last_name => 'Rossi',
    p_consent_privacy => false, p_consent_coupon => true, p_consent_marketing => false, p_privacy_version => 'v1')->>'status',
  'consent_required', 'senza privacy non si registra');

-- 2-4: prima registrazione con telefono e consenso offerte
insert into res values ('r1', public.register_for_event(p_slug => 'live-test', p_first_name => ' Mario ', p_last_name => 'Rossi',
  p_consent_privacy => true, p_consent_coupon => true, p_consent_marketing => true, p_privacy_version => 'v1',
  p_phone_e164 => '+393331234567', p_device_id => '00000000-0000-0000-0000-0000000000d1', p_ip_hash => 'ip-1'));
select is((select v->>'status' from res where k = 'r1'), 'created', 'prima registrazione creata');
select is((select first_name from public.customers where phone_e164 = '+393331234567'), 'Mario', 'nome salvato senza spazi');
select is((select marketing_consent_until from public.customers where phone_e164 = '+393331234567'),
  now() + interval '30 days', 'consenso offerte valido 30 giorni');

-- 5-6: stesso telefono da un altro dispositivo
insert into res values ('r2', public.register_for_event(p_slug => 'live-test', p_first_name => 'Mario', p_last_name => 'Rossi',
  p_consent_privacy => true, p_consent_coupon => true, p_consent_marketing => false, p_privacy_version => 'v1',
  p_phone_e164 => '+393331234567', p_device_id => '00000000-0000-0000-0000-0000000000d2'));
select is((select v->>'status' from res where k = 'r2'), 'existing', 'stesso telefono: coupon esistente');
select is((select v->>'coupon_token' from res where k = 'r2'), (select v->>'coupon_token' from res where k = 'r1'), 'stesso telefono: stesso token');

-- 7: stesso dispositivo, altro nome, senza telefono
insert into res values ('r3', public.register_for_event(p_slug => 'live-test', p_first_name => 'Luigi', p_last_name => 'Verdi',
  p_consent_privacy => true, p_consent_coupon => true, p_consent_marketing => false, p_privacy_version => 'v1',
  p_device_id => '00000000-0000-0000-0000-0000000000d1'));
select is((select v->>'coupon_token' from res where k = 'r3'), (select v->>'coupon_token' from res where k = 'r1'), 'stesso dispositivo: stesso token');

-- 8-10: nuova persona senza telefono
insert into res values ('r4', public.register_for_event(p_slug => 'live-test', p_first_name => 'Anna', p_last_name => 'Bianchi',
  p_consent_privacy => true, p_consent_coupon => true, p_consent_marketing => false, p_privacy_version => 'v1',
  p_device_id => '00000000-0000-0000-0000-0000000000d3'));
select is((select v->>'status' from res where k = 'r4'), 'created', 'nuova persona: coupon creato');
select is((select count(*)::int from public.customers where phone_e164 = '+393331234567'), 1, 'un solo cliente per telefono');
select is((select count(*)::int from public.registrations where event_id = '00000000-0000-0000-0000-00000000e001'), 2, 'due registrazioni sulla serata');

-- 11-14: finestre e stati della serata
select is(public.register_for_event(p_slug => 'draft-test', p_first_name => 'X', p_last_name => 'Y',
  p_consent_privacy => true, p_consent_coupon => true, p_consent_marketing => false, p_privacy_version => 'v1')->>'status',
  'event_not_found', 'serata in bozza non visibile');
select is(public.register_for_event(p_slug => 'non-esiste', p_first_name => 'X', p_last_name => 'Y',
  p_consent_privacy => true, p_consent_coupon => true, p_consent_marketing => false, p_privacy_version => 'v1')->>'status',
  'event_not_found', 'slug inesistente');
select is(public.register_for_event(p_slug => 'future-test', p_first_name => 'X', p_last_name => 'Y',
  p_consent_privacy => true, p_consent_coupon => true, p_consent_marketing => false, p_privacy_version => 'v1')->>'status',
  'event_closed', 'serata tra 2 giorni non ancora aperta');
select is(public.register_for_event(p_slug => 'closed-test', p_first_name => 'X', p_last_name => 'Y',
  p_consent_privacy => true, p_consent_coupon => true, p_consent_marketing => false, p_privacy_version => 'v1')->>'status',
  'event_closed', 'serata chiusa');

-- 15-20: bruciatura
select is(public.redeem_event_coupon('staff-live', 'chiave-sbagliata',
  (select coupon_code from public.registrations where coupon_token = (select v->>'coupon_token' from res where k = 'r1')))->>'status',
  'session_expired', 'chiave di sessione errata');
select is(public.redeem_event_coupon('staff-live', (select v from keys where k = 'live'),
  (select coupon_code from public.registrations where coupon_token = (select v->>'coupon_token' from res where k = 'r1')))->>'status',
  'ok', 'coupon bruciato');
select is(public.redeem_event_coupon('staff-live', (select v from keys where k = 'live'),
  (select coupon_code from public.registrations where coupon_token = (select v->>'coupon_token' from res where k = 'r1')))->>'status',
  'already_used', 'secondo utilizzo rifiutato');
select is(public.redeem_event_coupon('staff-live', (select v from keys where k = 'live'), 'ZZZZZZ')->>'status', 'not_found', 'codice inesistente');
select is(public.redeem_event_coupon('staff-live', (select v from keys where k = 'live'),
  lower((select coupon_code from public.registrations where coupon_token = (select v->>'coupon_token' from res where k = 'r4'))))->>'status',
  'ok', 'codice minuscolo accettato');
select is(public.redeem_event_coupon('staff-sconosciuto', (select v from keys where k = 'live'), 'ZZZZZZ')->>'status', 'unauthorized', 'token staff sconosciuto');

-- 21: fuori orario
insert into public.registrations (event_id, customer_id, coupon_code, consent_privacy_at, consent_coupon_at, consent_marketing, privacy_version)
select '00000000-0000-0000-0000-00000000e005', id, 'PAST22', now(), now(), false, 'v1'
  from public.customers where phone_e164 = '+393331234567';
select is(public.redeem_event_coupon('staff-past', (select v from keys where k = 'past'), 'PAST22')->>'status', 'out_of_window', 'serata finita da oltre un''ora');

-- blocco dopo 5 PIN errati
insert into keys values ('lock', public.verify_event_pin('staff-lock', '9999')->>'session_key');
do $$ begin perform public.verify_event_pin('staff-lock', '0000') from generate_series(1, 5); end $$;
select is(public.verify_event_pin('staff-lock', '9999')->>'status', 'locked', 'bloccato dopo 5 PIN errati anche con PIN giusto');
select is(public.redeem_event_coupon('staff-lock', (select v from keys where k = 'lock'), 'ZZZZZZ')->>'status', 'not_found',
  'con il PIN bloccato una chiave valida continua a bruciare');
select is(public.verify_event_pin('staff-live', '1234')->>'status', 'ok', 'verify_event_pin con PIN corretto');

-- 24: rate limit per IP
do $$
declare v_customer uuid;
begin
  for i in 1..100 loop
    insert into public.customers (first_name, last_name) values ('Bot', 'Numero' || i) returning id into v_customer;
    insert into public.registrations (event_id, customer_id, coupon_code, consent_privacy_at, consent_coupon_at, consent_marketing, privacy_version, ip_hash)
    values ('00000000-0000-0000-0000-00000000e001', v_customer, 'R' || lpad(i::text, 5, '0'), now(), now(), false, 'v1', 'ip-flood');
  end loop;
end $$;
select is(public.register_for_event(p_slug => 'live-test', p_first_name => 'Nuovo', p_last_name => 'Utente',
  p_consent_privacy => true, p_consent_coupon => true, p_consent_marketing => false, p_privacy_version => 'v1',
  p_ip_hash => 'ip-flood')->>'status', 'rate_limited', 'rate limit per IP');

-- 25-27: permessi
select ok(not has_function_privilege('anon', 'public.register_for_event(text,text,text,boolean,boolean,boolean,text,text,uuid,text)', 'execute'), 'anon non chiama register_for_event');
select ok(not has_function_privilege('authenticated', 'public.redeem_event_coupon(text,text,text)', 'execute'), 'authenticated non chiama redeem_event_coupon');
select ok(has_function_privilege('service_role', 'public.redeem_event_coupon(text,text,text)', 'execute'), 'service_role chiama redeem_event_coupon');

-- 28-31: cambio PIN
select throws_ok($$ select public.admin_set_event_pin('00000000-0000-0000-0000-00000000e001', '5555') $$,
  '42501', 'forbidden', 'admin_set_event_pin rifiutato ai non admin');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$ select public.admin_set_event_pin('00000000-0000-0000-0000-00000000e001', '5555') $$, 'l''admin cambia il PIN');
select is(public.verify_event_pin('staff-live', '5555')->>'status', 'ok', 'nuovo PIN valido');
select is(public.redeem_event_coupon('staff-live', (select v from keys where k = 'live'), 'ZZZZZZ')->>'status', 'session_expired',
  'dopo il cambio PIN la vecchia chiave non vale piu');
select is(public.redeem_event_coupon('staff-live', public.verify_event_pin('staff-live', '5555')->>'session_key', 'ZZZZZZ')->>'status', 'not_found',
  'la nuova chiave funziona');
select throws_ok($$ select public.admin_set_event_pin('00000000-0000-0000-0000-00000000e001', 'abc') $$,
  '22023', 'invalid_pin', 'PIN non numerico rifiutato');

-- 32: quattro tentativi errati non bloccano (semantica sequenziale con il lock advisory)
insert into public.events (id, slug, title, venue_name, starts_at, ends_at, coupon_title, status, staff_token, staff_pin_hash)
values ('00000000-0000-0000-0000-00000000e007', 'pin4-test', 'Pin4', 'Locale', now() - interval '1 hour', now() + interval '4 hours', 'Drink', 'live', 'staff-pin4', extensions.crypt('4321', extensions.gen_salt('bf')));
do $$ begin perform public.verify_event_pin('staff-pin4', '0000') from generate_series(1, 4); end $$;
select is(public.verify_event_pin('staff-pin4', '4321')->>'status', 'ok', '4 PIN errati non bloccano: il PIN giusto passa');

-- 5 bruciature con chiave obsoleta non creano blocchi
do $$ begin perform public.redeem_event_coupon('staff-pin4', 'obsoleta', 'ZZZZZZ') from generate_series(1, 5); end $$;
select is(public.verify_event_pin('staff-pin4', '4321')->>'status', 'ok', '5 bruciature con chiave obsoleta non bloccano il PIN');

-- 33: un solo coupon per dispositivo e serata a livello di indice
insert into public.customers (id, first_name, last_name) values ('00000000-0000-0000-0000-0000000000c9', 'Dup', 'Device');
select throws_ok($$ insert into public.registrations (event_id, customer_id, coupon_code, consent_privacy_at, consent_coupon_at, consent_marketing, privacy_version, device_id)
  values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000c9', 'DUPDEV', now(), now(), false, 'v1', '00000000-0000-0000-0000-0000000000d1') $$,
  '23505', null, 'secondo insert con stesso (serata, dispositivo) rifiutato');

-- 34-36: il consenso offerte non si estende senza una nuova registrazione
insert into res values ('m1', public.register_for_event(p_slug => 'live-test', p_first_name => 'Gina', p_last_name => 'Neri',
  p_consent_privacy => true, p_consent_coupon => true, p_consent_marketing => false, p_privacy_version => 'v1',
  p_phone_e164 => '+393339990000', p_device_id => '00000000-0000-0000-0000-0000000000d8'));
insert into res values ('m2', public.register_for_event(p_slug => 'live-test', p_first_name => 'Gina', p_last_name => 'Neri',
  p_consent_privacy => true, p_consent_coupon => true, p_consent_marketing => true, p_privacy_version => 'v1',
  p_phone_e164 => '+393339990000', p_device_id => '00000000-0000-0000-0000-0000000000d9'));
select is((select v->>'status' from res where k = 'm1'), 'created', 'registrazione senza consenso offerte creata');
select is((select v->>'status' from res where k = 'm2'), 'existing', 'seconda richiesta: coupon esistente');
select is((select marketing_consent_until from public.customers where phone_e164 = '+393339990000'), null::timestamptz,
  'consenso offerte non esteso senza nuova registrazione');

-- telefono non verificato: con un nome diverso dalla scheda il consenso offerte non cambia
insert into res values ('m3', public.register_for_event(p_slug => 'lock-test', p_first_name => 'Altro', p_last_name => 'Nome',
  p_consent_privacy => true, p_consent_coupon => true, p_consent_marketing => true, p_privacy_version => 'v1',
  p_phone_e164 => '+393339990000'));
select is((select v->>'status' from res where k = 'm3'), 'created', 'nuova serata con telefono noto e nome diverso: coupon creato');
select is((select marketing_consent_until from public.customers where phone_e164 = '+393339990000'), null::timestamptz,
  'nome diverso dalla scheda: consenso offerte non esteso');
select is((select consent_marketing from public.registrations where coupon_token = (select v->>'coupon_token' from res where k = 'm3')),
  false, 'nome diverso dalla scheda: la registrazione non riporta il consenso offerte');

-- stesso telefono e stesso nome (maiuscole diverse) su una nuova serata: consenso esteso
insert into public.events (id, slug, title, venue_name, starts_at, ends_at, coupon_title, status) values
  ('00000000-0000-0000-0000-00000000e0a7', 'name-test', 'Nome', 'Locale', now() - interval '1 hour', now() + interval '4 hours', 'Drink', 'live');
do $$ begin perform public.register_for_event(p_slug => 'name-test', p_first_name => 'gina', p_last_name => 'NERI ',
  p_consent_privacy => true, p_consent_coupon => true, p_consent_marketing => true, p_privacy_version => 'v1',
  p_phone_e164 => '+393339990000'); end $$;
select is((select marketing_consent_until from public.customers where phone_e164 = '+393339990000'), now() + interval '30 days',
  'stesso nome della scheda: consenso offerte esteso');

select * from finish();
rollback;
