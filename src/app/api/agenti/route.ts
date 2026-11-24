import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { nuovoId } from "@/lib/id";
import { slugDi } from "@/lib/regole";

export const runtime = "nodejs";
export const maxDuration = 60;

// API degli agenti programmati (vedi agenti/LEGGIMI.md). Stessa autorizzazione di /api/agenti/foto.
// POST JSON { op: "prodotto", ... }  crea o aggiorna un prodotto con le sue varianti (chiave: slug)
// POST JSON { op: "venduto", fonteUrl }  azzera i pezzi usati/nuovi presi da quell'annuncio
// POST JSON { op: "esiste", slug? , fonteUrl? }  per sapere cosa c'è già

type V = { colore?: string; taglia: string; giacenza?: number; prezzo?: number | null; prezzoMinimo?: number | null; fonteUrl?: string | null; prezzoAnnuncio?: string | null; difetti?: string; noteInterne?: string; pezzo?: number };
type P = {
  slug: string; marca: string; nome: string; sottotitolo?: string; categoria: string; stili?: string[]; tipo?: "NUOVO" | "USATO";
  prezzo?: number; trattabile?: boolean; materiale?: string | null; certificazione?: string | null; descrizione?: string[]; edizione?: string | null;
  sottocategoria?: string | null; attivo?: boolean; genere?: string | null; varianti?: V[]; aggiornaGiacenze?: boolean; coloriSpariti?: string[];
};

async function autorizzato(req: Request) {
  const dato = req.headers.get("x-agenti") ?? "";
  if (dato.length < 24) return false;
  const env = process.env.AGENTI_TOKEN ?? "";
  if (env.length >= 24 && env.length === dato.length && timingSafeEqual(Buffer.from(env), Buffer.from(dato))) return true;
  const h = createHash("sha256").update(dato).digest("hex");
  const r = await db.limite.findUnique({ where: { chiave: `agenti:${h}` } });
  return !!r && r.scade > new Date();
}

