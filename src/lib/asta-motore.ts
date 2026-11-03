// Motore dell'asta inglese con offerta delegata. Funzioni pure: si provano senza database.
//
// Ogni offerta è un MASSIMO segreto. Il sistema rilancia per chi è in testa al minimo
// necessario. Il prezzo esposto è quello del secondo più uno scatto, mai il massimo di
// chi è in testa. A parità di massimo vince chi ha offerto prima.

export type OffertaIn = { utenteId: string; massimo: number; ts: number };

export type Stato = {
  haOfferte: boolean;
  leader: string | null;
  prezzo: number;            // prezzo esposto
  riservaRaggiunta: boolean;
  minimoProssima: number;    // minimo per una nuova offerta
  offerenti: number;
};

export type Parametri = { partenza: number; riserva: number };

/** Finestra di proroga: un'offerta negli ultimi 2 minuti sposta la chiusura a 2 minuti da quel momento. */
export const ANTI_CRONOMETRO_MS = 2 * 60 * 1000;

/** Il rilancio cresce col prezzo: sotto non si litiga per cento piastre, sopra non si sale di mille alla volta.
 *  Soglie in EGP del prototipo (<5.000: +100 · <20.000: +250 · <50.000: +500 · <100.000: +1.000 · oltre: +2.500). */
export function scattoPer(prezzo: number): number {
  if (prezzo < 500000) return 10000;
  if (prezzo < 2000000) return 25000;
  if (prezzo < 5000000) return 50000;
  if (prezzo < 10000000) return 100000;
  return 250000;
}

/** Massimo effettivo per persona: non si può abbassare il proprio massimo. */
function massimiPerPersona(offerte: OffertaIn[]): Map<string, { massimo: number; ts: number }> {
  const m = new Map<string, { massimo: number; ts: number }>();
  const ordinate = [...offerte].sort((a, b) => a.ts - b.ts);
  for (const o of ordinate) {
    const cur = m.get(o.utenteId);
    if (!cur || o.massimo > cur.massimo) m.set(o.utenteId, { massimo: o.massimo, ts: o.ts });
  }
  return m;
}

export function stato(offerte: OffertaIn[], p: Parametri): Stato {
  const per = massimiPerPersona(offerte);
  if (per.size === 0) {
    return { haOfferte: false, leader: null, prezzo: p.partenza, riservaRaggiunta: false, minimoProssima: p.partenza, offerenti: 0 };
  }
  // Ordina: massimo più alto, poi chi lo ha raggiunto prima.
  const ordine = [...per.entries()].sort((a, b) => b[1].massimo - a[1].massimo || a[1].ts - b[1].ts);
  const [leader, top] = ordine[0];
  const secondo = ordine[1]?.[1].massimo ?? null;

  let prezzo: number;
  if (secondo === null) prezzo = p.partenza;
  else if (secondo >= top.massimo) prezzo = top.massimo;
  else prezzo = Math.min(top.massimo, secondo + scattoPer(secondo));
  prezzo = Math.max(prezzo, p.partenza);

  const riservaRaggiunta = top.massimo >= p.riserva;
  // Chi vince paga almeno la riserva, se il suo massimo la copre.
  if (riservaRaggiunta && prezzo < p.riserva) prezzo = Math.min(p.riserva, top.massimo);

  return {
    haOfferte: true,
    leader,
    prezzo,
    riservaRaggiunta,
    minimoProssima: prezzo + scattoPer(prezzo),
    offerenti: per.size,
  };
}

export type Esito =
  | { ok: true; nuovaFine: number | null }
  | { ok: false; motivo: "SOTTO_MINIMO" | "INVALIDA" | "ABBASSA_MASSIMO" | "CHIUSA" };

/** Controlla se un'offerta è accettabile PRIMA di scriverla. */
export function valuta(
  offerte: OffertaIn[],
  p: Parametri,
  nuova: { utenteId: string; massimo: number },
  adesso: number,
  fine: number,
  aperta: boolean,
): Esito {
  if (!aperta || adesso >= fine) return { ok: false, motivo: "CHIUSA" };
  if (!Number.isInteger(nuova.massimo) || nuova.massimo <= 0) return { ok: false, motivo: "INVALIDA" };
  const s = stato(offerte, p);
  const per = massimiPerPersona(offerte);
  const mio = per.get(nuova.utenteId);
  if (mio && nuova.massimo <= mio.massimo) return { ok: false, motivo: "ABBASSA_MASSIMO" };
  // Chi è già in testa può alzare il proprio massimo senza muovere il prezzo:
  // per lui il minimo è solo "più di prima". Per gli altri vale il minimo di asta.
  const èInTesta = s.leader === nuova.utenteId;
  if (!èInTesta && nuova.massimo < s.minimoProssima) return { ok: false, motivo: "SOTTO_MINIMO" };
  // la chiusura non si accorcia mai: si sposta solo in avanti
  const nuovaFine = fine - adesso < ANTI_CRONOMETRO_MS ? adesso + ANTI_CRONOMETRO_MS : null;
  return { ok: true, nuovaFine };
}

/** Quando un'offerta nuova supera il leader precedente. Serve per la lettera «Ti hanno superato». */
export function chiHaPerso(prima: Stato, dopo: Stato): string | null {
  return prima.leader && dopo.leader && prima.leader !== dopo.leader ? prima.leader : null;
}

export type Chiusura = { venduta: false } | { venduta: true; vincitoreId: string; prezzo: number };

export function chiudi(offerte: OffertaIn[], p: Parametri): Chiusura {
  const s = stato(offerte, p);
  if (!s.haOfferte || !s.riservaRaggiunta || !s.leader) return { venduta: false };
  return { venduta: true, vincitoreId: s.leader, prezzo: s.prezzo };
}
