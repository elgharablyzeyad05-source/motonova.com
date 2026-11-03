import { NextResponse } from "next/server";
import { suggerimenti } from "@/lib/catalogo";
import { limita } from "@/lib/limite";

export async function GET(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "locale").split(",")[0].trim();
  if (!limita(`sug:${ip}`, 90, 60_000)) return NextResponse.json([], { status: 429 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const r = await suggerimenti(q.slice(0, 60));
  return NextResponse.json(r.map((p) => ({ slug: p.slug, etichetta: `${p.marca.nome} ${p.nome}` })));
}
