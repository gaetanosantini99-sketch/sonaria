# Fase 1 — Serate, QR, coupon e validazione al bar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il PR crea una serata, scarica il QR e il link per i baristi. Il cliente scansiona, compila il form e ottiene un coupon personale. Il barista lo "brucia" una sola volta. Il PR vede i clienti, unisce i doppioni ed esporta un CSV.

**Architecture:**
- **Next.js:** un monolite Next.js 16 (App Router) su Netlify. Le pagine pubbliche e di validazione usano solo Server Actions con il client Supabase *secret* lato server. L'area `/admin` usa la sessione Supabase Auth del PR, con RLS che consente tutto solo agli utenti presenti in `admins`.
- **Database:** le operazioni critiche (registrazione, bruciatura del coupon, unione dei clienti) sono funzioni Postgres atomiche `security definer`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Supabase (Postgres 17, Auth, pg_cron, pgTAP), `@supabase/ssr`, zod 4, libphonenumber-js, qrcode, date-fns-tz, Vitest, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-30-pr-coupon-system-design.md`

## Global Constraints

- **Ambiente:** Node 24. I comandi si lanciano da Git Bash nella root `C:\G\Pr_SBS`. Supabase in locale con la CLI più Docker (`npx supabase ...`, CLI come devDependency).
- **Lingua:** tutta l'interfaccia è in italiano.
- **Fuso orario:** l'input e la visualizzazione di date e ore usano sempre `Europe/Rome`. Il DB salva `timestamptz` (UTC).
- **Accesso ai dati:** il browser non accede mai direttamente alle tabelle. Nessuna policy RLS per `anon`. La secret key compare solo in moduli server (`import 'server-only'`).
- **Env:** `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITEKEY`, `TURNSTILE_SECRET`, `IP_HASH_SALT`. Nella spec compaiono ancora `ANON_KEY`/`SERVICE_ROLE_KEY`: sono sostituite dalle nuove chiavi publishable/secret di Supabase, equivalenti.
- **Codici coupon:** 6 caratteri dell'alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
- **Token URL:** 128 bit casuali in base64url (22 caratteri).
- **PIN baristi:** da 4 a 8 cifre, salvato con bcrypt (`pgcrypto`). Blocco di 15 minuti dopo 5 tentativi errati.
- **Consenso offerte:** vale `now() + 30 giorni` da ogni registrazione con la spunta.
- **Conservazione:** i clienti senza attività da 12 mesi vengono cancellati (`pg_cron`, ogni giorno).
- **Finestre temporali:**
  - registrazione da `starts_at - 12h` a `ends_at`;
  - bruciatura da `starts_at` a `ends_at + 1h`.
- **Rate limit:** 100 registrazioni ogni 10 minuti per hash IP.
- **Hosting:** Netlify. Nessuna API specifica di Vercel.
- **Commit:** conventional commits, con il messaggio che termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Lavorare sul branch `feat/fase-1-serate`.

## Review Focus

1. **Il cliente riapre il QR da un browser in-app (Instagram/WhatsApp) che ha perso i cookie.** Se reinserisce lo stesso telefono, anche in formato diverso (`333…` oppure `+39 333…`), deve ritrovare lo **stesso** coupon. Coperto dal test e2e di Task 7.
2. **Il barista digita il codice in minuscolo, con spazi o trattini.** Deve essere accettato. Coperto dagli unit test di `normalizeCode` (Task 8) e dall'e2e in minuscolo.
3. **Serata a cavallo della mezzanotte o del cambio d'ora** (notte del 25/10/2026). L'orario UTC salvato deve essere corretto e la fine dopo mezzanotte va accettata. Coperto dai test di `dates` ed `event-form` (Task 6).
4. **Nomi con accenti, apostrofi, maiuscole o spazi** ("D'Angelo", "mario ", "ROSSI"). Devono essere salvati puliti, riconosciuti come doppioni e trovati dalla ricerca. Coperto dai test pgTAP di Task 4, dai test `searchTerms` di Task 9 e dall'e2e dei doppioni.
5. **Il PR cambia il PIN a serata in corso.** Il telefono del barista con la sessione vecchia deve mostrare "Sessione scaduta, reinserisci il PIN" e non fallire in silenzio. Coperto dal secondo test e2e di Task 8.

## File Structure

```
proxy.ts                               # protegge /admin (Next 16: ex middleware)
next.config.ts                         # header di sicurezza, noindex
netlify.toml
vitest.config.ts  playwright.config.ts
lib/
  env.ts site.ts dates.ts slug.ts event-form.ts event-status.ts event-window.ts
  qr.ts phone.ts ip.ts turnstile.ts registration.ts privacy.ts device.ts
  codes.ts staff-session-codec.ts staff-session.ts csv.ts search.ts consent.ts auth.ts
  supabase/{server.ts,admin.ts,proxy.ts,database.types.ts}
components/{field-error.tsx,copy-button.tsx}
app/
  layout.tsx globals.css page.tsx not-found.tsx privacy/page.tsx api/health/route.ts
  e/[slug]/{page.tsx,register-form.tsx,actions.ts}
  c/[token]/page.tsx
  v/{actions.ts,pin-form.tsx,redeem-form.tsx} v/[staffToken]/page.tsx v/scan/page.tsx
  admin/login/{page.tsx,login-form.tsx,actions.ts}
  admin/(dashboard)/{layout.tsx,page.tsx,error.tsx}
  admin/(dashboard)/eventi/{page.tsx,actions.ts,event-form.tsx} nuova/page.tsx [id]/page.tsx [id]/qr/route.ts
  admin/(dashboard)/clienti/{page.tsx,actions.ts} [id]/page.tsx doppioni/page.tsx export/route.ts
scripts/create-admin.ts
supabase/config.toml supabase/migrations/*.sql supabase/tests/database/*.test.sql
e2e/{global-setup.ts,helpers.ts,*.spec.ts}
.github/workflows/{ci.yml,keepalive.yml,backup.yml}
docs/deploy.md README.md
```

---

### Task 1: Scaffolding Next.js e tooling

**Files:**
- Create: progetto Next.js (`create-next-app`), `vitest.config.ts`, `netlify.toml`, `.env.example`, `.gitattributes`, `lib/site.ts`, `components/field-error.tsx`, `app/not-found.tsx`, `README.md`
- Modify: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `next.config.ts`, `package.json`, `.gitignore`
- Test: `lib/site.test.ts`

**Interfaces:**
- Produces: `siteUrl(path?: string): string`, `SITE_NAME: string` (`lib/site.ts`); `FieldError({ message?: string })` (`components/field-error.tsx`); classi CSS `.card .label .input .btn .btn-primary .btn-secondary .btn-danger .field-error`; colori Tailwind `bg surface border text muted accent accent-contrast ok danger`.

- [ ] **Step 1: Branch e scaffold**

```bash
cd /c/G/Pr_SBS
git checkout -b feat/fase-1-serate
npx create-next-app@16 . --yes --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
npm i @supabase/supabase-js @supabase/ssr zod libphonenumber-js qrcode date-fns date-fns-tz server-only
npm i -D vitest @types/qrcode supabase @playwright/test
```

Se `create-next-app` rifiuta la cartella perché non è vuota, sposta temporaneamente `docs/` fuori, esegui lo scaffold e rimetti `docs/` al suo posto.

- [ ] **Step 2: Script npm.** In `package.json`, dentro `"scripts"`, aggiungi (senza togliere `dev`/`build`/`start`/`lint`):

```json
"test": "vitest run",
"typecheck": "tsc --noEmit",
"db:start": "supabase start",
"db:reset": "supabase db reset",
"db:types": "supabase gen types typescript --local > lib/supabase/database.types.ts",
"test:db": "supabase test db",
"test:e2e": "playwright test",
"admin:create": "node --env-file=.env.local scripts/create-admin.ts"
```

- [ ] **Step 3: Config Vitest.** Crea `vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: { include: ['lib/**/*.test.ts'], environment: 'node' },
});
```

- [ ] **Step 4: Scrivi il test che fallisce.** `lib/site.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { siteUrl } from './site';

describe('siteUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('unisce base e path senza doppi slash', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.it/');
    expect(siteUrl('/e/abc')).toBe('https://example.it/e/abc');
  });

  it('aggiunge lo slash mancante', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.it');
    expect(siteUrl('c/x')).toBe('https://example.it/c/x');
  });

  it('usa localhost se la variabile è vuota', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(siteUrl()).toBe('http://localhost:3000/');
  });
});
```

- [ ] **Step 5: Esegui il test.** `npm test`. Atteso: FAIL con "Cannot find module './site'".

- [ ] **Step 6: Implementa `lib/site.ts`**

```ts
export const SITE_NAME = 'DJ';

export function siteUrl(path = '/'): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
```

- [ ] **Step 7: Esegui il test.** `npm test`. Atteso: 3 PASS.

- [ ] **Step 8: Tema e componenti base.** Sostituisci `app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-bg: #0b0b10;
  --color-surface: #16161f;
  --color-border: #2a2a38;
  --color-text: #f4f4f8;
  --color-muted: #9a9ab0;
  --color-accent: #c6ff3d;
  --color-accent-contrast: #0b0b10;
  --color-ok: #22c55e;
  --color-danger: #ef4444;
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
}

@layer components {
  .card { @apply rounded-2xl border border-border bg-surface p-5; }
  .label { @apply mb-1 block text-sm font-medium text-muted; }
  .input { @apply w-full rounded-xl border border-border bg-bg px-4 py-3 text-base text-text outline-none focus:border-accent; }
  .btn { @apply inline-flex items-center justify-center rounded-xl px-5 py-3 font-semibold transition disabled:opacity-50; }
  .btn-primary { @apply bg-accent text-accent-contrast hover:brightness-110; }
  .btn-secondary { @apply border border-border bg-surface text-text hover:border-accent; }
  .btn-danger { @apply bg-danger text-white hover:brightness-110; }
  .field-error { @apply mt-1 text-sm text-danger; }
}
```

Sostituisci `app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { SITE_NAME } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
```

Sostituisci `app/page.tsx` (la landing vera arriva in Fase 3):

```tsx
import { SITE_NAME } from '@/lib/site';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-black">{SITE_NAME}</h1>
      <p className="mt-2 text-muted">Sito in arrivo.</p>
    </main>
  );
}
```

Crea `app/not-found.tsx`:

```tsx
export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Pagina non trovata</h1>
      <p className="mt-2 text-muted">Il link potrebbe essere scaduto o errato.</p>
    </main>
  );
}
```

Crea `components/field-error.tsx`:

```tsx
export function FieldError({ message }: { message?: string }) {
  return message ? <p className="field-error">{message}</p> : null;
}
```

Rimuovi i file SVG demo in `public/` generati dallo scaffold.

- [ ] **Step 9: Header di sicurezza.** Sostituisci `next.config.ts`:

```ts
import type { NextConfig } from 'next';

const noIndex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      { source: '/e/:path*', headers: noIndex },
      { source: '/c/:path*', headers: noIndex },
      { source: '/v/:path*', headers: noIndex },
      { source: '/admin/:path*', headers: noIndex },
    ];
  },
};

export default nextConfig;
```

`Referrer-Policy: no-referrer` evita che i token presenti negli URL di coupon e staff finiscano nei referrer.

- [ ] **Step 10: File di progetto.** `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = ".next"
```

`.env.example`:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
# Chiavi di test Cloudflare Turnstile (passano sempre). In produzione usare quelle reali.
NEXT_PUBLIC_TURNSTILE_SITEKEY=1x00000000000000000000AA
TURNSTILE_SECRET=1x0000000000000000000000000000000AA
IP_HASH_SALT=sostituisci-con-una-stringa-casuale-lunga
```

`.gitattributes`:

```
* text=auto eol=lf
```

In `.gitignore`, sotto la riga `.env*`, aggiungi `!.env.example`.

`README.md`:

```markdown
# Sistema promozionale PR/DJ

Spec: `docs/superpowers/specs/2026-09-30-pr-coupon-system-design.md`

## Sviluppo locale
1. Requisiti: Node 24, Docker Desktop avviato.
2. `npm install`
3. `npm run db:start` e poi `npx supabase status -o env` per ottenere URL e chiavi
4. `cp .env.example .env.local` e compila le chiavi Supabase
5. `npm run admin:create -- tua@email.it passwordLunga`
6. `npm run dev`, poi apri http://localhost:3000/admin

## Test
- `npm test`: unit test (Vitest)
- `npm run test:db`: test del database (pgTAP, serve `db:start`)
- `npm run test:e2e`: end-to-end (Playwright, serve `db:start`)

Deploy e operazioni: `docs/deploy.md`.
```

- [ ] **Step 11: Verifica.** `npm run lint && npm run typecheck && npm test && npm run build`. Atteso: tutto verde.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 con tema, header di sicurezza e Vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Supabase locale e schema di base (tabelle, RLS, helper)

**Files:**
- Create: `supabase/config.toml` (con `supabase init`), `supabase/migrations/20260930120000_core_schema.sql`
- Test: `supabase/tests/database/01_schema.test.sql`

**Interfaces:**
- Produces: tabelle `admins`, `events`, `customers`, `registrations`, `pin_attempts`; funzioni `public.gen_token() → text`, `public.gen_code() → text`, `public.is_admin() → boolean`.

- [ ] **Step 1: Init.** `npx supabase init` (rispondi No alle domande su IDE e Deno). In `supabase/config.toml`:
  - nella sezione `[auth]` imposta `site_url = "http://localhost:3000"` e `enable_signup = false`;
  - nella sezione `[auth.email]` imposta `enable_signup = false`.

  La funzione `auth.admin.createUser` continua a funzionare anche con le registrazioni disattivate.

- [ ] **Step 2: Avvia lo stack.** `npm run db:start` (serve Docker). Poi `npx supabase status -o env`. Crea `.env.local` a partire da `.env.example`:
  - `NEXT_PUBLIC_SUPABASE_URL` = `API_URL`;
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `PUBLISHABLE_KEY` (se manca, `ANON_KEY`);
  - `SUPABASE_SECRET_KEY` = `SECRET_KEY` (se manca, `SERVICE_ROLE_KEY`).

- [ ] **Step 3: Scrivi il test che fallisce.** `supabase/tests/database/01_schema.test.sql`:

```sql
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
```

- [ ] **Step 4: Esegui il test.** `npm run test:db`. Atteso: FAIL (le tabelle non esistono).

- [ ] **Step 5: Migrazione.** `supabase/migrations/20260930120000_core_schema.sql`:

```sql
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
```

- [ ] **Step 6: Applica ed esegui il test.** `npm run db:reset && npm run test:db`. Atteso: `01_schema.test.sql .. ok`, 14/14.

- [ ] **Step 7: Commit**

