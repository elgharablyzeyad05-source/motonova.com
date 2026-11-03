import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { lingua, tx } from "@/lib/contesto";
import { href, tr } from "@/lib/i18n";
import { egp } from "@/lib/regole";
import { statoDa } from "@/lib/aste";
import { Cornice } from "@/componenti/Sagoma";
import { Orologio } from "@/componenti/Orologio";

export const metadata: Metadata = { title: "Second Life — aste" };
export const dynamic = "force-dynamic";

export default async function Aste() {
  const l = await lingua(); const _ = tx(l);
  const aste = await db.asta.findMany({ where: { prodotto: { attivo: true } }, orderBy: [{ stato: "asc" }, { fine: "asc" }], include: { offerte: true, prodotto: { include: { marca: true, foto: { orderBy: { ordine: "asc" }, take: 1 } } } } });
  const aperte = aste.filter((a) => a.stato === "APERTA" && a.fine > new Date());
  return (
    <div className="foglio sezione">
      <span className="mono lieve">Second Life</span>
      <h1 style={{ margin: "8px 0 14px" }}>{_("Pezzi unici, all'asta", "One-off pieces, at auction", "قطع فريدة بالمزاد")}</h1>
      <p className="tenue" style={{ maxWidth: 620, marginBottom: 12 }}>{_("Equipaggiamento usato, selezionato e misurato a mano. Ogni difetto è dichiarato. Quando finisce, è finita.", "Used gear, selected and measured by hand. Every flaw is declared. When it's gone, it's gone.", "معدات مستعملة، مختارة ومقاسة يدوياً. كل عيب معلن. عندما ينتهي، ينتهي.")}</p>
      <p style={{ marginBottom: 32 }}><Link className="mono" style={{ textDecoration: "underline" }} href={href(l, "/guide/second-life")}>{_("Perché vendiamo anche l'usato", "Why we also sell used", "لماذا نبيع المستعمل أيضاً")}</Link></p>
      {aperte.length === 0 ? <p className="nota">{_("Nessuna asta aperta in questo momento.", "No auctions open right now.", "لا توجد مزادات مفتوحة حالياً.")}</p> : (
        <div className="griglia">{aperte.map((a) => { const s = statoDa(a); return (
          <Link key={a.id} href={href(l, `/aste/${a.prodotto.slug}`)} className="scheda">
            <Cornice foto={a.prodotto.foto[0]?.piccola} categoria={a.prodotto.categoria} alt={a.prodotto.nome}><span className="bollino mono">{tr(l, a.prodotto.grado ?? "Second Life")}</span></Cornice>
            <span className="marca mono">{a.prodotto.marca.nome}</span><span className="nome">{a.prodotto.nome}</span>
            <span className="prezzo tab">{egp(s.prezzo)} <span className="lieve">· {s.offerenti} {_("offerenti", "bidders", "مزايدون")}</span></span>
            <Orologio fine={a.fine.toISOString()} aperta chiusa={_("Chiusa", "Closed", "مغلق")} />
          </Link>); })}</div>
      )}
    </div>
  );
}
