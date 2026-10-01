-- Verifica un PIN con blocco dopo 5 tentativi errati (15 minuti)
create or replace function public.check_pin(p_scope text, p_key text, p_pin_hash text, p_pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.pin_attempts;
begin
  -- serializza i tentativi sulla stessa chiave: il for update da solo non blocca nulla
  -- quando la riga non esiste ancora (primo tentativo, dopo un successo, dopo un blocco scaduto)
  perform pg_advisory_xact_lock(hashtext(p_scope || ':' || p_key));

  select * into v_attempt from public.pin_attempts
   where scope = p_scope and key = p_key
   for update;

  if found and v_attempt.locked_until is not null then
    if v_attempt.locked_until > now() then
      return 'locked';
    end if;
    delete from public.pin_attempts where scope = p_scope and key = p_key;
  end if;

  if p_pin_hash is not null and coalesce(p_pin, '') <> ''
     and extensions.crypt(p_pin, p_pin_hash) = p_pin_hash then
    delete from public.pin_attempts where scope = p_scope and key = p_key;
    return 'ok';
  end if;

  insert into public.pin_attempts as pa (scope, key, failed_count, locked_until)
  values (p_scope, p_key, 1, null)
  on conflict (scope, key) do update
    set failed_count = pa.failed_count + 1,
        locked_until = case when pa.failed_count + 1 >= 5 then now() + interval '15 minutes' end;
  return 'wrong_pin';
end;
$$;

create or replace function public.verify_event_pin(p_staff_token text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  select staff_pin_hash into v_hash from public.events where staff_token = p_staff_token;
  if not found then
    return jsonb_build_object('status', 'unauthorized');
  end if;
  return jsonb_build_object('status', public.check_pin('event', p_staff_token, v_hash, p_pin));
end;
$$;

create or replace function public.admin_set_event_pin(p_event_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'invalid_pin' using errcode = '22023';
  end if;
  update public.events
     set staff_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8))
   where id = p_event_id
  returning staff_token into v_token;
  if not found then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;
  delete from public.pin_attempts where scope = 'event' and key = v_token;
end;
$$;

-- un solo coupon per dispositivo e serata (difesa in profondità contro i doppi tap)
create unique index registrations_event_device_uniq
  on public.registrations (event_id, device_id) where device_id is not null;

create or replace function public.register_for_event(
  p_slug text,
  p_first_name text,
  p_last_name text,
  p_consent_privacy boolean,
  p_consent_coupon boolean,
  p_consent_marketing boolean,
  p_privacy_version text,
  p_phone_e164 text default null,
  p_device_id uuid default null,
  p_ip_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_customer_id uuid;
  v_token text;
  v_attempt int := 0;
begin
  if not coalesce(p_consent_privacy, false) or not coalesce(p_consent_coupon, false) then
    return jsonb_build_object('status', 'consent_required');
  end if;

  select * into v_event from public.events where slug = p_slug;
  if not found or v_event.status = 'draft' then
    return jsonb_build_object('status', 'event_not_found');
  end if;
  if v_event.status = 'closed'
     or now() < v_event.starts_at - interval '12 hours'
     or now() > v_event.ends_at then
    return jsonb_build_object('status', 'event_closed');
  end if;

  -- stesso dispositivo già registrato a questa serata
  if p_device_id is not null then
    -- serializza i doppi tap dallo stesso dispositivo sulla stessa serata
    perform pg_advisory_xact_lock(hashtext(v_event.id::text || ':' || p_device_id::text));
    select coupon_token into v_token from public.registrations
     where event_id = v_event.id and device_id = p_device_id
     limit 1;
    if found then
      return jsonb_build_object('status', 'existing', 'coupon_token', v_token);
    end if;
  end if;

  if p_ip_hash is not null and (
    select count(*) from public.registrations
     where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes'
  ) >= 100 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  -- cliente: riconosciuto dal telefono, altrimenti nuovo
  if p_phone_e164 is not null then
    insert into public.customers as c (first_name, last_name, phone_e164)
    values (trim(p_first_name), trim(p_last_name), p_phone_e164)
    on conflict (phone_e164) do update set last_activity_at = now()
    returning coalesce(c.merged_into_id, c.id) into v_customer_id;
  else
    insert into public.customers (first_name, last_name)
    values (trim(p_first_name), trim(p_last_name))
    returning id into v_customer_id;
  end if;

  update public.customers
     set last_activity_at = now()
   where id = v_customer_id;

  select coupon_token into v_token from public.registrations
   where event_id = v_event.id and customer_id = v_customer_id;
  if found then
    return jsonb_build_object('status', 'existing', 'coupon_token', v_token);
  end if;

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.registrations (
        event_id, customer_id, coupon_code, consent_privacy_at, consent_coupon_at,
        consent_marketing, privacy_version, device_id, ip_hash
      ) values (
        v_event.id, v_customer_id, public.gen_code(), now(), now(),
        coalesce(p_consent_marketing, false), p_privacy_version, p_device_id, p_ip_hash
      )
      returning coupon_token into v_token;
      -- il consenso offerte cambia solo con una nuova registrazione (evidenza)
      if p_consent_marketing then
        update public.customers
           set marketing_consent_until = greatest(marketing_consent_until, now() + interval '30 days')
         where id = v_customer_id;
      end if;
      return jsonb_build_object('status', 'created', 'coupon_token', v_token);
    exception when unique_violation then
      -- registrazione concorrente dello stesso cliente, oppure collisione del codice
      select coupon_token into v_token from public.registrations
       where event_id = v_event.id and customer_id = v_customer_id;
      if found then
        return jsonb_build_object('status', 'existing', 'coupon_token', v_token);
      end if;
      if p_device_id is not null then
        select coupon_token into v_token from public.registrations
         where event_id = v_event.id and device_id = p_device_id;
        if found then
          return jsonb_build_object('status', 'existing', 'coupon_token', v_token);
        end if;
      end if;
      if v_attempt >= 10 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

create or replace function public.redeem_event_coupon(p_staff_token text, p_pin text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_pin_status text;
  v_reg_id uuid;
  v_redeemed_at timestamptz;
  v_first_name text;
begin
  select * into v_event from public.events where staff_token = p_staff_token;
  if not found then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  v_pin_status := public.check_pin('event', p_staff_token, v_event.staff_pin_hash, p_pin);
  if v_pin_status <> 'ok' then
    return jsonb_build_object('status', v_pin_status);
  end if;

  select r.id, r.redeemed_at, c.first_name
    into v_reg_id, v_redeemed_at, v_first_name
    from public.registrations r
    join public.customers c on c.id = r.customer_id
   where r.event_id = v_event.id and r.coupon_code = upper(trim(p_code));
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_redeemed_at is not null then
    return jsonb_build_object('status', 'already_used', 'redeemed_at', v_redeemed_at);
  end if;
  if now() < v_event.starts_at or now() > v_event.ends_at + interval '1 hour' then
    return jsonb_build_object('status', 'out_of_window');
  end if;

  -- atomico: solo un chiamante concorrente trova redeemed_at ancora null
  update public.registrations set redeemed_at = now()
   where id = v_reg_id and redeemed_at is null
  returning redeemed_at into v_redeemed_at;
  if not found then
    select redeemed_at into v_redeemed_at from public.registrations where id = v_reg_id;
    return jsonb_build_object('status', 'already_used', 'redeemed_at', v_redeemed_at);
  end if;

  return jsonb_build_object('status', 'ok', 'coupon_title', v_event.coupon_title,
                            'first_name', v_first_name, 'redeemed_at', v_redeemed_at);
end;
$$;

revoke execute on function public.check_pin(text, text, text, text) from public, anon, authenticated, service_role;
revoke execute on function public.verify_event_pin(text, text) from public, anon, authenticated;
revoke execute on function public.register_for_event(text, text, text, boolean, boolean, boolean, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.redeem_event_coupon(text, text, text) from public, anon, authenticated;
revoke execute on function public.admin_set_event_pin(uuid, text) from public, anon;
grant execute on function public.verify_event_pin(text, text) to service_role;
grant execute on function public.register_for_event(text, text, text, boolean, boolean, boolean, text, text, uuid, text) to service_role;
grant execute on function public.redeem_event_coupon(text, text, text) to service_role;
grant execute on function public.admin_set_event_pin(uuid, text) to authenticated;
