"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { db } from "@/lib/db";
import { nuovoId } from "@/lib/id";
import { richiediAdmin } from "@/lib/sessione";
import { cambiaStato } from "@/lib/ordini";
import { leggiTaglie, slugDi } from "@/lib/regole";
import { normalizza } from "@/lib/coupon";
import type { StatoOrdine } from "@/generated/prisma/client";

async function admin() { const u = await richiediAdmin(); if (!u) redirect("/accedi?torna=/operativo"); return u; }
const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const egpToPiastre = (s: string) => { const n = Number(s.replace(",", ".")); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN; };
const ok = (tab: string, msg: string): never => redirect(`/operativo?tab=${tab}&ok=${encodeURIComponent(msg)}`);
const ko = (tab: string, msg: string, extra = ""): never => redirect(`/operativo?tab=${tab}${extra}&err=${encodeURIComponent(msg)}`);

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
  const id = t(f, "id");
  const back = id ? `&modifica=${id}` : "&modifica=nuovo";
  const nome = t(f, "nome"); const marcaNome = t(f, "marca");
  if (nome.length < 3) ko("prodotti", "Scrivi il nome del prodotto", back);
  if (!marcaNome) ko("prodotti", "Scrivi la marca", back);
  const prezzo = egpToPiastre(t(f, "prezzo")); if (!(prezzo > 0)) ko("prodotti", "Prezzo non valido (in EGP, es. 5920)", back);
  const prima = t(f, "prezzoPrima") ? egpToPiastre(t(f, "prezzoPrima")) : null;
  if (prima !== null && !(prima > prezzo)) ko("prodotti", "Il prezzo di prima deve essere più alto del prezzo", back);
  let taglie; try { taglie = leggiTaglie(t(f, "taglie")); } catch (e) { return ko("prodotti", (e as Error).message, back); }
  const tipo = t(f, "tipo") === "SECOND_LIFE" ? "SECOND_LIFE" : "NUOVO";
  const categoria = t(f, "categoria");
  if (!categoria) ko("prodotti", "Scegli la categoria", back);
  const stili = f.getAll("stili").map(String);
  const descrizione = t(f, "descrizione").split(/\n{2,}|\n/).map((s) => s.trim()).filter(Boolean);
  const marca = await db.marca.upsert({ where: { nome: marcaNome }, update: {}, create: { id: nuovoId(), nome: marcaNome, slug: slugDi(marcaNome) } });
  const dati = {
    nome, marcaId: marca.id, sottotitolo: t(f, "sottotitolo"), categoria, stili, tipo: tipo as "NUOVO" | "SECOND_LIFE",
    prezzo, prezzoPrima: prima, nota: t(f, "nota"), luogo: t(f, "luogo"), grado: t(f, "grado") || null, descrizione,
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
      for (const v of taglie) {
        const e = await tx.variante.findUnique({ where: { prodottoId_taglia: { prodottoId: pid, taglia: v.taglia } } });
        if (e) {
          if (v.giacenza < e.impegnati) throw new Error(`${v.taglia}: ${e.impegnati} pezzi sono già in ordini aperti, non puoi scendere sotto`);
          await tx.variante.update({ where: { id: e.id }, data: { giacenza: v.giacenza } });
        } else await tx.variante.create({ data: { id: nuovoId(), prodottoId: pid, taglia: v.taglia, giacenza: v.giacenza } });
      }
    });
    await salvaFoto(pid, f.getAll("foto").filter((x): x is File => x instanceof File));
  } catch (e) { return ko("prodotti", (e as Error).message, pid ? `&modifica=${pid}` : back); }
  revalidatePath("/", "layout"); ok("prodotti", id ? "Prodotto salvato" : "Prodotto creato");
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
