import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { nuovoId } from "./id";
import { totali, zonaDi, telefonoEgiziano, emailValida, egp, type Metodo } from "./regole";
import { calcolaSconto, chiaveCliente, consuma, valutaCoupon } from "./coupon";
import { inviaEmail } from "./posta";
import type { StatoOrdine } from "@/generated/prisma/client";

export const FLUSSO: StatoOrdine[] = ["DA_CONFERMARE", "CONFERMATO", "PREPARAZIONE", "SPEDITO", "CONSEGNATO"];

/** Da «da confermare» non si salta a «consegnato»: ogni passaggio ha il suo posto. */
export function prossimi(s: StatoOrdine): StatoOrdine[] {
  if (s === "CONSEGNATO" || s === "ANNULLATO") return [];
  const i = FLUSSO.indexOf(s);
  const out: StatoOrdine[] = [FLUSSO[i + 1]];
  if (s !== "SPEDITO") out.push("ANNULLATO"); // dopo la spedizione non si annulla: si gestisce come reso
  return out;
}

export type DatiOrdine = {
  nome: string; telefono: string; email?: string; governatorato: string; indirizzo: string; note?: string;
  metodo: Metodo; lingua: string; utenteId?: string | null;
};

export type Esaurito = { nome: string; taglia: string; disponibile: number };
export type ErroreOrdine =
  | { campo: string; messaggio: string }
  | { esaurito: Esaurito[] }
  | { vuoto: true };

class ErroreEsaurito extends Error { constructor(public dettaglio: Esaurito[]) { super("esaurito"); } }

const numeroOrdine = () => `MN-${new Date().getFullYear()}-${randomInt(100000, 999999)}`;

export async function creaOrdine(
  carrelloId: string, d: DatiOrdine,
): Promise<{ ok: true; numero: string; id: string; token: string; couponPerso: boolean } | { ok: false; errore: ErroreOrdine }> {
  const nome = d.nome.trim();
  if (nome.length < 2) return { ok: false, errore: { campo: "nome", messaggio: "Scrivi il tuo nome" } };
  const tel = telefonoEgiziano(d.telefono);
  if (!tel) return { ok: false, errore: { campo: "telefono", messaggio: "Numero egiziano non valido: 01X XXXX XXXX" } };
  const email = d.email?.trim() || "";
  if (email && !emailValida(email)) return { ok: false, errore: { campo: "email", messaggio: "Email non valida" } };
  const zona = zonaDi(d.governatorato);
  if (zona < 0) return { ok: false, errore: { campo: "governatorato", messaggio: "Scegli il governatorato" } };
  const indirizzo = d.indirizzo.trim();
  if (indirizzo.length < 6) return { ok: false, errore: { campo: "indirizzo", messaggio: "Scrivi quartiere, via e numero" } };
  if (!["CONTRASSEGNO", "CARTA", "RATE"].includes(d.metodo)) return { ok: false, errore: { campo: "metodo", messaggio: "Scegli come pagare" } };
  // La carta non c'è finché non ci sono le chiavi: il server lo rifiuta anche se qualcuno forza il modulo.
  if (d.metodo !== "CONTRASSEGNO" && !process.env.PAYMOB_API_KEY) {
    return { ok: false, errore: { campo: "metodo", messaggio: "Il pagamento con carta non è ancora attivo: scegli il contrassegno" } };
  }

  const k = await db.carrello.findUnique({
    where: { id: carrelloId },
    include: { righe: { include: { variante: { include: { prodotto: { include: { marca: true } } } } } } },
  });
  if (!k || !k.righe.length) return { ok: false, errore: { vuoto: true } };
  // Un pezzo vinto all'asta non si paga alla porta: chi rifiuta ha già bloccato il pezzo per giorni.
  if (d.metodo === "CONTRASSEGNO" && k.righe.some((r) => r.prezzoAsta !== null)) {
    return { ok: false, errore: { campo: "metodo", messaggio: "I pezzi vinti all'asta si pagano online: il contrassegno non è disponibile per questo ordine" } };
  }

  try {
    return await db.$transaction(async (tx) => {
      // 1. impegna le scorte con un UPDATE condizionale: dieci clienti sull'ultimo pezzo → uno solo passa
      const esauriti: Esaurito[] = [];
      for (const r of k.righe) {
        const n = await tx.$executeRaw`UPDATE "Variante" SET "impegnati" = "impegnati" + ${r.quantita}
          WHERE "id" = ${r.varianteId} AND "giacenza" - "impegnati" >= ${r.quantita}`;
        if (n !== 1) {
          const v = await tx.variante.findUnique({ where: { id: r.varianteId } });
          esauriti.push({ nome: r.variante.prodotto.nome, taglia: r.variante.taglia, disponibile: v ? Math.max(0, v.giacenza - v.impegnati) : 0 });
        }
      }
      if (esauriti.length) throw new ErroreEsaurito(esauriti);

      const subtotale = k.righe.reduce((s, r) => s + (r.prezzoAsta ?? r.variante.prodotto.prezzo) * r.quantita, 0);

      // 2. coupon ricalcolato qui: lo sconto mostrato nel carrello non è una promessa
      // Un codice che non vale più NON blocca l'ordine: rimandare indietro chi ha già scritto nome e
      // indirizzo è il modo più rapido di perdere sia il codice sia l'ordine. L'ordine nasce a prezzo pieno
      // e la pagina lo dice (couponPerso).
      let sconto = 0; let codice: string | null = null; let couponId: string | null = null; let couponPerso = false;
      const chiave = chiaveCliente(d.utenteId, email);
      if (k.coupon) {
        const e = await valutaCoupon(k.coupon, subtotale, chiave);
        if (e.ok && (await consuma(tx, e.id))) {
          const c = await tx.coupon.findUniqueOrThrow({ where: { id: e.id } });
          sconto = calcolaSconto({ tipo: c.tipo, valore: c.valore }, subtotale);
          codice = e.codice; couponId = e.id;
        } else couponPerso = true;
      }

      const t = totali(subtotale, zona, d.metodo, sconto);
      const numero = numeroOrdine();
      const token = randomBytes(16).toString("hex");
      const id = nuovoId();
      await tx.ordine.create({
        data: {
          id, numero, token, utenteId: d.utenteId ?? null, email: email || null, nome, telefono: tel,
          governatorato: d.governatorato, zona, indirizzo, note: d.note?.trim() || null,
          pagamento: d.metodo, subtotale: t.subtotale, spedizione: t.spedizione, commissione: t.commissione,
          sconto: t.sconto, totale: t.totale, acconto: t.acconto, contanti: t.contanti, coupon: codice,
          lingua: ["it", "en", "ar"].includes(d.lingua) ? d.lingua : "it",
          righe: {
            create: k.righe.map((r) => ({
              id: nuovoId(), varianteId: r.varianteId, nome: r.variante.prodotto.nome, marca: r.variante.prodotto.marca.nome,
              taglia: r.variante.taglia, prezzo: r.prezzoAsta ?? r.variante.prodotto.prezzo, quantita: r.quantita,
            })),
          },
          storia: { create: [{ id: nuovoId(), stato: "DA_CONFERMARE" }] },
        },
      });
      if (couponId) await tx.usoCoupon.create({ data: { id: nuovoId(), couponId, chiave, ordineId: id, sconto: t.sconto } });
      await tx.rigaCarrello.deleteMany({ where: { carrelloId } });
      await tx.carrello.update({ where: { id: carrelloId }, data: { coupon: null } });
      return { ok: true as const, numero, id, token, couponPerso };
    });
  } catch (e) {
    if (e instanceof ErroreEsaurito) return { ok: false, errore: { esaurito: e.dettaglio } };
    throw e;
  }
}

