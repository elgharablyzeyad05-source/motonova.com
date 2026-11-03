-- MotoNova — schema iniziale. Importi in piastre (1 EGP = 100), sempre interi.

CREATE TYPE "Ruolo" AS ENUM ('CLIENTE','ADMIN');
CREATE TYPE "TipoProdotto" AS ENUM ('NUOVO','SECOND_LIFE');
CREATE TYPE "StatoOrdine" AS ENUM ('DA_CONFERMARE','CONFERMATO','PREPARAZIONE','SPEDITO','CONSEGNATO','ANNULLATO');
CREATE TYPE "Pagamento" AS ENUM ('CONTRASSEGNO','CARTA','RATE');
CREATE TYPE "StatoAsta" AS ENUM ('PROGRAMMATA','APERTA','CHIUSA');
CREATE TYPE "TipoCoupon" AS ENUM ('PERCENTUALE','FISSO');
CREATE TYPE "EsitoPosta" AS ENUM ('INVIATA','NON_CONFIGURATA','ERRORE');

CREATE TABLE "Utente" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "telefono" TEXT,
  "passwordHash" TEXT NOT NULL,
  "ruolo" "Ruolo" NOT NULL DEFAULT 'CLIENTE',
  "garanzia" BOOLEAN NOT NULL DEFAULT false,
  "creato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Utente_email_key" ON "Utente"("email");

CREATE TABLE "Sessione" (
  "id" TEXT PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "utenteId" TEXT NOT NULL REFERENCES "Utente"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "scade" TIMESTAMP(3) NOT NULL,
  "creata" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Sessione_tokenHash_key" ON "Sessione"("tokenHash");

CREATE TABLE "Marca" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "descrizione" TEXT
);
CREATE UNIQUE INDEX "Marca_slug_key" ON "Marca"("slug");
CREATE UNIQUE INDEX "Marca_nome_key" ON "Marca"("nome");

CREATE TABLE "Prodotto" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "marcaId" TEXT NOT NULL REFERENCES "Marca"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "nome" TEXT NOT NULL,
  "sottotitolo" TEXT NOT NULL DEFAULT '',
  "categoria" TEXT NOT NULL,
  "stili" TEXT[],
  "tipo" "TipoProdotto" NOT NULL DEFAULT 'NUOVO',
  "prezzo" INTEGER NOT NULL,
  "prezzoPrima" INTEGER,
  "nota" TEXT NOT NULL DEFAULT '',
  "luogo" TEXT NOT NULL DEFAULT '',
  "grado" TEXT,
  "descrizione" TEXT[],
  "specs" JSONB NOT NULL DEFAULT '[]',
  "report" JSONB,
  "attivo" BOOLEAN NOT NULL DEFAULT true,
  "creato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Prodotto_slug_key" ON "Prodotto"("slug");
CREATE INDEX "Prodotto_categoria_idx" ON "Prodotto"("categoria");
CREATE INDEX "Prodotto_marcaId_idx" ON "Prodotto"("marcaId");

CREATE TABLE "Variante" (
  "id" TEXT PRIMARY KEY,
  "prodottoId" TEXT NOT NULL REFERENCES "Prodotto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "taglia" TEXT NOT NULL,
  "giacenza" INTEGER NOT NULL DEFAULT 0,
  "impegnati" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Variante_non_negativa" CHECK ("giacenza" >= 0 AND "impegnati" >= 0 AND "impegnati" <= "giacenza")
);
CREATE UNIQUE INDEX "Variante_prodottoId_taglia_key" ON "Variante"("prodottoId","taglia");

