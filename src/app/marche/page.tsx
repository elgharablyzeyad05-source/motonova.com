import { negozioChiuso } from "@/lib/lancio";
import Prossimamente from "@/componenti/Prossimamente";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { lingua, tx } from "@/lib/contesto";
import { href } from "@/lib/i18n";

export const metadata: Metadata = { title: "Marche" };
export const dynamic = "force-dynamic";

export default async function Marche() {
  const l = await lingua(); const _ = tx(l);
  if (await negozioChiuso()) return <Prossimamente l={l} dove={_("Marche", "Brands", "الماركات")} />;
  const marche = await db.marca.findMany({ where: { prodotti: { some: { attivo: true } } }, orderBy: { nome: "asc" }, include: { _count: { select: { prodotti: { where: { attivo: true } } } } } });
  return (
    <div className="foglio sezione">
      <h1 style={{ marginBottom: 28 }}>{_("Marche", "Brands", "الماركات")}</h1>
      <ul className="griglia" style={{ listStyle: "none", padding: 0, gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
        {marche.map((m) => (
          <li key={m.id}><Link href={href(l, `/marche/${m.slug}`)} style={{ display: "block", borderTop: "1px solid var(--testo)", padding: "14px 0", textDecoration: "none" }}>
            <h3 style={{ fontSize: 22 }}>{m.nome}</h3><span className="mono lieve">{m._count.prodotti} {_("pezzi", "pieces", "قطعة")}</span></Link></li>
        ))}
      </ul>
    </div>
  );
}
