// Traduzione dei contenuti scritti a mano (colori, finiture, condizioni, note brevi) senza IA.
// Ogni voce ha le forme accettate in italiano e in inglese e la resa in arabo; chi scrive può usare l'una o l'altra
// lingua («black matt», «nero opaco», «matte black») e il sito mostra la forma della lingua scelta.
// Si traduce solo un testo coperto per intero da voci note (più numeri, taglie e sigle): una frase libera
// tradotta a metà sarebbe peggio dell'originale, quindi resta com'è.

type Lingua = "it" | "en" | "ar";
type Tipo = "colore" | "finitura" | "altro";
type Voce = { it: string[]; en: string[]; ar: string; tipo: Tipo };

const V = (tipo: Tipo, it: string, en: string, ar: string): Voce => ({ tipo, it: it.split("|"), en: en.split("|"), ar });

const VOCI: Voce[] = [
  // colori
  V("colore", "nero|nera|neri", "black", "أسود"), V("colore", "bianco|bianca|bianchi", "white", "أبيض"),
  V("colore", "grigio scuro", "dark grey|dark gray", "رمادي غامق"), V("colore", "grigio chiaro", "light grey|light gray", "رمادي فاتح"),
  V("colore", "grigio|grigia", "grey|gray", "رمادي"), V("colore", "antracite", "anthracite", "رمادي فحمي"),
  V("colore", "rosso|rossa", "red", "أحمر"), V("colore", "bordeaux|bordò", "burgundy", "نبيتي"),
  V("colore", "blu scuro", "dark blue|navy", "كحلي"), V("colore", "blu", "blue", "أزرق"), V("colore", "azzurro|azzurra", "light blue|sky blue", "لبني"),
  V("colore", "verde fluo", "fluo green|neon green", "أخضر فسفوري"), V("colore", "verde", "green", "أخضر"),
  V("colore", "giallo fluo|giallo fluorescente", "fluo yellow|yellow fluo|neon yellow", "أصفر فسفوري"), V("colore", "giallo|gialla", "yellow", "أصفر"),
  V("colore", "arancione|arancio", "orange", "برتقالي"), V("colore", "arancione fluo", "fluo orange", "برتقالي فسفوري"),
  V("colore", "viola", "purple", "بنفسجي"), V("colore", "rosa", "pink", "وردي"), V("colore", "marrone", "brown", "بني"),
  V("colore", "beige", "beige", "بيج"), V("colore", "argento", "silver", "فضي"), V("colore", "oro|dorato", "gold", "دهبي"),
  V("colore", "titanio", "titanium", "تيتانيوم"), V("colore", "carbonio", "carbon", "كربون"), V("colore", "mimetico", "camo|camouflage", "مموّه"),
  V("colore", "multicolore", "multicolour|multicolor", "ألوان متعددة"), V("colore", "trasparente", "clear|transparent", "شفاف"),
  V("colore", "fumé|fume|scuro", "smoke|dark", "غامق"), V("colore", "iridium|specchiato", "iridium|mirrored", "عاكس"),
  // finiture
  V("finitura", "opaco|opaca|opachi", "matt|matte|flat", "مطفي"), V("finitura", "lucido|lucida|lucidi", "gloss|glossy", "لامع"),
  V("finitura", "metallizzato|metallizzata|metallico", "metallic", "ميتاليك"), V("finitura", "perlato|perlata", "pearl", "لؤلؤي"),
  V("finitura", "fluo|fluorescente", "fluo|neon", "فسفوري"),
  // condizioni e note brevi
  V("altro", "nuovo con etichette|nuovo con etichetta|nuovo con cartellino", "new with tags|brand new with tags", "جديد بالتيكت"),
  V("altro", "nuovo di zecca", "brand new", "جديد متبرشم"), V("altro", "come nuovo|come nuova", "like new", "زي الجديد"),
  V("altro", "mai usato|mai usata|mai indossato", "never used|never worn", "عمره ما اتستخدم"),
  V("altro", "ottime condizioni|ottimo stato", "excellent condition", "حالة ممتازة"), V("altro", "buone condizioni|buono stato", "good condition", "حالة كويسة"),
  V("altro", "condizioni discrete", "fair condition", "حالة مقبولة"),
  V("altro", "nessun difetto|senza difetti", "no defects|no flaws", "مفيش عيوب"),
  V("altro", "lievi segni di usura|leggeri segni di usura|piccoli segni di usura", "light signs of wear|minor signs of wear", "علامات استعمال خفيفة"),
  V("altro", "segni di usura", "signs of wear", "علامات استعمال"), V("altro", "graffi leggeri|piccoli graffi|lievi graffi", "light scratches|minor scratches", "خدوش خفيفة"),
  V("altro", "graffi", "scratches", "خدوش"), V("altro", "graffio", "scratch", "خدش"),
  V("altro", "sulla visiera|visiera", "on the visor|visor", "على الفيزر"), V("altro", "sulla calotta|calotta", "on the shell|shell", "على الهيكل"),
  V("altro", "interni lavati|interni puliti", "clean lining|washed lining", "البطانة نضيفة"), V("altro", "interni", "lining", "البطانة"),
  V("altro", "taglia unica", "one size", "مقاس واحد"),
  V("altro", "con commissione Vinted", "incl. Vinted fee|including Vinted fee", "شامل عمولة Vinted"),
  V("altro", "annunci", "listings", "إعلانات"), V("altro", "annuncio", "listing", "إعلان"),
  V("altro", "uomo", "men|man", "رجالي"), V("altro", "donna", "women|woman", "حريمي"),
  V("altro", "pelle", "leather", "جلد"), V("altro", "tessuto", "textile|fabric", "قماش"), V("altro", "rete|mesh", "mesh", "شبك"),
  V("altro", "impermeabile", "waterproof", "ضد المية"),
  V("altro", "usato", "used", "مستعمل"), V("altro", "nuovo", "new", "جديد"),
  V("altro", "con", "with", "مع"), V("altro", "e", "and", "و"), V("altro", "senza", "without", "من غير"),
];

