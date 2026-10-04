begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  0, 'anon non può eseguire nessuna funzione public');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'),
  0, 'anon non ha privilegi su tabelle e viste public');

select ok(not has_function_privilege('authenticated', 'public.gen_code()', 'execute'), 'authenticated non chiama gen_code');
select ok(not has_function_privilege('authenticated', 'public.verify_event_pin(text,text)', 'execute'), 'authenticated non chiama verify_event_pin');

-- un utente autenticato non admin non vede dati, nemmeno attraverso le viste
insert into public.customers (first_name, last_name) values ('Privilegi', 'Pgtap');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b9","role":"authenticated"}', true);
select is((select count(*)::int from public.customers), 0, 'non admin: nessun cliente');
select is((select count(*)::int from public.customer_overview), 0, 'non admin: vista clienti vuota');
select is((select count(*)::int from public.duplicate_candidates), 0, 'non admin: vista doppioni vuota');
reset role;

select * from finish();
rollback;
