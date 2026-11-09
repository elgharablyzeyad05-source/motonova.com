"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { db } from "@/lib/db";
import { nuovoId } from "@/lib/id";
import { richiediAdmin } from "@/lib/sessione";
import { accontoRicevuto, cambiaStato } from "@/lib/ordini";
import { leggiTaglie, slugDi } from "@/lib/regole";
import { normalizza } from "@/lib/coupon";
import { leggiAnnuncio } from "@/lib/vinted";
import { baseUrl } from "@/lib/contesto";
import type { StatoOrdine } from "@/generated/prisma/client";

async function admin() { const u = await richiediAdmin(); if (!u) redirect("/accedi?torna=/operativo"); return u; }
const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const egpToPiastre = (s: string) => { const n = Number(s.replace(",", ".")); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN; };
const ok = (tab: string, msg: string): never => redirect(`/operativo?tab=${tab}&ok=${encodeURIComponent(msg)}`);
const ko = (tab: string, msg: string, extra = ""): never => redirect(`/operativo?tab=${tab}${extra}&err=${encodeURIComponent(msg)}`);

export async function accontoRicevutoAction(f: FormData) {
  await admin();
  const r = await accontoRicevuto(t(f, "id"));
  if (!r.ok) ko("ordini", r.errore ?? "Errore");
  revalidatePath("/operativo"); ok("ordini", "Acconto registrato: prezzo bloccato per 48 ore");
}

export async function statoOrdineAction(f: FormData) {
  await admin();
  const r = await cambiaStato(t(f, "id"), t(f, "stato") as StatoOrdine);
  if (!r.ok) ko("ordini", r.errore ?? "Errore");
  revalidatePath("/operativo"); ok("ordini", "Stato aggiornato");
}

