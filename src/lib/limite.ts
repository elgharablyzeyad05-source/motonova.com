import { db } from "./db";

/** Limitatore su database: i contatori sono condivisi fra tutte le istanze (su Vercel la memoria no).
 *  Finestra fissa. Se il database non risponde lascia passare: meglio un abuso raro di un sito fermo. */
export async function limita(chiave: string, max: number, finestraMs: number): Promise<boolean> {
  try {
    const sec = Math.max(1, Math.round(finestraMs / 1000));
    const r = await db.$queryRaw<{ conteggio: number }[]>`
      INSERT INTO "Limite" ("chiave", "conteggio", "scade") VALUES (${chiave}, 1, now() + make_interval(secs => ${sec}))
      ON CONFLICT ("chiave") DO UPDATE SET
        "conteggio" = CASE WHEN "Limite"."scade" < now() THEN 1 ELSE "Limite"."conteggio" + 1 END,
        "scade" = CASE WHEN "Limite"."scade" < now() THEN now() + make_interval(secs => ${sec}) ELSE "Limite"."scade" END
      RETURNING "conteggio"`;
    if (Math.random() < 0.02) db.$executeRaw`DELETE FROM "Limite" WHERE "scade" < now() - interval '1 day'`.catch(() => {});
    return (r[0]?.conteggio ?? 1) <= max;
  } catch { return true; }
}

export async function azzera(chiave: string) { await db.$executeRaw`DELETE FROM "Limite" WHERE "chiave" = ${chiave}`.catch(() => {}); }
