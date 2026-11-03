CREATE TABLE "Conversazione" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "utenteId" TEXT,
  "nome" TEXT,
  "creata" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ultimo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Conversazione_tokenHash_key" ON "Conversazione"("tokenHash");
CREATE TABLE "Messaggio" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversazioneId" TEXT NOT NULL REFERENCES "Conversazione"("id") ON DELETE CASCADE,
  "daStaff" BOOLEAN NOT NULL DEFAULT false,
  "testo" TEXT NOT NULL,
  "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "letto" BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX "Messaggio_conversazioneId_ts_idx" ON "Messaggio"("conversazioneId", "ts");
