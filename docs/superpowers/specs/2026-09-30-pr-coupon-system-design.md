# Spec — Sistema promozionale PR/DJ (coupon serate + offerte sponsor)

## Context

Un PR, che fa anche il DJ, vuole sponsorizzare da solo le serate in cui suona:
- si accorda con chi organizza la serata;
- trova attività sponsor che pagano lo sconto dato ai clienti;
- distribuisce un QR per serata che dà diritto a un coupon;
- raccoglie i contatti di chi lo usa, con il consenso;
- manda a queste persone, via WhatsApp (copia-incolla manuale nella v1), le offerte degli sponsor, ciascuna con un codice personale;
- mostra agli sponsor i dati reali di utilizzo, che sono la base per farsi pagare.

Ci sono anche una landing pubblica (bio e foto del DJ) e una pagina che spiega il servizio agli sponsor. All'inizio i volumi sono piccoli, ma l'infrastruttura deve reggere la crescita. Il dominio è già stato acquistato. Budget: piani gratuiti. Nessuna scadenza.

**Decisioni già prese con l'utente**
- **QR:** uno per serata. Ogni cliente riceve un coupon personale univoco.
- **Form:**
  - campi nome, cognome e **telefono facoltativo**;
  - 3 checkbox: privacy (obbligatoria), accettazione del coupon (obbligatoria), offerte per 30 giorni (facoltativa).
- **Validazione al bar:** il barista "brucia" il coupon da una pagina protetta da PIN.
- **Offerte sponsor:** codice univoco per cliente. Il negozio lo valida da un link segreto con PIN, senza account.
- **Consenso:** 30 giorni, che ripartono da ogni registrazione con la spunta.
- **Identità del cliente:** riconoscimento automatico tramite il telefono. Senza telefono, il PR unisce i doppioni a mano (con suggerimenti).
- **Account:** ha un login solo il PR.
- **Coupon della serata:** testo libero, uno per persona, valido solo nella fascia oraria della serata.
- **Destinatari delle offerte:** chi ha il consenso attivo, con filtri facoltativi (serate, "solo chi ha usato il coupon").
- **Età:** nessuna verifica per ora.
- **Landing:** solo bio e foto (niente social), più la pagina `/sponsor`. I contenuti stanno nel codice.
- **Stack:**
  - Next.js (App Router, TypeScript) su **Netlify**, perché il piano Hobby di Vercel vieta l'uso commerciale;
  - Supabase: Postgres, Auth e `pg_cron`.
- **Approccio:** monolite Next.js con la logica lato server (Server Actions) e funzioni Postgres per le operazioni atomiche.

## Architettura

```
Browser ──► Netlify (Next.js)
             ├─ pagine pubbliche (SSG/SSR)
             ├─ Server Actions ──► Supabase (service key, solo server)
             │                       └─ RPC atomiche + tabelle (RLS on, nessuna policy anon)
             └─ /admin (Supabase Auth, sessione via @supabase/ssr)
GitHub Actions: keep-alive giornaliero, pg_dump settimanale
```

- Il browser non tocca mai le tabelle direttamente. Tutte le operazioni pubbliche passano dalle Server Actions.
- L'admin legge e scrive tramite il client server-side con la sessione del PR. Le policy RLS consentono tutto solo all'utente admin (`auth.uid()` presente nella tabella `admins`).

## Pagine

