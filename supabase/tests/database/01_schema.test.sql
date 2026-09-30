begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select has_table('public', 'admins', 'tabella admins');
select has_table('public', 'events', 'tabella events');
select has_table('public', 'customers', 'tabella customers');
select has_table('public', 'registrations', 'tabella registrations');
select has_table('public', 'pin_attempts', 'tabella pin_attempts');

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'RLS attivo su tutte le tabelle public');

select ok(not has_table_privilege('anon', 'public.customers', 'select'), 'anon non legge customers');
select ok(not has_table_privilege('anon', 'public.registrations', 'select'), 'anon non legge registrations');
select ok(not has_table_privilege('authenticated', 'public.pin_attempts', 'select'), 'authenticated non legge pin_attempts');
select ok(not has_function_privilege('anon', 'public.gen_token()', 'execute'), 'anon non chiama gen_token');

select matches(public.gen_code(), '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$', 'formato gen_code');
select matches(public.gen_token(), '^[A-Za-z0-9_-]{22}$', 'formato gen_token');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.events (slug, title, venue_name, starts_at, ends_at, coupon_title)
values ('rls-test', 'Test', 'Locale', now(), now() + interval '4 hours', 'Drink');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.events where slug = 'rls-test'), 0, 'un non admin non vede le serate');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.events where slug = 'rls-test'), 1, 'l''admin vede le serate');
reset role;

select * from finish();
rollback;
