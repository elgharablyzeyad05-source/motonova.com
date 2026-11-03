import { stato, valuta, chiudi, chiHaPerso, scattoPer, ANTI_CRONOMETRO_MS, type OffertaIn } from "../src/lib/asta-motore";
import { totali, telefonoEgiziano, leggiTaglie, egp, zonaDi, sconto } from "../src/lib/regole";
import { verifica, uguale, titolo, fine } from "./util";

const P = { partenza: 100000, riserva: 0 };
const o = (utenteId: string, massimo: number, ts: number): OffertaIn => ({ utenteId, massimo, ts });

titolo("Asta: prezzo esposto");
uguale("senza offerte: prezzo di partenza", stato([], P).prezzo, 100000);
uguale("una sola offerta: resta alla partenza, non al massimo", stato([o("a", 500000, 1)], P).prezzo, 100000);
uguale("offri 5.000, il secondo si ferma a 3.000: paghi 3.100 (passo +100)", stato([o("a", 500000, 1), o("b", 300000, 2)], P).prezzo, 310000);
uguale("il leader è chi ha il massimo più alto", stato([o("a", 500000, 1), o("b", 300000, 2)], P).leader, "a");
uguale("a parità di massimo vince chi ha offerto prima", stato([o("b", 300000, 2), o("a", 300000, 1)], P).leader, "a");
uguale("a parità il prezzo è il massimo comune", stato([o("a", 300000, 1), o("b", 300000, 2)], P).prezzo, 300000);
uguale("il prezzo non supera mai il massimo del leader", stato([o("a", 302000, 1), o("b", 300000, 2)], P).prezzo, 302000);

titolo("Asta: regole che chiudono i buchi");
uguale("non si abbassa il proprio massimo", stato([o("a", 500000, 1), o("a", 200000, 2), o("b", 300000, 3)], P).prezzo, 310000);
uguale("rilanciare contro sé stessi non alza il prezzo", stato([o("a", 500000, 1), o("b", 300000, 2), o("a", 800000, 3)], P).prezzo, 310000);
verifica("chi è in testa può alzare il suo massimo",
  valuta([o("a", 500000, 1), o("b", 300000, 2)], P, { utenteId: "a", massimo: 600000 }, 10, 1e9, true).ok);
uguale("non si può abbassare il massimo (esito)",
  valuta([o("a", 500000, 1)], P, { utenteId: "a", massimo: 400000 }, 10, 1e9, true), { ok: false, motivo: "ABBASSA_MASSIMO" });
uguale("sotto il minimo viene rifiutata",
  valuta([o("a", 500000, 1)], P, { utenteId: "b", massimo: 100000 }, 10, 1e9, true), { ok: false, motivo: "SOTTO_MINIMO" });
uguale("la prima offerta deve coprire la partenza",
  valuta([], P, { utenteId: "a", massimo: 90000 }, 10, 1e9, true), { ok: false, motivo: "SOTTO_MINIMO" });
uguale("asta scaduta: chiusa", valuta([], P, { utenteId: "a", massimo: 200000 }, 20, 10, true), { ok: false, motivo: "CHIUSA" });
uguale("asta non aperta: chiusa", valuta([], P, { utenteId: "a", massimo: 200000 }, 5, 10, false), { ok: false, motivo: "CHIUSA" });
uguale("importo non intero rifiutato", valuta([], P, { utenteId: "a", massimo: 1234.5 }, 5, 1e9, true), { ok: false, motivo: "INVALIDA" });

titolo("Asta: passo a scaglioni");
uguale("sotto 5.000: +100", scattoPer(499999), 10000);
uguale("da 5.000: +250", scattoPer(500000), 25000);
uguale("da 20.000: +500", scattoPer(2000000), 50000);
uguale("da 50.000: +1.000", scattoPer(5000000), 100000);
uguale("da 100.000: +2.500", scattoPer(10000000), 250000);
uguale("il prezzo sale col passo del secondo (6.000 → +250)", stato([o("a", 900000, 1), o("b", 600000, 2)], P).prezzo, 625000);
uguale("minimo successivo col passo del prezzo", stato([o("a", 900000, 1), o("b", 600000, 2)], P).minimoProssima, 650000);

