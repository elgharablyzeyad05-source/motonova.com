import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { leggiAsta, statoDa } from "@/lib/aste";
import { lingua, tx } from "@/lib/contesto";
import { href, tr, tc } from "@/lib/i18n";
import { egp } from "@/lib/regole";
import { utenteCorrente } from "@/lib/sessione";
import { Cornice } from "@/componenti/Sagoma";
import { Orologio } from "@/componenti/Orologio";
import { OffertaForm } from "@/componenti/OffertaForm";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; const p = await leggiAsta(slug);
  return p ? { title: `${p.marca.nome} ${p.nome} — Second Life` } : {};
}

export default async function AstaPagina({ params }: Props) {
  const { slug } = await params; const l = await lingua(); const _ = tx(l);
  const p = await leggiAsta(slug);
  if (!p || !p.asta || !p.attivo) notFound();
  const a = p.asta; const u = await utenteCorrente();
  const s = statoDa(a);
  const aperta = a.stato === "APERTA" && a.fine > new Date();
  const tuoMax = u ? Math.max(0, ...a.offerte.filter((o) => o.utenteId === u.id).map((o) => o.massimo)) : 0;
  const sono = u && s.leader === u.id;
  const specs = (p.specs as [string, string][]) ?? [];
  const report = (p.report as [string, string, string][] | null) ?? [];
  return (
    <div className="foglio sezione">
      <p className="mono lieve" style={{ marginBottom: 18 }}><Link href={href(l, "/aste")}>← Second Life</Link></p>
      <div className="prodotto">
        <div className="galleria"><Cornice foto={p.foto[0]?.grande} categoria={p.categoria} alt={p.nome} grande><span className="bollino mono">{tc(l, p.grado ?? "")}</span></Cornice>
          {!p.foto.length && <p className="mono lieve">{_("La foto arriverà: questo è un disegno, non il pezzo.", "The photo is coming: this is a drawing, not the piece.", "الصورة جاية: ده رسم مش القطعة نفسها.")}</p>}</div>
        <div>
          <span className="mono lieve">{p.marca.nome} · {tr(l, p.sottotitolo)}</span>
          <h1 style={{ fontSize: "clamp(28px,4.4vw,46px)", margin: "6px 0 18px" }}>{p.nome}</h1>
          <div style={{ display: "flex", gap: 32, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 6 }}>
            <div><span className="mono lieve">{s.haOfferte ? _("Prezzo attuale", "Current price", "السعر دلوقتي") : _("Base d'asta", "Starting price", "سعر البداية")}</span><div className="asta-prezzo tab" data-prezzo>{egp(s.prezzo)}</div></div>
            <div><span className="mono lieve">{_("Chiude tra", "Closes in", "بيقفل بعد")}</span><div><Orologio fine={a.fine.toISOString()} aperta={aperta} chiusa={_("Asta chiusa", "Auction closed", "المزاد اتقفل")} /></div></div>
          </div>
          <p className="mono lieve" style={{ marginBottom: 6 }}>{s.offerenti} {_("offerenti", "bidders", "مزايدين")} · {s.riservaRaggiunta ? _("Riserva raggiunta", "Reserve met", "وصلنا للحد الأدنى") : _("Riserva non raggiunta", "Reserve not met", "لسه ماوصلناش للحد الأدنى")}</p>
          {u && tuoMax > 0 && aperta && <p className={"nota " + (sono ? "ok" : "avviso")} role="status" style={{ margin: "12px 0" }}>{sono ? _("Sei in testa.", "You are leading.", "إنت في المقدمة.") : _("Sei stato superato.", "You have been outbid.", "حد زوّد عليك.")} <span className="mono">{_("Il tuo massimo", "Your maximum", "أقصى حد عندك")}: {egp(tuoMax)}</span></p>}
          {!aperta && a.stato === "CHIUSA" && <p className="nota" style={{ margin: "12px 0" }}>{a.vincitoreId ? _(`Aggiudicata a ${egp(a.prezzoFinale ?? 0)}.`, `Sold for ${egp(a.prezzoFinale ?? 0)}.`, `بيعت بسعر ${egp(a.prezzoFinale ?? 0)}.`) : _("Chiusa senza raggiungere la riserva: il pezzo non è stato venduto.", "Closed without meeting the reserve: the piece was not sold.", "اتقفل من غير ما يوصل للحد الأدنى: القطعة ماتباعتش.")}</p>}
          <div style={{ marginTop: 18 }}>
            {u ? <OffertaForm l={l} slug={p.slug} minimo={s.minimoProssima} aperta={aperta} collegato /> :
              aperta ? <Link className="tasto pieno" href={href(l, "/accedi") + `?torna=${encodeURIComponent(href(l, `/aste/${p.slug}`))}`}>{_("Accedi per offrire", "Sign in to bid", "سجّل دخولك عشان تزايد")}</Link> : null}
          </div>
          <div className="nota" style={{ marginTop: 22 }}>
            <b>{_("Come funziona", "How it works", "بيشتغل إزاي")}</b>
            <p>{_("Dichiari il massimo che sei disposto a pagare: noi rilanciamo per te al minimo necessario. Chi ha il massimo più alto vince, ma paga quanto serviva per battere il secondo. A parità vince chi ha offerto per primo. Un'offerta negli ultimi due minuti sposta la chiusura a due minuti da quel momento. I pezzi vinti si pagano online: il contrassegno non è disponibile.",
                "You state the most you are willing to pay: we bid for you at the minimum needed. The highest maximum wins but pays only what it took to beat the runner-up. Ties go to the earlier bid. A bid in the last two minutes moves the close to two minutes from then. Won pieces are paid online: cash on delivery is not available.",
                "تحدد أقصى ما أنت مستعد لدفعه ونزايد نيابةً عنك بالحد الأدنى اللازم. يفوز صاحب الحد الأقصى الأعلى لكنه يدفع ما يلزم لتجاوز الثاني فقط. عند التعادل يفوز الأسبق. أي عرض في آخر دقيقتين يؤجّل الإغلاق إلى دقيقتين من لحظته. القطع المربوحة تُدفع إلكترونياً: الدفع عند الاستلام غير متاح.")}</p>
          </div>
        </div>
      </div>
      {report.length > 0 && <section className="filetto rapporto" style={{ marginTop: 48 }}><h2 style={{ marginBottom: 14 }}>{_("Rapporto di condizione", "Condition report", "تقرير الحالة")}</h2>
        <table className="dati"><tbody>{report.map(([k, v, c], i) => <tr key={i}><th scope="row">{tr(l, k)}</th><td className={c}>{tr(l, v)}</td></tr>)}</tbody></table></section>}
      {p.descrizione.length > 0 && <section className="filetto" style={{ marginTop: 36 }}>{p.descrizione.map((d, i) => <p key={i} style={{ marginBottom: 12, maxWidth: 680 }}>{tr(l, d)}</p>)}</section>}
      {specs.length > 0 && <section className="filetto" style={{ marginTop: 36 }}><h2 style={{ marginBottom: 14 }}>{_("Scheda tecnica", "Specifications", "المواصفات")}</h2>
        <table className="dati"><tbody>{specs.map(([k, v]) => <tr key={k}><th scope="row">{tr(l, k)}</th><td>{tr(l, v)}</td></tr>)}</tbody></table></section>}
    </div>
  );
}
