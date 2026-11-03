import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { nuovoId } from "./id";

const COOKIE = "mn_c";
export const MAX_TESTO = 1000;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function conversazioneCorrente() {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t || t.length !== 48) return null;
  return db.conversazione.findUnique({ where: { tokenHash: hash(t) } });
}

/** La conversazione nasce al primo messaggio, non alla prima visita: niente righe per chi guarda e basta. */
export async function assicuraConversazione(utenteId?: string | null, nome?: string | null) {
  const e = await conversazioneCorrente(); if (e) return e;
  const token = randomBytes(24).toString("hex");
  const c = await db.conversazione.create({ data: { id: nuovoId(), tokenHash: hash(token), utenteId: utenteId ?? null, nome: nome?.slice(0, 60) || null } });
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180 });
  return c;
}

export function pulisci(t: unknown): string {
  // niente caratteri di controllo; React poi esegue l'escape: il testo non è mai HTML
  return String(t ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, MAX_TESTO);
}

export async function aggiungiMessaggio(conversazioneId: string, testo: string, daStaff: boolean) {
  const m = await db.messaggio.create({ data: { id: nuovoId(), conversazioneId, testo, daStaff } });
  await db.conversazione.update({ where: { id: conversazioneId }, data: { ultimo: m.ts } });
  return m;
}
