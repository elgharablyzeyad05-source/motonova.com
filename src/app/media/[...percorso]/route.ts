import { db } from "@/lib/db";
import { r2Leggi } from "@/lib/archivio";

// Le foto stanno nel database (tabella Media) o su Cloudflare R2 (riga Media con dati vuoti) e passano da qui. Si serve solo ciò che è in tabella:
// niente percorsi sul disco, quindi niente «../».
export async function GET(_req: Request, { params }: { params: Promise<{ percorso: string[] }> }) {
  const { percorso } = await params;
  const chiave = percorso.join("/");
  if (!/^prodotti\/[\w-]+\/[\w-]+\.webp$/.test(chiave)) return new Response("Not found", { status: 404 });
  const m = await db.media.findUnique({ where: { percorso: chiave } });
  if (!m) return new Response("Not found", { status: 404 });
  // dati vuoti = la foto è stata spostata su Cloudflare R2
  const dati = m.dati.length > 0 ? Uint8Array.from(m.dati) : await r2Leggi(chiave);
  if (!dati) return new Response("Not found", { status: 404 });
  return new Response(dati, { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