```bash
git add supabase .env.example
git commit -m "feat(db): schema di base con RLS, token e codici

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Funzioni della serata (PIN, registrazione, bruciatura del coupon)

**Files:**
- Create: `supabase/migrations/20260930120100_event_functions.sql`
- Test: `supabase/tests/database/02_events.test.sql`

**Interfaces:**
- Consumes: le tabelle e le funzioni di Task 2.
- Produces (tutte `returns jsonb` tranne dove indicato):
  - `register_for_event(p_slug text, p_first_name text, p_last_name text, p_consent_privacy boolean, p_consent_coupon boolean, p_consent_marketing boolean, p_privacy_version text, p_phone_e164 text default null, p_device_id uuid default null, p_ip_hash text default null)` restituisce `{status: 'created'|'existing'|'consent_required'|'event_not_found'|'event_closed'|'rate_limited', coupon_token?}`. Eseguibile solo da `service_role`.
  - `redeem_event_coupon(p_staff_token text, p_pin text, p_code text)` restituisce `{status: 'ok'|'already_used'|'not_found'|'out_of_window'|'wrong_pin'|'locked'|'unauthorized', coupon_title?, first_name?, redeemed_at?}`. Eseguibile solo da `service_role`.
  - `verify_event_pin(p_staff_token text, p_pin text)` restituisce `{status: 'ok'|'wrong_pin'|'locked'|'unauthorized'}`. Eseguibile solo da `service_role`.
  - `admin_set_event_pin(p_event_id uuid, p_pin text) returns void`. Eseguibile da `authenticated`. Senza admin solleva `42501 forbidden`; con un PIN non valido solleva `22023 invalid_pin`.
  - `check_pin(p_scope, p_key, p_pin_hash, p_pin) returns text`: uso interno, nessun grant.

- [ ] **Step 1: Scrivi il test che fallisce.** `supabase/tests/database/02_events.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into public.events (id, slug, title, venue_name, starts_at, ends_at, coupon_title, status, staff_token, staff_pin_hash) values
  ('00000000-0000-0000-0000-00000000e001', 'live-test', 'Live', 'Locale', now() - interval '1 hour', now() + interval '4 hours', 'Drink 5€', 'live', 'staff-live', extensions.crypt('1234', extensions.gen_salt('bf'))),
  ('00000000-0000-0000-0000-00000000e002', 'draft-test', 'Bozza', 'Locale', now() - interval '1 hour', now() + interval '4 hours', 'Drink', 'draft', 'staff-draft', null),
  ('00000000-0000-0000-0000-00000000e003', 'future-test', 'Futura', 'Locale', now() + interval '2 days', now() + interval '2 days 5 hours', 'Drink', 'live', 'staff-future', null),
  ('00000000-0000-0000-0000-00000000e004', 'closed-test', 'Chiusa', 'Locale', now() - interval '1 hour', now() + interval '4 hours', 'Drink', 'closed', 'staff-closed', null),
  ('00000000-0000-0000-0000-00000000e005', 'past-test', 'Passata', 'Locale', now() - interval '8 hours', now() - interval '3 hours', 'Drink', 'live', 'staff-past', extensions.crypt('1234', extensions.gen_salt('bf'))),
  ('00000000-0000-0000-0000-00000000e006', 'lock-test', 'Lock', 'Locale', now() - interval '1 hour', now() + interval '4 hours', 'Drink', 'live', 'staff-lock', extensions.crypt('9999', extensions.gen_salt('bf')));

create temp table res (k text primary key, v jsonb);

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
select is(public.redeem_event_coupon('staff-live', '0000',
  (select coupon_code from public.registrations where coupon_token = (select v->>'coupon_token' from res where k = 'r1')))->>'status',
  'wrong_pin', 'PIN errato');
select is(public.redeem_event_coupon('staff-live', '1234',
  (select coupon_code from public.registrations where coupon_token = (select v->>'coupon_token' from res where k = 'r1')))->>'status',
  'ok', 'coupon bruciato');
select is(public.redeem_event_coupon('staff-live', '1234',
  (select coupon_code from public.registrations where coupon_token = (select v->>'coupon_token' from res where k = 'r1')))->>'status',
  'already_used', 'secondo utilizzo rifiutato');
select is(public.redeem_event_coupon('staff-live', '1234', 'ZZZZZZ')->>'status', 'not_found', 'codice inesistente');
select is(public.redeem_event_coupon('staff-live', '1234',
  lower((select coupon_code from public.registrations where coupon_token = (select v->>'coupon_token' from res where k = 'r4'))))->>'status',
  'ok', 'codice minuscolo accettato');
select is(public.redeem_event_coupon('staff-sconosciuto', '1234', 'ZZZZZZ')->>'status', 'unauthorized', 'token staff sconosciuto');

-- 21: fuori orario
insert into public.registrations (event_id, customer_id, coupon_code, consent_privacy_at, consent_coupon_at, consent_marketing, privacy_version)
select '00000000-0000-0000-0000-00000000e005', id, 'PAST22', now(), now(), false, 'v1'
  from public.customers where phone_e164 = '+393331234567';
select is(public.redeem_event_coupon('staff-past', '1234', 'PAST22')->>'status', 'out_of_window', 'serata finita da oltre un''ora');

-- 22-23: blocco dopo 5 PIN errati
do $$ begin perform public.redeem_event_coupon('staff-lock', '0000', 'ZZZZZZ') from generate_series(1, 5); end $$;
select is(public.verify_event_pin('staff-lock', '9999')->>'status', 'locked', 'bloccato dopo 5 PIN errati anche con PIN giusto');
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
select throws_ok($$ select public.admin_set_event_pin('00000000-0000-0000-0000-00000000e001', 'abc') $$,
  '22023', 'invalid_pin', 'PIN non numerico rifiutato');

select * from finish();
rollback;
```

- [ ] **Step 2: Esegui il test.** `npm run test:db`. Atteso: FAIL su `02_events` (le funzioni non esistono).

- [ ] **Step 3: Migrazione.** `supabase/migrations/20260930120100_event_functions.sql`:

```sql
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
     set last_activity_at = now(),
         marketing_consent_until = case
           when p_consent_marketing then greatest(marketing_consent_until, now() + interval '30 days')
           else marketing_consent_until
         end
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
      return jsonb_build_object('status', 'created', 'coupon_token', v_token);
    exception when unique_violation then
      -- registrazione concorrente dello stesso cliente, oppure collisione del codice
      select coupon_token into v_token from public.registrations
       where event_id = v_event.id and customer_id = v_customer_id;
      if found then
        return jsonb_build_object('status', 'existing', 'coupon_token', v_token);
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
```

- [ ] **Step 4: Applica ed esegui il test.** `npm run db:reset && npm run test:db`. Atteso: `01` e `02` ok (14 + 31).

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat(db): registrazione alla serata, PIN baristi e bruciatura atomica del coupon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Viste admin, unione dei doppioni, pulizia GDPR e tipi TypeScript

**Files:**
- Create: `supabase/migrations/20260930120200_customer_functions.sql`, `lib/supabase/database.types.ts` (generato)
- Test: `supabase/tests/database/03_customers.test.sql`

**Interfaces:**
- Consumes: le tabelle di Task 2 e `register_for_event` di Task 3.
- Produces:
  - vista `event_stats(event_id, registrations int, redeemed int)`;
  - vista `customer_overview(id, first_name, last_name, phone_e164, marketing_consent_until, created_at, last_activity_at, events_count int, redeemed_count int)`, che esclude i clienti uniti ad altri;
  - vista `duplicate_candidates(a_id, a_first_name, a_last_name, a_phone, a_created_at, b_id, b_first_name, b_last_name, b_phone, b_created_at)`;
  - `merge_customers(p_keep_id uuid, p_drop_id uuid) returns void`, per `authenticated` admin;
  - `purge_inactive_customers() returns int`, solo per il job `pg_cron` `purge-inactive-customers`;
  - tipo TS `Database` in `lib/supabase/database.types.ts`.

- [ ] **Step 1: Scrivi il test che fallisce.** `supabase/tests/database/03_customers.test.sql`:

```sql
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
```

- [ ] **Step 2: Esegui il test.** `npm run test:db`. Atteso: FAIL su `03_customers`.

- [ ] **Step 3: Migrazione.** `supabase/migrations/20260930120200_customer_functions.sql`:

```sql
create or replace view public.event_stats with (security_invoker = true) as
select e.id as event_id,
       count(r.id)::int as registrations,
       count(r.redeemed_at)::int as redeemed
  from public.events e
  left join public.registrations r on r.event_id = e.id
 group by e.id;

create or replace view public.customer_overview with (security_invoker = true) as
select c.id, c.first_name, c.last_name, c.phone_e164, c.marketing_consent_until,
       c.created_at, c.last_activity_at,
       count(r.id)::int as events_count,
       count(r.redeemed_at)::int as redeemed_count
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
```

- [ ] **Step 4: Applica ed esegui il test.** `npm run db:reset && npm run test:db`. Atteso: `01`, `02` e `03` ok.

- [ ] **Step 5: Genera i tipi.** `npm run db:types`. Controlla che `lib/supabase/database.types.ts` inizi con `export type Json` e contenga `register_for_event` e `customer_overview`.

- [ ] **Step 6: Commit**

```bash
git add supabase lib/supabase/database.types.ts
git commit -m "feat(db): viste admin, unione doppioni, pulizia GDPR e tipi generati

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Client Supabase, login admin, protezione `/admin` e Playwright

**Files:**
- Create: `lib/env.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/proxy.ts`, `proxy.ts`, `lib/auth.ts`, `scripts/create-admin.ts`, `app/admin/login/{page.tsx,login-form.tsx,actions.ts}`, `app/admin/(dashboard)/{layout.tsx,page.tsx,error.tsx}`, `playwright.config.ts`, `e2e/global-setup.ts`, `e2e/helpers.ts`
- Test: `e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `Database` (Task 4), `FieldError` (Task 1).
- Produces:
  - `env(name: EnvName): string`;
  - `createClient(): Promise<SupabaseClient<Database>>` (sessione utente, `lib/supabase/server.ts`);
  - `createAdminClient(): SupabaseClient<Database>` (secret key, solo server);
  - `requireAdmin(): Promise<SupabaseClient<Database>>`, che reindirizza a `/admin/login` se l'utente non è admin;
  - `ensureAdmin(url, secretKey, email, password): Promise<string>`;
  - le server action `login` e `logout`;
  - negli helper e2e: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `loginAsAdmin(page)`.

- [ ] **Step 1: Env e client.** `lib/env.ts`:

```ts
type EnvName =
  | 'NEXT_PUBLIC_SUPABASE_URL'
  | 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
  | 'SUPABASE_SECRET_KEY'
  | 'NEXT_PUBLIC_TURNSTILE_SITEKEY'
  | 'TURNSTILE_SECRET'
  | 'IP_HASH_SALT';

// Solo lato server: l'accesso dinamico non viene inlinato nel bundle client.
export function env(name: EnvName): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}`);
  return value;
}
```

`lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import type { Database } from './database.types';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chiamato da un Server Component: il refresh della sessione lo fa proxy.ts
        }
      },
    },
  });
}
```

`lib/supabase/admin.ts`:

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from './database.types';

export function createAdminClient() {
  return createClient<Database>(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

`lib/supabase/proxy.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname !== '/admin/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}
```

`proxy.ts` (root; in Next 16 sostituisce `middleware.ts`):

```ts
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = { matcher: ['/admin/:path*'] };
```

`lib/auth.ts`:

```ts
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) redirect('/admin/login?error=forbidden');
  return supabase;
}
```

- [ ] **Step 2: Script per creare l'admin.** `scripts/create-admin.ts` (si esegue direttamente con Node 24, che rimuove i tipi TS; per questo niente sintassi TS non cancellabile):

```ts
import { createClient } from '@supabase/supabase-js';

export async function ensureAdmin(url: string, secretKey: string, email: string, password: string): Promise<string> {
  const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;

  let userId = list.users.find((u) => u.email === email)?.id;
  if (userId) {
    const { error } = await supabase.auth.admin.updateUserById(userId, { password });
    if (error) throw error;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  }

  const { error: adminError } = await supabase.from('admins').upsert({ user_id: userId });
  if (adminError) throw adminError;
  return userId;
}

if (process.argv[1]?.endsWith('create-admin.ts')) {
  const [email, password] = process.argv.slice(2);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!email || !password || password.length < 12 || !url || !key) {
    console.error('Uso: npm run admin:create -- <email> <password di almeno 12 caratteri> (servono le env Supabase)');
    process.exit(1);
  }
  ensureAdmin(url, key, email, password)
    .then((id) => console.log(`Admin pronto: ${email} (${id})`))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
```

Esegui `npm run admin:create -- tua@email.it unaPasswordLunga123`. Atteso: `Admin pronto: ...`.

- [ ] **Step 3: Setup Playwright.** `npx playwright install chromium`. Crea `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

process.loadEnvFile('.env.local');

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:3000', locale: 'it-IT', timezoneId: 'Europe/Rome', trace: 'retain-on-failure' },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120_000 },
});
```

`e2e/helpers.ts`:

```ts
import { expect, type Page } from '@playwright/test';

export const ADMIN_EMAIL = 'e2e-admin@example.test';
export const ADMIN_PASSWORD = 'e2e-password-1234';

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}
```

`e2e/global-setup.ts`:

```ts
import { ensureAdmin } from '../scripts/create-admin';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers';

export default async function globalSetup() {
  await ensureAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, ADMIN_EMAIL, ADMIN_PASSWORD);
}
```

- [ ] **Step 4: Scrivi il test che fallisce.** `e2e/auth.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, loginAsAdmin } from './helpers';

test('le pagine admin richiedono il login', async ({ page }) => {
  await page.goto('/admin/eventi');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('password errata mostra un errore', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill('password-sbagliata');
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page.getByText('Email o password non corretti')).toBeVisible();
});

test("login corretto e logout", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole('button', { name: 'Esci' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});
```

- [ ] **Step 5: Esegui il test.** `npm run test:e2e -- auth.spec.ts`. Atteso: FAIL (la pagina `/admin/login` non esiste).

- [ ] **Step 6: Pagine login.** `app/admin/login/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });
  if (error) return { error: 'Email o password non corretti' };
  redirect('/admin');
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
```

`app/admin/login/login-form.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { FieldError } from '@/components/field-error';
import { login, type LoginState } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <FieldError message={state.error} />
      <button className="btn btn-primary w-full" disabled={pending}>Accedi</button>
    </form>
  );
}
```

`app/admin/login/page.tsx`:

```tsx
import { LoginForm } from './login-form';

export const metadata = { title: 'Accesso' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">Area riservata</h1>
      {error === 'forbidden' && <p className="field-error mb-4">Questo account non è abilitato.</p>}
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 7: Layout admin.** `app/admin/(dashboard)/layout.tsx`:

```tsx
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { logout } from '@/app/admin/login/actions';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/eventi', label: 'Serate' },
  { href: '/admin/clienti', label: 'Clienti' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="font-semibold hover:text-accent">
              {item.label}
            </Link>
          ))}
          <form action={logout} className="ml-auto">
            <button className="text-sm text-muted hover:text-text">Esci</button>
          </form>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
