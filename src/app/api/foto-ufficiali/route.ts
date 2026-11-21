import { db } from "@/lib/db";
import { nuovoId } from "@/lib/id";
import { HOST_FOTO, pulisciFoto } from "@/lib/foto-pulizia";
import { richiediAdmin } from "@/lib/sessione";
import LAVORO from "../../../../dati/foto-ufficiali.json";

export const runtime = "nodejs";
export const maxDuration = 60;

// Sostituzione una tantum delle foto con le originali dei marchi (elenco in dati/foto-ufficiali.json).
// Solo admin collegato; si chiama a blocchi: POST { da: 0 }, poi { da: 8 }, ...

type Voce = { op: "sostituisci" | "elimina" | "aggiungi"; fotoId?: string; prodottoId?: string; src?: string; colore?: string; principale?: boolean; ordine?: number };

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
  if (req.headers.get("x-richiesta") !== "motonova" || !(await richiediAdmin())) return new Response("no", { status: 401 });
  const { da = 0 } = await req.json().catch(() => ({}));
  const tutte = LAVORO as Voce[];
  const blocco = tutte.slice(Math.max(0, Number(da) || 0), (Number(da) || 0) + 8);
  const esito: unknown[] = [];
  for (const s of blocco) {
    try {
      if (s.op === "sostituisci") {
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
        esito.push({ op: s.op, ok: true, sfondo: v.sfondo });
      } else if (s.op === "elimina") {
        const f = await db.foto.findUnique({ where: { id: String(s.fotoId) } });
        if (f) await db.$transaction([db.foto.delete({ where: { id: f.id } }), db.media.deleteMany({ where: { percorso: { in: [f.grande, f.piccola] } } })]);
        esito.push({ op: s.op, ok: true });
      } else {
        const pid = String(s.prodottoId);
        // rifare il blocco non deve duplicare: se c'è già una foto con quell'ordine e colore, salta
        if (await db.foto.findFirst({ where: { prodottoId: pid, ordine: s.ordine ?? -1, colore: s.colore ?? "" } })) { esito.push({ op: s.op, ok: true, gia: true }); continue; }
        const v = await versioni(String(s.src));
        const n = nuovoId(), pg = `prodotti/${pid}/${n}.webp`, pp = `prodotti/${pid}/${n}-s.webp`;
        await db.$transaction([
          db.media.create({ data: { percorso: pg, dati: new Uint8Array(v.grande) } }),
          db.media.create({ data: { percorso: pp, dati: new Uint8Array(v.piccola) } }),
          db.foto.create({ data: { id: nuovoId(), prodottoId: pid, grande: pg, piccola: pp, ordine: s.ordine ?? 0, colore: s.colore ?? "", principale: !!s.principale } }),
        ]);
        esito.push({ op: s.op, ok: true, sfondo: v.sfondo });
      }
    } catch (e) { esito.push({ op: s.op, ok: false, errore: String((e as Error).message) }); }
  }
  return Response.json({ totale: tutte.length, prossimo: (Number(da) || 0) + blocco.length, esito });
}
