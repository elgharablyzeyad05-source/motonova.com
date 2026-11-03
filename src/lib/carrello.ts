import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { utenteCorrente } from "./sessione";
import { disponibile } from "./catalogo";
import { calcolaSconto, chiaveCliente, normalizza, valutaCoupon, type Motivo } from "./coupon";

const COOKIE = "mn_c";

const includeRighe = {
  righe: {
    orderBy: { id: "asc" as const },
    include: {
      variante: { include: { prodotto: { include: { marca: true, foto: { orderBy: { ordine: "asc" as const }, take: 1 } } } } },
    },
  },
};

export async function trovaCarrello() {
  const u = await utenteCorrente();
  if (u) return db.carrello.findUnique({ where: { utenteId: u.id }, include: includeRighe });
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return db.carrello.findUnique({ where: { token }, include: includeRighe });
}

/** Solo da azioni e route handler: scrive il cookie. */
export async function assicuraCarrello() {
  const u = await utenteCorrente();
  if (u) {
    return db.carrello.upsert({ where: { utenteId: u.id }, update: {}, create: { utenteId: u.id }, include: { righe: true } });
  }
  const c = await cookies();
  const esistente = c.get(COOKIE)?.value;
  if (esistente) {
    const k = await db.carrello.findUnique({ where: { token: esistente }, include: { righe: true } });
    if (k) return k;
  }
  const token = randomBytes(24).toString("hex");
  const k = await db.carrello.create({ data: { token }, include: { righe: true } });
  c.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 60 });
  return k;
}

export type EsitoAggiungi = "OK" | "ESAURITO" | "NON_TROVATO" | "SOLO_ASTA";

export async function aggiungi(varianteId: string, quantita = 1): Promise<EsitoAggiungi> {
  const v = await db.variante.findUnique({ where: { id: varianteId }, include: { prodotto: true } });
  if (!v || !v.prodotto.attivo) return "NON_TROVATO";
  // Senza questa porta chiusa un pezzo all'asta si comprerebbe a listino mandando a mano la richiesta giusta.
  if (v.prodotto.tipo === "SECOND_LIFE") return "SOLO_ASTA";
  const k = await assicuraCarrello();
  const riga = k.righe.find((r) => r.varianteId === varianteId);
  if (riga?.prezzoPattuito != null) return "OK"; // il pezzo trattato resta uno solo, al prezzo concordato
  const disp = disponibile(v);
  const voluta = Math.min((riga?.quantita ?? 0) + Math.max(1, Math.floor(quantita)), 20);
  if (disp <= 0) return "ESAURITO";
  const q = Math.min(voluta, disp);
  if (riga) await db.rigaCarrello.update({ where: { id: riga.id }, data: { quantita: q } });
  else await db.rigaCarrello.create({ data: { carrelloId: k.id, varianteId, quantita: q } });
  await db.carrello.update({ where: { id: k.id }, data: { aggiornato: new Date() } });
  return "OK";
}

/** Mette nel carrello un solo pezzo al prezzo concordato (sostituisce un'eventuale riga normale della stessa taglia). */
export async function aggiungiPattuito(varianteId: string, prezzo: number): Promise<EsitoAggiungi> {
  const v = await db.variante.findUnique({ where: { id: varianteId }, include: { prodotto: true } });
  if (!v || !v.prodotto.attivo) return "NON_TROVATO";
  if (v.prodotto.tipo === "SECOND_LIFE") return "SOLO_ASTA";
  if (disponibile(v) <= 0) return "ESAURITO";
  const k = await assicuraCarrello();
  const riga = k.righe.find((r) => r.varianteId === varianteId);
  if (riga) await db.rigaCarrello.update({ where: { id: riga.id }, data: { quantita: 1, prezzoPattuito: prezzo } });
  else await db.rigaCarrello.create({ data: { carrelloId: k.id, varianteId, quantita: 1, prezzoPattuito: prezzo } });
  await db.carrello.update({ where: { id: k.id }, data: { aggiornato: new Date() } });
  return "OK";
}

export async function impostaQuantita(rigaId: string, quantita: number) {
  const k = await trovaCarrello();
  const riga = k?.righe.find((r) => r.id === rigaId);
  if (!k || !riga) return;
  if (riga.prezzoAsta !== null || riga.prezzoPattuito !== null) return; // pezzo unico o prezzo concordato
  if (quantita <= 0) { await db.rigaCarrello.delete({ where: { id: riga.id } }); return; }
  const q = Math.min(Math.floor(quantita), disponibile(riga.variante), 20);
  if (q <= 0) { await db.rigaCarrello.delete({ where: { id: riga.id } }); return; }
  await db.rigaCarrello.update({ where: { id: riga.id }, data: { quantita: q } });
}

