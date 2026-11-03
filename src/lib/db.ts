import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const g = globalThis as unknown as { __db?: PrismaClient };

// DB_SCHEMA: su Supabase le tabelle stanno nello schema «motonova», non in «public».
// Poche connessioni per istanza: su Vercel ogni istanza ne apre di proprie.
export const db: PrismaClient =
  g.__db ??
  (g.__db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: process.env.DATABASE_URL, max: process.env.VERCEL ? 3 : 10 },
      process.env.DB_SCHEMA ? { schema: process.env.DB_SCHEMA } : undefined,
    ),
  }));