| Route | Chi | Funzione |
|---|---|---|
| `/` | pubblico | Landing del DJ: bio e foto |
| `/sponsor` | pubblico | Spiega il servizio alle attività, con CTA per contattare il PR (mailto / wa.me) |
| `/privacy` | pubblico | Informativa privacy versionata |
| `/e/[slug]` | cliente | Destinazione del QR della serata: form con Turnstile, crea il coupon e reindirizza a `/c/[token]` |
| `/c/[token]` | cliente | Coupon personale: titolo, codice di 6 caratteri, QR del codice, stato (valido / usato / scaduto) |
| `/o/[token]` | cliente | Offerta sponsor personale: codice, validità, link "non voglio più offerte" |
| `/v/[staffToken]` | barista | PIN (cookie di sessione), poi inserimento o scansione del codice, poi "Brucia" |
| `/s/[validationToken]` | sponsor | PIN, poi validazione del codice offerta, più un contatore degli utilizzi della propria offerta |
| `/admin/login` | PR | Email e password (registrazioni pubbliche disattivate, 2FA TOTP consigliata) |
| `/admin` | PR | Dashboard: prossime serate, numeri principali |
| `/admin/eventi` | PR | Gestione serate, download del QR (PNG/SVG), PIN staff, statistiche |
| `/admin/clienti` | PR | Ricerca, storico, consenso, doppioni suggeriti con unione, export CSV |
| `/admin/sponsor` | PR | Anagrafica sponsor, link e PIN di validazione, offerte, report |
| `/admin/template` | PR | Template WhatsApp con segnaposto `{nome} {cognome} {link_offerta} {codice} {sponsor} {scadenza}` |
| `/admin/invii/[offerId]` | PR | Filtri e generazione dei codici, poi lista con messaggio già compilato, pulsanti Copia / Apri WhatsApp e spunta "inviato" |

## Modello dati

```
admins            user_id (→ auth.users)
events            id, slug UNIQUE, title, venue_name, starts_at, ends_at,
                  coupon_title, coupon_description, staff_token UNIQUE, staff_pin_hash,
                  status (draft|live|closed), created_at
customers         id, first_name, last_name, phone_e164 UNIQUE NULL,
                  marketing_consent_until, merged_into_id NULL → customers,
                  created_at, last_activity_at
registrations     id, event_id, customer_id, UNIQUE(event_id, customer_id),
                  coupon_code, UNIQUE(event_id, coupon_code), coupon_token UNIQUE,
                  redeemed_at, consent_privacy_at, consent_coupon_at,
                  consent_marketing bool, privacy_version, device_id, ip_hash, created_at
sponsors          id, name, contact_name, phone, email, notes,
                  validation_token UNIQUE, pin_hash, active
offers            id, sponsor_id, title, description, terms, valid_from, valid_until,
                  max_redemptions NULL, status (draft|active|ended)
offer_codes       id, offer_id, customer_id, UNIQUE(offer_id, customer_id),
                  code, UNIQUE(offer_id, code), token UNIQUE, sent_at, redeemed_at
message_templates id, name, kind (offer|event|generic), body
pin_attempts      scope, key, failed_count, locked_until
```

- **Codici:** 6 caratteri presi dall'alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, cioè senza caratteri ambigui.
- **Token:** 128 bit casuali codificati in base64url.
- **PIN:** hash bcrypt tramite `pgcrypto`, blocco di 15 minuti dopo 5 tentativi sbagliati.

**Funzioni Postgres (security definer, eseguibili solo dal service role)**
- `register_for_event(slug, first, last, phone?, consents, device_id, ip_hash, privacy_version)`:
  - verifica che la serata sia `live` e dentro la finestra `starts_at - 12h … ends_at`;
  - trova il cliente dal telefono, altrimenti crea un nuovo cliente;
  - se esiste già una registrazione per quella serata (stesso cliente oppure stesso `device_id`), restituisce il coupon esistente;
  - altrimenti crea la registrazione e il codice;
  - se c'è il consenso alle offerte, imposta `marketing_consent_until = now() + 30 giorni`.
