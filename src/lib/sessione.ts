import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";

const NOME = "mn_s";
const GIORNI = 30;

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function creaSessione(utenteId: string) {
  const token = randomBytes(32).toString("hex");
  const scade = new Date(Date.now() + GIORNI * 864e5);
  await db.sessione.create({ data: { tokenHash: hash(token), utenteId, scade } });
  const c = await cookies();
  c.set(NOME, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", expires: scade,
  });
}

export async function utenteCorrente() {
  const c = await cookies();
  const token = c.get(NOME)?.value;
  if (!token) return null;
  const s = await db.sessione.findUnique({ where: { tokenHash: hash(token) }, include: { utente: true } });
  if (!s || s.scade < new Date()) return null;
  return s.utente;
}

export async function chiudiSessione() {
  const c = await cookies();
  const token = c.get(NOME)?.value;
  if (token) await db.sessione.deleteMany({ where: { tokenHash: hash(token) } });
  c.delete(NOME);
}

export const cifra = (pw: string) => bcrypt.hash(pw, 11);
export const confronta = (pw: string, h: string) => bcrypt.compare(pw, h);

/** Un `torna` accetta solo percorsi interni: con `http://` si costruisce una truffa credibile da un nostro link. */
export function tornaSicuro(torna: unknown, predefinito = "/account"): string {
  if (typeof torna !== "string") return predefinito;
  if (!torna.startsWith("/") || torna.startsWith("//") || torna.includes("\\") || /[\r\n]/.test(torna)) return predefinito;
  return torna;
}

export async function richiediAdmin() {
  const u = await utenteCorrente();
  if (!u || u.ruolo !== "ADMIN") return null;
  return u;
}
