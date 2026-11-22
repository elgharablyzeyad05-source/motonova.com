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
      return Response.json({ ok: true });
    }
    // Foto del catalogo (per trovare quelle da riusare): per marca, i prodotti con i colori e la foto principale di ciascun colore
    if (b.op === "fotoCatalogo") {
      const ps = await db.prodotto.findMany({ where: { marca: { nome: String(b.marca) }, tipo: "NUOVO" }, select: { id: true, nome: true, foto: { select: { id: true, colore: true, principale: true, grande: true }, orderBy: { ordine: "asc" } } } });
      return Response.json({ ok: true, prodotti: ps.map((p) => ({ id: p.id, nome: p.nome, colori: Object.values(p.foto.reduce((m, f) => { (m[f.colore] ??= { colore: f.colore, foto: [] as { id: string; principale: boolean; url: string }[] }).foto.push({ id: f.id, principale: f.principale, url: `/media/${f.grande}` }); return m; }, {} as Record<string, { colore: string; foto: { id: string; principale: boolean; url: string }[] }>)) })) });
    }
    // Prezzi dei pezzi presi da Vinted (regola di Zeyad, 23/11/2026):
    //   prezzo = euro dell'annuncio × 62 + 2.000 + 7.000 EGP; minimo trattabile = euro × 62 + 2.000 + 4.000 EGP.
    // Il prezzo si mette solo ai pezzi pronti: foto ufficiale del loro colore e taglia verificata. I prezzi già presenti non si toccano.
    // Un prodotto USATO va online quando ha almeno un pezzo pronto e disponibile; il suo prezzo è il più basso dei pezzi pronti.
    if (b.op === "prezzi") {
      const vs = await db.variante.findMany({ where: { fonteUrl: { not: null }, giacenza: { gt: 0 } }, include: { prodotto: { select: { id: true, tipo: true, foto: { select: { colore: true } } } } } });
      let prezzati = 0, nonPronti = 0, senzaPrezzoAnnuncio = 0;
      for (const v of vs) {
        if (v.prezzo != null) continue;
        const m = (v.prezzoAnnuncio ?? "").replace(/\s/g, "").match(/(\d+(?:[.,]\d{1,2})?)/);
        if (!m) { senzaPrezzoAnnuncio++; continue; }
        const euro = Number(m[1].replace(",", "."));
        const pronto = v.prodotto.foto.some((f) => f.colore === v.colore) && v.taglia.trim() !== "" && !/verific/i.test(v.taglia);
        if (!pronto) { nonPronti++; continue; }
        await db.variante.update({ where: { id: v.id }, data: { prezzo: Math.round(euro * 62 + 9000) * 100, prezzoMinimo: Math.round(euro * 62 + 6000) * 100 } });
        prezzati++;
      }
      const usati = await db.prodotto.findMany({ where: { tipo: "USATO" }, select: { id: true, attivo: true, prezzo: true, varianti: { select: { prezzo: true, giacenza: true, impegnati: true } } } });
      let pubblicati = 0;
      for (const p of usati) {
        const pronti = p.varianti.filter((v) => v.prezzo != null && v.giacenza - v.impegnati > 0).map((v) => v.prezzo!);
        if (!pronti.length) continue;
        const min = Math.min(...pronti);
        if (!p.attivo || p.prezzo !== min) {
          await db.prodotto.update({ where: { id: p.id }, data: { attivo: true, prezzo: min, trattabile: true } });
          if (!p.attivo) pubblicati++;
        }
      }
      return Response.json({ ok: true, prezzati, nonPronti, senzaPrezzoAnnuncio, pubblicati });
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