export async function emailConferma(ordineId: string, base: string) {
  const o = await db.ordine.findUnique({ where: { id: ordineId }, include: { righe: true } });
  if (!o?.email) return "SENZA_INDIRIZZO" as const;
  const righe = o.righe.map((r) => `• ${r.marca} ${r.nome} (${r.taglia}) × ${r.quantita} — ${egp(r.prezzo * r.quantita)}`).join("\n");
  const pag = o.pagamento === "CONTRASSEGNO"
    ? (o.lingua === "ar" ? "الدفع عند الاستلام" : o.lingua === "en" ? "Cash on delivery" : "Contrassegno")
    : (o.lingua === "ar" ? "بطاقة" : o.lingua === "en" ? "Card" : "Carta");
  return inviaEmail("ordineConfermato", o.email, o.lingua, {
    nome: o.nome, numero: o.numero, righe, totale: egp(o.totale), pagamento: pag,
    indirizzo: `${o.indirizzo}, ${o.governatorato}`, linkOrdine: `${base}/ordine/${o.numero}?t=${o.token}`,
  });
}

/** Cambia stato e muove le scorte: a «spedito» il pezzo esce davvero dal magazzino; annullando prima, torna disponibile. */
export async function cambiaStato(ordineId: string, nuovo: StatoOrdine): Promise<{ ok: boolean; errore?: string }> {
  return db.$transaction(async (tx) => {
    const o = await tx.ordine.findUnique({ where: { id: ordineId }, include: { righe: true } });
    if (!o) return { ok: false, errore: "Ordine non trovato" };
    if (!prossimi(o.stato).includes(nuovo)) return { ok: false, errore: `Da «${o.stato}» non si passa a «${nuovo}»` };
    if (nuovo === "SPEDITO") {
      for (const r of o.righe) if (r.varianteId) {
        await tx.$executeRaw`UPDATE "Variante" SET "giacenza" = "giacenza" - ${r.quantita}, "impegnati" = "impegnati" - ${r.quantita} WHERE "id" = ${r.varianteId}`;
      }
    }
    if (nuovo === "ANNULLATO") {
      for (const r of o.righe) if (r.varianteId) {
        await tx.$executeRaw`UPDATE "Variante" SET "impegnati" = GREATEST(0, "impegnati" - ${r.quantita}) WHERE "id" = ${r.varianteId}`;
      }
      // l'uso del coupon si restituisce: un ordine annullato non deve consumare il codice
      const usi = await tx.usoCoupon.findMany({ where: { ordineId } });
      for (const u of usi) await tx.$executeRaw`UPDATE "Coupon" SET "usiFatti" = GREATEST(0, "usiFatti" - 1) WHERE "id" = ${u.couponId}`;
      await tx.usoCoupon.deleteMany({ where: { ordineId } });
    }
    await tx.ordine.update({ where: { id: ordineId }, data: { stato: nuovo } });
    await tx.storiaOrdine.create({ data: { id: nuovoId(), ordineId, stato: nuovo } });
    return { ok: true };
  });
}

export function tokenValido(atteso: string, dato: string | undefined | null): boolean {
  if (!dato || dato.length !== atteso.length) return false;
  return timingSafeEqual(Buffer.from(atteso), Buffer.from(dato));
}