async function prodotto(p: P) {
  if (!p.slug || !p.marca || !p.nome || !p.categoria) throw new Error("slug, marca, nome e categoria obbligatori");
  const marca = await db.marca.upsert({ where: { nome: p.marca }, update: {}, create: { id: nuovoId(), nome: p.marca, slug: slugDi(p.marca) } });
  const tipo = p.tipo ?? "NUOVO";
  let esiste = await db.prodotto.findUnique({ where: { slug: p.slug }, include: { varianti: true } });
  let creato = false;
  if (!esiste) {
    await db.prodotto.create({ data: {
      id: nuovoId(), slug: p.slug, marcaId: marca.id, nome: p.nome, sottotitolo: p.sottotitolo ?? "", categoria: p.categoria, stili: p.stili ?? [], tipo,
      prezzo: Math.round(p.prezzo ?? 0), trattabile: p.trattabile ?? tipo === "USATO", materiale: p.materiale ?? null, certificazione: p.certificazione ?? null,
      descrizione: p.descrizione ?? [], edizione: p.edizione ?? null, sottocategoria: p.sottocategoria ?? null, genere: p.genere ?? null,
      attivo: p.attivo ?? tipo === "NUOVO",
    } });
    creato = true;
    esiste = await db.prodotto.findUnique({ where: { slug: p.slug }, include: { varianti: true } });
  } else if (p.prezzo != null && tipo === "NUOVO" && Math.round(p.prezzo) !== esiste.prezzo) {
    await db.prodotto.update({ where: { id: esiste.id }, data: { prezzo: Math.round(p.prezzo) } });
  }
  const pr = esiste!;
  let nuove = 0, aggiornate = 0;
  const visti = new Set<string>();
  for (const v of p.varianti ?? []) {
    const colore = v.colore ?? "", taglia = v.taglia;
    const pezzo = v.pezzo ?? 0;
    const k = `${colore}|${taglia}|${pezzo}`;
    if (visti.has(k)) continue; visti.add(k);
    // un pezzo preso da un annuncio è sempre un pezzo in più (pezzo successivo), mai un aggiornamento
    const c = v.fonteUrl ? undefined : pr.varianti.find((x) => x.colore === colore && x.taglia === taglia && x.pezzo === pezzo);
    // un annuncio già caricato non si carica due volte
    if (!c && v.fonteUrl && (await db.variante.findFirst({ where: { fonteUrl: v.fonteUrl }, select: { id: true } }))) continue;
    if (c) {
      if (p.aggiornaGiacenze && v.giacenza != null && c.giacenza !== v.giacenza && c.impegnati === 0) { await db.variante.update({ where: { id: c.id }, data: { giacenza: v.giacenza } }); aggiornate++; }
      continue;
    }
    let pz = pezzo;
    while (pr.varianti.some((x) => x.colore === colore && x.taglia === taglia && x.pezzo === pz) || (await db.variante.findFirst({ where: { prodottoId: pr.id, colore, taglia, pezzo: pz }, select: { id: true } }))) pz++;
    await db.variante.create({ data: {
      id: nuovoId(), prodottoId: pr.id, colore, taglia, pezzo: pz, giacenza: v.giacenza ?? 1, prezzo: v.prezzo ?? null, prezzoMinimo: v.prezzoMinimo ?? null,
      fonteUrl: v.fonteUrl ?? null, prezzoAnnuncio: v.prezzoAnnuncio ?? null, difetti: v.difetti ?? "", noteInterne: v.noteInterne ?? "",
    } });
    nuove++;
  }
  // nuovo: le taglie che il sito ufficiale non ha più vanno a zero (solo per i colori presenti nel piano),
  // e i colori spariti del tutto dal sito ufficiale (coloriSpariti) vanno a zero interi
  if (p.aggiornaGiacenze && tipo === "NUOVO") {
    const colPiano = new Set((p.varianti ?? []).map((v) => v.colore ?? ""));
    const spariti = new Set(p.coloriSpariti ?? []);
    for (const c of pr.varianti) {
      if (c.fonteUrl || c.giacenza === 0 || c.impegnati > 0) continue; // i pezzi presi da Vinted li gestisce l'agente dell'usato
      const via = spariti.has(c.colore) || (colPiano.has(c.colore) && !visti.has(`${c.colore}|${c.taglia}|${c.pezzo}`));
      if (via) { await db.variante.update({ where: { id: c.id }, data: { giacenza: 0 } }); aggiornate++; }
    }
  }
  const foto = await db.foto.count({ where: { prodottoId: pr.id } });
  return { id: pr.id, creato, nuove, aggiornate, foto };
}

const nomeBase = (n: string) => n.replace(/\s+(special|limited)\s+edition\b.*$/i, "").trim();
const slugColore = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Nome del modello di un prodotto usato: dalla sottocategoria «Marca Modello» (es. «AGV K3 SV» → «K3 SV»).
const pulisci = (s: string) => s.replace(/\s+/g, " ").trim();
function modelloDi(sottocategoria: string | null, marca: string, nomeFallback: string) {
  const sc = pulisci(sottocategoria ?? "");
  if (sc) return sc.toLowerCase().startsWith(marca.toLowerCase() + " ") ? sc.slice(marca.length + 1) : sc;
  return nomeBase(pulisci(nomeFallback));
}