const piega = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// Indice: forma (minuscola, senza accenti) → voce; le forme lunghe vincono sulle corte.
const INDICE = new Map<string, Voce>();
for (const v of VOCI) for (const f of [...v.it, ...v.en]) if (!INDICE.has(piega(f))) INDICE.set(piega(f), v);
const MAXP = Math.max(...[...INDICE.keys()].map((k) => k.split(" ").length));

// Parole che non si traducono e non impediscono la traduzione: numeri, taglie, sigle, prezzi.
const NEUTRO = /^(\d[\d.,]*|[€$£]?\d[\d.,]*[€$£]?|x?\d+|xxs|xs|s|m|l|xl|xxl|3xl|4xl|eu|egp|ece|ce|vinted|[a-z]?\d+[a-z\d]*)$/i;

const resa = (v: Voce, l: Lingua) => (l === "ar" ? v.ar : v[l][0]);

/** Traduce un testo breve scritto a mano nella lingua scelta. Se non lo copre per intero, lo restituisce com'è. */
export function traduciTesto(testo: string, l: Lingua): string {
  if (!testo || !/[A-Za-zÀ-ÿ]/.test(testo)) return testo;
  const pezzi = testo.split(/([A-Za-zÀ-ÿ']+)/); // parole alle posizioni dispari
  const parole: { i: number; w: string }[] = [];
  pezzi.forEach((p, i) => { if (i % 2 === 1) parole.push({ i, w: p }); });
  const out = [...pezzi];
  const trovate: { da: number; a: number; v: Voce }[] = [];
  for (let k = 0; k < parole.length;) {
    let presa = 0;
    for (let n = Math.min(MAXP, parole.length - k); n > 0; n--) {
      // le parole di una locuzione devono essere separate solo da spazi
      if (n > 1 && parole.slice(k, k + n - 1).some((x, j) => pezzi[x.i + 1].trim() !== "" || parole[k + j + 1].i !== x.i + 2)) continue;
      const v = INDICE.get(piega(parole.slice(k, k + n).map((x) => x.w).join(" ")));
      if (v) { trovate.push({ da: k, a: k + n, v }); presa = n; break; }
    }
    if (presa) k += presa;
    else { if (!NEUTRO.test(parole[k].w)) return testo; k++; }
  }
  if (!trovate.length) return testo;
  // Ordine delle parole: in inglese la finitura va prima del colore («matt black»), in italiano e arabo dopo.
  const seq = [...trovate];
  for (let j = 0; j + 1 < seq.length; j++) {
    const [x, y] = [seq[j], seq[j + 1]];
    if (y.da !== x.a) continue;
    const scambia = l === "en" ? x.v.tipo === "colore" && y.v.tipo === "finitura" : x.v.tipo === "finitura" && y.v.tipo === "colore";
    if (scambia) { seq[j] = { ...y, da: x.da, a: x.da + (y.a - y.da) }; seq[j + 1] = { ...x, da: seq[j].a, a: y.a }; j++; }
  }
  // Ricompongo: ogni gruppo di parole diventa la resa della sua voce, scritta nella prima posizione del gruppo.
  const posDi = (k: number) => parole[k].i;
  const originali = trovate.map((t) => ({ da: t.da, a: t.a }));
  seq.forEach((t, j) => {
    const o = originali[j];
    let r = resa(t.v, l);
    const w0 = parole[o.da].w;
    // Maiuscola solo a inizio testo o dopo un segno («Nero / Blu»), non dentro una locuzione («Matte Black» → «Nero opaco»).
    const prima = pezzi[posDi(o.da) - 1] ?? "";
    const inizio = posDi(o.da) === 1 || /\S/.test(prima);
    if (l !== "ar" && inizio && w0[0] === w0[0].toUpperCase() && w0[0] !== w0[0].toLowerCase()) r = r[0].toUpperCase() + r.slice(1);
    out[posDi(o.da)] = r;
    for (let k = o.da + 1; k < o.a; k++) { out[posDi(k)] = ""; out[posDi(k) - 1] = ""; }
  });
  let s = out.join("").replace(/\s{2,}/g, " ").trim();
  // Le forme maiuscole («Nero») restano maiuscole anche dopo lo scambio; il resto in minuscolo.
  // Un colore («black matt») si mostra come etichetta: iniziale maiuscola.
  if (l !== "ar" && /^[a-zà-ÿ]/.test(s) && (/^[A-ZÀ-Þ]/.test(testo.trim()) || trovate[0].v.tipo !== "altro")) s = s[0].toUpperCase() + s.slice(1);
  return s;
}
