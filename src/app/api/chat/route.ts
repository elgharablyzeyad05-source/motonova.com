import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { limita } from "@/lib/limite";
import { utenteCorrente } from "@/lib/sessione";
import { aggiungiMessaggio, assicuraConversazione, conversazioneCorrente, pulisci } from "@/lib/chat";

export const dynamic = "force-dynamic";
const ipDi = (r: Request) => (r.headers.get("x-forwarded-for") ?? "locale").split(",")[0].trim();
const vista = (m: { id: string; daStaff: boolean; testo: string; ts: Date }) => ({ id: m.id, staff: m.daStaff, testo: m.testo, ts: m.ts.getTime() });

/** Messaggi della propria conversazione; segna come letti quelli dello staff se la chat è aperta. */
export async function GET(req: Request) {
  if (!(await limita(`chat-g:${ipDi(req)}`, 120, 60_000))) return NextResponse.json({ errore: "troppe richieste" }, { status: 429 });
  const c = await conversazioneCorrente();
  if (!c) return NextResponse.json({ messaggi: [], nonLetti: 0 });
  const url = new URL(req.url);
  const messaggi = await db.messaggio.findMany({ where: { conversazioneId: c.id }, orderBy: { ts: "asc" }, take: 200 });
  const nonLetti = messaggi.filter((m) => m.daStaff && !m.letto).length;
  if (url.searchParams.get("aperta") === "1" && nonLetti) await db.messaggio.updateMany({ where: { conversazioneId: c.id, daStaff: true, letto: false }, data: { letto: true } });
  return NextResponse.json({ messaggi: messaggi.map(vista), nonLetti });
}

export async function POST(req: Request) {
  const ip = ipDi(req);
  if (!(await limita(`chat-p:${ip}`, 12, 60_000)) || !(await limita(`chat-d:${ip}`, 150, 24 * 3600_000))) return NextResponse.json({ errore: "Troppi messaggi, riprova tra poco" }, { status: 429 });
  let corpo: { testo?: unknown; nome?: unknown };
  try { corpo = await req.json(); } catch { return NextResponse.json({ errore: "richiesta non valida" }, { status: 400 }); }
  const testo = pulisci(corpo.testo);
  if (!testo) return NextResponse.json({ errore: "messaggio vuoto" }, { status: 400 });
  const u = await utenteCorrente();
  const c = await assicuraConversazione(u?.id, u?.nome ?? pulisci(corpo.nome).slice(0, 60));
  const m = await aggiungiMessaggio(c.id, testo, false);
  return NextResponse.json({ messaggio: vista(m) });
}
