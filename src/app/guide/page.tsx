import type { Metadata } from "next";
import Link from "next/link";
import { lingua, tx } from "@/lib/contesto";
import { href, tr } from "@/lib/i18n";
import { GUIDE } from "@/lib/editoriale";

export const metadata: Metadata = { title: "Guide" };

export default async function Guide() {
  const l = await lingua(); const _ = tx(l);
  return (
    <div className="foglio sezione">
      <h1 style={{ marginBottom: 14 }}>{_("Guide", "Guides", "أدلة")}</h1>
      <p className="tenue" style={{ maxWidth: 560, marginBottom: 36 }}>{_("Quello che ci chiedono prima di comprare, scritto una volta sola.", "What people ask before buying, written once.", "اللي الناس بتسألنا عليه قبل ما تشتري، مكتوب مرة واحدة.")}</p>
      <div className="griglia" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
        {GUIDE.map((g) => (
          <Link key={g.id} href={href(l, `/guide/${g.id}`)} className="scheda" style={{ borderTop: "1px solid var(--testo)", paddingTop: 14 }}>
            <span className="mono lieve">{tr(l, g.occhiello)} · {tr(l, g.tempo)}</span>
            <h3 style={{ fontSize: 20 }}>{tr(l, g.titolo)}</h3>
            <p className="tenue">{tr(l, g.sommario)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