```

`app/admin/(dashboard)/page.tsx` (la versione con le statistiche arriva in Task 9):

```tsx
export default function DashboardPage() {
  return <h1 className="text-2xl font-bold">Dashboard</h1>;
}
```

`app/admin/(dashboard)/error.tsx`:

```tsx
'use client';

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card space-y-3">
      <p className="font-bold">Qualcosa è andato storto</p>
      <p className="text-sm text-muted">{error.message}</p>
      <button className="btn btn-secondary" onClick={reset}>Riprova</button>
    </div>
  );
}
```

- [ ] **Step 8: Esegui il test.** `npm run test:e2e -- auth.spec.ts`. Atteso: 3 PASS. Poi `npm run lint && npm run typecheck`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(admin): login PR con Supabase Auth, proxy di protezione e setup Playwright

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Gestione serate in admin (crea, modifica, stato, PIN, QR)

**Files:**
- Create: `lib/dates.ts`, `lib/slug.ts`, `lib/event-form.ts`, `lib/event-status.ts`, `lib/qr.ts`, `components/copy-button.tsx`, `app/admin/(dashboard)/eventi/{page.tsx,actions.ts,event-form.tsx}`, `app/admin/(dashboard)/eventi/nuova/page.tsx`, `app/admin/(dashboard)/eventi/[id]/page.tsx`, `app/admin/(dashboard)/eventi/[id]/qr/route.ts`
- Modify: `e2e/helpers.ts` (aggiunge `romeInput` e `createLiveEvent`)
- Test: `lib/dates.test.ts`, `lib/slug.test.ts`, `lib/event-form.test.ts`, `lib/qr.test.ts`, `e2e/events.spec.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `siteUrl`, `FieldError`, la RPC `admin_set_event_pin`, la vista `event_stats`.
- Produces:
  - in `lib/dates.ts`: `TIME_ZONE`, `romeLocalToUtcIso(local: string): string`, `utcToRomeLocalInput(iso: string): string`, `formatRome(iso: string, pattern?: string): string`;
  - in `lib/slug.ts`: `slugify`, `randomSuffix`, `makeEventSlug(title, suffix?)`;
  - in `lib/event-form.ts`: `parseEventForm(formData, { pinRequired }): EventFormResult`;
  - in `lib/event-status.ts`: `EVENT_STATUSES`, `EventStatus`, `STATUS_LABEL`, `STATUS_ACTION_LABEL`, `isEventStatus`;
  - in `lib/qr.ts`: `qrSvg(text): Promise<string>`, `qrPng(text): Promise<Buffer>`;
  - `CopyButton({ text, label? })`;
  - negli helper e2e: `romeInput(offsetMs)`, `createLiveEvent(page, { title, pin }): Promise<CreatedEvent>`.
  - Il dettaglio serata espone `data-testid` `event-status`, `public-url` e `staff-url`.

- [ ] **Step 1: Scrivi i test che falliscono.** `lib/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatRome, romeLocalToUtcIso, utcToRomeLocalInput } from './dates';

describe('date Europe/Rome', () => {
  it('converte ora legale (UTC+2)', () => {
    expect(romeLocalToUtcIso('2026-07-10T23:00')).toBe('2026-07-10T21:00:00.000Z');
  });
  it('converte ora solare (UTC+1)', () => {
    expect(romeLocalToUtcIso('2026-12-10T23:00')).toBe('2026-12-10T22:00:00.000Z');
  });
  it('gestisce la notte del cambio ora (25/10/2026)', () => {
    expect(romeLocalToUtcIso('2026-10-24T23:00')).toBe('2026-10-24T21:00:00.000Z');
    expect(romeLocalToUtcIso('2026-10-25T04:00')).toBe('2026-10-25T03:00:00.000Z');
  });
  it('rifiuta input non validi', () => {
    expect(() => romeLocalToUtcIso('boh')).toThrow();
  });
  it('riconverte per gli input datetime-local', () => {
    expect(utcToRomeLocalInput('2026-07-10T21:00:00.000Z')).toBe('2026-07-10T23:00');
  });
  it('formatta a cavallo di capodanno', () => {
    expect(formatRome('2026-12-31T23:30:00Z')).toBe('01/01/2027 00:30');
  });
});
```

`lib/slug.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEventSlug, randomSuffix, slugify } from './slug';

describe('slug', () => {
  it('toglie accenti e simboli', () => {
    expect(slugify('Notte Città — Latina!')).toBe('notte-citta-latina');
  });
  it('restituisce stringa vuota per soli spazi', () => {
    expect(slugify('   ')).toBe('');
  });
  it('tronca a 40 caratteri senza trattino finale', () => {
    const s = slugify('a'.repeat(39) + ' bbbbbb');
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith('-')).toBe(false);
  });
  it('aggiunge il suffisso', () => {
    expect(makeEventSlug('Sabato Latino', 'ab12')).toBe('sabato-latino-ab12');
  });
  it('usa "serata" se il titolo non ha caratteri validi', () => {
    expect(makeEventSlug('!!!', 'ab12')).toBe('serata-ab12');
  });
  it('suffisso casuale di 4 caratteri sicuri', () => {
    expect(randomSuffix()).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{4}$/);
  });
});
```

`lib/event-form.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseEventForm } from './event-form';

function form(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const values = {
    title: 'Sabato Latino',
    venue_name: 'Bar Centrale',
    starts_at: '2026-10-24T23:00',
    ends_at: '2026-10-25T04:00',
    coupon_title: 'Drink a 5€',
    coupon_description: '',
    pin: '1234',
    ...overrides,
  };
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe('parseEventForm', () => {
  it('accetta una serata che finisce dopo mezzanotte e converte in UTC', () => {
    const r = parseEventForm(form(), { pinRequired: true });
    expect(r).toEqual({
      ok: true,
      data: {
        title: 'Sabato Latino',
        venue_name: 'Bar Centrale',
        starts_at: '2026-10-24T21:00:00.000Z',
        ends_at: '2026-10-25T03:00:00.000Z',
        coupon_title: 'Drink a 5€',
        coupon_description: '',
        pin: '1234',
      },
    });
  });
  it('segnala il titolo mancante', () => {
    const r = parseEventForm(form({ title: '  ' }), { pinRequired: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.title).toBe('Titolo obbligatorio');
  });
  it('rifiuta una fine precedente all\'inizio', () => {
    const r = parseEventForm(form({ ends_at: '2026-10-24T22:00' }), { pinRequired: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.ends_at).toBe("La fine deve essere dopo l'inizio");
  });
  it('richiede il PIN in creazione', () => {
    const r = parseEventForm(form({ pin: '' }), { pinRequired: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.pin).toBe('PIN obbligatorio');
  });
  it('rifiuta PIN non numerici', () => {
    const r = parseEventForm(form({ pin: 'abc' }), { pinRequired: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.pin).toBe('Il PIN deve avere da 4 a 8 cifre');
  });
  it('PIN vuoto in modifica significa invariato', () => {
    const r = parseEventForm(form({ pin: '' }), { pinRequired: false });
    expect(r.ok && r.data.pin).toBe(null);
  });
});
```

`lib/qr.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { qrPng, qrSvg } from './qr';

describe('qr', () => {
  it('genera un SVG', async () => {
    expect((await qrSvg('https://example.it/e/x')).trim().startsWith('<svg')).toBe(true);
  });
  it('genera un PNG', async () => {
    const png = await qrPng('https://example.it/e/x');
    expect(png.subarray(0, 4).toString('hex')).toBe('89504e47');
  });
});
```

- [ ] **Step 2: Esegui i test.** `npm test`. Atteso: FAIL (i moduli non esistono).

- [ ] **Step 3: Implementa le librerie.** `lib/dates.ts`:

```ts
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const TIME_ZONE = 'Europe/Rome';

export function romeLocalToUtcIso(local: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('Data non valida');
  return fromZonedTime(local, TIME_ZONE).toISOString();
}

export function utcToRomeLocalInput(iso: string): string {
  return formatInTimeZone(iso, TIME_ZONE, "yyyy-MM-dd'T'HH:mm");
}

export function formatRome(iso: string, pattern = 'dd/MM/yyyy HH:mm'): string {
  return formatInTimeZone(iso, TIME_ZONE, pattern);
}
```

`lib/slug.ts`:

```ts
const SUFFIX_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export function randomSuffix(length = 4): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => SUFFIX_ALPHABET[b % SUFFIX_ALPHABET.length]).join('');
}

export function makeEventSlug(title: string, suffix = randomSuffix()): string {
  return `${slugify(title) || 'serata'}-${suffix}`;
}
```

`lib/event-form.ts`:

```ts
import { z } from 'zod';
import { romeLocalToUtcIso } from '@/lib/dates';

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Data e ora obbligatorie');

const schema = z.object({
  title: z.string().trim().min(1, 'Titolo obbligatorio').max(120, 'Massimo 120 caratteri'),
  venue_name: z.string().trim().min(1, 'Locale obbligatorio').max(120, 'Massimo 120 caratteri'),
  starts_at: localDateTime,
  ends_at: localDateTime,
  coupon_title: z.string().trim().min(1, 'Titolo coupon obbligatorio').max(120, 'Massimo 120 caratteri'),
  coupon_description: z.string().trim().max(1000, 'Massimo 1000 caratteri'),
  pin: z.string().trim(),
});

const FIELDS = ['title', 'venue_name', 'starts_at', 'ends_at', 'coupon_title', 'coupon_description', 'pin'] as const;

export type EventInput = {
  title: string;
  venue_name: string;
  starts_at: string;
  ends_at: string;
  coupon_title: string;
  coupon_description: string;
  pin: string | null;
};

export type EventFormResult = { ok: true; data: EventInput } | { ok: false; errors: Record<string, string> };

export function parseEventForm(formData: FormData, { pinRequired }: { pinRequired: boolean }): EventFormResult {
  const raw = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? '')]));
  const parsed = schema.safeParse(raw);
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { ok: false, errors };
  }
  const d = parsed.data;
  if (d.pin === '' && pinRequired) errors.pin = 'PIN obbligatorio';
  if (d.pin !== '' && !/^\d{4,8}$/.test(d.pin)) errors.pin = 'Il PIN deve avere da 4 a 8 cifre';
  const startsAt = romeLocalToUtcIso(d.starts_at);
  const endsAt = romeLocalToUtcIso(d.ends_at);
  if (Date.parse(endsAt) <= Date.parse(startsAt)) errors.ends_at = "La fine deve essere dopo l'inizio";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      title: d.title,
      venue_name: d.venue_name,
      starts_at: startsAt,
      ends_at: endsAt,
      coupon_title: d.coupon_title,
      coupon_description: d.coupon_description,
      pin: d.pin === '' ? null : d.pin,
    },
  };
}
```

`lib/qr.ts`:

```ts
import QRCode from 'qrcode';

export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
}

export function qrPng(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { type: 'png', width: 1200, margin: 2, errorCorrectionLevel: 'M' });
}
```

`lib/event-status.ts`:

```ts
export const EVENT_STATUSES = ['draft', 'live', 'closed'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const STATUS_LABEL: Record<EventStatus, string> = { draft: 'Bozza', live: 'Attiva', closed: 'Chiusa' };
export const STATUS_ACTION_LABEL: Record<EventStatus, string> = { draft: 'Rimetti in bozza', live: 'Attiva', closed: 'Chiudi' };

export function isEventStatus(value: string): value is EventStatus {
  return (EVENT_STATUSES as readonly string[]).includes(value);
}
```

- [ ] **Step 4: Esegui i test.** `npm test`. Atteso: tutti PASS.

- [ ] **Step 5: Scrivi l'e2e che fallisce.** Aggiungi in fondo a `e2e/helpers.ts`:

```ts
import { formatInTimeZone } from 'date-fns-tz';

export function romeInput(offsetMs: number): string {
  return formatInTimeZone(new Date(Date.now() + offsetMs), 'Europe/Rome', "yyyy-MM-dd'T'HH:mm");
}

export type CreatedEvent = { id: string; title: string; publicPath: string; staffPath: string };

export async function createLiveEvent(page: Page, { title, pin }: { title: string; pin: string }): Promise<CreatedEvent> {
  await page.goto('/admin/eventi/nuova');
  await page.getByLabel('Titolo serata').fill(title);
  await page.getByLabel('Locale').fill('Bar Test');
  await page.getByLabel('Inizio').fill(romeInput(-60 * 60 * 1000));
  await page.getByLabel('Fine').fill(romeInput(4 * 60 * 60 * 1000));
  await page.getByLabel('Titolo coupon').fill('Drink a 5€');
  await page.getByLabel('Descrizione coupon').fill('Valido per un drink');
  await page.getByLabel('PIN baristi', { exact: true }).fill(pin);
  await page.getByRole('button', { name: 'Crea serata' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await page.getByRole('button', { name: 'Attiva', exact: true }).click();
  await expect(page.getByTestId('event-status')).toHaveText('Attiva');
  const id = page.url().split('/').pop()!;
  const publicPath = new URL(await page.getByTestId('public-url').innerText()).pathname;
  const staffPath = new URL(await page.getByTestId('staff-url').innerText()).pathname;
  return { id, title, publicPath, staffPath };
}
```

Sposta l'`import { formatInTimeZone }` in cima al file, insieme agli altri import.

`e2e/events.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { createLiveEvent, loginAsAdmin } from './helpers';

test('il PR crea una serata, la attiva e scarica il QR', async ({ page }) => {
  await loginAsAdmin(page);
  const event = await createLiveEvent(page, { title: `Serata ${Date.now()}`, pin: '4321' });
  expect(event.publicPath).toMatch(/^\/e\/serata-\d+-[a-z2-9]{4}$/);
  expect(event.staffPath).toMatch(/^\/v\/[A-Za-z0-9_-]{22}$/);

  const png = await page.request.get(`/admin/eventi/${event.id}/qr?format=png`);
  expect(png.status()).toBe(200);
  expect(png.headers()['content-type']).toBe('image/png');

  await page.goto('/admin/eventi');
  await expect(page.getByText(event.title)).toBeVisible();
});

test('il form mostra gli errori di validazione', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/eventi/nuova');
  await page.getByRole('button', { name: 'Crea serata' }).click();
  await expect(page.getByText('Titolo obbligatorio')).toBeVisible();
  await expect(page.getByText('Data e ora obbligatorie').first()).toBeVisible();
});
```

- [ ] **Step 6: Esegui l'e2e.** `npm run test:e2e -- events.spec.ts`. Atteso: FAIL (le pagine non esistono).

