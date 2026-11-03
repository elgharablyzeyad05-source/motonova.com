import { db } from "./db";
import { nuovoId } from "./id";
import { stato as statoAsta, valuta, chiudi, chiHaPerso } from "./asta-motore";
import { inviaEmail } from "./posta";
import { egp } from "./regole";

const toMs = (d: Date) => d.getTime();

type OffertaDb = { utenteId: string; massimo: number; ts: Date };
type AstaDb = { partenza: number; riserva: number; offerte: OffertaDb[] };

export async function leggiAsta(slug: string) {
  return db.prodotto.findUnique({
    where: { slug },
    include: { marca: true, foto: { orderBy: { ordine: "asc" } }, varianti: true, asta: { include: { offerte: true } } },
  });
}

export const offerteMotore = (offerte: OffertaDb[]) =>
  offerte.map((o) => ({ utenteId: o.utenteId, massimo: o.massimo, ts: toMs(o.ts) }));

export const statoDa = (a: AstaDb) => statoAsta(offerteMotore(a.offerte), a);

export type EsitoOfferta =
  | { ok: true; prolungata: boolean; sorpassato: string | null }
  | { ok: false; motivo: string; minimo?: number };

/** Serializza le offerte della stessa asta con un lock di riga: due offerte nello stesso istante non si pestano. */
export async function offri(slug: string, utenteId: string, massimo: number, base: string): Promise<EsitoOfferta> {
  // Chi non ritira un pezzo all'asta lo ha tenuto bloccato per giorni: serve una garanzia prima di poter offrire.
  const utente = await db.utente.findUnique({ where: { id: utenteId } });
  if (!utente) return { ok: false, motivo: "NON_TROVATA" };
  if (!utente.garanzia && process.env.ASTE_SENZA_GARANZIA !== "1") return { ok: false, motivo: "SERVE_GARANZIA" };
  const esito = await db.$transaction(async (tx) => {
    const p = await tx.prodotto.findUnique({ where: { slug }, include: { asta: true } });
    if (!p?.asta) return { ok: false as const, motivo: "NON_TROVATA" };
    await tx.$queryRaw`SELECT "id" FROM "Asta" WHERE "id" = ${p.asta.id} FOR UPDATE`;
    const a = await tx.asta.findUniqueOrThrow({ where: { id: p.asta.id }, include: { offerte: true } });
    const adesso = Date.now();
    const aperta = a.stato === "APERTA" && toMs(a.inizio) <= adesso;
    const lista = offerteMotore(a.offerte);
    const prima = statoAsta(lista, a);
    const v = valuta(lista, a, { utenteId, massimo }, adesso, toMs(a.fine), aperta);
    if (!v.ok) return { ok: false as const, motivo: v.motivo, minimo: prima.minimoProssima };
    await tx.offerta.create({ data: { id: nuovoId(), astaId: a.id, utenteId, massimo } });
    let fine = a.fine;
    if (v.nuovaFine !== null) { fine = new Date(v.nuovaFine); await tx.asta.update({ where: { id: a.id }, data: { fine } }); }
    const dopo = statoAsta([...lista, { utenteId, massimo, ts: adesso }], a);
    return { ok: true as const, prolungata: v.nuovaFine !== null, sorpassato: chiHaPerso(prima, dopo), dopo, nome: p.nome, fine };
  });
  if (!esito.ok) return esito;
  if (esito.sorpassato) {
    const u = await db.utente.findUnique({ where: { id: esito.sorpassato } });
    if (u) {
      const chiusura = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(esito.fine);
      await inviaEmail("superato", u.email, "it", {
        nome: u.nome, pezzo: esito.nome, prezzoAttuale: egp(esito.dopo.prezzo),
        minimoPerRilanciare: egp(esito.dopo.minimoProssima), chiusura, linkAsta: `${base}/aste/${slug}`,
      }).catch(() => {});
    }
  }
  return { ok: true, prolungata: esito.prolungata, sorpassato: esito.sorpassato };
}

/** Il giro: apre le aste che devono aprire e chiude quelle scadute. Idempotente: si può lanciare ogni minuto. */
export async function giro(base: string, adesso = new Date()) {
  const aperte = await db.asta.updateMany({
    where: { stato: "PROGRAMMATA", inizio: { lte: adesso }, fine: { gt: adesso } }, data: { stato: "APERTA" },
  });
  const scadute = await db.asta.findMany({ where: { stato: { in: ["APERTA", "PROGRAMMATA"] }, fine: { lte: adesso } }, select: { id: true } });
  let vendute = 0, invendute = 0;
  for (const { id } of scadute) {
    const r = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Asta" WHERE "id" = ${id} FOR UPDATE`;
      const a = await tx.asta.findUniqueOrThrow({ where: { id }, include: { offerte: true, prodotto: { include: { varianti: true } } } });
      if (a.stato === "CHIUSA") return null;
      const c = chiudi(offerteMotore(a.offerte), a);
      if (!c.venduta) { await tx.asta.update({ where: { id }, data: { stato: "CHIUSA" } }); return { venduta: false as const }; }
      // il pezzo vinto entra nel carrello del vincitore a prezzo battuto, come riga unica
      const variante = a.prodotto.varianti[0];
      const k = await tx.carrello.upsert({ where: { utenteId: c.vincitoreId }, update: {}, create: { id: nuovoId(), utenteId: c.vincitoreId } });
      if (variante) {
        await tx.rigaCarrello.deleteMany({ where: { carrelloId: k.id, varianteId: variante.id } });
        await tx.rigaCarrello.create({ data: { id: nuovoId(), carrelloId: k.id, varianteId: variante.id, quantita: 1, prezzoAsta: c.prezzo } });
      }
      await tx.asta.update({ where: { id }, data: { stato: "CHIUSA", vincitoreId: c.vincitoreId, prezzoFinale: c.prezzo } });
      return { venduta: true as const, vincitoreId: c.vincitoreId, prezzo: c.prezzo, nome: a.prodotto.nome };
    });
    if (!r) continue;
    if (r.venduta) {
      vendute++;
      const u = await db.utente.findUnique({ where: { id: r.vincitoreId } });
      if (u) await inviaEmail("aggiudicato", u.email, "it", { nome: u.nome, pezzo: r.nome, prezzoFinale: egp(r.prezzo), linkCassa: `${base}/carrello` }).catch(() => {});
    } else invendute++;
  }
  return { aperte: aperte.count, chiuse: scadute.length, vendute, invendute };
}
