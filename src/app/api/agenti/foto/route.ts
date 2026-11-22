import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { nuovoId } from "@/lib/id";
import { HOST_FOTO, pulisciFoto } from "@/lib/foto-pulizia";

export const runtime = "nodejs";
export const maxDuration = 60;

// Caricamento foto per gli agenti programmati (vedi agenti/LEGGIMI.md).
// Autorizzazione: intestazione x-agenti con
//  - la chiave AGENTI_TOKEN di Vercel, oppure
//  - una chiave usa-e-getta registrata dall'agente nel database: riga in "Limite" con chiave 'agenti:<sha256 della chiave>' e scadenza futura.
// Corpo multipart: prodottoId, colore, principale ("1"/"0"), ordine, e il file "f" oppure "src" (indirizzo https di un sito ammesso).

async function autorizzato(req: Request) {
  const dato = req.headers.get("x-agenti") ?? "";
  if (dato.length < 24) return false;
  const env = process.env.AGENTI_TOKEN ?? "";
  if (env.length >= 24 && env.length === dato.length && timingSafeEqual(Buffer.from(env), Buffer.from(dato))) return true;
  const h = createHash("sha256").update(dato).digest("hex");
  const r = await db.limite.findUnique({ where: { chiave: `agenti:${h}` } });
  return !!r && r.scade > new Date();
}

async function scarica(src: string) {
  const u = new URL(src);
  if (u.protocol !== "https:" || !HOST_FOTO.includes(u.hostname)) throw new Error(`host non ammesso: ${u.hostname}`);
  const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0", Accept: "image/webp,image/*" }, redirect: "error" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

export async function POST(req: Request) {
  if (!(await autorizzato(req))) return new Response("no", { status: 401 });
  try {
    const f = await req.formData();
    const pid = String(f.get("prodottoId") ?? "");
    if (!(await db.prodotto.findUnique({ where: { id: pid }, select: { id: true } }))) return Response.json({ ok: false, errore: "prodotto inesistente" }, { status: 400 });
    const x = f.get("f");
    const buf = x && typeof x !== "string" && x.size > 0 ? Buffer.from(await x.arrayBuffer()) : await scarica(String(f.get("src") ?? ""));
    if (buf.length > 25e6) throw new Error("file troppo grande");
    const { img, sfondo } = await pulisciFoto(buf);
    const grande = await img.clone().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    const piccola = await img.clone().resize({ width: 480, height: 480, fit: "inside" }).webp({ quality: 78 }).toBuffer();
    const n = nuovoId(), pg = `prodotti/${pid}/${n}.webp`, pp = `prodotti/${pid}/${n}-s.webp`;
    const ordine = f.get("ordine") != null ? Number(f.get("ordine")) : await db.foto.count({ where: { prodottoId: pid } });
    const id = nuovoId();
    await db.$transaction([
      db.media.create({ data: { percorso: pg, dati: new Uint8Array(grande) } }),
      db.media.create({ data: { percorso: pp, dati: new Uint8Array(piccola) } }),
      db.foto.create({ data: { id, prodottoId: pid, grande: pg, piccola: pp, ordine, colore: String(f.get("colore") ?? ""), principale: f.get("principale") === "1" } }),
    ]);
    return Response.json({ ok: true, id, sfondo });
  } catch (e) {
    return Response.json({ ok: false, errore: String((e as Error).message) }, { status: 500 });
  }
}