- [ ] **Step 7: Server actions.** `app/admin/(dashboard)/eventi/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { parseEventForm } from '@/lib/event-form';
import { isEventStatus } from '@/lib/event-status';
import { makeEventSlug } from '@/lib/slug';

export type EventFormState = { errors: Record<string, string>; values?: Record<string, string>; saved?: boolean };

function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !key.startsWith('$') && key !== 'pin') values[key] = value;
  }
  return values;
}

export async function createEvent(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const supabase = await requireAdmin();
  const parsed = parseEventForm(formData, { pinRequired: true });
  if (!parsed.ok) return { errors: parsed.errors, values: formValues(formData) };
  const { pin, ...fields } = parsed.data;

  const { data: event, error } = await supabase
    .from('events')
    .insert({ ...fields, slug: makeEventSlug(fields.title) })
    .select('id')
    .single();
  if (error || !event) return { errors: { form: 'Errore nel salvataggio, riprova' }, values: formValues(formData) };

  const { error: pinError } = await supabase.rpc('admin_set_event_pin', { p_event_id: event.id, p_pin: pin! });
  if (pinError) return { errors: { pin: 'PIN non salvato: impostalo dalla pagina della serata' }, values: formValues(formData) };

  revalidatePath('/admin/eventi');
  redirect(`/admin/eventi/${event.id}`);
}

export async function updateEvent(eventId: string, _prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const supabase = await requireAdmin();
  const parsed = parseEventForm(formData, { pinRequired: false });
  if (!parsed.ok) return { errors: parsed.errors, values: formValues(formData) };
  const { pin, ...fields } = parsed.data;

  const { error } = await supabase.from('events').update(fields).eq('id', eventId);
  if (error) return { errors: { form: 'Errore nel salvataggio, riprova' }, values: formValues(formData) };
  if (pin) {
    const { error: pinError } = await supabase.rpc('admin_set_event_pin', { p_event_id: eventId, p_pin: pin });
    if (pinError) return { errors: { pin: 'PIN non salvato, riprova' }, values: formValues(formData) };
  }
  revalidatePath(`/admin/eventi/${eventId}`);
  return { errors: {}, values: formValues(formData), saved: true };
}

export async function setEventStatus(eventId: string, status: string): Promise<void> {
  const supabase = await requireAdmin();
  if (!isEventStatus(status)) throw new Error('Stato non valido');
  const { error } = await supabase.from('events').update({ status }).eq('id', eventId);
  if (error) throw new Error('Cambio stato non riuscito');
  revalidatePath(`/admin/eventi/${eventId}`);
  revalidatePath('/admin/eventi');
}
```

- [ ] **Step 8: Form e pagine.** `components/copy-button.tsx`:

```tsx
'use client';

import { useState } from 'react';

export function CopyButton({ text, label = 'Copia' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copiato ✓' : label}
    </button>
  );
}
```

`app/admin/(dashboard)/eventi/event-form.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { FieldError } from '@/components/field-error';
import type { EventFormState } from './actions';

type Field = 'title' | 'venue_name' | 'starts_at' | 'ends_at' | 'coupon_title' | 'coupon_description';

function TextField({ name, label, type = 'text', defaultValue, error }: {
  name: string; label: string; type?: string; defaultValue: string; error?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} className="input" defaultValue={defaultValue} />
      <FieldError message={error} />
    </div>
  );
}

export function EventForm({ action, defaults = {}, pinRequired, submitLabel }: {
  action: (state: EventFormState, formData: FormData) => Promise<EventFormState>;
  defaults?: Partial<Record<Field, string>>;
  pinRequired: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { errors: {} });
  const value = (field: Field) => state.values?.[field] ?? defaults[field] ?? '';
  return (
    <form action={formAction} className="card max-w-xl space-y-4">
      <TextField name="title" label="Titolo serata" defaultValue={value('title')} error={state.errors.title} />
      <TextField name="venue_name" label="Locale" defaultValue={value('venue_name')} error={state.errors.venue_name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="starts_at" label="Inizio" type="datetime-local" defaultValue={value('starts_at')} error={state.errors.starts_at} />
        <TextField name="ends_at" label="Fine" type="datetime-local" defaultValue={value('ends_at')} error={state.errors.ends_at} />
      </div>
      <TextField name="coupon_title" label="Titolo coupon" defaultValue={value('coupon_title')} error={state.errors.coupon_title} />
      <div>
        <label className="label" htmlFor="coupon_description">Descrizione coupon</label>
        <textarea id="coupon_description" name="coupon_description" rows={3} className="input" defaultValue={value('coupon_description')} />
        <FieldError message={state.errors.coupon_description} />
      </div>
      <div>
        <label className="label" htmlFor="pin">{pinRequired ? 'PIN baristi' : 'Nuovo PIN baristi (vuoto = invariato)'}</label>
        <input id="pin" name="pin" inputMode="numeric" autoComplete="off" className="input" />
        <FieldError message={state.errors.pin} />
      </div>
      <FieldError message={state.errors.form} />
      {state.saved && <p className="text-ok">Salvato ✓</p>}
      <button className="btn btn-primary" disabled={pending}>{submitLabel}</button>
    </form>
  );
}
```

`app/admin/(dashboard)/eventi/nuova/page.tsx`:

```tsx
import { createEvent } from '../actions';
import { EventForm } from '../event-form';

export default function NewEventPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nuova serata</h1>
      <EventForm action={createEvent} pinRequired submitLabel="Crea serata" />
    </div>
  );
}
```

`app/admin/(dashboard)/eventi/page.tsx`:

```tsx
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { formatRome } from '@/lib/dates';
import { STATUS_LABEL, type EventStatus } from '@/lib/event-status';

export default async function EventsPage() {
  const supabase = await requireAdmin();
  const [{ data: events }, { data: stats }] = await Promise.all([
    supabase.from('events').select('id, title, venue_name, starts_at, status').order('starts_at', { ascending: false }),
    supabase.from('event_stats').select('event_id, registrations, redeemed'),
  ]);
  const statsById = new Map((stats ?? []).map((s) => [s.event_id, s]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Serate</h1>
        <Link href="/admin/eventi/nuova" className="btn btn-primary">Nuova serata</Link>
      </div>
      {events?.length ? (
        <ul className="space-y-2">
          {events.map((e) => {
            const s = statsById.get(e.id);
            return (
              <li key={e.id}>
                <Link href={`/admin/eventi/${e.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-accent">
                  <span>
                    <b>{e.title}</b> <span className="text-muted">· {e.venue_name} · {formatRome(e.starts_at)}</span>
                  </span>
                  <span className="text-sm">
                    {STATUS_LABEL[e.status as EventStatus]} · {s?.registrations ?? 0} registrati · {s?.redeemed ?? 0} usati
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted">Nessuna serata ancora.</p>
      )}
    </div>
  );
}
```

`app/admin/(dashboard)/eventi/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { CopyButton } from '@/components/copy-button';
import { requireAdmin } from '@/lib/auth';
import { formatRome, utcToRomeLocalInput } from '@/lib/dates';
import { EVENT_STATUSES, STATUS_ACTION_LABEL, STATUS_LABEL, type EventStatus } from '@/lib/event-status';
import { qrSvg } from '@/lib/qr';
import { siteUrl } from '@/lib/site';
import { setEventStatus, updateEvent } from '../actions';
import { EventForm } from '../event-form';

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await requireAdmin();
  const { data: event } = await supabase
    .from('events')
    .select('id, slug, title, venue_name, starts_at, ends_at, coupon_title, coupon_description, staff_token, status')
    .eq('id', id)
    .maybeSingle();
  if (!event) notFound();

  const [{ data: stats }, { data: registrations }] = await Promise.all([
    supabase.from('event_stats').select('registrations, redeemed').eq('event_id', id).maybeSingle(),
    supabase
      .from('registrations')
      .select('id, coupon_code, redeemed_at, created_at, customers(first_name, last_name, phone_e164)')
      .eq('event_id', id)
      .order('created_at', { ascending: false }),
  ]);

  const publicUrl = siteUrl(`/e/${event.slug}`);
  const staffUrl = siteUrl(`/v/${event.staff_token}`);
  const qr = await qrSvg(publicUrl);
  const status = event.status as EventStatus;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <span data-testid="event-status" className="rounded-full border border-border px-3 py-1 text-sm">{STATUS_LABEL[status]}</span>
      </header>
      <p className="text-muted">{event.venue_name} · {formatRome(event.starts_at)} → {formatRome(event.ends_at)}</p>

      <div className="flex flex-wrap gap-2">
        {EVENT_STATUSES.filter((s) => s !== status).map((s) => (
          <form key={s} action={setEventStatus.bind(null, event.id, s)}>
            <button className="btn btn-secondary">{STATUS_ACTION_LABEL[s]}</button>
          </form>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="font-bold">QR per i clienti</h2>
          <div className="w-48 rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} />
          <code data-testid="public-url" className="block break-all text-sm">{publicUrl}</code>
          <div className="flex flex-wrap gap-2">
            <a className="btn btn-secondary" href={`/admin/eventi/${event.id}/qr?format=png`}>Scarica PNG</a>
            <a className="btn btn-secondary" href={`/admin/eventi/${event.id}/qr?format=svg`}>Scarica SVG</a>
            <CopyButton text={publicUrl} label="Copia link" />
          </div>
        </div>
        <div className="card space-y-3">
          <h2 className="font-bold">Link per i baristi</h2>
          <p className="text-sm text-muted">Apri questo link sul telefono del bar e inserisci il PIN.</p>
          <code data-testid="staff-url" className="block break-all text-sm">{staffUrl}</code>
          <CopyButton text={staffUrl} label="Copia link staff" />
          <p className="text-lg">
            Registrati: <b>{stats?.registrations ?? 0}</b> · Usati: <b>{stats?.redeemed ?? 0}</b>
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">Modifica serata</h2>
        <EventForm
          action={updateEvent.bind(null, event.id)}
          pinRequired={false}
          submitLabel="Salva modifiche"
          defaults={{
            title: event.title,
            venue_name: event.venue_name,
            starts_at: utcToRomeLocalInput(event.starts_at),
            ends_at: utcToRomeLocalInput(event.ends_at),
            coupon_title: event.coupon_title,
            coupon_description: event.coupon_description,
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">Registrazioni</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr><th className="py-2">Nome</th><th>Telefono</th><th>Codice</th><th>Usato</th></tr>
            </thead>
            <tbody>
              {(registrations ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2">{r.customers?.first_name} {r.customers?.last_name}</td>
                  <td>{r.customers?.phone_e164 ?? '—'}</td>
                  <td className="font-mono">{r.coupon_code}</td>
                  <td>{r.redeemed_at ? formatRome(r.redeemed_at, 'HH:mm') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

`app/admin/(dashboard)/eventi/[id]/qr/route.ts`:

```ts
import { requireAdmin } from '@/lib/auth';
import { qrPng, qrSvg } from '@/lib/qr';
import { siteUrl } from '@/lib/site';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await requireAdmin();
  const { data: event } = await supabase.from('events').select('slug').eq('id', id).maybeSingle();
  if (!event) return new Response('Serata non trovata', { status: 404 });

  const url = siteUrl(`/e/${event.slug}`);
  if (new URL(request.url).searchParams.get('format') === 'svg') {
    return new Response(await qrSvg(url), {
      headers: { 'Content-Type': 'image/svg+xml', 'Content-Disposition': `attachment; filename="qr-${event.slug}.svg"` },
    });
  }
  return new Response(new Uint8Array(await qrPng(url)), {
    headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="qr-${event.slug}.png"` },
  });
}
```

- [ ] **Step 9: Esegui i test.** `npm test && npm run test:e2e -- events.spec.ts`. Atteso: tutti PASS. Poi `npm run lint && npm run typecheck`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(admin): gestione serate con QR, link staff, PIN e stato

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Registrazione del cliente (`/e/[slug]`), coupon (`/c/[token]`) e informativa

**Files:**
- Create: `lib/phone.ts`, `lib/ip.ts`, `lib/turnstile.ts`, `lib/registration.ts`, `lib/event-window.ts`, `lib/privacy.ts`, `lib/device.ts`, `app/e/[slug]/{page.tsx,register-form.tsx,actions.ts}`, `app/c/[token]/page.tsx`, `app/privacy/page.tsx`
- Modify: `e2e/helpers.ts` (aggiunge `registerCustomer`)
- Test: `lib/phone.test.ts`, `lib/ip.test.ts`, `lib/turnstile.test.ts`, `lib/registration.test.ts`, `lib/event-window.test.ts`, `e2e/registration.spec.ts`

**Interfaces:**
- Consumes: la RPC `register_for_event`, `createAdminClient`, `env`, `qrSvg`, `siteUrl`, `formatRome`.
- Produces:
  - in `lib/phone.ts`: `normalizePhone(input): { ok: true; value: string | null } | { ok: false }`;
  - in `lib/ip.ts`: `getClientIp(headers): string | null`, `hashIp(ip, salt): string`;
  - in `lib/turnstile.ts`: `verifyTurnstile(token, secret, ip, fetchImpl?): Promise<boolean>`;
  - in `lib/registration.ts`: `parseRegistration(formData): RegistrationParse`;
  - in `lib/event-window.ts`: `isRegistrationOpen(event, now)`, `couponStatus(redeemedAt, endsAt, now): 'valid' | 'redeemed' | 'expired'`, `REDEEM_GRACE_MS`;
  - in `lib/privacy.ts`: `PRIVACY_VERSION = 'v1'`, `DATA_CONTROLLER`;
  - in `lib/device.ts`: `readDeviceId()`, `getOrCreateDeviceId()` (cookie `did`);
  - la pagina coupon espone `data-testid` `coupon-code` e `coupon-status`;
  - il QR del coupon punta a `/v/scan?code=CODICE` (pagina creata in Task 8);
  - negli helper e2e: `registerCustomer(page, publicPath, { firstName, lastName, phone? }): Promise<string>`, che restituisce il codice.

- [ ] **Step 1: Scrivi i test che falliscono.** `lib/phone.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('numero italiano senza prefisso', () => {
    expect(normalizePhone('333 123 4567')).toEqual({ ok: true, value: '+393331234567' });
  });
  it('stesso numero con +39 dà lo stesso risultato', () => {
    expect(normalizePhone('+39 333 1234567')).toEqual({ ok: true, value: '+393331234567' });
  });
  it('numero estero', () => {
    expect(normalizePhone('+44 7911 123456')).toEqual({ ok: true, value: '+447911123456' });
  });
  it('vuoto = nessun telefono', () => {
    expect(normalizePhone('  ')).toEqual({ ok: true, value: null });
  });
  it('rifiuta numeri non validi', () => {
    expect(normalizePhone('123')).toEqual({ ok: false });
    expect(normalizePhone('ciao')).toEqual({ ok: false });
  });
});
```

`lib/ip.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getClientIp, hashIp } from './ip';

describe('ip', () => {
  it('preferisce l\'header di Netlify', () => {
    const h = new Headers({ 'x-nf-client-connection-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' });
    expect(getClientIp(h)).toBe('1.2.3.4');
  });
  it('usa il primo IP di x-forwarded-for', () => {
    expect(getClientIp(new Headers({ 'x-forwarded-for': '5.6.7.8, 10.0.0.1' }))).toBe('5.6.7.8');
  });
  it('null senza header', () => {
    expect(getClientIp(new Headers())).toBeNull();
  });
  it('hash stabile, salato, non reversibile', () => {
    expect(hashIp('1.2.3.4', 'sale')).toBe(hashIp('1.2.3.4', 'sale'));
    expect(hashIp('1.2.3.4', 'sale')).not.toBe(hashIp('1.2.3.4', 'altro'));
    expect(hashIp('1.2.3.4', 'sale')).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

`lib/turnstile.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { verifyTurnstile } from './turnstile';

const reply = (body: unknown, ok = true) => vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 }));

describe('verifyTurnstile', () => {
  it('true se Cloudflare conferma', async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile('tok', 'sec', '1.2.3.4', f)).toBe(true);
    const body = (f.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams;
    expect(body.get('remoteip')).toBe('1.2.3.4');
  });
  it('false se Cloudflare rifiuta', async () => {
    expect(await verifyTurnstile('tok', 'sec', null, reply({ success: false }))).toBe(false);
  });
  it('false senza token, senza chiamare Cloudflare', async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile('', 'sec', null, f)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it('false su errore di rete', async () => {
    const f = vi.fn(async () => { throw new Error('rete'); });
    expect(await verifyTurnstile('tok', 'sec', null, f)).toBe(false);
  });
});
```

`lib/registration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseRegistration } from './registration';

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const valid = { first_name: " D'Angelo ", last_name: 'Niccolò', phone: '', consent_privacy: 'on', consent_coupon: 'on' };

describe('parseRegistration', () => {
  it('accetta nomi con apostrofi e accenti, senza telefono', () => {
    expect(parseRegistration(form(valid))).toEqual({
      ok: true,
      data: { firstName: "D'Angelo", lastName: 'Niccolò', phone: null, consentMarketing: false },
    });
  });
  it('normalizza il telefono e legge il consenso offerte', () => {
    const r = parseRegistration(form({ ...valid, phone: '333 1234567', consent_marketing: 'on' }));
    expect(r.ok && r.data.phone).toBe('+393331234567');
    expect(r.ok && r.data.consentMarketing).toBe(true);
  });
  it('richiede privacy e coupon', () => {
    const r = parseRegistration(form({ first_name: 'A', last_name: 'B', phone: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.consent_privacy).toBe("Devi accettare l'informativa privacy");
      expect(r.errors.consent_coupon).toBe('Devi accettare le condizioni del coupon');
    }
  });
  it('segnala nome vuoto e telefono non valido', () => {
    const r = parseRegistration(form({ ...valid, first_name: ' ', phone: '12' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.first_name).toBe('Inserisci il nome');
      expect(r.errors.phone).toBe('Numero di telefono non valido');
    }
  });
});
```

`lib/event-window.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { couponStatus, isRegistrationOpen } from './event-window';

const event = { status: 'live', starts_at: '2026-10-24T21:00:00Z', ends_at: '2026-10-25T03:00:00Z' };

describe('finestre serata', () => {
  it('registrazioni aperte da 12 ore prima fino alla fine', () => {
    expect(isRegistrationOpen(event, new Date('2026-10-24T09:00:00Z'))).toBe(true);
    expect(isRegistrationOpen(event, new Date('2026-10-24T08:59:00Z'))).toBe(false);
    expect(isRegistrationOpen(event, new Date('2026-10-25T03:01:00Z'))).toBe(false);
  });
  it('chiuse se la serata non è live', () => {
    expect(isRegistrationOpen({ ...event, status: 'closed' }, new Date('2026-10-24T22:00:00Z'))).toBe(false);
  });
  it('stato del coupon', () => {
    expect(couponStatus(null, event.ends_at, new Date('2026-10-25T03:30:00Z'))).toBe('valid');
    expect(couponStatus(null, event.ends_at, new Date('2026-10-25T04:01:00Z'))).toBe('expired');
    expect(couponStatus('2026-10-24T23:00:00Z', event.ends_at, new Date('2026-10-24T23:05:00Z'))).toBe('redeemed');
  });
});
```

- [ ] **Step 2: Esegui i test.** `npm test`. Atteso: FAIL (i moduli non esistono).

- [ ] **Step 3: Implementa le librerie.** `lib/phone.ts`:

```ts
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export type PhoneResult = { ok: true; value: string | null } | { ok: false };

export function normalizePhone(input: string): PhoneResult {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: true, value: null };
  const phone = parsePhoneNumberFromString(trimmed, 'IT');
  if (!phone || !phone.isValid()) return { ok: false };
  return { ok: true, value: phone.number };
}
```

`lib/ip.ts`:

```ts
import { createHash } from 'node:crypto';

export function getClientIp(headers: Headers): string | null {
  const netlify = headers.get('x-nf-client-connection-ip');
  if (netlify) return netlify.trim();
  const forwarded = headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || null;
}

export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}
```

`lib/turnstile.ts`:

```ts
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetchImpl(VERIFY_URL, { method: 'POST', body });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
```

`lib/registration.ts`:

```ts
import { z } from 'zod';
import { normalizePhone } from '@/lib/phone';

const names = z.object({
  first_name: z.string().trim().min(1, 'Inserisci il nome').max(60, 'Nome troppo lungo'),
  last_name: z.string().trim().min(1, 'Inserisci il cognome').max(60, 'Cognome troppo lungo'),
});

export type RegistrationInput = { firstName: string; lastName: string; phone: string | null; consentMarketing: boolean };
export type RegistrationParse = { ok: true; data: RegistrationInput } | { ok: false; errors: Record<string, string> };

export function parseRegistration(formData: FormData): RegistrationParse {
  const errors: Record<string, string> = {};
  const parsed = names.safeParse({
    first_name: String(formData.get('first_name') ?? ''),
    last_name: String(formData.get('last_name') ?? ''),
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
  }
  const phone = normalizePhone(String(formData.get('phone') ?? ''));
  if (!phone.ok) errors.phone = 'Numero di telefono non valido';
  if (formData.get('consent_privacy') !== 'on') errors.consent_privacy = "Devi accettare l'informativa privacy";
  if (formData.get('consent_coupon') !== 'on') errors.consent_coupon = 'Devi accettare le condizioni del coupon';

  if (!parsed.success || !phone.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      firstName: parsed.data.first_name,
      lastName: parsed.data.last_name,
      phone: phone.value,
      consentMarketing: formData.get('consent_marketing') === 'on',
    },
  };
}
```

`lib/event-window.ts` (rispecchia le finestre di Task 3; l'autorità resta il DB):

```ts
export const REGISTRATION_OPENS_BEFORE_MS = 12 * 60 * 60 * 1000;
export const REDEEM_GRACE_MS = 60 * 60 * 1000;

export function isRegistrationOpen(event: { status: string; starts_at: string; ends_at: string }, now: Date): boolean {
  const t = now.getTime();
  return event.status === 'live' && t >= Date.parse(event.starts_at) - REGISTRATION_OPENS_BEFORE_MS && t <= Date.parse(event.ends_at);
}

export type CouponStatus = 'valid' | 'redeemed' | 'expired';

export function couponStatus(redeemedAt: string | null, endsAt: string, now: Date): CouponStatus {
  if (redeemedAt) return 'redeemed';
  if (now.getTime() > Date.parse(endsAt) + REDEEM_GRACE_MS) return 'expired';
  return 'valid';
}
```

`lib/privacy.ts`:

```ts
export const PRIVACY_VERSION = 'v1';

// Da compilare prima del go-live (vedi docs/deploy.md)
export const DATA_CONTROLLER = {
  name: 'Titolare del trattamento (da indicare)',
  email: 'privacy@dominio-da-indicare.it',
};
```

`lib/device.ts`:

```ts
import { cookies } from 'next/headers';

const DEVICE_COOKIE = 'did';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function readDeviceId(): Promise<string | null> {
  const value = (await cookies()).get(DEVICE_COOKIE)?.value;
  return value && UUID_RE.test(value) ? value : null;
}

// Da usare solo in Server Actions o Route Handlers (scrive un cookie)
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await readDeviceId();
  if (existing) return existing;
  const id = crypto.randomUUID();
  (await cookies()).set(DEVICE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}
```

- [ ] **Step 4: Esegui i test.** `npm test`. Atteso: tutti PASS.

- [ ] **Step 5: Scrivi l'e2e che fallisce.** Aggiungi a `e2e/helpers.ts`:

```ts
export async function registerCustomer(
  page: Page,
  publicPath: string,
  { firstName, lastName, phone = '' }: { firstName: string; lastName: string; phone?: string },
): Promise<string> {
  await page.goto(publicPath);
  await page.getByLabel('Nome', { exact: true }).fill(firstName);
  await page.getByLabel('Cognome', { exact: true }).fill(lastName);
  if (phone) await page.getByLabel('Telefono (facoltativo)').fill(phone);
  await page.getByLabel(/informativa privacy/).check();
  await page.getByLabel(/Accetto il coupon/).check();
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Ottieni il coupon' }).click();
  await expect(page).toHaveURL(/\/c\//);
  return (await page.getByTestId('coupon-code').innerText()).trim();
}
```

`e2e/registration.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { createLiveEvent, loginAsAdmin, registerCustomer } from './helpers';

test('il cliente ottiene il coupon e ritrova sempre lo stesso', async ({ browser }) => {
  const admin = await browser.newPage();
  await loginAsAdmin(admin);
  const event = await createLiveEvent(admin, { title: `Registrazione ${Date.now()}`, pin: '1234' });
  const digits = String(Date.now()).slice(-7);

  const customer = await browser.newPage();
  const code = await registerCustomer(customer, event.publicPath, { firstName: 'Mario', lastName: 'Rossi', phone: `333 ${digits}` });
  expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  await expect(customer.getByTestId('coupon-status')).toContainText('Valido');
  const couponUrl = customer.url();

  // stesso dispositivo: il QR riporta al coupon già ottenuto
  await customer.goto(event.publicPath);
  await expect(customer).toHaveURL(couponUrl);

  // browser in-app senza cookie, stesso telefono scritto con +39: stesso coupon
  const inApp = await browser.newPage();
  const again = await registerCustomer(inApp, event.publicPath, { firstName: 'Mario', lastName: 'Rossi', phone: `+39 333${digits}` });
  expect(again).toBe(code);

  // il PR vede la registrazione
  await admin.goto(`/admin/eventi/${event.id}`);
  await expect(admin.getByRole('cell', { name: code })).toBeVisible();
});

test('senza consensi il form mostra gli errori', async ({ browser }) => {
  const admin = await browser.newPage();
  await loginAsAdmin(admin);
  const event = await createLiveEvent(admin, { title: `Consensi ${Date.now()}`, pin: '1234' });

  const page = await browser.newPage();
  await page.goto(event.publicPath);
  await page.getByLabel('Nome', { exact: true }).fill('Anna');
  await page.getByLabel('Cognome', { exact: true }).fill('Verdi');
  await page.getByRole('button', { name: 'Ottieni il coupon' }).click();
  await expect(page.getByText("Devi accettare l'informativa privacy")).toBeVisible();
  await expect(page.getByText('Devi accettare le condizioni del coupon')).toBeVisible();
});

test('slug inesistente: pagina non trovata', async ({ page }) => {
  await page.goto('/e/non-esiste-xyz9');
  await expect(page.getByText('Pagina non trovata')).toBeVisible();
});
```

- [ ] **Step 6: Esegui l'e2e.** `npm run test:e2e -- registration.spec.ts`. Atteso: FAIL.

- [ ] **Step 7: Action di registrazione.** `app/e/[slug]/actions.ts`:

```ts
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
  if (error) return { errors: { form: 'Errore imprevisto, riprova' }, values };

  const result = data as unknown as { status: string; coupon_token?: string };
  if ((result.status === 'created' || result.status === 'existing') && result.coupon_token) {
    redirect(`/c/${result.coupon_token}`);
  }
  return { errors: { form: RPC_ERRORS[result.status] ?? 'Errore imprevisto, riprova' }, values };
}
```

- [ ] **Step 8: Form e pagine.** `app/e/[slug]/register-form.tsx`:

```tsx
'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useActionState, useEffect } from 'react';
import { FieldError } from '@/components/field-error';
import { register, type RegisterState } from './actions';

declare global {
  interface Window {
    turnstile?: { reset: (widget?: string) => void };
  }
}

export function RegisterForm({ slug, siteKey }: { slug: string; siteKey: string }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(register.bind(null, slug), { errors: {} });
  const v = state.values ?? {};

  useEffect(() => {
    if (Object.keys(state.errors).length > 0) window.turnstile?.reset();
  }, [state]);

  return (
    <form action={action} className="card space-y-4" noValidate>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div>
        <label className="label" htmlFor="first_name">Nome</label>
        <input id="first_name" name="first_name" autoComplete="given-name" className="input" defaultValue={v.first_name} />
        <FieldError message={state.errors.first_name} />
      </div>
      <div>
        <label className="label" htmlFor="last_name">Cognome</label>
        <input id="last_name" name="last_name" autoComplete="family-name" className="input" defaultValue={v.last_name} />
        <FieldError message={state.errors.last_name} />
      </div>
      <div>
        <label className="label" htmlFor="phone">Telefono (facoltativo)</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" defaultValue={v.phone} />
        <FieldError message={state.errors.phone} />
      </div>

      <div className="space-y-3 text-sm">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="consent_privacy" defaultChecked={v.consent_privacy === 'on'} className="mt-0.5 size-5 accent-accent" />
          <span>
            Ho letto l&apos;<Link href="/privacy" target="_blank" className="underline">informativa privacy</Link> e acconsento al trattamento dei miei dati
          </span>
        </label>
        <FieldError message={state.errors.consent_privacy} />
        <label className="flex items-start gap-3">
          <input type="checkbox" name="consent_coupon" defaultChecked={v.consent_coupon === 'on'} className="mt-0.5 size-5 accent-accent" />
          <span>Accetto il coupon della serata e le sue condizioni</span>
        </label>
        <FieldError message={state.errors.consent_coupon} />
        <label className="flex items-start gap-3">
          <input type="checkbox" name="consent_marketing" defaultChecked={v.consent_marketing === 'on'} className="mt-0.5 size-5 accent-accent" />
          <span>Acconsento a ricevere offerte dedicate nei prossimi 30 giorni (facoltativo)</span>
        </label>
      </div>

      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="dark" data-language="it" />
      <FieldError message={state.errors.form} />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? 'Attendi…' : 'Ottieni il coupon'}</button>
    </form>
  );
}
```

`app/e/[slug]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation';
import { formatRome } from '@/lib/dates';
import { readDeviceId } from '@/lib/device';
import { env } from '@/lib/env';
import { isRegistrationOpen } from '@/lib/event-window';
import { createAdminClient } from '@/lib/supabase/admin';
import { RegisterForm } from './register-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Il tuo coupon per la serata' };

export default async function EventRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();
  const { data: event } = await supabase
    .from('events')
    .select('id, title, venue_name, starts_at, ends_at, coupon_title, coupon_description, status')
    .eq('slug', slug)
    .neq('status', 'draft')
    .maybeSingle();
  if (!event) notFound();

  const deviceId = await readDeviceId();
  if (deviceId) {
    const { data: existing } = await supabase
      .from('registrations')
      .select('coupon_token')
      .eq('event_id', event.id)
      .eq('device_id', deviceId)
      .limit(1)
      .maybeSingle();
    if (existing) redirect(`/c/${existing.coupon_token}`);
  }

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <header className="space-y-1 text-center">
        <h1 className="text-3xl font-black">{event.title}</h1>
        <p className="text-muted">{event.venue_name} · {formatRome(event.starts_at)}</p>
      </header>
      <section className="card text-center">
        <p className="text-xl font-bold text-accent">{event.coupon_title}</p>
        {event.coupon_description && <p className="mt-1 text-sm text-muted">{event.coupon_description}</p>}
      </section>
      {isRegistrationOpen(event, new Date()) ? (
        <RegisterForm slug={slug} siteKey={env('NEXT_PUBLIC_TURNSTILE_SITEKEY')} />
      ) : (
        <p className="card text-center">Le registrazioni per questa serata non sono aperte.</p>
      )}
    </main>
  );
}
```

`app/c/[token]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { formatRome } from '@/lib/dates';
import { couponStatus } from '@/lib/event-window';
import { qrSvg } from '@/lib/qr';
import { siteUrl } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Il tuo coupon' };

export default async function CouponPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: reg } = await createAdminClient()
    .from('registrations')
    .select('coupon_code, redeemed_at, customers(first_name), events(title, venue_name, starts_at, ends_at, coupon_title, coupon_description)')
    .eq('coupon_token', token)
    .maybeSingle();
  if (!reg?.events) notFound();

  const event = reg.events;
  const status = couponStatus(reg.redeemed_at, event.ends_at, new Date());
  const qr = status === 'valid' ? await qrSvg(siteUrl(`/v/scan?code=${reg.coupon_code}`)) : null;
  const label =
    status === 'valid'
      ? 'Valido — mostralo al bancone'
      : status === 'redeemed'
        ? `Usato il ${formatRome(reg.redeemed_at!, "dd/MM 'alle' HH:mm")}`
        : 'Scaduto';

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8 text-center">
      <p className="text-muted">Ciao {reg.customers?.first_name}, ecco il tuo coupon per</p>
      <h1 className="text-2xl font-black">{event.title}</h1>
      <p className="text-muted">{event.venue_name} · {formatRome(event.starts_at)}</p>
      <section className="card space-y-4">
        <p className="text-xl font-bold text-accent">{event.coupon_title}</p>
        {event.coupon_description && <p className="text-sm text-muted">{event.coupon_description}</p>}
        <p data-testid="coupon-code" className="font-mono text-5xl font-black tracking-[0.2em]">{reg.coupon_code}</p>
        {qr && <div className="mx-auto w-56 rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} />}
        <p data-testid="coupon-status" className={`text-lg font-bold ${status === 'valid' ? 'text-ok' : 'text-danger'}`}>{label}</p>
      </section>
      <p className="text-sm text-muted">Salva questa pagina tra i preferiti: puoi riaprirla quando vuoi.</p>
    </main>
  );
}
```

`app/privacy/page.tsx` (bozza strutturata, da validare con il consulente prima del go-live):

```tsx
import { DATA_CONTROLLER, PRIVACY_VERSION } from '@/lib/privacy';

export const metadata = { title: 'Informativa privacy' };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-10 leading-relaxed">
      <h1 className="text-2xl font-bold">Informativa privacy</h1>
      <p className="text-sm text-muted">Versione {PRIVACY_VERSION} — bozza da validare con un consulente privacy.</p>
      <h2 className="font-bold">Titolare</h2>
      <p>{DATA_CONTROLLER.name} — {DATA_CONTROLLER.email}</p>
      <h2 className="font-bold">Dati raccolti</h2>
      <p>
        Nome, cognome, numero di telefono (facoltativo), data e ora dei consensi, un identificativo tecnico del dispositivo
        (cookie) usato per evitare coupon duplicati e un&apos;impronta non reversibile dell&apos;indirizzo IP usata contro gli abusi.
      </p>
      <h2 className="font-bold">Finalità</h2>
      <p>1) Emettere e verificare il coupon della serata. 2) Solo con il tuo consenso, inviarti offerte dedicate per 30 giorni dall&apos;ultima registrazione.</p>
      <h2 className="font-bold">Conservazione</h2>
      <p>I dati vengono cancellati dopo 12 mesi senza nuove registrazioni. Il consenso alle offerte scade dopo 30 giorni.</p>
      <h2 className="font-bold">Destinatari</h2>
      <p>I dati sono ospitati da fornitori infrastrutturali (database e hosting). Gli sponsor delle offerte non ricevono i tuoi dati.</p>
      <h2 className="font-bold">I tuoi diritti</h2>
      <p>
        Puoi chiedere accesso, rettifica, cancellazione o revocare il consenso scrivendo a {DATA_CONTROLLER.email}. Puoi proporre
        reclamo al Garante per la protezione dei dati personali.
      </p>
    </main>
  );
}
```

- [ ] **Step 9: Esegui i test.** `npm test && npm run test:e2e -- registration.spec.ts`. Atteso: tutti PASS. Poi `npm run lint && npm run typecheck`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(public): registrazione cliente con consensi, Turnstile e pagina coupon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Validazione al bar (`/v/[staffToken]` e `/v/scan`)

**Files:**
- Create: `lib/codes.ts`, `lib/staff-session-codec.ts`, `lib/staff-session.ts`, `app/v/{actions.ts,pin-form.tsx,redeem-form.tsx}`, `app/v/[staffToken]/page.tsx`, `app/v/scan/page.tsx`
- Test: `lib/codes.test.ts`, `lib/staff-session-codec.test.ts`, `e2e/staff.spec.ts`, `e2e/redeem-concurrency.spec.ts`

**Interfaces:**
- Consumes: le RPC `verify_event_pin` e `redeem_event_coupon`, `createAdminClient`, `formatRome`, gli helper e2e `createLiveEvent`, `registerCustomer`, `loginAsAdmin`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- Produces:
  - in `lib/codes.ts`: `CODE_ALPHABET`, `normalizeCode(input): string`, `isValidCode(code): boolean`;
  - in `lib/staff-session-codec.ts`: `StaffSession`, `encodeStaffSession`, `decodeStaffSession`;
  - in `lib/staff-session.ts`: `getStaffSession()`, `setStaffSession(s)`, `clearStaffSession()`. Il cookie è `staff_session`, httpOnly, path `/v`, durata 12 ore;
  - le server action `verifyPin`, `redeem`, `logoutStaff`;
  - l'esito della bruciatura ha `data-testid="redeem-result"`.

La sessione del barista tiene nel cookie httpOnly il token della serata e il PIN. Ogni bruciatura riverifica il PIN nel DB, quindi un cambio di PIN invalida subito i telefoni con la sessione vecchia.

- [ ] **Step 1: Scrivi i test che falliscono.** `lib/codes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isValidCode, normalizeCode } from './codes';

describe('codici coupon', () => {
  it('normalizza minuscole, spazi e trattini', () => {
    expect(normalizeCode(' k7m-4qx ')).toBe('K7M4QX');
    expect(normalizeCode('k7 m4 qx')).toBe('K7M4QX');
  });
  it('valida l\'alfabeto e la lunghezza', () => {
    expect(isValidCode('K7M4QX')).toBe(true);
    expect(isValidCode('K7M4Q')).toBe(false);
    expect(isValidCode('K7M4Q0')).toBe(false);
    expect(isValidCode('IIIIII')).toBe(false);
  });
});
```

`lib/staff-session-codec.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decodeStaffSession, encodeStaffSession } from './staff-session-codec';

describe('sessione staff', () => {
  it('andata e ritorno', () => {
    const s = { staffToken: 'abc_DEF-123', pin: '2468' };
    expect(decodeStaffSession(encodeStaffSession(s))).toEqual(s);
  });
  it('null se assente o corrotta', () => {
    expect(decodeStaffSession(undefined)).toBeNull();
    expect(decodeStaffSession('%%%non-base64')).toBeNull();
    expect(decodeStaffSession(Buffer.from('{"x":1}').toString('base64url'))).toBeNull();
  });
});
```

- [ ] **Step 2: Esegui i test.** `npm test`. Atteso: FAIL (i moduli non esistono).

- [ ] **Step 3: Implementa le librerie.** `lib/codes.ts`:

```ts
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{6}$`);

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidCode(code: string): boolean {
  return CODE_RE.test(code);
}
```

`lib/staff-session-codec.ts`:

```ts
export type StaffSession = { staffToken: string; pin: string };

export function encodeStaffSession(session: StaffSession): string {
  return Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
}

export function decodeStaffSession(value: string | undefined): StaffSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<StaffSession>;
    if (typeof parsed.staffToken === 'string' && typeof parsed.pin === 'string') {
      return { staffToken: parsed.staffToken, pin: parsed.pin };
    }
  } catch {
    // cookie corrotto
  }
  return null;
}
```

`lib/staff-session.ts`:

```ts
import { cookies } from 'next/headers';
import { decodeStaffSession, encodeStaffSession, type StaffSession } from './staff-session-codec';

const COOKIE = 'staff_session';

export async function getStaffSession(): Promise<StaffSession | null> {
  return decodeStaffSession((await cookies()).get(COOKIE)?.value);
}

export async function setStaffSession(session: StaffSession): Promise<void> {
  (await cookies()).set(COOKIE, encodeStaffSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/v',
    maxAge: 12 * 60 * 60,
  });
}

export async function clearStaffSession(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: '/v' });
}
```

- [ ] **Step 4: Esegui i test.** `npm test`. Atteso: tutti PASS.

- [ ] **Step 5: Scrivi gli e2e che falliscono.** `e2e/staff.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { createLiveEvent, loginAsAdmin, registerCustomer } from './helpers';

