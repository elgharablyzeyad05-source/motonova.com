import { db } from "@/lib/db";
import { nuovoId } from "@/lib/id";
import { creaOrdine, accontoRicevuto, confermaBlocco, scadenzeBlocchi } from "@/lib/ordini";
import { verifica, titolo, uguale, fine } from "./util";

const p = await db.prodotto.findFirstOrThrow({ where: { tipo: "NUOVO", attivo: true } });
const v = await db.variante.create({ data: { id: nuovoId(), prodottoId: p.id, taglia: "BLK" + (Date.now() % 1000), giacenza: 5 } });
const d = { nome: "Prova Blocco", telefono: "01012345678", governatorato: "Giza", indirizzo: "Via Prova 123", metodo: "CONTRASSEGNO" as const, lingua: "it", blocco: true };
const carrello = async (pattuito: number | null, q = 2) => {
  const k = await db.carrello.create({ data: { id: nuovoId(), token: nuovoId() } });
  await db.rigaCarrello.create({ data: { id: nuovoId(), carrelloId: k.id, varianteId: v.id, quantita: q, prezzoPattuito: pattuito } });
  return k.id;
};

titolo("Blocco prezzo con acconto");
const senza = await creaOrdine(await carrello(null), d);
verifica("senza prezzo trattato il blocco è rifiutato", !senza.ok);

const r = await creaOrdine(await carrello(Math.floor(p.prezzo * 0.9)), d);
if (!r.ok) throw new Error("ordine bloccato non creato");
let o = await db.ordine.findUniqueOrThrow({ where: { id: r.id } });
uguale("acconto fisso 800 EGP", o.acconto, 80000);
uguale("contanti = totale − acconto", o.contanti, o.totale - 80000);
verifica("prezzo trattato nelle righe", (await db.rigaOrdine.findFirstOrThrow({ where: { ordineId: o.id } })).prezzo === Math.floor(p.prezzo * 0.9));
verifica("scade entro ~6 ore finché manca l'acconto", !!o.bloccoScade && o.bloccoScade.getTime() - Date.now() < 6.1 * 3600_000 && !o.bloccoPagato);
let vv = await db.variante.findUniqueOrThrow({ where: { id: v.id } });
uguale("pezzi impegnati", vv.impegnati, 2);

verifica("conferma senza acconto rifiutata", !(await confermaBlocco(o.numero, o.token)).ok);
verifica("conferma con token sbagliato rifiutata", !(await confermaBlocco(o.numero, "x".repeat(32))).ok);
verifica("acconto ricevuto", (await accontoRicevuto(o.id)).ok);
o = await db.ordine.findUniqueOrThrow({ where: { id: o.id } });
verifica("blocco di 48 ore", o.bloccoPagato && o.bloccoScade!.getTime() - Date.now() > 47.9 * 3600_000);
verifica("il giro non annulla un blocco valido", (await scadenzeBlocchi()) === 0 && (await db.ordine.findUniqueOrThrow({ where: { id: o.id } })).stato === "DA_CONFERMARE");
verifica("conferma cliente", (await confermaBlocco(o.numero, o.token)).ok);
o = await db.ordine.findUniqueOrThrow({ where: { id: o.id } });
verifica("diventa ordine normale", o.bloccoScade === null && o.stato === "DA_CONFERMARE" && o.acconto === 80000);

titolo("Scadenza");
const r2 = await creaOrdine(await carrello(Math.floor(p.prezzo * 0.9), 1), d);
if (!r2.ok) throw new Error("ordine 2");
await accontoRicevuto(r2.id);
await db.ordine.update({ where: { id: r2.id }, data: { bloccoScade: new Date(Date.now() - 1000) } });
verifica("blocco scaduto annullato dal giro", (await scadenzeBlocchi()) >= 1);
const o2 = await db.ordine.findUniqueOrThrow({ where: { id: r2.id } });
verifica("stato annullato", o2.stato === "ANNULLATO");
vv = await db.variante.findUniqueOrThrow({ where: { id: v.id } });
uguale("pezzi liberati (restano solo i 2 dell'ordine confermato)", vv.impegnati, 2);
await fine();
