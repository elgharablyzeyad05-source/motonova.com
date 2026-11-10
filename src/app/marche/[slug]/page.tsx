import { negozioChiuso } from "@/lib/lancio";
import Prossimamente from "@/componenti/Prossimamente";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { cerca } from "@/lib/catalogo";
import { lingua, tx } from "@/lib/contesto";
import { href } from "@/lib/i18n";
import { Scheda } from "@/componenti/Scheda";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; const l = await lingua(); const m = await db.marca.findUnique({ where: { slug } });
  return m ? { title: m.nome, alternates: { canonical: href(l, `/marche/${slug}`) } } : {};
}

export default async function Marca({ params }: Props) {
  const { slug } = await params; const l = await lingua(); const _ = tx(l);
  if (await negozioChiuso()) return <Prossimamente l={l} dove={_("Marche", "Brands", "الماركات")} />;
  const m = await db.marca.findUnique({ where: { slug } });
  if (!m) notFound();
  const lista = await cerca({ marca: slug });
  return (
    <div className="foglio sezione">
      <span className="mono lieve">{_("Marca", "Brand", "الماركة")}</span>
      <h1 style={{ margin: "8px 0 14px" }}>{m.nome}</h1>
      {m.descrizione && <p className="tenue" style={{ maxWidth: 600, marginBottom: 28 }}>{m.descrizione}</p>}
      {lista.length === 0 ? <p className="tenue">{_("Nessun pezzo disponibile in questo momento.", "No pieces available right now.", "مفيش قطع متاحة دلوقتي.")}</p> : <div className="griglia">{lista.map((p) => <Scheda key={p.id} p={p} l={l} />)}</div>}
    </div>
  );
}