// ---------- foto ----------
const MAGIC = (b: Buffer) =>
  (b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG") ||
  (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP");

async function salvaFoto(prodottoId: string, files: File[]) {
  const veri = files.filter((f) => f.size > 0);
  // Vercel accetta al massimo ~4,5 MB per richiesta: meglio dirlo prima che far fallire il salvataggio a metà
  if (veri.reduce((s, f) => s + f.size, 0) > 4 * 1024 * 1024) throw new Error("Foto troppo pesanti: massimo 4 MB in totale per salvataggio. Caricale una o due alla volta.");
  let ordine = await db.foto.count({ where: { prodottoId } });
  for (const file of veri) {
    const buf = Buffer.from(await file.arrayBuffer());
    if (!MAGIC(buf)) throw new Error(`${file.name}: non è una foto JPG, PNG o WebP`);
    const nome = nuovoId();
    const base = sharp(buf, { limitInputPixels: 80e6 }).rotate();
    const grande = await base.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    const piccola = await base.clone().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    const pg = `prodotti/${prodottoId}/${nome}.webp`, pp = `prodotti/${prodottoId}/${nome}-s.webp`;
    await db.$transaction([
      db.media.create({ data: { percorso: pg, dati: new Uint8Array(grande) } }),
      db.media.create({ data: { percorso: pp, dati: new Uint8Array(piccola) } }),
      db.foto.create({ data: { id: nuovoId(), prodottoId, grande: pg, piccola: pp, ordine: ordine++ } }),
    ]);
  }
}

export async function eliminaFotoAction(f: FormData) {
  await admin();
  const id = t(f, "id"); const p = await db.foto.findUnique({ where: { id } });
  if (p) await db.$transaction([db.foto.delete({ where: { id } }), db.media.deleteMany({ where: { percorso: { in: [p.grande, p.piccola] } } })]);
  ok("prodotti", "Foto tolta");
}

// ---------- prodotti ----------
export async function salvaProdottoAction(f: FormData) {
  await admin();
  const rt = t(f, "ritorno") || "prodotti";
  const id = t(f, "id");
  const back = id ? `&modifica=${id}` : "&modifica=nuovo";
  const nome = t(f, "nome"); const marcaNome = t(f, "marca");
  if (nome.length < 3) ko(rt, "Scrivi il nome del prodotto", back);
  if (!marcaNome) ko(rt, "Scrivi la marca", back);
  const tipoScelto = t(f, "tipo") === "SECOND_LIFE";
  const partenza = tipoScelto && t(f, "partenza") ? egpToPiastre(t(f, "partenza")) : NaN;
  const pzMin = Math.min(...f.getAll("pz_prezzo").map((x) => egpToPiastre(String(x).trim())).filter((x) => Number.isFinite(x) && x > 0), Infinity);
  const usato = t(f, "tipo") === "USATO";
  // Usato: il prezzo del prodotto è il più basso fra i pezzi. Senza prezzi resta a 0 ma solo se il prodotto non è visibile.
  const prezzo = tipoScelto ? partenza : usato ? (Number.isFinite(pzMin) ? pzMin : 0) : egpToPiastre(t(f, "prezzo"));
  if (usato && !(prezzo > 0) && f.get("attivo") === "on") ko(rt, "Scrivi il prezzo di almeno un pezzo, oppure togli «Visibile sul sito»", back);
  if (!usato && !(prezzo > 0)) ko(rt, tipoScelto ? "Scrivi il prezzo di partenza dell'asta (in EGP)" : "Scrivi il prezzo (in EGP, es. 5920)", back);
  const prima = t(f, "prezzoPrima") ? egpToPiastre(t(f, "prezzoPrima")) : null;
  if (prima !== null && !(prima > prezzo)) ko(rt, "Il prezzo di prima deve essere più alto del prezzo", back);
  let taglie; try { taglie = t(f, "tipo") === "USATO" ? [] : leggiTaglie(t(f, "taglie")); } catch (e) { return ko(rt, (e as Error).message, back); }
  const tipoRaw = t(f, "tipo"); const tipo = tipoRaw === "SECOND_LIFE" ? "SECOND_LIFE" : tipoRaw === "USATO" ? "USATO" : "NUOVO";
  // L'usato è sempre un pezzo unico (si vende all'asta); il nuovo può avere più pezzi.
  if (tipo === "SECOND_LIFE" && !(taglie.length === 1 && taglie[0].giacenza === 1)) ko(rt, "Il prodotto usato è un pezzo unico: scrivi una sola taglia con 1 pezzo (es. L:1)", back);
  // L'usato è sempre trattabile: i minimi stanno sui singoli pezzi.
  const trattabile = tipo === "USATO" || (tipo === "NUOVO" && f.get("trattabile") === "on");
  const minimo = tipo === "USATO" ? null : t(f, "prezzoMinimo") ? egpToPiastre(t(f, "prezzoMinimo")) : null;
  if (tipo === "NUOVO" && trattabile && (minimo === null || !(minimo > 0 && minimo <= prezzo))) ko(rt, "Con la trattativa attiva scrivi il prezzo minimo: maggiore di zero e non superiore al prezzo", back);
  const categoria = t(f, "categoria");
  if (!categoria) ko(rt, "Scegli la categoria", back);
  const stili = f.getAll("stili").map(String);
  const descrizione = t(f, "descrizione").split(/\n{2,}|\n/).map((s) => s.trim()).filter(Boolean);
  const marca = await db.marca.upsert({ where: { nome: marcaNome }, update: {}, create: { id: nuovoId(), nome: marcaNome, slug: slugDi(marcaNome) } });
  const dati = {
    nome, marcaId: marca.id, sottotitolo: t(f, "sottotitolo"), categoria, stili, tipo: tipo as "NUOVO" | "SECOND_LIFE" | "USATO",
    sottocategoria: t(f, "sottocategoria") || null, colore: t(f, "colore") || null, genere: t(f, "genere") || null,
    materiale: t(f, "materiale") || null, certificazione: t(f, "certificazione") || null, moto: t(f, "moto") || null,
    specs: t(f, "specs").split("\n").map((r) => r.trim()).filter(Boolean).map((r) => { const i = r.indexOf(":"); return i > 0 ? [r.slice(0, i).trim(), r.slice(i + 1).trim()] : [r, ""]; }),
    prezzo, prezzoMinimo: trattabile ? minimo : null, trattabile, prezzoPrima: prima, nota: t(f, "nota"), luogo: t(f, "luogo"), grado: t(f, "grado") || null, descrizione,
    edizione: ["limited", "special"].includes(t(f, "edizione")) ? t(f, "edizione") : null,
    fonteUrl: t(f, "fonteUrl") || null, costo: t(f, "costo") && egpToPiastre(t(f, "costo")) >= 0 ? egpToPiastre(t(f, "costo")) : null, difetti: t(f, "difetti"), noteInterne: t(f, "noteInterne"),
    attivo: f.get("attivo") === "on",
  };
  let pid = id;
  try {
    await db.$transaction(async (tx) => {
      if (id) await tx.prodotto.update({ where: { id }, data: dati });
      else {
        let slug = slugDi(`${marcaNome} ${nome}`); if (await tx.prodotto.findUnique({ where: { slug } })) slug += "-" + Math.random().toString(36).slice(2, 6);
        pid = nuovoId(); await tx.prodotto.create({ data: { id: pid, slug, ...dati } });
      }
      // Asta: se il pezzo è da asta e non ne ha ancora una, la apro subito con i dati del modulo.
      if (tipo === "SECOND_LIFE" && !(await tx.asta.findUnique({ where: { prodottoId: pid } }))) {
        const riserva = t(f, "riserva") ? egpToPiastre(t(f, "riserva")) : 0;
        const giorni = Math.round(Number(t(f, "giorni") || 7));
        if (!(riserva >= 0) || !(giorni >= 1 && giorni <= 30)) throw new Error("Controlla la riserva e la durata (da 1 a 30 giorni)");
        const inizio = new Date();
        await tx.asta.create({ data: { id: nuovoId(), prodottoId: pid, inizio, fine: new Date(inizio.getTime() + giorni * 864e5), partenza: prezzo, riserva, stato: "APERTA" } });
      }
      if (tipo === "USATO") {
        const g = (k: string) => f.getAll(k).map(String);
        const [ids, col, tg, qt, lk, an, co, df, nt, pr, mi] = ["pz_id", "pz_colore", "pz_taglia", "pz_qta", "pz_link", "pz_annuncio", "pz_costo", "pz_difetti", "pz_note", "pz_prezzo", "pz_minimo"].map(g);
        for (let i = 0; i < tg.length; i++) {
          const vid = (ids[i] ?? "").trim(); const taglia = (tg[i] ?? "").trim().toUpperCase();
          if (!taglia) {
            if (vid) {
              const e = await tx.variante.findUnique({ where: { id: vid } });
              if (e && e.impegnati > 0) throw new Error(`${e.colore} ${e.taglia}: è in un ordine aperto, non puoi toglierlo`);
              if (e) await tx.variante.delete({ where: { id: vid } });
            }
            continue;
          }
          const costoP = (co[i] ?? "").trim() ? egpToPiastre(co[i]) : NaN;
          const prezzoV = (pr[i] ?? "").trim() ? egpToPiastre(pr[i]) : NaN; const minimoV = (mi[i] ?? "").trim() ? egpToPiastre(mi[i]) : NaN;
          if (Number.isFinite(prezzoV) && Number.isFinite(minimoV) && minimoV > prezzoV) throw new Error(`${taglia}: il minimo non può superare il prezzo di vendita`);
          const d = { prezzo: Number.isFinite(prezzoV) && prezzoV > 0 ? prezzoV : null, prezzoMinimo: Number.isFinite(minimoV) && minimoV > 0 ? minimoV : null, colore: (col[i] ?? "").trim(), taglia, giacenza: Math.max(0, Math.min(99, parseInt(qt[i] ?? "", 10) || 1)), fonteUrl: (lk[i] ?? "").trim() || null, prezzoAnnuncio: (an[i] ?? "").trim() || null, costo: Number.isFinite(costoP) ? costoP : null, difetti: (df[i] ?? "").trim(), noteInterne: (nt[i] ?? "").trim() };
          if (vid) await tx.variante.update({ where: { id: vid }, data: d });
          else await tx.variante.create({ data: { id: nuovoId(), prodottoId: pid, ...d } });
        }
      }
      for (const v of taglie) {
        const e = await tx.variante.findUnique({ where: { prodottoId_colore_taglia: { prodottoId: pid, colore: "", taglia: v.taglia } } });
        if (e) {
          if (v.giacenza < e.impegnati) throw new Error(`${v.taglia}: ${e.impegnati} pezzi sono già in ordini aperti, non puoi scendere sotto`);
          await tx.variante.update({ where: { id: e.id }, data: { giacenza: v.giacenza } });
        } else await tx.variante.create({ data: { id: nuovoId(), prodottoId: pid, taglia: v.taglia, giacenza: v.giacenza } });
      }
    });
    await salvaFoto(pid, f.getAll("foto").filter((x): x is File => x instanceof File));
  } catch (e) { return ko(rt, (e as Error).message, pid ? `&modifica=${pid}` : back); }
  revalidatePath("/", "layout"); ok(t(f, "ritorno") || (tipo === "SECOND_LIFE" ? "aste" : "prodotti"), id ? "Salvato" : tipo === "SECOND_LIFE" ? "Asta aperta: è già sul sito" : "Prodotto pubblicato");
}

/** Caricamento veloce di un pezzo usato dal testo di un annuncio Vinted: aggiunge una variante (colore + taglia) al prodotto del modello. */
export async function caricaVelocePezzoAction(f: FormData) {
  await admin();
  const testo = t(f, "testo");
  if (testo.length < 5) ko("veloce", "Incolla il testo dell'annuncio");
  const r = leggiAnnuncio(testo, t(f, "categoria") || undefined);
  const marcaNome = t(f, "marca") || r.marca || ""; const nome = t(f, "nome") || r.nome || "";
  const categoria = t(f, "categoria") || r.categoria || "";
  if (!marcaNome || !nome || !categoria) ko("veloce", "Non ho riconosciuto il modello: scegli la categoria e scrivi marca e nome qui sotto");
  const modello = r.modello ?? `${marcaNome} ${nome}`;
  const colore = t(f, "colore") || r.colore; const taglia = (t(f, "taglia") || r.taglia).toUpperCase();
  const annuncio = t(f, "annuncio");
  const annuncioTxt = annuncio ? (/^[\d.,]+$/.test(annuncio) ? `${annuncio} €` : annuncio) : null;
  let pid = "", nuovo = false;
  if (t(f, "condizione") === "nuovo") {
    if (!taglia) ko("veloce", "Non ho trovato la taglia: scrivila qui sotto");
    let r2: { pid: string; creato: boolean };
    try {
      const marca = await db.marca.upsert({ where: { nome: marcaNome }, update: {}, create: { id: nuovoId(), nome: marcaNome, slug: slugDi(marcaNome) } });
      r2 = await db.$transaction((tx) => mettiNelNuovo(tx, { marcaId: marca.id, marcaNome, nome, categoria, modello, colore, taglia, prezzo: null, costo: null, fonteUrl: t(f, "link") || null, prezzoAnnuncio: annuncioTxt, nota: "",
        edizione: /limited edition|edizione limitata/i.test(testo) ? "limited" : /special edition|edizione speciale/i.test(testo) ? "special" : null }));
      if (r2.creato) {
        const res = await fetch(`${await baseUrl()}/immagini/modelli/${categoria}-${slugDi(modello)}.webp`).catch(() => null);
        if (res?.ok) await salvaFoto(r2.pid, [new File([await res.arrayBuffer()], "catalogo.webp", { type: "image/webp" })]);
      }
    } catch (e) { return ko("veloce", (e as Error).message); }
    revalidatePath("/", "layout");
    return ok("veloce", `Aggiunto al nuovo: ${modello} · ${taglia}. ${r2.creato ? "Prodotto nascosto: inserisci il prezzo da Prodotti e attivalo." : "Un pezzo in più su questa taglia."}`);
  }
  try {
    const marca = await db.marca.upsert({ where: { nome: marcaNome }, update: {}, create: { id: nuovoId(), nome: marcaNome, slug: slugDi(marcaNome) } });
    const esistente = await db.prodotto.findFirst({ where: { tipo: "USATO", categoria, sottocategoria: { equals: modello, mode: "insensitive" } } });
    if (esistente) pid = esistente.id;
    else {
      let slug = slugDi(`${marcaNome} ${nome} used`); if (await db.prodotto.findUnique({ where: { slug } })) slug += "-" + Math.random().toString(36).slice(2, 6);
      pid = nuovoId(); nuovo = true;
      await db.prodotto.create({ data: { id: pid, slug, nome, marcaId: marca.id, sottotitolo: "", categoria, stili: [], tipo: "USATO", sottocategoria: modello, specs: [], prezzo: 0, trattabile: true, nota: "Used", luogo: "", descrizione: [], attivo: false, edizione: /limited edition|edizione limitata|edizione limited/i.test(testo) ? "limited" : /special edition|edizione speciale|speciale/i.test(testo) ? "special" : null } });
    }
    await db.variante.create({ data: { id: nuovoId(), prodottoId: pid, colore, taglia, giacenza: 1, fonteUrl: t(f, "link") || null, prezzoAnnuncio: annuncioTxt, difetti: t(f, "difetti") || r.difetti, noteInterne: testo.slice(0, 2000) } });
    // Foto da catalogo del modello (fondo bianco), se esiste e il prodotto non ne ha ancora
    if (!(await db.foto.count({ where: { prodottoId: pid } }))) {
      const sl = slugDi(modello);
      try {
        const res = await fetch(`${await baseUrl()}/immagini/modelli/${categoria}-${sl}.webp`);
        if (res.ok) await salvaFoto(pid, [new File([await res.arrayBuffer()], "catalogo.webp", { type: "image/webp" })]);
      } catch { /* senza foto: si aggiunge dopo */ }
    }
  } catch (e) {
    const m = (e as { code?: string }).code === "P2002" ? `${modello} · ${colore || "senza colore"} · ${taglia} esiste già: modificalo da Prodotti` : (e as Error).message;
    return ko("veloce", m);
  }
  revalidatePath("/", "layout");
  ok("veloce", `Aggiunto: ${modello} · ${colore || "—"} · ${taglia}. ${nuovo ? "Prodotto nascosto: " : ""}inserisci il prezzo di vendita da Prodotti e attivalo.`);
}

// ---------- dall'usato al nuovo ----------
type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
type PezzoNuovo = { marcaId: string; marcaNome: string; nome: string; categoria: string; modello: string; colore: string; taglia: string;
  prezzo: number | null; costo: number | null; fonteUrl: string | null; prezzoAnnuncio: string | null; nota: string; edizione: string | null; fotoDa?: string };

/** Mette un pezzo nuovo di zecca nel catalogo Nuovo: si somma al prodotto nuovo dello stesso modello se c'è, altrimenti ne crea uno nascosto
    (con le foto copiate dall'usato) da completare con il prezzo. Il colore del nuovo non è per variante: finisce nel colore del prodotto. */
async function mettiNelNuovo(tx: Tx, z: PezzoNuovo): Promise<{ pid: string; creato: boolean }> {
  const esistente = await tx.prodotto.findFirst({ where: { tipo: "NUOVO", categoria: z.categoria, OR: [
    { sottocategoria: { equals: z.modello, mode: "insensitive" } }, { marcaId: z.marcaId, nome: { equals: z.nome, mode: "insensitive" } }] } });
  const appunto = [z.fonteUrl, z.prezzoAnnuncio && `annuncio ${z.prezzoAnnuncio}`, z.colore && `colore ${z.colore}`].filter(Boolean).join(" · ");
  let pid = esistente?.id ?? "";
  if (!esistente) {
    let slug = slugDi(`${z.marcaNome} ${z.nome}`); if (await tx.prodotto.findUnique({ where: { slug } })) slug += "-" + Math.random().toString(36).slice(2, 6);
    pid = nuovoId();
    await tx.prodotto.create({ data: { id: pid, slug, nome: z.nome, marcaId: z.marcaId, sottotitolo: "", categoria: z.categoria, stili: [], tipo: "NUOVO", sottocategoria: z.modello,
      colore: z.colore || null, specs: [], prezzo: z.prezzo ?? 0, trattabile: false, nota: z.nota, luogo: "", descrizione: [], attivo: false, edizione: z.edizione } });
    if (z.fotoDa) {
      const foto = await tx.foto.findMany({ where: { prodottoId: z.fotoDa }, orderBy: { ordine: "asc" } });
      for (const [i, f] of foto.entries()) {
        const media = await tx.media.findMany({ where: { percorso: { in: [f.grande, f.piccola] } } });
        const g = media.find((m) => m.percorso === f.grande), pc = media.find((m) => m.percorso === f.piccola);
        if (!g || !pc) continue;
        const n = nuovoId(), pg = `prodotti/${pid}/${n}.webp`, pp = `prodotti/${pid}/${n}-s.webp`;
        await tx.media.createMany({ data: [{ percorso: pg, dati: g.dati }, { percorso: pp, dati: pc.dati }] });
        await tx.foto.create({ data: { id: nuovoId(), prodottoId: pid, grande: pg, piccola: pp, ordine: i } });
      }
    }
  }
  const v = await tx.variante.findUnique({ where: { prodottoId_colore_taglia: { prodottoId: pid, colore: "", taglia: z.taglia } } });
  if (v) await tx.variante.update({ where: { id: v.id }, data: { giacenza: { increment: 1 }, noteInterne: [v.noteInterne, appunto].filter(Boolean).join("\n").slice(0, 4000) } });
  else await tx.variante.create({ data: { id: nuovoId(), prodottoId: pid, taglia: z.taglia, giacenza: 1, costo: z.costo, fonteUrl: z.fonteUrl, prezzoAnnuncio: z.prezzoAnnuncio, noteInterne: appunto } });
  return { pid, creato: !esistente };
}

/** Bottone «Sposta nel nuovo» su un pezzo usato già salvato: il pezzo lascia l'usato e diventa un pezzo del prodotto nuovo. */
export async function spostaNelNuovoAction(vid: string, f: FormData) {
  await admin();
  const v = await db.variante.findUnique({ where: { id: vid }, include: { prodotto: { include: { marca: true } } } });
  if (!v || v.prodotto.tipo !== "USATO") return ko("prodotti", "Pezzo non trovato");
  if (v.impegnati > 0) return ko("prodotti", "Questo pezzo è in un ordine aperto: non si può spostare", `&modifica=${v.prodottoId}`);
  // Il prezzo scritto nel modulo (anche se non ancora salvato) vale più di quello in archivio.
  const i = f.getAll("pz_id").map(String).indexOf(vid);
  const scritto = i >= 0 ? egpToPiastre(String(f.getAll("pz_prezzo")[i] ?? "").trim()) : NaN;
  const p = v.prodotto;
  let pid = "", creato = false;
  try {
    ({ pid, creato } = await db.$transaction(async (tx) => {
      const r = await mettiNelNuovo(tx, { marcaId: p.marcaId, marcaNome: p.marca.nome, nome: p.nome, categoria: p.categoria, modello: p.sottocategoria || `${p.marca.nome} ${p.nome}`,
        colore: v.colore, taglia: v.taglia, prezzo: scritto > 0 ? scritto : v.prezzo, costo: v.costo, fonteUrl: v.fonteUrl, prezzoAnnuncio: v.prezzoAnnuncio, nota: "", edizione: p.edizione, fotoDa: p.id });
      await tx.variante.delete({ where: { id: v.id } });
      if (!(await tx.variante.count({ where: { prodottoId: p.id } }))) await tx.prodotto.update({ where: { id: p.id }, data: { attivo: false } });
      return r;
    }));
  } catch (e) { return ko("prodotti", (e as Error).message, `&modifica=${p.id}`); }
  revalidatePath("/", "layout");
  ok(`prodotti&modifica=${pid}`, creato ? "Spostato nel nuovo: controlla il prezzo e rendilo visibile" : "Spostato nel nuovo: aggiunto un pezzo alla taglia " + v.taglia);
}

// ---------- coupon ----------
export async function creaCouponAction(f: FormData) {
  await admin();
  const codice = normalizza(t(f, "codice")); if (!/^[A-Z0-9_-]{3,24}$/.test(codice)) ko("coupon", "Codice: 3–24 lettere o numeri");
  const tipo = t(f, "tipo") === "FISSO" ? "FISSO" : "PERCENTUALE";
  const valore = tipo === "FISSO" ? egpToPiastre(t(f, "valore")) : Math.round(Number(t(f, "valore")));
  if (!(valore > 0) || (tipo === "PERCENTUALE" && valore > 90)) ko("coupon", "Valore non valido (percentuale 1–90, oppure EGP)");
  const num = (k: string) => (t(f, k) ? Math.round(Number(t(f, k))) : null);
  const data = (k: string) => (t(f, k) ? new Date(t(f, k)) : null);
  try {
    await db.coupon.create({ data: { id: nuovoId(), codice, tipo, valore, minimo: t(f, "minimo") ? egpToPiastre(t(f, "minimo")) : 0, inizio: data("inizio"), fine: data("fine"), usiMax: num("usiMax"), perPersona: num("perPersona") } });
  } catch { ko("coupon", "Esiste già un coupon con questo codice"); }
  ok("coupon", "Coupon creato");
}
/** Un coupon già usato non si cancella mai: si spegne. Lo storico degli ordini resta leggibile. */
export async function interruttoreCouponAction(f: FormData) {
  await admin(); const c = await db.coupon.findUnique({ where: { id: t(f, "id") } });
  if (c) await db.coupon.update({ where: { id: c.id }, data: { attivo: !c.attivo } });
  ok("coupon", "Fatto");
}

// ---------- aste ----------
export async function creaAstaAction(f: FormData) {
  await admin();
  const prodottoId = t(f, "prodottoId");
  const p = await db.prodotto.findUnique({ where: { id: prodottoId }, include: { asta: true } });
  if (!p || p.tipo !== "SECOND_LIFE") ko("aste", "Scegli un pezzo Second Life");
  if (p!.asta) ko("aste", "Questo pezzo ha già un'asta");
  const partenza = egpToPiastre(t(f, "partenza")), riserva = t(f, "riserva") ? egpToPiastre(t(f, "riserva")) : 0;
  const giorni = Math.round(Number(t(f, "giorni") || 7));
  if (!(partenza > 0) || !(riserva >= 0) || !(giorni >= 1 && giorni <= 30)) ko("aste", "Controlla partenza, riserva e durata (1–30 giorni)");
  const inizio = new Date(); const fine = new Date(inizio.getTime() + giorni * 864e5);
  await db.asta.create({ data: { id: nuovoId(), prodottoId, inizio, fine, partenza, riserva, stato: "APERTA" } });
  ok("aste", "Asta aperta");
}

// ---------- chat ----------
import { aggiungiMessaggio, pulisci } from "@/lib/chat";
export async function rispondiChatAction(f: FormData) {
  await admin();
  const id = t(f, "id"); const testo = pulisci(f.get("testo"));
  if (!testo) redirect(`/operativo?tab=chat&conv=${id}`);
  if (!(await db.conversazione.findUnique({ where: { id } }))) ko("chat", "Conversazione non trovata");
  await aggiungiMessaggio(id, testo, true);
  redirect(`/operativo?tab=chat&conv=${id}`);
}

export async function garanziaAction(f: FormData) {
  await admin();
  const u = await db.utente.findUnique({ where: { id: t(f, "id") } });
  if (u && u.ruolo !== "ADMIN") await db.utente.update({ where: { id: u.id }, data: { garanzia: !u.garanzia } });
  ok("clienti", "Fatto");
}