- `redeem_event_coupon(staff_token, pin, code)`: controlla PIN e blocco, poi fa `UPDATE … SET redeemed_at = now() WHERE redeemed_at IS NULL AND now() BETWEEN starts_at AND ends_at + margine`. Restituisce `ok | already_used | not_found | out_of_window | locked`.
- `redeem_offer_code(validation_token, pin, code)`: stessa logica, più il controllo di validità e di `max_redemptions`.
- `generate_offer_codes(offer_id, event_ids[]?, only_redeemed bool)`: considera solo i clienti con `marketing_consent_until > now()` e non uniti ad altri, poi inserisce i codici con `ON CONFLICT DO NOTHING`.
- `merge_customers(keep_id, drop_id)`: sposta registrazioni e codici sul cliente principale (se c'è un conflitto sulla stessa serata tiene quella già bruciata) e imposta `merged_into_id`.
- `revoke_marketing(offer_token)`: imposta `marketing_consent_until = now()`.
- **Job giornaliero con `pg_cron`:** cancella i clienti senza attività da 12 mesi (durata da confermare con il consulente privacy). Le cancellazioni si propagano a registrazioni e codici.

## Sicurezza e GDPR

- RLS è attivo su tutte le tabelle. L'unica policy è quella per l'admin. La service key compare solo nelle env server-side di Netlify.
- Il form pubblico usa Cloudflare Turnstile, verificato lato server, e un rate limit per IP. L'IP si salva solo come hash salato.
- Ogni registrazione salva la data e ora di ciascun consenso e `privacy_version`, che fa da prova del consenso.
- Gli sponsor non ricevono mai dati personali: vedono solo il codice e il conteggio degli utilizzi.
- Il titolare del trattamento è il PR. Il testo dell'informativa lo fornisce un consulente, mentre il sistema si occupa di versionarlo.

## Gestione

- **Supabase:** progetti `dev` e `prod`, migrazioni versionate con la CLI (`supabase/migrations`), tipi TypeScript generati.
- **Netlify:** deploy da `main`, deploy preview per ogni pull request, dominio personalizzato.
- **GitHub Actions:**
  - keep-alive giornaliero (evita la pausa del piano free di Supabase);
  - `pg_dump` settimanale cifrato con `age` e salvato come artifact privato.
- **Env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITEKEY`, `IP_HASH_SALT`, `NEXT_PUBLIC_SITE_URL`.
- **Tema:** colori e font definiti come variabili CSS e token Tailwind, così il brand, ancora da decidere, si cambia facilmente.

## Struttura del repository (proposta)

```
app/(public)/page.tsx, sponsor/, privacy/, e/[slug]/, c/[token]/, o/[token]/
app/(validate)/v/[staffToken]/, s/[validationToken]/
app/admin/(auth)/login/, admin/eventi/, clienti/, sponsor/, template/, invii/[offerId]/
lib/supabase/{server,admin}.ts   lib/codes.ts   lib/templates.ts   lib/turnstile.ts
content/bio.md, sponsor.md, privacy-v1.md   public/img/
supabase/migrations/*.sql   supabase/tests/*.sql (pgTAP)
.github/workflows/{keepalive,backup}.yml
```

## Fasi (ognuna utilizzabile da sola)

1. **F1, serate:** schema, auth admin, CRUD serate con QR e PIN, form `/e`, coupon `/c`, validazione `/v`, lista clienti con unione dei doppioni ed export, keep-alive e backup.
2. **F2, sponsor:** sponsor, offerte, template, generazione codici e invii (copia / wa.me / spunta inviato), `/o`, `/s`, revoca del consenso, report per offerta.
3. **F3, vetrina:** landing `/`, `/sponsor`, `/privacy` definitiva, tema e brand.

**Fuori dalla v1:** invio automatico con la WhatsApp Business API, più PR, statistiche per l'organizzatore, verifica dell'età, contenuti modificabili dall'admin.

## Verifica

- **Vitest:** generazione dei codici (alfabeto, lunghezza), rendering dei template (segnaposto, link `wa.me` con testo codificato), normalizzazione dei telefoni in E.164.
- **pgTAP:**
  - `register_for_event` non crea duplicati (stesso telefono o stesso dispositivo);
  - la finestra oraria viene rispettata;
  - due `redeem_event_coupon` in parallelo producono esattamente un `ok` e un `already_used`;
  - il blocco del PIN scatta dopo 5 tentativi sbagliati;
  - `generate_offer_codes` esclude i consensi scaduti;
  - `merge_customers` non perde dati.
- **Playwright end-to-end (su Supabase dev):** crea la serata in admin, apre `/e/slug`, compila il form, arriva al coupon, `/v` con PIN lo brucia, un secondo tentativo risponde "già usato". In F2 si aggiunge: offerta, invio, `/o`, validazione su `/s`, report aggiornato.
- **Controlli di sicurezza:** `get_advisors` di Supabase (sicurezza e prestazioni) prima di ogni rilascio. Verifica che la anon key non possa leggere nessuna tabella.
