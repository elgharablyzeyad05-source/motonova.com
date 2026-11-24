# Messa online su Vercel + Supabase

Database: schema/ruolo dedicato su Supabase (vedi sotto). App: Vercel (Next.js). Foto: nel database (tabella Media).

Variabili d'ambiente su Vercel:
- `DATABASE_URL` — stringa «Transaction pooler» di Supabase con l'utente dedicato `motonova_app.<ref>`
- `SITO_URL=https://motonova.online`
- `CHIAVE_GIRO` — stringa casuale (la stessa usata dal cron)
- `SMTP_*` (facoltativo), `PAYMOB_API_KEY` (quando disponibile)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — foto su Cloudflare R2 (vedi sotto)

Limiti da conoscere:
- le foto: massimo ~4 MB in totale per salvataggio (limite Vercel);
- le aste si chiudono con un job pg_cron su Supabase che chiama `/api/giro` ogni minuto (il cron gratuito di Vercel è solo giornaliero).

Foto su Cloudflare R2 (dal 24/11/2026, per non riempire i 500 MB di Supabase):
- le foto nuove si salvano ancora nella tabella Media; l'op agenti `{"op":"spostaFotoR2","quante":40}` le copia su R2, le ricontrolla e svuota i byte nel database (riga con dati vuoti = foto su R2). `/media/...` legge da dove stanno.
- dopo lo spostamento lo spazio in Postgres si libera davvero solo con `VACUUM FULL motonova."Media";` (SQL editor di Supabase).
