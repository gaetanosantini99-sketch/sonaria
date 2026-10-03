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
   - Sign In / Providers → Email: il provider **deve restare attivo** (il login con password lo richiede), ma disattiva "Allow new users to sign up". In locale `supabase/config.toml` rispecchia questa scelta: `[auth] enable_signup = false`, `[auth.email] enable_signup = true`.
   - URL Configuration: imposta `Site URL = https://<dominio>`.
   - Nota: la MFA TOTP non è ancora supportata dall'app (manca la schermata di verifica). Usa una password lunga e unica per l'account del PR.
4. Project Settings → API Keys: copia la **publishable** key e la **secret** key.

## 2. Cloudflare Turnstile
Crea un widget su dash.cloudflare.com → Turnstile, con dominio `<dominio>` e modalità Managed. Copia sitekey e secret.

## 3. Netlify
1. Crea il repository GitHub (privato), fai push di `main` e importalo su Netlify (Add new site → Import from Git). Build: `npm run build`. Node 24 è fissato in `netlify.toml`.
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
4. Prova un ripristino completo almeno una volta su un progetto di prova: un backup mai ripristinato non è un backup.

## 6. Privacy
Compila `DATA_CONTROLLER` in `lib/privacy.ts` e fai validare `app/privacy/page.tsx` da un consulente. Se il testo cambia nella sostanza, incrementa `PRIVACY_VERSION`.

## 7. Controlli di sicurezza prima del go-live
- Le migrazioni sono state sviluppate su un database nuovo: in produzione applicale sempre con `npx supabase db push` da un progetto pulito.
- Supabase → Advisors (Security e Performance), oppure lo strumento MCP `get_advisors`: nessun errore.
- La chiave pubblica non deve leggere dati. Questo comando deve rispondere con un errore di permesso o con `[]`:
  ```bash
  curl "https://<ref>.supabase.co/rest/v1/customers?select=*" -H "apikey: <publishable-key>"
  ```

## 8. Smoke test in produzione
1. Il PR crea una serata di prova, la attiva, scansiona il QR dal telefono e si registra.
2. Il barista apre il link staff su un secondo telefono, inserisce il PIN, digita o scansiona il codice e preme "Brucia coupon".
3. Controlla che il secondo tentativo risponda "Già usato".
4. Elimina i dati di prova dal SQL editor:
   ```sql
   -- 1) annota l'id del cliente di prova PRIMA di eliminare la serata
   select c.id, c.first_name, c.last_name
     from public.customers c
     join public.registrations r on r.customer_id = c.id
     join public.events e on e.id = r.event_id
    where e.slug = '<slug-di-prova>';
   -- 2) elimina la serata di prova (a cascata le sue registrazioni)
   delete from public.events where slug = '<slug-di-prova>';
   -- 3) elimina SOLO il cliente di prova annotato al punto 1
   delete from public.customers where id = '<id-del-cliente-di-prova>';
   ```

## Ripristino da backup
Si ripristina in un **nuovo** progetto Supabase pulito. `schema.sql` e `roles.sql` nell'archivio sono solo di riferimento.
1. Crea un nuovo progetto Supabase, poi `npx supabase link --project-ref <nuovo-ref>` e `npx supabase db push` (lo schema arriva dalle migrazioni, non dal dump).
2. Decifra ed estrai:
   ```bash
   age -d -i backup-key.txt -o backup.tgz backup.tgz.age && tar xzf backup.tgz
   ```
3. Carica solo i dati:
   ```bash
   psql "<connection-string-del-nuovo-progetto>" --single-transaction -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica" -f data.sql
   ```
4. Gli utenti di Supabase Auth NON sono nel backup: esegui `delete from public.admins;` dal SQL editor e ricrea l'account del PR con `scripts/create-admin.ts` (vedi §4).
5. Aggiorna le variabili d'ambiente su Netlify (URL e chiavi del nuovo progetto) e i secret GitHub (`SUPABASE_DB_URL`), poi rifai lo smoke test.

## Limiti noti e rischi accettati
- Il telefono non è verificato. Chi conosce il numero di un cliente già registrato può: riaprire il suo coupon per la stessa serata; registrarlo a un'altra serata attiva (il coupon finisce sulla sua scheda). Il nome del cliente si vede solo sul telefono che ha fatto la registrazione, e il consenso alle offerte si rinnova solo se anche nome e cognome coincidono con la scheda. Mitigazione futura: verifica via OTP.
- Una serata si può eliminare dall'admin solo se non ha registrazioni; altrimenti va chiusa.
- Il rate limit per IP si basa sull'header `x-nf-client-connection-ip` impostato da Netlify: se si cambia hosting va rivisto `lib/ip.ts`.
- La sessione dei baristi vale finché il PR non cambia il PIN della serata (per revocare tutti i telefoni: cambiare il PIN).
- L'informativa privacy è una bozza da validare.

## Note
- Piano free di Supabase: il keep-alive evita la pausa, ma i backup automatici giornalieri ci sono solo sul piano Pro. Conviene passare a Pro quando i clienti diventano centinaia.
- I workflow schedulati di GitHub si disattivano dopo 60 giorni di inattività solo nei repository pubblici: tieni il repository privato.
