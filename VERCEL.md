# Messa online su Vercel + Supabase

Database: schema/ruolo dedicato su Supabase (vedi sotto). App: Vercel (Next.js). Foto: nel database (tabella Media).

Variabili d'ambiente su Vercel:
- `DATABASE_URL` — stringa «Transaction pooler» di Supabase con l'utente dedicato `motonova_app.<ref>`
- `SITO_URL=https://motonova.com`
- `CHIAVE_GIRO` — stringa casuale (la stessa usata dal cron)
- `SMTP_*` (facoltativo), `PAYMOB_API_KEY` (quando disponibile)

Limiti da conoscere:
- le foto: massimo ~4 MB in totale per salvataggio (limite Vercel);
- le aste si chiudono con un job pg_cron su Supabase che chiama `/api/giro` ogni minuto (il cron gratuito di Vercel è solo giornaliero).