test('il barista brucia un coupon una sola volta', async ({ browser }) => {
  const admin = await browser.newPage();
  await loginAsAdmin(admin);
  const event = await createLiveEvent(admin, { title: `Staff ${Date.now()}`, pin: '2468' });

  const customer = await browser.newPage();
  const code = await registerCustomer(customer, event.publicPath, { firstName: 'Giulia', lastName: 'Neri' });
  const couponUrl = customer.url();

  const staff = await browser.newPage();
  await staff.goto(event.staffPath);
  await staff.getByLabel('PIN').fill('0000');
  await staff.getByRole('button', { name: 'Entra' }).click();
  await expect(staff.getByText('PIN errato')).toBeVisible();
  await staff.getByLabel('PIN').fill('2468');
  await staff.getByRole('button', { name: 'Entra' }).click();

  await staff.getByLabel('Codice coupon').fill(` ${code.toLowerCase().slice(0, 3)}-${code.toLowerCase().slice(3)} `);
  await staff.getByRole('button', { name: 'Brucia coupon' }).click();
  await expect(staff.getByTestId('redeem-result')).toContainText('Coupon valido');

  await staff.getByLabel('Codice coupon').fill(code);
  await staff.getByRole('button', { name: 'Brucia coupon' }).click();
  await expect(staff.getByTestId('redeem-result')).toContainText('Già usato');

  await customer.goto(couponUrl);
  await expect(customer.getByTestId('coupon-status')).toContainText('Usato');

  // il barista inquadra il QR del coupon con la fotocamera: si apre /v/scan già compilato
  await staff.goto(`/v/scan?code=${code}`);
  await expect(staff.getByLabel('Codice coupon')).toHaveValue(code);
  await staff.getByRole('button', { name: 'Brucia coupon' }).click();
  await expect(staff.getByTestId('redeem-result')).toContainText('Già usato');

  // il cliente che scansiona il proprio QR non entra nell'area staff
  await customer.goto(`/v/scan?code=${code}`);
  await expect(customer.getByText(/mostrare al bancone/)).toBeVisible();
});

test('se il PR cambia PIN, il barista deve reinserirlo', async ({ browser }) => {
  const admin = await browser.newPage();
  await loginAsAdmin(admin);
  const event = await createLiveEvent(admin, { title: `CambioPin ${Date.now()}`, pin: '1111' });

  const customer = await browser.newPage();
  const code = await registerCustomer(customer, event.publicPath, { firstName: 'Paolo', lastName: 'Gialli' });

  const staff = await browser.newPage();
  await staff.goto(event.staffPath);
  await staff.getByLabel('PIN').fill('1111');
  await staff.getByRole('button', { name: 'Entra' }).click();
  await expect(staff.getByLabel('Codice coupon')).toBeVisible();

  await admin.getByLabel(/Nuovo PIN baristi/).fill('2222');
  await admin.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(admin.getByText('Salvato ✓')).toBeVisible();

  await staff.getByLabel('Codice coupon').fill(code);
  await staff.getByRole('button', { name: 'Brucia coupon' }).click();
  await expect(staff.getByTestId('redeem-result')).toContainText('Sessione scaduta');
  await staff.reload();
  await expect(staff.getByLabel('PIN')).toBeVisible();
});
```

`e2e/redeem-concurrency.spec.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers';

test('bruciature concorrenti: esattamente una va a buon fine', async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const asAdmin = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { error: authError } = await asAdmin.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  expect(authError).toBeNull();

  const now = Date.now();
  const slug = `conc-${now}`;
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

  const service = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
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
      service.rpc('redeem_event_coupon', { p_staff_token: event!.staff_token, p_pin: '1357', p_code: row!.coupon_code }),
    ),
  );
  const statuses = results.map((r) => (r.data as { status: string }).status);
  expect(statuses.filter((s) => s === 'ok')).toHaveLength(1);
  expect(statuses.filter((s) => s === 'already_used')).toHaveLength(7);
});
```

- [ ] **Step 6: Esegui gli e2e.** `npm run test:e2e -- staff.spec.ts redeem-concurrency.spec.ts`. Atteso: `staff.spec` FAIL (le pagine non esistono). `redeem-concurrency` passa già perché verifica il DB di Task 3: va bene così, fa da test di regressione.

- [ ] **Step 7: Server actions.** `app/v/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { isValidCode, normalizeCode } from '@/lib/codes';
import { clearStaffSession, getStaffSession, setStaffSession } from '@/lib/staff-session';
import { createAdminClient } from '@/lib/supabase/admin';

export type PinState = { error?: string };
export type RedeemStatus = 'ok' | 'already_used' | 'not_found' | 'out_of_window' | 'wrong_pin' | 'locked' | 'unauthorized' | 'error';
export type RedeemResult = { status: RedeemStatus; code: string; couponTitle?: string; firstName?: string; redeemedAt?: string };
export type RedeemState = { result?: RedeemResult };

export async function verifyPin(staffToken: string, _prev: PinState, formData: FormData): Promise<PinState> {
  const pin = String(formData.get('pin') ?? '').trim();
  const { data, error } = await createAdminClient().rpc('verify_event_pin', { p_staff_token: staffToken, p_pin: pin });
  if (error) return { error: 'Errore imprevisto, riprova' };
  const { status } = data as unknown as { status: string };
  if (status === 'ok') {
    await setStaffSession({ staffToken, pin });
    redirect(`/v/${staffToken}`);
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
    p_pin: session.pin,
    p_code: code,
  });
  if (error) return { result: { status: 'error', code } };

  const r = data as unknown as { status: RedeemStatus; coupon_title?: string; first_name?: string; redeemed_at?: string };
  if (r.status === 'wrong_pin' || r.status === 'locked' || r.status === 'unauthorized') await clearStaffSession();
  return { result: { status: r.status, code, couponTitle: r.coupon_title, firstName: r.first_name, redeemedAt: r.redeemed_at } };
}