titolo("Asta: anti-cronometro (2 minuti)");
const FINE = 10 * 60 * 1000;
const dentro = valuta([], P, { utenteId: "a", massimo: 200000 }, FINE - 60_000, FINE, true);
uguale("a 1 minuto dalla fine: chiusura a 2 minuti dall'offerta", dentro.ok && dentro.nuovaFine, FINE - 60_000 + ANTI_CRONOMETRO_MS);
const fuori = valuta([], P, { utenteId: "a", massimo: 200000 }, FINE - ANTI_CRONOMETRO_MS - 1000, FINE, true);
verifica("prima degli ultimi 2 minuti non cambia", fuori.ok && fuori.nuovaFine === null);
const quasi = valuta([], P, { utenteId: "a", massimo: 200000 }, FINE - 119_000, FINE, true);
verifica("la chiusura non si accorcia mai", quasi.ok && quasi.nuovaFine !== null && quasi.nuovaFine > FINE);

titolo("Asta: riserva");
const R = { ...P, riserva: 400000 };
verifica("sotto la riserva non si vende", !chiudi([o("a", 300000, 1), o("b", 250000, 2)], R).venduta);
verifica("riserva non raggiunta nello stato", !stato([o("a", 300000, 1)], R).riservaRaggiunta);
const ch = chiudi([o("a", 600000, 1), o("b", 250000, 2)], R);
verifica("sopra la riserva si vende", ch.venduta);
uguale("chi vince paga almeno la riserva", ch.venduta ? ch.prezzo : 0, 400000);
verifica("senza offerte non si vende", !chiudi([], P).venduta);
const prima = stato([o("a", 500000, 1)], P), dopo = stato([o("a", 500000, 1), o("b", 700000, 2)], P);
uguale("sorpasso: chi ha perso", chiHaPerso(prima, dopo), "a");
uguale("nessun sorpasso se non cambia il leader", chiHaPerso(prima, stato([o("a", 500000, 1), o("b", 200000, 2)], P)), null);

titolo("Totali: spedizione, contrassegno, acconto");
let t = totali(100000, 0, "CONTRASSEGNO");
uguale("Cairo: spedizione 60", t.spedizione, 6000);
uguale("commissione minima 25 EGP", t.commissione, 2500);
uguale("totale = merce + spedizione + commissione", t.totale, 100000 + 6000 + 2500);
t = totali(450000, 1, "CONTRASSEGNO");
verifica("spedizione gratis sopra 4.000", t.spedizione === 0 && t.spedizioneGratis);
uguale("commissione 1,5% senza spedizione", t.commissione, Math.round(450000 * 0.015));
t = totali(2100000, 0, "CONTRASSEGNO");
uguale("sopra 20.000 serve l'acconto del 20%", t.acconto, Math.round(t.totale * 0.2));
uguale("acconto + contanti = totale", t.acconto + t.contanti, t.totale);
t = totali(2100000, 0, "CARTA");
verifica("con carta nessuna commissione né acconto", t.commissione === 0 && t.acconto === 0 && t.contanti === 0);
t = totali(30000, 0, "CONTRASSEGNO", 50000);
uguale("lo sconto non supera la merce", t.sconto, 30000);
uguale("con sconto totale la spedizione resta", t.spedizione, 6000);
t = totali(500000, 0, "CONTRASSEGNO", 150000);
verifica("la soglia gratis guarda la merce scontata", !t.spedizioneGratis);
uguale("senza zona: spedizione zero", totali(100000, null, "CARTA").spedizione, 0);
uguale("governatorato → zona", zonaDi("Luxor"), 2);
uguale("governatorato sconosciuto", zonaDi("Roma"), -1);

titolo("Formato e lettura dati");
uguale("EGP con separatore migliaia", egp(592000), "EGP 5,920");
uguale("sconto percentuale", sconto(1486000, 1720000), 14);
uguale("telefono 01…", telefonoEgiziano("01012345678"), "01012345678");
uguale("telefono +20…", telefonoEgiziano("+20 101 234 5678"), "01012345678");
uguale("telefono 0020…", telefonoEgiziano("0020 1012345678"), "01012345678");
uguale("telefono non egiziano", telefonoEgiziano("3331234567"), null);
uguale("taglie «S:3, M:6, L:4»", leggiTaglie("S:3, M:6, L:4"), [{ taglia: "S", giacenza: 3 }, { taglia: "M", giacenza: 6 }, { taglia: "L", giacenza: 4 }]);
verifica("taglia ripetuta dà errore", (() => { try { leggiTaglie("S:1, s:2"); return false; } catch { return true; } })());
verifica("taglia illeggibile dà errore chiaro", (() => { try { leggiTaglie("S 3"); return false; } catch (e) { return String(e).includes("S:3"); } })());

fine("aste + regole");
