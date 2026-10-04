# Sonaria

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