export async function logoutStaff(staffToken: string): Promise<void> {
  await clearStaffSession();
  redirect(`/v/${staffToken}`);
}
```

- [ ] **Step 8: Componenti e pagine.** `app/v/pin-form.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { FieldError } from '@/components/field-error';
import { verifyPin, type PinState } from './actions';

export function PinForm({ staffToken }: { staffToken: string }) {
  const [state, action, pending] = useActionState<PinState, FormData>(verifyPin.bind(null, staffToken), {});
  return (
    <form action={action} className="card space-y-3">
      <label className="label" htmlFor="pin">PIN</label>
      <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="off" autoFocus className="input text-center text-2xl tracking-widest" />
      <FieldError message={state.error} />
      <button className="btn btn-primary w-full" disabled={pending}>Entra</button>
    </form>
  );
}
```

`app/v/redeem-form.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { formatRome } from '@/lib/dates';
import { redeem, type RedeemResult, type RedeemState } from './actions';

function resultText(r: RedeemResult): string {
  switch (r.status) {
    case 'ok':
      return `✅ Coupon valido — ${r.couponTitle ?? ''}${r.firstName ? ` (${r.firstName})` : ''}`;
    case 'already_used':
      return `⛔ Già usato${r.redeemedAt ? ` alle ${formatRome(r.redeemedAt, 'HH:mm')}` : ''}`;
    case 'not_found':
      return '⛔ Codice non trovato';
    case 'out_of_window':
      return '⛔ Fuori orario della serata';
    case 'wrong_pin':
    case 'locked':
    case 'unauthorized':
      return '⚠️ Sessione scaduta: ricarica la pagina e reinserisci il PIN';
    default:
      return '⚠️ Errore, riprova';
  }
}

export function RedeemForm({ defaultCode = '' }: { defaultCode?: string }) {
  const [state, action, pending] = useActionState<RedeemState, FormData>(redeem, {});
  const r = state.result;
  return (
    <div className="space-y-4">
      {r && (
        <div
          data-testid="redeem-result"
          role="status"
          className={`rounded-2xl p-5 text-center text-xl font-bold ${r.status === 'ok' ? 'bg-ok text-black' : 'bg-danger text-white'}`}
        >
          <p>{resultText(r)}</p>
          <p className="mt-1 font-mono text-base opacity-80">{r.code}</p>
        </div>
      )}
      <form action={action} className="card space-y-3">
        <label className="label" htmlFor="code">Codice coupon</label>
        <input
          id="code"
          name="code"
          defaultValue={defaultCode}
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={12}
          className="input text-center font-mono text-3xl uppercase tracking-[0.3em]"
        />
        <button className="btn btn-primary w-full" disabled={pending}>Brucia coupon</button>
      </form>
    </div>
  );
}
```

`app/v/[staffToken]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { formatRome } from '@/lib/dates';
import { getStaffSession } from '@/lib/staff-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logoutStaff } from '../actions';
import { PinForm } from '../pin-form';
import { RedeemForm } from '../redeem-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Area staff' };

export default async function StaffPage({ params }: { params: Promise<{ staffToken: string }> }) {
  const { staffToken } = await params;
  const { data: event } = await createAdminClient()
    .from('events')
    .select('title, venue_name, starts_at')
    .eq('staff_token', staffToken)
    .maybeSingle();
  if (!event) notFound();

  const session = await getStaffSession();
  const authed = session?.staffToken === staffToken;

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <header className="text-center">
        <p className="text-sm text-muted">Area staff</p>
        <h1 className="text-2xl font-black">{event.title}</h1>
        <p className="text-muted">{event.venue_name} · {formatRome(event.starts_at)}</p>
      </header>
      {authed ? (
        <>
          <RedeemForm />
          <form action={logoutStaff.bind(null, staffToken)} className="text-center">
            <button className="text-sm text-muted underline">Esci</button>
          </form>
        </>
      ) : (
        <PinForm staffToken={staffToken} />
      )}
    </main>
  );
}
```

`app/v/scan/page.tsx`:

```tsx
import { normalizeCode } from '@/lib/codes';
import { getStaffSession } from '@/lib/staff-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { RedeemForm } from '../redeem-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Area staff' };

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = '' } = await searchParams;
  const session = await getStaffSession();
  const { data: event } = session
    ? await createAdminClient().from('events').select('title').eq('staff_token', session.staffToken).maybeSingle()
    : { data: null };

  if (!event) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="card">
          Questo è un coupon da mostrare al bancone. Se sei dello staff, apri prima il link della serata e inserisci il PIN.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <header className="text-center">
        <p className="text-sm text-muted">Area staff</p>
        <h1 className="text-2xl font-black">{event.title}</h1>
      </header>
      <RedeemForm defaultCode={normalizeCode(code)} />
    </main>
  );
}
```

- [ ] **Step 9: Esegui i test.** `npm test && npm run test:e2e -- staff.spec.ts redeem-concurrency.spec.ts`. Atteso: tutti PASS. Poi `npm run lint && npm run typecheck`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(staff): validazione coupon al bar con PIN, scansione QR e sessione staff

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Clienti in admin (lista, dettaglio, doppioni, export CSV) e dashboard

**Files:**
- Create: `lib/csv.ts`, `lib/search.ts`, `lib/consent.ts`, `app/admin/(dashboard)/clienti/{page.tsx,actions.ts}`, `app/admin/(dashboard)/clienti/[id]/page.tsx`, `app/admin/(dashboard)/clienti/doppioni/page.tsx`, `app/admin/(dashboard)/clienti/export/route.ts`
- Modify: `app/admin/(dashboard)/page.tsx` (dashboard con i numeri)
- Test: `lib/csv.test.ts`, `lib/search.test.ts`, `lib/consent.test.ts`, `e2e/customers.spec.ts`

**Interfaces:**
- Consumes: le viste `customer_overview`, `duplicate_candidates`, `event_stats`; la RPC `merge_customers`; `requireAdmin`, `formatRome`.
- Produces:
  - in `lib/csv.ts`: `CsvColumn<T>`, `csvCell(value)`, `toCsv(rows, columns)` (separatore `;`, BOM UTF-8, CRLF, protezione dalle formule);
  - in `lib/search.ts`: `searchTerms(query): string[]`;
  - in `lib/consent.ts`: `consentLabel(until, now): string`;
  - la server action `mergeCustomers(keepId, dropId)`;
  - ogni coppia di doppioni espone `data-testid="duplicate-pair"`.

- [ ] **Step 1: Scrivi i test che falliscono.** `lib/csv.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('csv', () => {
  it('celle semplici e vuote', () => {
    expect(csvCell('Mario')).toBe('Mario');
    expect(csvCell(5)).toBe('5');
    expect(csvCell(null)).toBe('');
  });
  it('mette tra virgolette separatori, virgolette e a capo', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('di "Mario"')).toBe('"di ""Mario"""');
    expect(csvCell('riga1\nriga2')).toBe('"riga1\nriga2"');
  });
  it('neutralizza le formule per Excel', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+393331234567')).toBe("'+393331234567");
  });
  it('BOM, intestazioni e CRLF', () => {
    const csv = toCsv([{ n: 'Anna' }], [{ header: 'Nome', value: (r) => r.n }]);
    expect(csv).toBe('﻿Nome\r\nAnna\r\n');
  });
});
```

`lib/search.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { searchTerms } from './search';

describe('searchTerms', () => {
  it('divide in parole', () => {
    expect(searchTerms('  Mario   Rossi ')).toEqual(['Mario', 'Rossi']);
  });
  it('conserva apostrofi, accenti e +', () => {
    expect(searchTerms("d'Angelo Niccolò +39333")).toEqual(["d'Angelo", 'Niccolò', '+39333']);
  });
  it('toglie i caratteri che rompono i filtri', () => {
    expect(searchTerms('a,b(c)')).toEqual(['a', 'b', 'c']);
    expect(searchTerms('%_*')).toEqual([]);
  });
  it('massimo 3 parole', () => {
    expect(searchTerms('a b c d')).toEqual(['a', 'b', 'c']);
  });
});
```

`lib/consent.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { consentLabel } from './consent';

describe('consentLabel', () => {
  const now = new Date('2026-10-01T10:00:00Z');
  it('attivo', () => {
    expect(consentLabel('2026-10-20T10:00:00Z', now)).toBe('Fino al 20/10/2026');
  });
  it('scaduto o assente', () => {
    expect(consentLabel('2026-09-20T10:00:00Z', now)).toBe('Non attivo');
    expect(consentLabel(null, now)).toBe('Non attivo');
  });
});
```

- [ ] **Step 2: Esegui i test.** `npm test`. Atteso: FAIL.

- [ ] **Step 3: Implementa le librerie.** `lib/csv.ts`:

```ts
export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [
    columns.map((c) => csvCell(c.header)).join(';'),
    ...rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(';')),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}
