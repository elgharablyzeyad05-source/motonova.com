import { db } from "@/lib/db";
import { nuovoId } from "@/lib/id";
import { creaOrdine } from "@/lib/ordini";
import { valutaCoupon, calcolaSconto } from "@/lib/coupon";
import { verifica, titolo, uguale, fine } from "./util";

const p = await db.prodotto.findFirstOrThrow({ where: { tipo: "NUOVO" } });
const v = await db.variante.create({ data: { id: nuovoId(), prodottoId: p.id, taglia: "PROVA" + Date.now() % 1000, giacenza: 1 } });
const d = { nome: "Prova Prova", telefono: "01012345678", governatorato: "Giza", indirizzo: "Via Prova 123", metodo: "CONTRASSEGNO" as const, lingua: "it" };

titolo("Dieci clienti sull'ultimo pezzo");
const carrelli = await Promise.all(Array.from({ length: 10 }, async () => {
  const k = await db.carrello.create({ data: { id: nuovoId() } });
  await db.rigaCarrello.create({ data: { id: nuovoId(), carrelloId: k.id, varianteId: v.id, quantita: 1 } });
  return k.id;
}));
const esiti = await Promise.all(carrelli.map((id) => creaOrdine(id, d)));
uguale("un solo ordine passa", esiti.filter((e) => e.ok).length, 1);
uguale("nove ricevono «esaurito»", esiti.filter((e) => !e.ok && "esaurito" in e.errore).length, 9);
const dopo = await db.variante.findUniqueOrThrow({ where: { id: v.id } });
uguale("impegnati = 1, mai oltre la giacenza", dopo.impegnati, 1);

titolo("Coupon con un solo uso, 8 ordini insieme");
const v2 = await db.variante.create({ data: { id: nuovoId(), prodottoId: p.id, taglia: "PC" + Date.now() % 1000, giacenza: 50 } });
const cod = "PROVA" + Date.now() % 100000;
const c = await db.coupon.create({ data: { id: nuovoId(), codice: cod, tipo: "PERCENTUALE", valore: 10, usiMax: 1 } });
const ks = await Promise.all(Array.from({ length: 8 }, async () => {
  const k = await db.carrello.create({ data: { id: nuovoId(), coupon: cod } });
  await db.rigaCarrello.create({ data: { id: nuovoId(), carrelloId: k.id, varianteId: v2.id, quantita: 1 } });
  return k.id;
}));
const es2 = await Promise.all(ks.map((id) => creaOrdine(id, d)));
uguale("tutti e 8 gli ordini nascono", es2.filter((e) => e.ok).length, 8);
uguale("solo uno ottiene lo sconto", es2.filter((e) => e.ok && !e.couponPerso).length, 1);
const cc = await db.coupon.findUniqueOrThrow({ where: { id: c.id } });
uguale("usi registrati = 1", cc.usiFatti, 1);

titolo("Regole coupon");
uguale("10% di 1000,00", calcolaSconto({ tipo: "PERCENTUALE", valore: 10 }, 100000), 10000);
uguale("fisso mai sopra il totale", calcolaSconto({ tipo: "FISSO", valore: 500000 }, 100000), 100000);
const x = await valutaCoupon("NONESISTE", 100000, "k"); const y = await db.coupon.create({ data: { id: nuovoId(), codice: "SPENTO" + Date.now() % 1000, tipo: "FISSO", valore: 100, attivo: false } });
const z = await valutaCoupon(y.codice, 100000, "k");
verifica("inesistente e spento: stesso errore", !x.ok && !z.ok && x.motivo === z.motivo, { x, z });
const sc = await db.coupon.create({ data: { id: nuovoId(), codice: "SCAD" + Date.now() % 1000, tipo: "FISSO", valore: 100, fine: new Date(Date.now() - 1000) } });
const s = await valutaCoupon(sc.codice, 100000, "k"); verifica("scaduto rifiutato", !s.ok && s.motivo === "SCADUTO", s);

// pulizia
await db.ordine.deleteMany({ where: { nome: "Prova Prova" } });
await db.rigaCarrello.deleteMany({ where: { varianteId: { in: [v.id, v2.id] } } });
await db.carrello.deleteMany({ where: { utenteId: null, righe: { none: {} } } });
await db.variante.deleteMany({ where: { id: { in: [v.id, v2.id] } } });
await db.coupon.deleteMany({ where: { id: { in: [c.id, y.id, sc.id] } } });
fine("concorrenza");
