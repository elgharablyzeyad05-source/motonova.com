// Traduzione dei contenuti scritti a mano (colori, finiture, condizioni, note brevi) senza IA.
// Ogni voce ha le forme accettate in italiano e in inglese e la resa in arabo; chi scrive può usare l'una o l'altra
// lingua («black matt», «nero opaco», «matte black») e il sito mostra la forma della lingua scelta.
// Si traduce solo un testo coperto per intero da voci note (più numeri, taglie e sigle): una frase libera
// tradotta a metà sarebbe peggio dell'originale, quindi resta com'è.

type Lingua = "it" | "en" | "ar";
type Tipo = "colore" | "finitura" | "agg" | "nome" | "altro";
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
  V("nome", "calotta", "shell", "الهيكل"), V("nome", "lato", "side", "الجنب"), V("nome", "retro", "back", "الضهر"),
  V("altro", "interni lavati|interni puliti", "clean lining|washed lining", "البطانة نضيفة"), V("nome", "interni", "lining", "البطانة"),
  V("altro", "taglia unica", "one size", "مقاس واحد"),
  V("altro", "con commissione Vinted", "incl. Vinted fee|including Vinted fee", "شامل عمولة Vinted"),
  V("altro", "annunci", "listings", "إعلانات"), V("altro", "annuncio", "listing", "إعلان"),
  V("altro", "uomo", "men|man", "رجالي"), V("altro", "donna", "women|woman", "حريمي"),
  V("altro", "pelle", "leather", "جلد"), V("altro", "tessuto", "textile|fabric", "قماش"), V("altro", "rete|mesh", "mesh", "شبك"),
  V("altro", "impermeabile", "waterproof", "ضد المية"),
  // parti, accessori, difetti (nomi) e aggettivi: si combinano liberamente, «graffi leggeri sulla visiera»
  V("nome", "visiera", "visor", "فيزر"), V("nome", "visiera parasole|visierino parasole|parasole", "sun visor", "فيزر شمس"), V("nome", "pinlock", "pinlock", "بينلوك"),
  V("nome", "mentoniera", "chin bar", "الدقن"), V("nome", "imbottitura|imbottiture", "padding", "الحشو"), V("nome", "cinturino|chiusura", "chin strap|strap", "الحزام"),
  V("nome", "cerniera|zip", "zip|zipper", "السوستة"), V("nome", "protezioni", "protectors|armour|armor", "الحمايات"), V("nome", "protezione", "protector", "حماية"),
  V("nome", "paraschiena", "back protector", "حماية الضهر"), V("nome", "gomiti", "elbows", "الكوع"), V("nome", "spalle", "shoulders", "الكتف"), V("nome", "ginocchia", "knees", "الركب"),
  V("nome", "suola", "sole", "النعل"), V("nome", "punta", "toe", "المقدمة"), V("nome", "tacco", "heel", "الكعب"), V("nome", "fodera", "liner", "البطانة الداخلية"),
  V("nome", "cuciture", "stitching|seams", "الخياطة"), V("nome", "adesivi|adesivo", "stickers|sticker", "استيكرات"), V("nome", "logo", "logo", "اللوجو"),
  V("nome", "scatola", "box", "العلبة"), V("nome", "scatola originale", "original box", "العلبة الأصلية"), V("nome", "sacca|sacchetto", "bag|dust bag", "الشنطة"),
  V("nome", "etichette|etichetta|cartellino", "tags|tag", "التيكت"), V("nome", "segni|segno", "marks|mark", "علامات"), V("nome", "macchia|macchie", "stain|stains", "بقعة"),
  V("nome", "strappo|strappi", "tear|tears", "قطع"), V("nome", "ammaccatura|ammaccature", "dent|dents", "خبطة"), V("nome", "crepa|crepe", "crack|cracks", "شرخ"),
  V("nome", "usura", "wear", "استعمال"), V("nome", "difetti|difetto", "defects|defect|flaws|flaw", "عيوب"),
  V("agg", "leggero|leggera|leggeri|leggere|lieve|lievi", "light|slight", "خفيف"), V("agg", "piccolo|piccola|piccoli|piccole", "small|minor", "صغير"),
  V("agg", "visibile|visibili", "visible", "باين"), V("agg", "non visibile|non visibili|invisibile", "not visible|invisible", "مش باين"),
  V("agg", "rotto|rotta|rotti", "broken", "مكسور"), V("agg", "mancante|mancanti", "missing", "ناقص"), V("agg", "scolorito|scolorita|sbiadito", "faded", "باهت"),
  V("agg", "pulito|pulita|puliti", "clean", "نضيف"), V("agg", "igienizzato|igienizzata|sanificato", "sanitised|sanitized", "متعقم"),
  V("agg", "originale|originali", "original", "أصلي"), V("agg", "omologato|omologata", "certified|homologated", "معتمد"),
  V("agg", "traspirante", "breathable", "بيهوّي"), V("agg", "ventilato|ventilata", "vented|ventilated", "مهوّي"), V("agg", "estivo|estiva|estivi", "summer", "صيفي"),
  V("agg", "invernale|invernali", "winter", "شتوي"), V("agg", "sinistro|sinistra", "left", "شمال"), V("agg", "destro|destra", "right", "يمين"),
  V("agg", "anteriore", "front", "قدّام"), V("agg", "posteriore", "rear|back", "ورا"),
  V("altro", "sulla|sul|sullo|sugli|sulle|su", "on the|on", "على"), V("altro", "nella|nel|nello|negli|nelle|in", "in the|in", "في"),
  V("altro", "dietro", "behind", "من ورا"),
  V("altro", "mai caduto|mai caduta|nessuna caduta", "never dropped|no drops", "عمره ما وقع"), V("altro", "usato poco|poco usato|usata poco", "lightly used|barely used", "مستعمل قليل"),
  V("altro", "usato una volta|usata una volta", "used once|worn once", "مستعمل مرة واحدة"), V("altro", "perfette condizioni|perfetto stato|perfetto", "perfect condition|perfect", "حالة ممتازة جداً"),
  V("altro", "completo di|completa di", "complete with", "كامل مع"), V("altro", "doppia visiera", "double visor", "فيزرين"),
  V("altro", "predisposizione interfono|predisposto interfono", "intercom ready", "جاهز للإنتركم"),
  V("altro", "fibra di vetro", "fiberglass|fibreglass", "فايبر جلاس"), V("altro", "policarbonato", "polycarbonate", "بولي كربونات"),
  V("altro", "usato", "used", "مستعمل"), V("altro", "nuovo|nuova", "new", "جديد"),
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
  // Ordine delle parole dentro un gruppo di parole consecutive: in inglese aggettivi, finiture e colori vanno prima
  // del nome («light scratches», «matt black visor»); in italiano e arabo dopo («graffi leggeri», «فيزر أسود مطفي»).
  const rango = (t: Tipo) => (l === "en" ? { agg: 0, finitura: 0, colore: 1, nome: 2, altro: -1 } : { nome: 0, colore: 1, finitura: 2, agg: 2, altro: -1 })[t];
  const seq = [...trovate];
  for (let j = 0; j < seq.length;) {
    let fine = j + 1;
    while (fine < seq.length && seq[fine].da === seq[fine - 1].a && rango(seq[fine].v.tipo) >= 0 && rango(seq[j].v.tipo) >= 0) fine++;
    if (fine - j > 1) { const run = seq.slice(j, fine).map((x, n) => ({ x, n })).sort((p, q) => rango(p.x.v.tipo) - rango(q.x.v.tipo) || p.n - q.n).map((o) => o.x); seq.splice(j, fine - j, ...run); }
    j = fine;
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
  if (l !== "ar" && /^[a-zà-ÿ]/.test(s) && (/^[A-ZÀ-Þ]/.test(testo.trim()) || ["colore", "finitura"].includes(trovate[0].v.tipo))) s = s[0].toUpperCase() + s.slice(1);
  return s;
}

/** Testi più lunghi (descrizioni, difetti): frase per frase. Ogni frase coperta si traduce, le altre restano come scritte.
    `tutto` dice se è stato tradotto tutto, per l'anteprima nel pannello. */
export function traduciFrasi(testo: string, l: Lingua): { testo: string; tutto: boolean } {
  if (!testo.trim()) return { testo, tutto: true };
  let tutto = true;
  const out = testo.split(/(?<=[.!?;\n])\s+|(?<=,)\s+/).map((f) => {
    const t = traduciTesto(f.replace(/[.!?;,]+$/, ""), l);
    const punto = f.match(/[.!?;,]+$/)?.[0] ?? "";
    if (t === f.replace(/[.!?;,]+$/, "") && /[A-Za-zÀ-ÿ]{3,}/.test(f) && !isNeutro(f)) tutto = false;
    return t + punto;
  });
  return { testo: out.join(" "), tutto };
}
const isNeutro = (f: string) => (f.match(/[A-Za-zÀ-ÿ']+/g) ?? []).every((w) => NEUTRO.test(w));
