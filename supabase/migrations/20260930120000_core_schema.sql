create extension if not exists pgcrypto with schema extensions;

-- Token URL-safe da 128 bit (22 caratteri base64url)
create or replace function public.gen_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_');
$$;

-- Codice di 6 caratteri senza caratteri ambigui (niente 0 O 1 I L)
create or replace function public.gen_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(6);
  result text := '';
begin
  for i in 0..5 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null check (length(title) between 1 and 120),
  venue_name text not null check (length(venue_name) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  coupon_title text not null check (length(coupon_title) between 1 and 120),
  coupon_description text not null default '' check (length(coupon_description) <= 1000),
  staff_token text not null unique default public.gen_token(),
  staff_pin_hash text,
  status text not null default 'draft' check (status in ('draft', 'live', 'closed')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(first_name) between 1 and 60),
  last_name text not null check (length(last_name) between 1 and 60),
  phone_e164 text unique check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  marketing_consent_until timestamptz,
  merged_into_id uuid references public.customers (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index customers_name_idx on public.customers (lower(trim(last_name)), lower(trim(first_name)));
create index customers_merged_into_idx on public.customers (merged_into_id);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  coupon_code text not null,
  coupon_token text not null unique default public.gen_token(),
  redeemed_at timestamptz,
  consent_privacy_at timestamptz not null,
  consent_coupon_at timestamptz not null,
  consent_marketing boolean not null,
  privacy_version text not null,
  device_id uuid,
  ip_hash text,
  created_at timestamptz not null default now(),
  unique (event_id, customer_id),
  unique (event_id, coupon_code)
);
create index registrations_event_device_idx on public.registrations (event_id, device_id);
create index registrations_ip_recent_idx on public.registrations (ip_hash, created_at);
create index registrations_customer_idx on public.registrations (customer_id);

create table public.pin_attempts (
  scope text not null,
  key text not null,
  failed_count int not null default 0,
  locked_until timestamptz,
  primary key (scope, key)
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

alter table public.admins enable row level security;
alter table public.events enable row level security;
alter table public.customers enable row level security;
alter table public.registrations enable row level security;
alter table public.pin_attempts enable row level security;

create policy admins_read_self on public.admins
  for select to authenticated using (user_id = (select auth.uid()));
create policy events_admin_all on public.events
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy customers_admin_all on public.customers
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy registrations_admin_all on public.registrations
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
-- pin_attempts: nessuna policy, accessibile solo dalle funzioni security definer

revoke all on table public.admins, public.events, public.customers, public.registrations, public.pin_attempts from anon;
revoke all on table public.pin_attempts from authenticated;

-- gen_token / gen_code servono ad authenticated come default delle colonne negli insert dell'admin
revoke execute on function public.gen_token() from public, anon;
revoke execute on function public.gen_code() from public, anon;
grant execute on function public.gen_token() to authenticated, service_role;
grant execute on function public.gen_code() to authenticated, service_role;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