// Sposta un pezzo usato nel prodotto della sua colorazione. Nome e slug si ricavano dal MODELLO (sottocategoria) e dal colore,
// mai dal nome del prodotto di partenza (che può contenere un colore generico vecchio, es. «K3 Nero Matt Black»).
// Se esiste già un prodotto usato dello stesso modello con quella sola colorazione, il pezzo va lì (niente doppioni).
// `modello` (opzionale) = nuova sottocategoria «Marca Modello», per i pezzi finiti nel modello sbagliato.
async function spostaInColorazione(varianteId: string, slug: string, nome: string, edizione?: string | null, modello?: string) {
  const v = await db.variante.findUniqueOrThrow({ where: { id: varianteId }, include: { prodotto: { include: { foto: true, marca: true } } } });
  const src = v.prodotto;
  const sottocategoria = pulisci(modello || src.sottocategoria || "") || null;
  const mod = modelloDi(sottocategoria, src.marca.nome, src.nome);
  const ed = edizione === undefined ? src.edizione : edizione;
  if (!slug) {
    const gemello = (await db.prodotto.findMany({ where: { tipo: "USATO", sottocategoria, marcaId: src.marcaId, id: { not: src.id } }, select: { id: true, slug: true, varianti: { select: { colore: true } } } }))
      .find((p) => p.varianti.length > 0 && p.varianti.every((x) => x.colore === v.colore));
    if (gemello) slug = gemello.slug;
  }
  const base = slugColore(sottocategoria || `${src.marca.nome} ${mod}`);
  slug = slug || `${base}-${slugColore(v.colore) || "da-riconoscere"}${ed === "special" || ed === "limited" ? `-${ed}` : ""}-used`;
  nome = nome || pulisci(`${mod} ${v.colore}`);
  let dest = await db.prodotto.findUnique({ where: { slug } });
  let creato = false;
  if (!dest) {
    dest = await db.prodotto.create({ data: {
      id: nuovoId(), slug, marcaId: src.marcaId, nome, sottotitolo: src.sottotitolo, categoria: src.categoria, stili: src.stili, tipo: "USATO",
      prezzo: 0, trattabile: true, edizione: ed, sottocategoria, genere: src.genere,
      materiale: src.materiale, certificazione: src.certificazione, descrizione: src.descrizione, attivo: false,
    } });
    creato = true;
  }
  if (dest.id === src.id) return { creato, prodotto: dest.slug };
  let pz = 0;
  while (await db.variante.findFirst({ where: { prodottoId: dest.id, colore: v.colore, taglia: v.taglia, pezzo: pz }, select: { id: true } })) pz++;
  await db.variante.update({ where: { id: v.id }, data: { prodottoId: dest.id, pezzo: pz } });
  // le foto di quel colore: si spostano se nel vecchio prodotto non restano pezzi di quel colore, altrimenti si copiano
  const restano = await db.variante.count({ where: { prodottoId: src.id, colore: v.colore } });
  const giaDest = await db.foto.count({ where: { prodottoId: dest.id, colore: v.colore } });
  if (!giaDest) {
    for (const f of src.foto.filter((x) => x.colore === v.colore)) {
      if (!restano) await db.foto.update({ where: { id: f.id }, data: { prodottoId: dest.id } });
      else {
        const [g, pc] = await Promise.all([db.media.findUnique({ where: { percorso: f.grande } }), db.media.findUnique({ where: { percorso: f.piccola } })]);
        if (!g || !pc) continue;
        const n = nuovoId(), pg = `prodotti/${dest.id}/${n}.webp`, pp = `prodotti/${dest.id}/${n}-s.webp`;
        await db.$transaction([db.media.create({ data: { percorso: pg, dati: g.dati } }), db.media.create({ data: { percorso: pp, dati: pc.dati } }),
          db.foto.create({ data: { id: nuovoId(), prodottoId: dest.id, grande: pg, piccola: pp, ordine: f.ordine, colore: f.colore, principale: f.principale } })]);
      }
    }
  }
  // un prodotto usato rimasto vuoto (era solo il contenitore di colorazioni ora separate) si toglie, con le sue foto
  if (!(await db.variante.count({ where: { prodottoId: src.id } })) && src.tipo === "USATO" && !(await db.asta.findUnique({ where: { prodottoId: src.id } }).catch(() => null))) {
    const fs = await db.foto.findMany({ where: { prodottoId: src.id } });
    await db.media.deleteMany({ where: { percorso: { in: fs.flatMap((f) => [f.grande, f.piccola]) } } });
    await db.preferito.deleteMany({ where: { prodottoId: src.id } }).catch(() => null);
    await db.prodotto.delete({ where: { id: src.id } });
  }
  return { creato, prodotto: dest.slug };
}

