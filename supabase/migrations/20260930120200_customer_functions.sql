create or replace view public.event_stats with (security_invoker = true) as
select e.id as event_id,
       count(r.id)::int as registrations,
       count(r.redeemed_at)::int as redeemed
  from public.events e
  left join public.registrations r on r.event_id = e.id
 group by e.id;

create extension if not exists unaccent with schema extensions;

create or replace view public.customer_overview with (security_invoker = true) as
select c.id, c.first_name, c.last_name, c.phone_e164, c.marketing_consent_until,
       c.created_at, c.last_activity_at,
       count(r.id)::int as events_count,
       count(r.redeemed_at)::int as redeemed_count,
       lower(extensions.unaccent(c.first_name || ' ' || c.last_name || ' ' || coalesce(c.phone_e164, ''))) as search_text
  from public.customers c
  left join public.registrations r on r.customer_id = c.id
 where c.merged_into_id is null
 group by c.id;

-- Stesso nome e cognome (senza badare a maiuscole e spazi), almeno uno dei due senza telefono
create or replace view public.duplicate_candidates with (security_invoker = true) as
select a.id as a_id, a.first_name as a_first_name, a.last_name as a_last_name,
       a.phone_e164 as a_phone, a.created_at as a_created_at,
       b.id as b_id, b.first_name as b_first_name, b.last_name as b_last_name,
       b.phone_e164 as b_phone, b.created_at as b_created_at
  from public.customers a
  join public.customers b
    on lower(trim(a.last_name)) = lower(trim(b.last_name))
   and lower(trim(a.first_name)) = lower(trim(b.first_name))
   and a.id < b.id
 where a.merged_into_id is null
   and b.merged_into_id is null
   and (a.phone_e164 is null or b.phone_e164 is null);

revoke all on public.event_stats, public.customer_overview, public.duplicate_candidates from anon;

create or replace function public.merge_customers(p_keep_id uuid, p_drop_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keep public.customers;
  v_drop public.customers;
  r record;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_keep_id = p_drop_id then
    raise exception 'same_customer' using errcode = '22023';
  end if;
  select * into v_keep from public.customers where id = p_keep_id and merged_into_id is null for update;
  if not found then
    raise exception 'customer_not_found' using errcode = 'P0002';
  end if;
  select * into v_drop from public.customers where id = p_drop_id and merged_into_id is null for update;
  if not found then
    raise exception 'customer_not_found' using errcode = 'P0002';
  end if;

  -- blocca le registrazioni di entrambi: un riscatto concorrente non può cambiare l'esito del confronto
  perform 1 from public.registrations where customer_id in (p_keep_id, p_drop_id) for update;

  -- stessa serata su entrambi: si tiene quella già bruciata (a parità, quella del cliente tenuto)
  for r in
    select k.id as keep_reg, d.id as drop_reg, k.redeemed_at as keep_redeemed, d.redeemed_at as drop_redeemed
      from public.registrations k
      join public.registrations d on d.event_id = k.event_id
     where k.customer_id = p_keep_id and d.customer_id = p_drop_id
  loop
    if r.keep_redeemed is null and r.drop_redeemed is not null then
      delete from public.registrations where id = r.keep_reg;
    else
      delete from public.registrations where id = r.drop_reg;
    end if;
  end loop;
  update public.registrations set customer_id = p_keep_id where customer_id = p_drop_id;

  -- il telefono passa al cliente tenuto se non ne ha uno; altrimenti resta come alias sul cliente unito
  if v_keep.phone_e164 is null and v_drop.phone_e164 is not null then
    update public.customers set phone_e164 = null where id = p_drop_id;
    update public.customers set phone_e164 = v_drop.phone_e164 where id = p_keep_id;
  end if;

  update public.customers
     set marketing_consent_until = greatest(v_keep.marketing_consent_until, v_drop.marketing_consent_until),
         last_activity_at = greatest(v_keep.last_activity_at, v_drop.last_activity_at),
         created_at = least(v_keep.created_at, v_drop.created_at)
   where id = p_keep_id;

  update public.customers
     set merged_into_id = p_keep_id
   where id = p_drop_id or merged_into_id = p_drop_id;
end;
$$;

-- GDPR: cancella i clienti senza attività da 12 mesi (a cascata registrazioni e alias uniti)
create or replace function public.purge_inactive_customers()
returns int
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.customers
     where merged_into_id is null
       and last_activity_at < now() - interval '12 months'
    returning 1
  )
  select count(*)::int from deleted;
$$;

revoke execute on function public.merge_customers(uuid, uuid) from public, anon;
grant execute on function public.merge_customers(uuid, uuid) to authenticated;
revoke execute on function public.purge_inactive_customers() from public, anon, authenticated, service_role;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('purge-inactive-customers', '0 3 * * *', $$select public.purge_inactive_customers()$$);
