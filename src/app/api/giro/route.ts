import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { giro } from "@/lib/aste";
import { scadenzeBlocchi } from "@/lib/ordini";

// Va chiamato ogni minuto da un cron del server: apre le aste che iniziano e chiude quelle scadute.
// Senza CHIAVE_GIRO l'indirizzo è spento: non ci si può affidare a un URL aperto a tutti.
export async function GET(req: Request) {
  const chiave = process.env.CHIAVE_GIRO;
  if (!chiave) return NextResponse.json({ errore: "spento: manca CHIAVE_GIRO" }, { status: 503 });
  const dato = req.headers.get("x-chiave") ?? new URL(req.url).searchParams.get("chiave") ?? "";
  const ok = dato.length === chiave.length && timingSafeEqual(Buffer.from(dato), Buffer.from(chiave));
  if (!ok) return NextResponse.json({ errore: "non autorizzato" }, { status: 401 });
  const base = (process.env.SITO_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  const r = await giro(base);
  const blocchiScaduti = await scadenzeBlocchi();
  return NextResponse.json({ ...r, blocchiScaduti });
}
export const POST = GET;
export const dynamic = "force-dynamic";
