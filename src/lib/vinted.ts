import MODELLI from "../../dati/usato-modelli.json";

const MARCHE = ["Alpinestars", "AGV", "HJC", "Dainese", "Scorpion", "MT", "Shoei", "Arai", "REV'IT!", "RST", "TCX", "Sidi", "Sena", "Cardo", "Kriega", "SW-Motech"];
const norm = (s: string) => ` ${s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;
const nucleo = (m: string) => m.replace(/\(.*?\)/g, "").trim();

export type Riconosciuto = {
  categoria: string | null; modello: string | null; marca: string | null; nome: string | null;
  taglia: string; descrizione: string[]; difetti: string; colore: string;
};

const HINT: Record<string, RegExp> = {
  tute: /\b(tuta|suit|one piece|intera|due pezzi|2 pezzi|two piece)\b/,
  protezioni: /\b(paraschiena|back protector|protezion\w*|armor|armour)\b/,
  gilet: /\b(gilet|vest|airbag)\b/,
};

/** Legge il testo di un annuncio Vinted: modello, categoria, taglia, descrizione. */
export function leggiAnnuncio(testo: string, catForzata?: string): Riconosciuto {
  const T = norm(testo);
  const cand: { cat: string; modello: string; marca: string; len: number }[] = [];
  for (const [cat, lista] of Object.entries(MODELLI as unknown as Record<string, string[] | string>)) {
    if (!Array.isArray(lista)) continue;
    for (const modello of lista) {
      const marca = MARCHE.find((b) => modello.toLowerCase().startsWith(b.toLowerCase()));
      if (!marca) continue;
      if (!T.includes(norm(marca))) continue;
      const resto = norm(nucleo(modello).slice(marca.length));
      const compatto = (x: string) => x.replace(/ /g, "");
      if (T.includes(resto) || T.includes(norm(nucleo(modello))) || (compatto(resto).length >= 3 && compatto(T).includes(compatto(resto)))) cand.push({ cat, modello, marca, len: resto.length });
    }
  }
  const max = Math.max(0, ...cand.map((c) => c.len));
  let top = cand.filter((c) => c.len === max);
  if (catForzata) top = top.filter((c) => c.cat === catForzata).length ? top.filter((c) => c.cat === catForzata) : top;
  let scelto = top[0];
  if (top.length > 1 && !catForzata) {
    const per = top.find((c) => HINT[c.cat]?.test(T.trim()));
    if (per) scelto = per;
  }
  // taglia
  const grezzo = testo.replace(/\s+/g, " ");
  let taglia = "";
  const m1 = grezzo.match(/\b(?:taglia|size|tg|misura|eu)\.?\s*[:\-]?\s*(3XL|4XL|XXL|XXS|XL|XS|S|M|L|\d{2}(?:[.,]\d)?(?:\s?\/\s?\d{2})?)\b/i);
  if (m1) taglia = m1[1].toUpperCase().replace(/\s/g, "");
  else { const m2 = grezzo.match(/(?:^|[\s(,;])(3XL|4XL|XXL|XXS|XL|XS)(?=[\s),;.]|$)/i); if (m2) taglia = m2[1].toUpperCase(); }
  const descrizione = testo.split(/\r?\n/).map((r) => r.trim()).filter((r) => r && !/vinted|https?:\/\//i.test(r) && !/^#/.test(r));
  const COL = "nero|black|bianco|white|grigio|grey|gray|rosso|red|blu|blue|giallo|yellow|verde|green|arancione|arancio|orange|argento|silver|oro|gold|titanio|titanium";
  const rxCol = new RegExp(`\\b(?:(?:matt|matte|opaco|opaca|lucido|lucida|gloss)[\\s/-]+)?(?:${COL})(?:[\\s/-]+(?:${COL}|lucido|lucida|opaco|opaca|matt|matte|gloss))*\\b`, "i");
  const titolo = descrizione[0] ?? "";
  const mc = titolo.match(rxCol) ?? grezzo.match(rxCol);
  const colore = mc ? mc[0].trim().replace(/\s+/g, " ").replace(/^./, (c) => c.toUpperCase()) : "";
  const DIF = /(difett|graff|segn[oi]|usura|macchi|rott|dann|cicatric|scolor|abrasion|strapp|crepa|scheggi|ammacc|sbiad|defect|scratch|scuff|wear|damage|crack|stain|tear)/i;
  const NEG = /\b(nessun[oa]?|senza|privo|zero|no|without|none)\b/i;
  const frasi = descrizione.flatMap((r) => r.split(/(?<=[.!?])\s+/)).map((x) => x.trim()).filter(Boolean);
  const difetti = frasi.filter((r) => DIF.test(r) && !NEG.test(r)).join(" ");
  return {
    categoria: scelto?.cat ?? catForzata ?? null,
    modello: scelto?.modello ?? null,
    marca: scelto?.marca ?? null,
    nome: scelto ? scelto.modello.slice(scelto.marca.length).trim() : null,
    taglia: taglia || "Unica",
    descrizione, difetti, colore,
  };
}
