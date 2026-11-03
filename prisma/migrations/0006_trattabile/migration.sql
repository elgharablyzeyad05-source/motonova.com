ALTER TABLE "Prodotto" ADD COLUMN "trattabile" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Prodotto" SET "trattabile" = true WHERE "prezzoMinimo" IS NOT NULL;
