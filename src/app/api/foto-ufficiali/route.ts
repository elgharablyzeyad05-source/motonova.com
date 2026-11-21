import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { nuovoId } from "@/lib/id";
import { HOST_FOTO, pulisciFoto } from "@/lib/foto-pulizia";

export const runtime = "nodejs";
export const maxDuration = 60;

// Sostituzione in blocco delle foto con quelle ufficiali dei marchi (lavoro una tantum, protetto da token).
// Corpo: { sostituisci?: [{ fotoId, src }], aggiungi?: [{ prodottoId, src, colore?, principale?, ordine? }], elimina?: [fotoId] }

function autorizzato(req: Request) {
  const atteso = process.env.FOTO_TOKEN ?? "";
  const dato = req.headers.get("x-token") ?? "";
  return atteso.length >= 24 && dato.length === atteso.length && timingSafeEqual(Buffer.from(dato), Buffer.from(atteso));
}

async function scarica(src: string) {
  const u = new URL(src);
  if (u.protocol !== "https:" || !HOST_FOTO.includes(u.hostname)) throw new Error(`host non ammesso: ${u.hostname}`);
  const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "error" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const b = Buffer.from(await r.arrayBuffer());
  if (b.length > 25e6) throw new Error("file troppo grande");
  return b;
}

async function versioni(src: string) {
  const { img, sfondo } = await pulisciFoto(await scarica(src));
  const grande = await img.clone().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const piccola = await img.clone().resize({ width: 480, height: 480, fit: "inside" }).webp({ quality: 78 }).toBuffer();
  return { grande, piccola, sfondo };
}

export async function POST(req: Request) {
  if (!autorizzato(req)) return new Response("no", { status: 401 });
  const body = await req.json().catch(() => ({}));
  const esito: unknown[] = [];

  for (const s of (body.sostituisci ?? []).slice(0, 12)) {
    try {
      const f = await db.foto.findUnique({ where: { id: String(s.fotoId) } });
      if (!f) throw new Error("foto inesistente");
      const v = await versioni(String(s.src));
      const n = nuovoId(), pg = `prodotti/${f.prodottoId}/${n}.webp`, pp = `prodotti/${f.prodottoId}/${n}-s.webp`;
      await db.$transaction([
        db.media.create({ data: { percorso: pg, dati: new Uint8Array(v.grande) } }),
        db.media.create({ data: { percorso: pp, dati: new Uint8Array(v.piccola) } }),
        db.foto.update({ where: { id: f.id }, data: { grande: pg, piccola: pp } }),
        db.media.deleteMany({ where: { percorso: { in: [f.grande, f.piccola] } } }),
      ]);
      esito.push({ fotoId: f.id, ok: true, sfondo: v.sfondo });
    } catch (e) { esito.push({ fotoId: s.fotoId, ok: false, errore: String((e as Error).message) }); }
  }

  for (const a of (body.aggiungi ?? []).slice(0, 12)) {
    try {
      const pid = String(a.prodottoId);
      if (!(await db.prodotto.findUnique({ where: { id: pid }, select: { id: true } }))) throw new Error("prodotto inesistente");
      const v = await versioni(String(a.src));
      const n = nuovoId(), pg = `prodotti/${pid}/${n}.webp`, pp = `prodotti/${pid}/${n}-s.webp`;
      const ordine = typeof a.ordine === "number" ? a.ordine : await db.foto.count({ where: { prodottoId: pid } });
      await db.$transaction([
        db.media.create({ data: { percorso: pg, dati: new Uint8Array(v.grande) } }),
        db.media.create({ data: { percorso: pp, dati: new Uint8Array(v.piccola) } }),
        db.foto.create({ data: { id: nuovoId(), prodottoId: pid, grande: pg, piccola: pp, ordine, colore: String(a.colore ?? ""), principale: !!a.principale } }),
      ]);
      esito.push({ prodottoId: pid, ok: true, sfondo: v.sfondo });
    } catch (e) { esito.push({ prodottoId: a.prodottoId, ok: false, errore: String((e as Error).message) }); }
  }

  for (const id of (body.elimina ?? []).slice(0, 50)) {
    const f = await db.foto.findUnique({ where: { id: String(id) } });
    if (!f) continue;
    await db.$transaction([db.foto.delete({ where: { id: f.id } }), db.media.deleteMany({ where: { percorso: { in: [f.grande, f.piccola] } } })]);
    esito.push({ elimina: f.id, ok: true });
  }

  return Response.json({ esito });
}