export async function rimuovi(rigaId: string) {
  const k = await trovaCarrello();
  if (!k?.righe.some((r) => r.id === rigaId)) return;
  await db.rigaCarrello.delete({ where: { id: rigaId } });
}

/** Al login il carrello da ospite si fonde col proprio. */
export async function fondiAlLogin(utenteId: string) {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return;
  const ospite = await db.carrello.findUnique({ where: { token }, include: { righe: true } });
  if (!ospite) { c.delete(COOKIE); return; }
  const mio = await db.carrello.upsert({ where: { utenteId }, update: {}, create: { utenteId }, include: { righe: true } });
  for (const r of ospite.righe) {
    const gia = mio.righe.find((x) => x.varianteId === r.varianteId);
    if (gia) {
      if (r.prezzoAsta === null && gia.prezzoAsta === null && r.prezzoPattuito === null && gia.prezzoPattuito === null) {
        const v = await db.variante.findUnique({ where: { id: r.varianteId } });
        const q = Math.min(gia.quantita + r.quantita, v ? disponibile(v) : 1, 20);
        await db.rigaCarrello.update({ where: { id: gia.id }, data: { quantita: Math.max(1, q) } });
      }
    } else {
      await db.rigaCarrello.update({ where: { id: r.id }, data: { carrelloId: mio.id } });
    }
  }
  if (ospite.coupon && !mio.coupon) await db.carrello.update({ where: { id: mio.id }, data: { coupon: ospite.coupon } });
  await db.carrello.delete({ where: { id: ospite.id } });
  c.delete(COOKIE);
}

export async function applicaCoupon(codice: string): Promise<{ ok: boolean; motivo?: Motivo; minimo?: number }> {
  const k = await trovaCarrello();
  if (!k) return { ok: false, motivo: "NON_VALIDO" };
  const u = await utenteCorrente();
  const vista = await vistaCarrello(k);
  const e = await valutaCoupon(codice, vista.subtotale, chiaveCliente(u?.id, u?.email));
  if (!e.ok) return { ok: false, motivo: e.motivo, minimo: e.minimo };
  await db.carrello.update({ where: { id: k.id }, data: { coupon: e.codice } });
  return { ok: true };
}

export async function togliCoupon() {
  const k = await trovaCarrello();
  if (k) await db.carrello.update({ where: { id: k.id }, data: { coupon: null } });
}

type Carrello = NonNullable<Awaited<ReturnType<typeof trovaCarrello>>>;

export type RigaVista = {
  id: string; varianteId: string; slug: string; nome: string; marca: string; taglia: string;
  prezzo: number; quantita: number; disponibile: number; unico: boolean; pattuito: boolean; categoria: string; foto: string | null;
};

/** Il codice si salva sul carrello, lo sconto no: si ricalcola a ogni lettura, perché un carrello
 *  lasciato aperto tre giorni deve mostrare quello che succederà alla cassa. */
export async function vistaCarrello(k: Carrello | null) {
  const righe: RigaVista[] = (k?.righe ?? []).map((r) => {
    const p = r.variante.prodotto;
    const disp = disponibile(r.variante);
    return {
      id: r.id, varianteId: r.varianteId, slug: p.slug, nome: p.nome, marca: p.marca.nome, taglia: r.variante.taglia,
      prezzo: r.prezzoAsta ?? (r.prezzoPattuito != null ? Math.min(r.prezzoPattuito, p.prezzo) : p.prezzo),
      quantita: r.prezzoPattuito != null ? Math.min(1, disp) : Math.min(r.quantita, Math.max(disp, r.prezzoAsta !== null ? 1 : 0)),
      disponibile: disp, unico: r.prezzoAsta !== null, pattuito: r.prezzoPattuito != null, categoria: p.categoria,
      foto: p.foto[0]?.piccola ?? null,
    };
  });
  const subtotale = righe.reduce((s, r) => s + r.prezzo * r.quantita, 0);
  let coupon: { codice: string; sconto: number } | null = null;
  let couponErrore: Motivo | null = null;
  if (k?.coupon && subtotale > 0) {
    const u = await utenteCorrente();
    const e = await valutaCoupon(k.coupon, subtotale, chiaveCliente(u?.id, u?.email));
    if (e.ok) coupon = { codice: e.codice, sconto: e.sconto };
    else couponErrore = e.motivo;
  }
  const pezzi = righe.reduce((s, r) => s + r.quantita, 0);
  return { righe, subtotale, coupon, couponErrore, pezzi };
}

export async function contaPezzi(): Promise<number> {
  const k = await trovaCarrello();
  return k ? k.righe.reduce((s, r) => s + r.quantita, 0) : 0;
}

export { normalizza, calcolaSconto };
