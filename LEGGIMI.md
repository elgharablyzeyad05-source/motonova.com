# MotoNova — avvio

Richiede Node 20+ e PostgreSQL 15+.

1. `cp .env.example .env` e compila (DATABASE_URL, SITO_URL, ADMIN_EMAIL/PASSWORD, CHIAVE_GIRO).
2. `npm install`
3. `npx prisma generate` poi applica `prisma/migrations/0001_init/migration.sql` al database (`psql "$DATABASE_URL" -f …`).
4. `npm run db:seed` — carica i 31 prodotti di prova e crea l'amministratore. Poi li sostituisci dal pannello.
5. `npm run build && npm start` (porta 3000).

## Pannello
`/operativo` (nessun link pubblico, 404 per chi non è admin). Ordini, prodotti + foto, coupon, aste, email, iscritti (CSV).

Per la messa online vedi DEPLOY.md.

## Chat
I messaggi arrivano nella scheda «chat» di /operativo (tra parentesi i non letti). Nessuna notifica email: controllala ogni tanto.

## Da fare prima di aprire
- **Aste**: cron ogni minuto su `GET /api/giro` con la chiave `CHIAVE_GIRO` (vedi `src/app/api/giro/route.ts`).
- **Email**: compila SMTP_*; finché mancano, ogni email è registrata come «NON_CONFIGURATA» nel pannello.
- **Carta / rate**: serve `PAYMOB_API_KEY`; senza, il server accetta solo il contrassegno.
- **Testi legali**: cerca `[DA COMPLETARE]` in `dati/legali.json` (ragione sociale, indirizzo, P.IVA/tax ID…).
- Cambia subito la password admin. Le foto stanno nel database: il backup del database le include.

## Prove
`npm run prova:tutto` (il test browser richiede `npx playwright install chromium` e il sito avviato su :3100).
