ALTER TABLE "Prodotto" ADD COLUMN "sottocategoria" TEXT, ADD COLUMN "colore" TEXT, ADD COLUMN "genere" TEXT,
  ADD COLUMN "materiale" TEXT, ADD COLUMN "certificazione" TEXT, ADD COLUMN "moto" TEXT;
CREATE TABLE "Limite" (
  "chiave" TEXT NOT NULL PRIMARY KEY,
  "conteggio" INTEGER NOT NULL,
  "scade" TIMESTAMP(3) NOT NULL
);
