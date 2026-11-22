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
