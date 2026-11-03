import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lingua } from "@/lib/contesto";
import { href, tr } from "@/lib/i18n";
import { PAGINE, paginaPerId } from "@/lib/editoriale";
import { Blocchi, Collegamenti } from "@/componenti/Blocchi";

type Props = { params: Promise<{ id: string }> };
export function generateStaticParams() { return PAGINE.map((g) => ({ id: g.id })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params; const l = await lingua(); const g = paginaPerId(id);
  return g ? { title: tr(l, g.titolo), description: tr(l, g.sommario), alternates: { canonical: href(l, `/pagina/${id}`) } } : {};
}

export default async function Pagina({ params }: Props) {
  const { id } = await params; const l = await lingua(); const g = paginaPerId(id);
  if (!g) notFound();
  return (
    <article className="foglio sezione">
      <span className="mono lieve">{tr(l, g.occhiello)}</span>
      <h1 style={{ fontSize: "clamp(30px,5.5vw,56px)", margin: "10px 0 16px" }}>{tr(l, g.titolo)}</h1>
      <p className="tenue" style={{ maxWidth: 640, fontSize: 18, marginBottom: 36 }}>{tr(l, g.sommario)}</p>
      <Blocchi blocchi={g.blocchi} l={l} />
      {g.collegamenti && <Collegamenti l={l} voci={g.collegamenti} />}
    </article>
  );
}
