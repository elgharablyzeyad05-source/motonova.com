-- Colore e foto principale per colorazione
ALTER TABLE "Foto" ADD COLUMN IF NOT EXISTS "colore" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Foto" ADD COLUMN IF NOT EXISTS "principale" BOOLEAN NOT NULL DEFAULT false;