```

`lib/search.ts`:

```ts
export function searchTerms(query: string): string[] {
  return query
    .replace(/[^\p{L}\p{N}+' ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
}
```

`lib/consent.ts`:

```ts
import { formatRome } from '@/lib/dates';

export function consentLabel(until: string | null, now: Date): string {
  if (!until || Date.parse(until) <= now.getTime()) return 'Non attivo';
  return `Fino al ${formatRome(until, 'dd/MM/yyyy')}`;
}
```

- [ ] **Step 4: Esegui i test.** `npm test`. Atteso: tutti PASS.

- [ ] **Step 5: Scrivi l'e2e che fallisce.** `e2e/customers.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { createLiveEvent, loginAsAdmin, registerCustomer } from './helpers';

test('il PR trova, unisce ed esporta i clienti', async ({ browser }) => {
  const admin = await browser.newPage();
  await loginAsAdmin(admin);
  const event = await createLiveEvent(admin, { title: `Clienti ${Date.now()}`, pin: '1234' });
  const lastName = `Doppione${Date.now().toString(36)}`;

  // stessa persona da due telefoni diversi, senza numero, scritta in modo diverso
  await registerCustomer(await browser.newPage(), event.publicPath, { firstName: 'Luca', lastName });
  await registerCustomer(await browser.newPage(), event.publicPath, { firstName: 'luca', lastName: lastName.toUpperCase() });

  await admin.goto(`/admin/clienti?q=${lastName}`);
  await expect(admin.locator('tbody tr')).toHaveCount(2);

  await admin.goto('/admin/clienti/doppioni');
  const pair = admin.getByTestId('duplicate-pair').filter({ hasText: lastName });
  await expect(pair).toHaveCount(1);
  await pair.getByRole('button', { name: 'Tieni questo' }).first().click();
  await expect(admin.getByTestId('duplicate-pair').filter({ hasText: lastName })).toHaveCount(0);

  await admin.goto(`/admin/clienti?q=${lastName}`);
  await expect(admin.locator('tbody tr')).toHaveCount(1);

  const res = await admin.request.get('/admin/clienti/export');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
  expect((await res.text()).toLowerCase()).toContain(lastName.toLowerCase());

  await admin.goto('/admin');
  await expect(admin.getByText('Clienti totali')).toBeVisible();
});
```

- [ ] **Step 6: Esegui l'e2e.** `npm run test:e2e -- customers.spec.ts`. Atteso: FAIL.

- [ ] **Step 7: Action di unione.** `app/admin/(dashboard)/clienti/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';

export async function mergeCustomers(keepId: string, dropId: string): Promise<void> {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc('merge_customers', { p_keep_id: keepId, p_drop_id: dropId });
  if (error) throw new Error(`Unione non riuscita: ${error.message}`);
  revalidatePath('/admin/clienti', 'layout');
}
```

- [ ] **Step 8: Pagine clienti.** `app/admin/(dashboard)/clienti/page.tsx`:

```tsx
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { consentLabel } from '@/lib/consent';
import { formatRome } from '@/lib/dates';
import { searchTerms } from '@/lib/search';

const PAGE_SIZE = 50;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q = '', page = '1' } = await searchParams;
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const supabase = await requireAdmin();

  let query = supabase
    .from('customer_overview')
    .select('*', { count: 'exact' })
    .order('last_activity_at', { ascending: false })
    .range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1);
  for (const term of searchTerms(q)) {
    query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone_e164.ilike.%${term}%`);
  }
  const [{ data: customers, count }, { count: duplicates }] = await Promise.all([
    query,
    supabase.from('duplicate_candidates').select('a_id', { count: 'exact', head: true }),
  ]);
  const now = new Date();
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const pageHref = (n: number) => `/admin/clienti?${new URLSearchParams({ q, page: String(n) })}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Clienti ({count ?? 0})</h1>
        <a href="/admin/clienti/export" className="btn btn-secondary">Esporta CSV</a>
      </div>
      {(duplicates ?? 0) > 0 && (
        <Link href="/admin/clienti/doppioni" className="card block hover:border-accent">
          ⚠️ {duplicates} possibili doppioni da controllare →
        </Link>
      )}
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Cerca nome, cognome o telefono" className="input" />
        <button className="btn btn-primary">Cerca</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr><th className="py-2">Nome</th><th>Telefono</th><th>Serate</th><th>Usati</th><th>Offerte</th><th>Ultima attività</th></tr>
          </thead>
          <tbody>
            {(customers ?? []).map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="py-2">
                  <Link href={`/admin/clienti/${c.id}`} className="font-semibold hover:text-accent">{c.first_name} {c.last_name}</Link>
                </td>
                <td>{c.phone_e164 ?? '—'}</td>
                <td>{c.events_count}</td>
                <td>{c.redeemed_count}</td>
                <td>{consentLabel(c.marketing_consent_until, now)}</td>
                <td>{c.last_activity_at ? formatRome(c.last_activity_at, 'dd/MM/yyyy') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="flex items-center gap-3">
          {pageNum > 1 && <Link href={pageHref(pageNum - 1)} className="btn btn-secondary">← Precedenti</Link>}
          <span className="text-muted">Pagina {pageNum} di {pages}</span>
          {pageNum < pages && <Link href={pageHref(pageNum + 1)} className="btn btn-secondary">Successivi →</Link>}
        </nav>
      )}
    </div>
  );
}
```

`app/admin/(dashboard)/clienti/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { consentLabel } from '@/lib/consent';
import { formatRome } from '@/lib/dates';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await requireAdmin();
  const { data: customer } = await supabase.from('customer_overview').select('*').eq('id', id).maybeSingle();
  if (!customer) notFound();
  const { data: registrations } = await supabase
    .from('registrations')
    .select('id, coupon_code, redeemed_at, created_at, consent_marketing, events(title, starts_at)')
    .eq('customer_id', id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{customer.first_name} {customer.last_name}</h1>
      <div className="card grid gap-2 sm:grid-cols-2">
        <p>Telefono: <b>{customer.phone_e164 ?? '—'}</b></p>
        <p>Offerte: <b>{consentLabel(customer.marketing_consent_until, new Date())}</b></p>
        <p>Primo contatto: <b>{customer.created_at ? formatRome(customer.created_at, 'dd/MM/yyyy') : '—'}</b></p>
        <p>Coupon usati: <b>{customer.redeemed_count} su {customer.events_count}</b></p>
      </div>
      <h2 className="font-bold">Serate</h2>
      <ul className="space-y-2">
        {(registrations ?? []).map((r) => (
          <li key={r.id} className="card flex flex-wrap justify-between gap-2">
            <span>{r.events?.title} · {r.events ? formatRome(r.events.starts_at, 'dd/MM/yyyy') : ''}</span>
            <span className="text-sm text-muted">
              <span className="font-mono">{r.coupon_code}</span> · {r.redeemed_at ? `usato ${formatRome(r.redeemed_at, 'HH:mm')}` : 'non usato'}
              {r.consent_marketing ? ' · consenso offerte' : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`app/admin/(dashboard)/clienti/doppioni/page.tsx`:

```tsx
import { requireAdmin } from '@/lib/auth';
import { formatRome } from '@/lib/dates';
import { mergeCustomers } from '../actions';

type Side = { id: string; firstName: string; lastName: string; phone: string | null; createdAt: string };

function KeepCard({ keep, drop }: { keep: Side; drop: Side }) {
  return (
    <div className="card flex-1 space-y-2">
      <p className="font-bold">{keep.firstName} {keep.lastName}</p>
      <p className="text-sm text-muted">{keep.phone ?? 'Senza telefono'} · dal {formatRome(keep.createdAt, 'dd/MM/yyyy')}</p>
      <form action={mergeCustomers.bind(null, keep.id, drop.id)}>
        <button className="btn btn-secondary">Tieni questo</button>
      </form>
    </div>
  );
}

export default async function DuplicatesPage() {
  const supabase = await requireAdmin();
  const { data: pairs } = await supabase.from('duplicate_candidates').select('*').limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Possibili doppioni</h1>
      <p className="text-muted">
        Stesso nome e cognome, almeno uno senza telefono. Scegli la scheda da tenere: l&apos;altra verrà unita a questa.
      </p>
      {pairs?.length ? (
        pairs.map((p) => {
          const a: Side = { id: p.a_id!, firstName: p.a_first_name!, lastName: p.a_last_name!, phone: p.a_phone, createdAt: p.a_created_at! };
          const b: Side = { id: p.b_id!, firstName: p.b_first_name!, lastName: p.b_last_name!, phone: p.b_phone, createdAt: p.b_created_at! };
          return (
            <div key={`${a.id}-${b.id}`} data-testid="duplicate-pair" className="flex flex-col gap-3 md:flex-row">
              <KeepCard keep={a} drop={b} />
              <KeepCard keep={b} drop={a} />
            </div>
          );
        })
      ) : (
        <p className="text-muted">Nessun possibile doppione.</p>
      )}
    </div>
  );
}
```

`app/admin/(dashboard)/clienti/export/route.ts`:

```ts
import { requireAdmin } from '@/lib/auth';
import { toCsv, type CsvColumn } from '@/lib/csv';
import { formatRome } from '@/lib/dates';
import type { Database } from '@/lib/supabase/database.types';

type Row = Database['public']['Views']['customer_overview']['Row'];

const date = (iso: string | null) => (iso ? formatRome(iso, 'dd/MM/yyyy') : '');

const COLUMNS: CsvColumn<Row>[] = [
  { header: 'Nome', value: (r) => r.first_name },
  { header: 'Cognome', value: (r) => r.last_name },
  { header: 'Telefono', value: (r) => r.phone_e164 },
  { header: 'Serate', value: (r) => r.events_count },
  { header: 'Coupon usati', value: (r) => r.redeemed_count },
  { header: 'Consenso offerte fino al', value: (r) => date(r.marketing_consent_until) },
  { header: 'Ultima attività', value: (r) => date(r.last_activity_at) },
  { header: 'Primo contatto', value: (r) => date(r.created_at) },
];

export async function GET() {
  const supabase = await requireAdmin();
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('customer_overview').select('*').order('created_at').range(from, from + 999);
    if (error) return new Response('Errore durante l’export', { status: 500 });
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return new Response(toCsv(rows, COLUMNS), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clienti-${formatRome(new Date().toISOString(), 'yyyy-MM-dd')}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
```

- [ ] **Step 9: Dashboard.** Sostituisci `app/admin/(dashboard)/page.tsx`:

```tsx
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { formatRome } from '@/lib/dates';
import { STATUS_LABEL, type EventStatus } from '@/lib/event-status';

export default async function DashboardPage() {
  const supabase = await requireAdmin();
  const nowIso = new Date().toISOString();
  const [{ count: customers }, { count: consenting }, { data: upcoming }, { data: stats }] = await Promise.all([
    supabase.from('customer_overview').select('id', { count: 'exact', head: true }),
    supabase.from('customer_overview').select('id', { count: 'exact', head: true }).gt('marketing_consent_until', nowIso),
    supabase.from('events').select('id, title, venue_name, starts_at, status').gte('ends_at', nowIso).order('starts_at').limit(5),
    supabase.from('event_stats').select('event_id, registrations, redeemed'),
  ]);
  const statsById = new Map((stats ?? []).map((s) => [s.event_id, s]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card"><p className="text-sm text-muted">Clienti totali</p><p className="text-3xl font-black">{customers ?? 0}</p></div>
        <div className="card"><p className="text-sm text-muted">Con consenso offerte attivo</p><p className="text-3xl font-black">{consenting ?? 0}</p></div>
      </div>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Prossime serate</h2>
          <Link href="/admin/eventi/nuova" className="btn btn-primary">Nuova serata</Link>
        </div>
        {upcoming?.length ? (
          upcoming.map((e) => (
            <Link key={e.id} href={`/admin/eventi/${e.id}`} className="card flex flex-wrap justify-between gap-2 hover:border-accent">
              <span><b>{e.title}</b> <span className="text-muted">· {e.venue_name} · {formatRome(e.starts_at)}</span></span>
              <span className="text-sm">
                {STATUS_LABEL[e.status as EventStatus]} · {statsById.get(e.id)?.registrations ?? 0} registrati · {statsById.get(e.id)?.redeemed ?? 0} usati
              </span>
            </Link>
          ))
        ) : (
          <p className="text-muted">Nessuna serata in programma.</p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 10: Esegui i test.** `npm test && npm run test:e2e`. Atteso: l'intera suite e2e PASS. Poi `npm run lint && npm run typecheck`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(admin): lista clienti, unione doppioni, export CSV e dashboard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Health check, CI, keep-alive, backup e runbook di deploy

**Files:**
- Create: `app/api/health/route.ts`, `.github/workflows/ci.yml`, `.github/workflows/keepalive.yml`, `.github/workflows/backup.yml`, `docs/deploy.md`
- Test: `e2e/health.spec.ts`

**Interfaces:**
- Consumes: `createAdminClient`.
- Produces: `GET /api/health`, che risponde `200 {"ok":true}` se il DB risponde e `503 {"ok":false}` altrimenti. Lo usa il workflow di keep-alive.

- [ ] **Step 1: Scrivi il test che fallisce.** `e2e/health.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('health check interroga il database', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});
```

- [ ] **Step 2: Esegui il test.** `npm run test:e2e -- health.spec.ts`. Atteso: FAIL (404).

- [ ] **Step 3: Implementa.** `app/api/health/route.ts`:

```ts
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error } = await createAdminClient().from('events').select('id', { count: 'exact', head: true });
  if (error) return Response.json({ ok: false }, { status: 503 });
  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Esegui il test.** `npm run test:e2e -- health.spec.ts`. Atteso: PASS.

- [ ] **Step 5: Workflow.** `.github/workflows/ci.yml`:

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npx supabase db start
      - run: npm run test:db
```

`.github/workflows/keepalive.yml` (evita che il progetto Supabase free vada in pausa dopo 7 giorni di inattività):

```yaml
name: keepalive
on:
  schedule:
    - cron: '17 6 * * *'
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl --fail --silent --show-error --max-time 30 "${{ secrets.SITE_URL }}/api/health"
```

`.github/workflows/backup.yml`:

```yaml
name: backup
on:
  schedule:
    - cron: '0 3 * * 0'
  workflow_dispatch:
jobs:
  dump:
    runs-on: ubuntu-latest
    steps:
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: sudo apt-get update && sudo apt-get install -y age
      - name: Dump cifrato
        env:
          DB_URL: ${{ secrets.SUPABASE_DB_URL }}
          AGE_RECIPIENT: ${{ secrets.AGE_RECIPIENT }}
        run: |
          supabase db dump --db-url "$DB_URL" -f roles.sql --role-only
          supabase db dump --db-url "$DB_URL" -f schema.sql
          supabase db dump --db-url "$DB_URL" -f data.sql --use-copy --data-only
          tar czf backup.tgz roles.sql schema.sql data.sql
          age -r "$AGE_RECIPIENT" -o backup.tgz.age backup.tgz
          rm backup.tgz roles.sql schema.sql data.sql
      - uses: actions/upload-artifact@v4
        with:
          name: backup-${{ github.run_id }}
          path: backup.tgz.age
          retention-days: 90
```

- [ ] **Step 6: Runbook.** `docs/deploy.md`:

````markdown
# Deploy e operazioni

## 1. Supabase (produzione)
1. Crea un progetto su supabase.com in una **regione UE** (es. Francoforte). Salva la password del DB nel password manager.
2. Collega il progetto e applica le migrazioni:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. In Authentication:
   - Sign In / Providers → Email: disattiva "Allow new users to sign up".
   - URL Configuration: imposta `Site URL = https://<dominio>`.
   - Consigliato: attiva la MFA TOTP.
4. Project Settings → API Keys: copia la **publishable** key e la **secret** key.

## 2. Cloudflare Turnstile
Crea un widget su dash.cloudflare.com → Turnstile, con dominio `<dominio>` e modalità Managed. Copia sitekey e secret.

## 3. Netlify
1. Crea il repository GitHub (privato), fai push di `main` e importalo su Netlify (Add new site → Import from Git). Build: `npm run build`.
2. Configura le variabili d'ambiente (Site configuration → Environment variables):
   - `NEXT_PUBLIC_SITE_URL=https://<dominio>`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
   - `NEXT_PUBLIC_TURNSTILE_SITEKEY`, `TURNSTILE_SECRET`
   - `IP_HASH_SALT` (genera con `openssl rand -hex 32`)
3. Domain management → Add a domain, poi configura i DNS dal registrar seguendo le istruzioni di Netlify (CNAME per `www`, ALIAS/A per il dominio principale). Il certificato HTTPS si attiva in automatico.
4. Verifica su un deploy preview che `/admin` reindirizzi a `/admin/login`: `proxy.ts` deve essere supportato dal runtime Next di Netlify.

## 4. Account del PR
Crea `.env.production.local` (è già ignorato da git) con `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SECRET_KEY` di produzione, poi:
```bash
node --env-file=.env.production.local scripts/create-admin.ts <email-del-pr> <password-lunga>
```
Cancella il file subito dopo.

## 5. GitHub Actions
1. Genera la chiave per i backup, **offline**: `age-keygen -o backup-key.txt`. Custodisci `backup-key.txt` nel password manager e **non** nel repository.
2. In Settings → Secrets and variables → Actions, crea:
   - `SITE_URL` = `https://<dominio>`
   - `SUPABASE_DB_URL` = connection string "Session pooler" (porta 5432) presa da Supabase → Connect
   - `AGE_RECIPIENT` = la chiave pubblica (`age1...`) stampata da `age-keygen`
3. Lancia a mano `keepalive` e `backup` (Actions → Run workflow) e controlla che finiscano in verde.

## 6. Privacy
Compila `DATA_CONTROLLER` in `lib/privacy.ts` e fai validare `app/privacy/page.tsx` da un consulente. Se il testo cambia nella sostanza, incrementa `PRIVACY_VERSION`.

## 7. Controlli di sicurezza prima del go-live
- Supabase → Advisors (Security e Performance), oppure lo strumento MCP `get_advisors`: nessun errore.
- La chiave pubblica non deve leggere dati. Questo comando deve rispondere con un errore di permesso o con `[]`:
  ```bash
  curl "https://<ref>.supabase.co/rest/v1/customers?select=*" -H "apikey: <publishable-key>"
  ```

## 8. Smoke test in produzione
1. Il PR crea una serata di prova, la attiva, scansiona il QR dal telefono e si registra.
2. Apre il link staff su un secondo telefono, inserisce il PIN e brucia il coupon.
3. Controlla che il secondo tentativo risponda "Già usato".
4. Elimina i dati di prova dal SQL editor:
   ```sql
   delete from public.events where slug = '<slug-di-prova>';
   delete from public.customers c
    where not exists (select 1 from public.registrations r where r.customer_id = c.id);
   ```

## Ripristino da backup
```bash
age -d -i backup-key.txt -o backup.tgz backup.tgz.age
tar xzf backup.tgz
psql "$DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
  -f roles.sql -f schema.sql -c 'SET session_replication_role = replica' -f data.sql
```

## Note
- Piano free di Supabase: il keep-alive evita la pausa, ma i backup automatici giornalieri ci sono solo sul piano Pro. Conviene passare a Pro quando i clienti diventano centinaia.
- I workflow schedulati di GitHub si disattivano dopo 60 giorni di inattività solo nei repository pubblici: tieni il repository privato.
````

- [ ] **Step 7: Verifica completa.** `npm run lint && npm run typecheck && npm test && npm run test:db && npm run test:e2e && npm run build`. Atteso: tutto verde.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore(ops): health check, CI, keep-alive Supabase, backup cifrati e runbook di deploy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Copertura della spec (Fase 1)

| Requisito della spec | Task |
|---|---|
| Schema, RLS senza policy anon, admin tramite `admins` | 2 |
| `register_for_event` con dedup per telefono/dispositivo, finestra, rate limit, consenso 30 gg | 3 |
| `redeem_event_coupon` atomico, PIN bcrypt con blocco | 3, 8 (concorrenza) |
| `merge_customers`, doppioni suggeriti, pulizia 12 mesi con `pg_cron` | 4, 9 |
| Login admin, 2FA consigliata, registrazioni disattivate | 5, docs/deploy.md |
| `/admin/eventi`: CRUD, QR PNG/SVG, PIN staff, statistiche | 6 |
| `/e/[slug]` con Turnstile, `/c/[token]`, `/privacy` versionata | 7 |
| `/v/[staffToken]` con PIN e bruciatura | 8 |
| `/admin/clienti`: ricerca, storico, consenso, doppioni, export CSV | 9 |
| Dashboard admin | 9 |
| Keep-alive, backup `pg_dump` cifrato, CI | 10 |
| Controllo con gli advisors, verifica che la publishable key non legga i dati | docs/deploy.md §7 |

Rimandati alle fasi successive, come da spec: sponsor, offerte, template, invii, `/o`, `/s` (Fase 2); landing, `/sponsor` e brand (Fase 3).
