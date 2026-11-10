import { negozioChiuso } from "@/lib/lancio";
import Prossimamente from "@/componenti/Prossimamente";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { lingua, tx } from "@/lib/contesto";
import { href, tr, tc } from "@/lib/i18n";
import { egp } from "@/lib/regole";
import { statoDa } from "@/lib/aste";
import { Cornice } from "@/componenti/Sagoma";
import { Orologio } from "@/componenti/Orologio";

export const metadata: Metadata = { title: "Aste — un pezzo raro a settimana" };
export const dynamic = "force-dynamic";

export default async function Aste() {
  const l = await lingua(); const _ = tx(l);
  if (await negozioChiuso()) return <Prossimamente l={l} dove={_("Aste", "Auctions", "المزادات")} />;
  const aste = await db.asta.findMany({ where: { prodotto: { attivo: true } }, orderBy: [{ stato: "asc" }, { fine: "asc" }], include: { offerte: true, prodotto: { include: { marca: true, foto: { orderBy: { ordine: "asc" }, take: 1 } } } } });
  const aperte = aste.filter((a) => a.stato === "APERTA" && a.fine > new Date());
  return (
    <div className="foglio sezione">
      <span className="mono lieve">{_("Aste", "Auctions", "المزادات")}</span>
      <h1 style={{ margin: "8px 0 14px" }}>{_("L'asta della settimana", "The auction of the week", "مزاد الأسبوع")}</h1>
      <p className="tenue" style={{ maxWidth: 620, marginBottom: 12 }}>{_("Ogni settimana un pezzo raro, super premium o introvabile. Un solo esemplare: vince chi offre di più. Ogni difetto, se c'è, è dichiarato.", "Every week one rare, super-premium or hard-to-find piece. A single item: the highest bidder wins. Any flaw is declared.", "كل أسبوع قطعة نادرة أو فاخرة جداً أو صعب تلاقيها. قطعة واحدة بس: اللي يدفع أكتر ياخدها. أي عيب فيها بنقوله.")}</p>
      <p style={{ marginBottom: 32 }}><Link className="mono" style={{ textDecoration: "underline" }} href={href(l, "/guide/second-life")}>{_("Perché vendiamo anche l'usato", "Why we also sell used", "ليه بنبيع مستعمل كمان")}</Link></p>
      {aperte.length === 0 ? <p className="nota">{_("Nessuna asta aperta in questo momento.", "No auctions open right now.", "مفيش مزادات مفتوحة دلوقتي.")}</p> : (
        <div className="griglia">{aperte.map((a) => { const s = statoDa(a); return (
          <Link key={a.id} href={href(l, `/aste/${a.prodotto.slug}`)} className="scheda">
            <Cornice foto={a.prodotto.foto[0]?.piccola} categoria={a.prodotto.categoria} alt={a.prodotto.nome}><span className="bollino mono">{a.prodotto.grado ? tc(l, a.prodotto.grado) : "Second Life"}</span></Cornice>
            <span className="marca mono">{a.prodotto.marca.nome}</span><span className="nome">{a.prodotto.nome}</span>
            <span className="prezzo tab">{egp(s.prezzo)} <span className="lieve">· {s.offerenti} {_("offerenti", "bidders", "مزايدين")}</span></span>
            <Orologio fine={a.fine.toISOString()} aperta chiusa={_("Chiusa", "Closed", "اتقفل")} />
          </Link>); })}</div>
      )}
    </div>
  );
}
