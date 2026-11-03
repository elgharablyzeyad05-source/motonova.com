import { db } from "@/lib/db";

// Le foto stanno nel database (tabella Media) e passano da qui. Si serve solo ciò che è in tabella:
// niente percorsi sul disco, quindi niente «../».
export async function GET(_req: Request, { params }: { params: Promise<{ percorso: string[] }> }) {
  const { percorso } = await params;
  const chiave = percorso.join("/");
  if (!/^prodotti\/[\w-]+\/[\w-]+\.webp$/.test(chiave)) return new Response("Not found", { status: 404 });
  const m = await db.media.findUnique({ where: { percorso: chiave } });
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(m.dati), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
