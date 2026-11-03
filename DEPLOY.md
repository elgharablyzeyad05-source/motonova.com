# Messa online — motonova.online

1. **VPS**: Hetzner o DigitalOcean, Ubuntu 24.04, 2 GB RAM (circa 5–8 €/mese), datacenter Frankfurt.
2. **DNS**: record A di `motonova.online` e `www` → IP del VPS.
3. Sul VPS: `curl -fsSL https://get.docker.com | sh`
4. Carica la cartella (`scp motonova.tar.gz …` e `tar xzf`), poi:
   `cp .env.produzione.example .env` e compila.
5. `docker compose up -d --build` (HTTPS di Let's Encrypt automatico).
6. Crea l'admin: `docker compose run --rm app npm run db:admin`
7. Apri `https://motonova.online/operativo`, entra e carica i prodotti.

Le aste si chiudono da sole (servizio `giro` nel compose). Foto e database stanno in volumi Docker: fai un backup periodico (`docker compose exec db pg_dump -U motonova motonova > backup.sql`).
