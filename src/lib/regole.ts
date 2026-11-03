// Regole di business pure: nessuna dipendenza, tutto in piastre intere (1 EGP = 100).
// Stanno qui, non nelle pagine, così si provano senza database e senza browser.

export type Zona = { nome: string; costo: number; giorni: string; governatorati: string[] };

export const ZONE: Zona[] = [
  { nome: "Il Cairo e dintorni", costo: 6000, giorni: "Il giorno dopo", governatorati: ["Il Cairo", "Giza", "Qalyubia"] },
  { nome: "Delta e Canale", costo: 8500, giorni: "2 giorni lavorativi", governatorati: ["Alessandria", "Sharqia", "Dakahlia", "Beheira", "Gharbia", "Monufia", "Kafr El Sheikh", "Damietta", "Port Said", "Ismailia", "Suez"] },
  { nome: "Alto Egitto", costo: 11000, giorni: "3 giorni lavorativi", governatorati: ["Beni Suef", "Fayoum", "Minya", "Asyut", "Sohag", "Qena", "Luxor", "Aswan"] },
  { nome: "Frontiera", costo: 15000, giorni: "4–5 giorni lavorativi", governatorati: ["Sinai del Nord", "Sinai del Sud", "Mar Rosso", "Nuova Valle", "Matrouh"] },
];

export const SPEDIZIONE_GRATIS_SOPRA = 400000;   // EGP 4.000
export const COMMISSIONE_CONTRASSEGNO = 0.015;   // 1,5% su merce + spedizione
export const COMMISSIONE_MINIMA = 2500;          // EGP 25
export const ACCONTO_SOPRA = 2000000;            // EGP 20.000
export const ACCONTO_PERCENTUALE = 0.2;
export const ACCONTO_BLOCCO = 80000;               // EGP 800: blocca il prezzo trattato
export const BLOCCO_ORE = 48;
export const BLOCCO_ATTESA_ACCONTO_ORE = 6;        // senza acconto ricevuto il blocco decade presto
export const RATE_OFFERTE = [3, 6, 9, 12] as const;

export function zonaDi(governatorato: string): number {
  return ZONE.findIndex((z) => z.governatorati.includes(governatorato));
}

export type Metodo = "CONTRASSEGNO" | "CARTA" | "RATE";

export type Totali = {
  subtotale: number;
  spedizione: number;
  spedizioneGratis: boolean;
  commissione: number;
  sconto: number;
  totale: number;
  acconto: number;   // da pagare online adesso (solo contrassegno sopra soglia)
  contanti: number;  // da pagare al corriere
};

/** Lo sconto non supera mai la merce: la spedizione resta dov'è. */
export function totali(subtotale: number, zona: number | null, metodo: Metodo, sconto = 0): Totali {
  const scontoVero = Math.max(0, Math.min(sconto, subtotale));
  const merce = subtotale - scontoVero;
  let spedizione = 0;
  let spedizioneGratis = false;
  if (zona !== null && zona >= 0 && zona < ZONE.length) {
    spedizione = ZONE[zona].costo;
    // la soglia della spedizione gratis guarda la merce pagata, non il listino
    if (merce >= SPEDIZIONE_GRATIS_SOPRA) {
      spedizione = 0;
      spedizioneGratis = true;
    }
  }
  const commissione = metodo === "CONTRASSEGNO" && merce > 0
    ? Math.max(Math.round((merce + spedizione) * COMMISSIONE_CONTRASSEGNO), COMMISSIONE_MINIMA)
    : 0;
  const totale = merce + spedizione + commissione;
  const acconto = metodo === "CONTRASSEGNO" && totale > ACCONTO_SOPRA ? Math.round(totale * ACCONTO_PERCENTUALE) : 0;
  const contanti = metodo === "CONTRASSEGNO" ? totale - acconto : 0;
  return { subtotale, spedizione, spedizioneGratis, commissione, sconto: scontoVero, totale, acconto, contanti };
}

export function rata(totale: number, mesi: number): number {
  return Math.round(totale / mesi);
}

// ── Formato ────────────────────────────────────────────────────────────────

/** Sempre `useGrouping: true` e locale fisso: Node e il browser devono produrre
 *  lo stesso testo, altrimenti React non idrata la pagina. */
export function egp(piastre: number): string {
  const v = Math.round(piastre / 100);
  return "EGP " + new Intl.NumberFormat("en-US", { useGrouping: true, maximumFractionDigits: 0 }).format(v);
}

export function sconto(prezzo: number, prima: number | null | undefined): number {
  return prima && prima > prezzo ? Math.round((1 - prezzo / prima) * 100) : 0;
}

// ── Telefono egiziano: 01XXXXXXXXX, +201XXXXXXXXX, 00201XXXXXXXXX ──────────

export function telefonoEgiziano(grezzo: string): string | null {
  const s = grezzo.replace(/[\s\-().]/g, "");
  const m = /^(?:\+20|0020|0)?(1[0125]\d{8})$/.exec(s);
  return m ? "0" + m[1] : null;
}

export function emailValida(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;
}

export function slugDi(testo: string): string {
  return testo
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** "S:3, M:6, L:4" → [{taglia:"S", giacenza:3}, …]. Errori in chiaro, mai silenziosi. */
export function leggiTaglie(testo: string): { taglia: string; giacenza: number }[] {
  const out: { taglia: string; giacenza: number }[] = [];
  const viste = new Set<string>();
  for (const pezzo of testo.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)) {
    const m = /^([^:=\s][^:=]*?)\s*[:=]\s*(\d{1,5})$/.exec(pezzo);
    if (!m) throw new Error(`Taglia non leggibile: «${pezzo}». Scrivila così: S:3, M:6, L:4`);
    const taglia = m[1].toUpperCase();
    if (viste.has(taglia)) throw new Error(`La taglia ${taglia} compare due volte`);
    viste.add(taglia);
    out.push({ taglia, giacenza: parseInt(m[2], 10) });
  }
  if (!out.length) throw new Error("Serve almeno una taglia, per esempio: S:3, M:6, L:4");
  return out;
}