CREATE TABLE "Foto" (
  "id" TEXT PRIMARY KEY,
  "prodottoId" TEXT NOT NULL REFERENCES "Prodotto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "grande" TEXT NOT NULL,
  "piccola" TEXT NOT NULL,
  "ordine" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "Carrello" (
  "id" TEXT PRIMARY KEY,
  "utenteId" TEXT REFERENCES "Utente"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "token" TEXT,
  "coupon" TEXT,
  "aggiornato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Carrello_utenteId_key" ON "Carrello"("utenteId");
CREATE UNIQUE INDEX "Carrello_token_key" ON "Carrello"("token");

CREATE TABLE "RigaCarrello" (
  "id" TEXT PRIMARY KEY,
  "carrelloId" TEXT NOT NULL REFERENCES "Carrello"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "varianteId" TEXT NOT NULL REFERENCES "Variante"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "quantita" INTEGER NOT NULL DEFAULT 1,
  "prezzoAsta" INTEGER
);
CREATE UNIQUE INDEX "RigaCarrello_carrelloId_varianteId_key" ON "RigaCarrello"("carrelloId","varianteId");

CREATE TABLE "Ordine" (
  "id" TEXT PRIMARY KEY,
  "numero" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "utenteId" TEXT REFERENCES "Utente"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "email" TEXT,
  "nome" TEXT NOT NULL,
  "telefono" TEXT NOT NULL,
  "governatorato" TEXT NOT NULL,
  "zona" INTEGER NOT NULL,
  "indirizzo" TEXT NOT NULL,
  "note" TEXT,
  "stato" "StatoOrdine" NOT NULL DEFAULT 'DA_CONFERMARE',
  "pagamento" "Pagamento" NOT NULL DEFAULT 'CONTRASSEGNO',
  "subtotale" INTEGER NOT NULL,
  "spedizione" INTEGER NOT NULL,
  "commissione" INTEGER NOT NULL DEFAULT 0,
  "sconto" INTEGER NOT NULL DEFAULT 0,
  "totale" INTEGER NOT NULL,
  "acconto" INTEGER NOT NULL DEFAULT 0,
  "contanti" INTEGER NOT NULL DEFAULT 0,
  "coupon" TEXT,
  "lingua" TEXT NOT NULL DEFAULT 'it',
  "creato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Ordine_numero_key" ON "Ordine"("numero");

CREATE TABLE "RigaOrdine" (
  "id" TEXT PRIMARY KEY,
  "ordineId" TEXT NOT NULL REFERENCES "Ordine"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "varianteId" TEXT REFERENCES "Variante"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "nome" TEXT NOT NULL,
  "marca" TEXT NOT NULL,
  "taglia" TEXT NOT NULL,
  "prezzo" INTEGER NOT NULL,
  "quantita" INTEGER NOT NULL
);

CREATE TABLE "StoriaOrdine" (
  "id" TEXT PRIMARY KEY,
  "ordineId" TEXT NOT NULL REFERENCES "Ordine"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "stato" "StatoOrdine" NOT NULL,
  "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Coupon" (
  "id" TEXT PRIMARY KEY,
  "codice" TEXT NOT NULL,
  "tipo" "TipoCoupon" NOT NULL,
  "valore" INTEGER NOT NULL,
  "minimo" INTEGER NOT NULL DEFAULT 0,
  "inizio" TIMESTAMP(3),
  "fine" TIMESTAMP(3),
  "usiMax" INTEGER,
  "usiFatti" INTEGER NOT NULL DEFAULT 0,
  "perPersona" INTEGER,
  "attivo" BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX "Coupon_codice_key" ON "Coupon"("codice");

CREATE TABLE "UsoCoupon" (
  "id" TEXT PRIMARY KEY,
  "couponId" TEXT NOT NULL REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "chiave" TEXT NOT NULL,
  "ordineId" TEXT NOT NULL REFERENCES "Ordine"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "sconto" INTEGER NOT NULL,
  "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "UsoCoupon_couponId_chiave_idx" ON "UsoCoupon"("couponId","chiave");

CREATE TABLE "Iscritto" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "lingua" TEXT NOT NULL DEFAULT 'it',
  "creato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Iscritto_email_key" ON "Iscritto"("email");

CREATE TABLE "Preferito" (
  "id" TEXT PRIMARY KEY,
  "utenteId" TEXT NOT NULL REFERENCES "Utente"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "prodottoId" TEXT NOT NULL REFERENCES "Prodotto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "prezzoSalvato" INTEGER NOT NULL,
  "creato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Preferito_utenteId_prodottoId_key" ON "Preferito"("utenteId","prodottoId");

CREATE TABLE "Asta" (
  "id" TEXT PRIMARY KEY,
  "prodottoId" TEXT NOT NULL REFERENCES "Prodotto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "inizio" TIMESTAMP(3) NOT NULL,
  "fine" TIMESTAMP(3) NOT NULL,
  "partenza" INTEGER NOT NULL,
  "riserva" INTEGER NOT NULL DEFAULT 0,
  "stato" "StatoAsta" NOT NULL DEFAULT 'PROGRAMMATA',
  "vincitoreId" TEXT REFERENCES "Utente"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "prezzoFinale" INTEGER
);
CREATE UNIQUE INDEX "Asta_prodottoId_key" ON "Asta"("prodottoId");

CREATE TABLE "Offerta" (
  "id" TEXT PRIMARY KEY,
  "astaId" TEXT NOT NULL REFERENCES "Asta"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "utenteId" TEXT NOT NULL REFERENCES "Utente"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "massimo" INTEGER NOT NULL,
  "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Offerta_astaId_utenteId_idx" ON "Offerta"("astaId","utenteId");

CREATE TABLE "Posta" (
  "id" TEXT PRIMARY KEY,
  "a" TEXT NOT NULL,
  "oggetto" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "esito" "EsitoPosta" NOT NULL,
  "errore" TEXT,
  "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
