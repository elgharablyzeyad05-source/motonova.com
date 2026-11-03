import { db } from "@/lib/db";
import { richiediAdmin } from "@/lib/sessione";

export async function GET() {
  if (!(await richiediAdmin())) return new Response("Not found", { status: 404 });
  const r = await db.iscritto.findMany({ orderBy: { creato: "desc" } });
  // un'email che inizia con = + - @ in un foglio di calcolo può eseguire formule: la neutralizziamo
  const cella = (s: string) => `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
  const csv = ["email,lingua,data", ...r.map((x) => [cella(x.email), x.lingua, x.creato.toISOString()].join(","))].join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="iscritti.csv"', "Cache-Control": "no-store" } });
}