export async function POST(req: Request) {
  if (!(await autorizzato(req))) return new Response("no", { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return Response.json({ ok: false, errore: "JSON mancante" }, { status: 400 });
  try {
    if (b.op === "prodotto") return Response.json({ ok: true, ...(await prodotto(b as P)) });
    if (b.op === "venduto") {
      const vs = await db.variante.findMany({ where: { fonteUrl: String(b.fonteUrl) } });
      let tolti = 0;
      for (const v of vs) if (v.giacenza > 0 && v.impegnati === 0) { await db.variante.update({ where: { id: v.id }, data: { giacenza: 0 } }); tolti++; }
      return Response.json({ ok: true, trovati: vs.length, tolti });
    }
    if (b.op === "catalogo") {
      const ps = await db.prodotto.findMany({ where: { marca: { nome: String(b.marca) }, tipo: b.tipo === "USATO" ? "USATO" : "NUOVO" }, select: { slug: true, nome: true, sottocategoria: true, varianti: { select: { colore: true, taglia: true, fonteUrl: true, giacenza: true } } } });
      return Response.json({ ok: true, prodotti: ps.map((p) => ({ slug: p.slug, nome: p.nome, sottocategoria: p.sottocategoria, colori: [...new Set(p.varianti.map((v) => v.colore))], annunci: p.varianti.filter((v) => v.fonteUrl && v.giacenza > 0).map((v) => v.fonteUrl) })) });
    }
    // Usato da riconoscere: pezzi presi da Vinted, ancora disponibili, con la situazione delle foto per colore
    if (b.op === "daRiconoscere") {
      const vs = await db.variante.findMany({
        where: { fonteUrl: { not: null }, giacenza: { gt: 0 } },
        select: { id: true, colore: true, taglia: true, fonteUrl: true, noteInterne: true, difetti: true, prodotto: { select: { id: true, slug: true, nome: true, tipo: true, sottocategoria: true, marca: { select: { nome: true } }, foto: { select: { id: true, colore: true, principale: true } } } } },
        orderBy: { id: "asc" },
      });
      return Response.json({ ok: true, pezzi: vs.map((v) => ({
        varianteId: v.id, colore: v.colore, taglia: v.taglia, fonteUrl: v.fonteUrl, note: v.noteInterne, difetti: v.difetti,
        prodotto: { id: v.prodotto.id, slug: v.prodotto.slug, nome: v.prodotto.nome, tipo: v.prodotto.tipo, modello: v.prodotto.sottocategoria, marca: v.prodotto.marca.nome },
        fotoDelColore: v.prodotto.foto.filter((f) => f.colore === v.colore).length, fotoProdotto: v.prodotto.foto.length,
      })) });
    }
    // Copia una foto già sul sito (es. dal catalogo nuovo) in un altro prodotto, con il colore indicato
    if (b.op === "copiaFoto") {
      const f = await db.foto.findUnique({ where: { id: String(b.fotoId) } });
      const dest = await db.prodotto.findUnique({ where: { id: String(b.prodottoId) }, select: { id: true } });
      if (!f || !dest) throw new Error("foto o prodotto inesistente");
      const [g, pc] = await Promise.all([db.media.findUnique({ where: { percorso: f.grande } }), db.media.findUnique({ where: { percorso: f.piccola } })]);
      if (!g || !pc) throw new Error("file della foto mancante");
      const n = nuovoId(), pg = `prodotti/${dest.id}/${n}.webp`, pp = `prodotti/${dest.id}/${n}-s.webp`;
      const ordine = b.ordine != null ? Number(b.ordine) : await db.foto.count({ where: { prodottoId: dest.id } });
      const id = nuovoId();
      await db.$transaction([
        db.media.create({ data: { percorso: pg, dati: g.dati } }),
        db.media.create({ data: { percorso: pp, dati: pc.dati } }),
        db.foto.create({ data: { id, prodottoId: dest.id, grande: pg, piccola: pp, ordine, colore: String(b.colore ?? f.colore), principale: !!b.principale } }),
      ]);
      return Response.json({ ok: true, id });
    }
    // Corregge un pezzo preso da Vinted (colore ufficiale, taglia, note). Solo pezzi con fonteUrl, mai il catalogo nuovo.
    if (b.op === "variante") {
      const v = await db.variante.findUnique({ where: { id: String(b.varianteId) } });
      if (!v || !v.fonteUrl) throw new Error("si correggono solo i pezzi presi da annunci");
      const data: { colore?: string; taglia?: string; noteInterne?: string; difetti?: string } = {};
      if (typeof b.colore === "string" && b.colore.trim()) data.colore = b.colore.trim();
      if (typeof b.taglia === "string" && b.taglia.trim()) data.taglia = b.taglia.trim();
      if (typeof b.noteInterne === "string") data.noteInterne = b.noteInterne.slice(0, 2000);
      if (typeof b.difetti === "string") data.difetti = b.difetti.slice(0, 1000);
      if (data.colore || data.taglia) {
        const col = data.colore ?? v.colore, tg = data.taglia ?? v.taglia;
        let pz = v.pezzo;
        while (await db.variante.findFirst({ where: { prodottoId: v.prodottoId, colore: col, taglia: tg, pezzo: pz, id: { not: v.id } }, select: { id: true } })) pz++;
        (data as { pezzo?: number }).pezzo = pz;
      }
      await db.variante.update({ where: { id: v.id }, data });
      // usato: cambiato il colore, il pezzo va nel prodotto della sua colorazione
      const p = await db.prodotto.findUnique({ where: { id: v.prodottoId }, select: { tipo: true } });
      if (data.colore && data.colore !== v.colore && p?.tipo === "USATO") {
        const r = await spostaInColorazione(v.id, "", "", b.edizione ?? undefined);
        return Response.json({ ok: true, spostatoIn: r.prodotto });
      }
      return Response.json({ ok: true });
    }
    // Foto del catalogo (per trovare quelle da riusare): per marca, i prodotti con i colori e la foto principale di ciascun colore
    if (b.op === "fotoCatalogo") {
      const ps = await db.prodotto.findMany({ where: { marca: { nome: String(b.marca) }, tipo: "NUOVO" }, select: { id: true, nome: true, foto: { select: { id: true, colore: true, principale: true, grande: true }, orderBy: { ordine: "asc" } } } });
      return Response.json({ ok: true, prodotti: ps.map((p) => ({ id: p.id, nome: p.nome, colori: Object.values(p.foto.reduce((m, f) => { (m[f.colore] ??= { colore: f.colore, foto: [] as { id: string; principale: boolean; url: string }[] }).foto.push({ id: f.id, principale: f.principale, url: `/media/${f.grande}` }); return m; }, {} as Record<string, { colore: string; foto: { id: string; principale: boolean; url: string }[] }>)) })) });
    }
    // Prezzi dei pezzi presi da Vinted (regola di Zeyad, 24/11/2026):
    //   prezzo = euro dell'annuncio × 62 + 3.000 + 10.000 EGP; minimo trattabile = euro × 62 + 2.000 + 4.000 EGP (invariato).
    //   I prezzi messi con la formula vecchia (euro × 62 + 9.000) si aggiornano alla nuova; quelli messi a mano non si toccano.
    // Il prezzo si mette solo ai pezzi pronti: foto ufficiale del loro colore e taglia verificata. I prezzi già presenti non si toccano.
    // Un prodotto USATO va online quando ha almeno un pezzo pronto e disponibile; il suo prezzo è il più basso dei pezzi pronti.
    if (b.op === "prezzi") {
      const vs = await db.variante.findMany({ where: { fonteUrl: { not: null }, giacenza: { gt: 0 } }, include: { prodotto: { select: { id: true, tipo: true, foto: { select: { colore: true } } } } } });
      let prezzati = 0, nonPronti = 0, senzaPrezzoAnnuncio = 0;
      let aggiornati = 0;
      for (const v of vs) {
        const m = (v.prezzoAnnuncio ?? "").replace(/\s/g, "").match(/(\d+(?:[.,]\d{1,2})?)/);
        if (v.prezzo != null) {
          if (m && v.prezzo === Math.round(Number(m[1].replace(",", ".")) * 62 + 9000) * 100) {
            await db.variante.update({ where: { id: v.id }, data: { prezzo: Math.round(Number(m[1].replace(",", ".")) * 62 + 13000) * 100 } });
            aggiornati++;
          }
          continue;
        }
        if (!m) { senzaPrezzoAnnuncio++; continue; }
        const euro = Number(m[1].replace(",", "."));
        const pronto = v.prodotto.foto.some((f) => f.colore === v.colore) && v.taglia.trim() !== "" && !/verific/i.test(v.taglia);
        if (!pronto) { nonPronti++; continue; }
        await db.variante.update({ where: { id: v.id }, data: { prezzo: Math.round(euro * 62 + 13000) * 100, prezzoMinimo: Math.round(euro * 62 + 6000) * 100 } });
        prezzati++;
      }
      // anche i prodotti NUOVO fatti solo di pezzi presi da annunci (nuovo di zecca senza modello a catalogo): stessa regola di pubblicazione
      const usati = await db.prodotto.findMany({ where: { OR: [{ tipo: "USATO" }, { tipo: "NUOVO", AND: [{ varianti: { some: {} } }, { varianti: { every: { fonteUrl: { not: null } } } }] }] }, select: { id: true, tipo: true, attivo: true, prezzo: true, foto: { select: { colore: true } }, varianti: { select: { prezzo: true, giacenza: true, impegnati: true, colore: true } } } });
      let pubblicati = 0;
      for (const p of usati) {
        const conFoto = new Set(p.foto.map((f) => f.colore));
        const pronti = p.varianti.filter((v) => v.prezzo != null && v.giacenza - v.impegnati > 0 && conFoto.has(v.colore)).map((v) => v.prezzo!);
        if (!pronti.length) { if (p.attivo) await db.prodotto.update({ where: { id: p.id }, data: { attivo: false } }); continue; }
        const min = Math.min(...pronti);
        if (!p.attivo || p.prezzo !== min) {
          await db.prodotto.update({ where: { id: p.id }, data: p.tipo === "USATO" ? { attivo: true, prezzo: min, trattabile: true } : { attivo: true, prezzo: min } });
          if (!p.attivo) pubblicati++;
        }
      }
      return Response.json({ ok: true, prezzati, aggiornati, nonPronti, senzaPrezzoAnnuncio, pubblicati });
    }
    // Usato: un prodotto per ogni colorazione (regola di Zeyad, 23/11/2026). Sposta un pezzo nel prodotto della sua colorazione,
    // creandolo se manca (stessa marca, categoria, modello). Le foto di quel colore vanno con lui.
    if (b.op === "spostaPezzo") {
      const v = await db.variante.findUnique({ where: { id: String(b.varianteId) }, include: { prodotto: true } });
      if (!v || v.prodotto.tipo !== "USATO") throw new Error("si spostano solo pezzi dell'usato");
      const r = await spostaInColorazione(v.id, String(b.slug ?? ""), String(b.nome ?? ""), b.edizione ?? undefined, typeof b.modello === "string" ? b.modello : undefined);
      return Response.json({ ok: true, ...r });
    }
    // Riordina l'usato: riunisce i prodotti dello stesso modello con la stessa colorazione (un prodotto per colorazione)
    // e rimette i nomi nella forma «Modello Colorazione». Gli slug (link) non cambiano. { op: "sistemaUsato", prova?: true }
    if (b.op === "sistemaUsato") {
      const prova = !!b.prova;
      const ps = await db.prodotto.findMany({ where: { tipo: "USATO" }, include: { marca: true, foto: { select: { colore: true } }, varianti: { select: { id: true, colore: true } } }, orderBy: { creato: "asc" } });
      const riuniti: string[] = [], rinominati: string[] = [];
      const gruppi = new Map<string, typeof ps>();
      for (const p of ps) {
        const col = [...new Set(p.varianti.map((x) => x.colore))];
        if (col.length !== 1 || !col[0]) continue;
        const k = `${p.marcaId}|${pulisci(p.sottocategoria ?? "")}|${col[0]}`;
        gruppi.set(k, [...(gruppi.get(k) ?? []), p]);
      }
      for (const g of gruppi.values()) {
        if (g.length < 2) continue;
        // resta il prodotto con le foto di quel colore (a parità: il più vecchio)
        const col = g[0].varianti[0].colore;
        const dest = [...g].sort((a, c) => Number(c.foto.some((f) => f.colore === col)) - Number(a.foto.some((f) => f.colore === col)))[0];
        for (const p of g) {
          if (p.id === dest.id) continue;
          riuniti.push(`${p.slug} → ${dest.slug}`);
          if (!prova) for (const x of p.varianti) await spostaInColorazione(x.id, dest.slug, "", undefined);
        }
      }
      const dopo = prova ? ps : await db.prodotto.findMany({ where: { tipo: "USATO" }, include: { marca: true, varianti: { select: { colore: true } } } });
      for (const p of dopo) {
        const col = [...new Set(p.varianti.map((x) => x.colore))];
        if (col.length !== 1 || !col[0]) continue;
        const n = pulisci(`${modelloDi(p.sottocategoria, p.marca.nome, p.nome)} ${pulisci(col[0])}`);
        if (n !== p.nome) { rinominati.push(`${p.nome} → ${n}`); if (!prova) await db.prodotto.update({ where: { id: p.id }, data: { nome: n } }); }
      }
      return Response.json({ ok: true, prova, riuniti, rinominati });
    }
    // Divide in blocco ogni prodotto usato con più colorazioni: un prodotto per colorazione.
    if (b.op === "dividiUsato") {
      const ps = await db.prodotto.findMany({ where: { tipo: "USATO" }, include: { varianti: true } });
      let creati = 0, spostati = 0;
      for (const p of ps) {
        const colori = [...new Set(p.varianti.map((v) => v.colore))];
        if (colori.length < 2) {
          if (colori.length === 1 && colori[0] && !p.nome.includes(colori[0])) await db.prodotto.update({ where: { id: p.id }, data: { nome: `${nomeBase(p.nome)} ${colori[0]}` } });
          continue;
        }
        // resta qui il colore con più pezzi; gli altri vanno nei loro prodotti
        const conta = (c: string) => p.varianti.filter((v) => v.colore === c).length;
        const resta = [...colori].sort((a, b2) => conta(b2) - conta(a) || (a ? 0 : 1))[0];
        for (const c of colori) {
          if (c === resta || !c) continue;
          for (const v of p.varianti.filter((x) => x.colore === c)) { const r = await spostaInColorazione(v.id, "", "", undefined); spostati++; if (r.creato) creati++; }
        }
        if (resta) await db.prodotto.update({ where: { id: p.id }, data: { nome: `${nomeBase(p.nome)} ${resta}` } });
      }
      return Response.json({ ok: true, creati, spostati });
    }
    if (b.op === "esiste") {
      if (b.fonteUrl) return Response.json({ ok: true, esiste: !!(await db.variante.findFirst({ where: { fonteUrl: String(b.fonteUrl) }, select: { id: true } })) });
      const p = await db.prodotto.findUnique({ where: { slug: String(b.slug) }, select: { id: true, foto: { select: { colore: true, ordine: true } }, varianti: { select: { colore: true, taglia: true, giacenza: true } } } });
      if (!p) return Response.json({ ok: true, esiste: false });
      return Response.json({ ok: true, esiste: true, id: p.id, coloriFoto: [...new Set(p.foto.map((f) => f.colore))], maxOrdine: Math.max(-1, ...p.foto.map((f) => f.ordine)), varianti: p.varianti.length });
    }
    return Response.json({ ok: false, errore: "op sconosciuta" }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, errore: String((e as Error).message) }, { status: 500 });
  }
}
