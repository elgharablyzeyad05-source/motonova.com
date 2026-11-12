-- Usato: più pezzi unici con stesso colore e taglia
ALTER TABLE "Variante" ADD COLUMN IF NOT EXISTS "pezzo" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS "Variante_prodottoId_colore_taglia_pezzo_key" ON "Variante"("prodottoId", "colore", "taglia", "pezzo");
DROP INDEX IF EXISTS "Variante_prodottoId_colore_taglia_key";
