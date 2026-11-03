import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";

export type Motivo = "NON_VALIDO" | "SCADUTO" | "ESAURITO" | "SOTTO_MINIMO" | "GIA_USATO";
export type EsitoCoupon =
  | { ok: true; id: string; codice: string; sconto: number }
  | { ok: false; motivo: Motivo; minimo?: number };

export const normalizza = (c: string) => c.trim().toUpperCase().replace(/\s+/g, "");

type C = { tipo: "PERCENTUALE" | "FISSO"; valore: number };
/** Lo sconto non supera mai la merce: un codice da 500 su un ordine da 300 fa pagare zero. */
export function calcolaSconto(c: C, subtotale: number): number {
  const s = c.tipo === "PERCENTUALE" ? Math.round((subtotale * c.valore) / 100) : c.valore;
  return Math.max(0, Math.min(s, subtotale));
}

export const chiaveCliente = (utenteId?: string | null, email?: string | null) =>
  utenteId ? `u:${utenteId}` : email ? `e:${email.trim().toLowerCase()}` : "";

/** Un codice inventato e un codice spento danno la stessa risposta: dire «esiste ma è scaduto»
 *  a chi tira a indovinare serve solo a fargli scoprire quali codici esistono. */
export async function valutaCoupon(codice: string, subtotale: number, chiave: string, adesso = new Date()): Promise<EsitoCoupon> {
  const cod = normalizza(codice);
  if (!cod) return { ok: false, motivo: "NON_VALIDO" };
  const c = await db.coupon.findUnique({ where: { codice: cod } });
  if (!c || !c.attivo) return { ok: false, motivo: "NON_VALIDO" };
  if (c.inizio && c.inizio > adesso) return { ok: false, motivo: "NON_VALIDO" };
  if (c.fine && c.fine < adesso) return { ok: false, motivo: "SCADUTO" };
  if (c.usiMax !== null && c.usiFatti >= c.usiMax) return { ok: false, motivo: "ESAURITO" };
  if (subtotale < c.minimo) return { ok: false, motivo: "SOTTO_MINIMO", minimo: c.minimo };
  if (c.perPersona !== null && chiave) {
    const usi = await db.usoCoupon.count({ where: { couponId: c.id, chiave } });
    if (usi >= c.perPersona) return { ok: false, motivo: "GIA_USATO" };
  }
  return { ok: true, id: c.id, codice: c.codice, sconto: calcolaSconto(c, subtotale) };
}

/** Il conteggio si alza con un UPDATE condizionale dentro la transazione dell'ordine:
 *  letto, controllato e poi aumentato verrebbe usato duecento volte durante una promozione. */
export async function consuma(tx: Prisma.TransactionClient, couponId: string): Promise<boolean> {
  const n = await tx.$executeRaw`UPDATE "Coupon" SET "usiFatti" = "usiFatti" + 1
    WHERE "id" = ${couponId} AND "attivo" AND ("usiMax" IS NULL OR "usiFatti" < "usiMax")`;
  return n === 1;
}
