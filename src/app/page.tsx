import Link from "next/link";
import { lingua } from "@/lib/contesto";
import { href } from "@/lib/i18n";
import home from "../../dati/home.json";
import { ScenaHero } from "@/componenti/ScenaHero";
import { Cornice } from "@/componenti/Sagoma";
import { Scheda } from "@/componenti/Scheda";
import { vetrine, CATEGORIE, ETICHETTA_CAT } from "@/lib/catalogo";
import { tr } from "@/lib/i18n";

type K = keyof typeof home.it;
const Html = ({ t, tag: Tag = "span" }: { t: string; tag?: "span" | "p" | "h3" }) => <Tag dangerouslySetInnerHTML={{ __html: t }} />;

export default async function Home() {
  const l = await lingua();
  const v = await vetrine().catch(() => ({ nuovi: [], offerte: [], piuVenduti: [], marche: [] }));
  const T = (k: K): string => (l === "it" ? home.it : home[l])[k] ?? home.it[k];
  const guida = (id: string, cat: string, tag: K, titolo: K, desc: K) => (
    <Link className="scheda" href={href(l, `/guide/${id}`)} key={id}>
      <Cornice categoria={cat} alt="" />
      <span className="mono lieve">{T(tag)}</span><h3 style={{ fontSize: 22 }}>{T(titolo)}</h3><p className="tenue">{T(desc)}</p>
    </Link>
  );
  return (
    <>
      <ScenaHero>
        <h1><span>{T("heroA")}</span><br /><span className="out">{T("heroB")}</span></h1>
        <div className="meta"><span className="mono">{T("heroMeta")}</span><span className="ital">{T("heroItal")}</span></div>
        <div className="hero-cta">
          <Link className="tasto" href={href(l, "/negozio")}>{T("heroCta1")}</Link>
          <a className="tasto fantasma" href="#mondo">{T("heroCta2")}</a>
        </div>
      </ScenaHero>

      <section className="foglio manifesto"><p><Html t={T("maniText")} /></p><p className="mono lieve" style={{ marginTop: 24 }}>MotoNova · Italia → Egitto</p></section>


      <section className="foglio sezione" aria-label={T("worldH")}>
        <div className="categorie-home" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {CATEGORIE.map((c) => <Link key={c} className="tasto vuoto piccolo" href={href(l, `/negozio?cat=${c}`)}>{tr(l, ETICHETTA_CAT[c])}</Link>)}
        </div>
      </section>
      {([["Nuovi arrivi", "New arrivals", "وصل حديثاً", v.nuovi], ["Più venduti", "Best sellers", "الأكثر مبيعاً", v.piuVenduti], ["Offerte", "Offers", "عروض", v.offerte]] as [string, string, string, typeof v.nuovi][]).filter(([, , , lista]) => lista.length > 0).map(([it, en, ar, lista]) => (
        <section key={it} className="foglio sezione">
          <h2 style={{ marginBottom: 24 }}>{l === "en" ? en : l === "ar" ? ar : it}</h2>
          <div className="griglia">{lista.map((p) => <Scheda key={p.id} p={p} l={l} />)}</div>
        </section>
      ))}
      {v.marche.length > 0 && (
        <section className="foglio sezione">
          <h2 style={{ marginBottom: 18 }}>{l === "en" ? "Brands" : l === "ar" ? "الماركات" : "Marche"}</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{v.marche.map((m) => <Link key={m.slug} className="tasto vuoto piccolo" href={href(l, `/marche/${m.slug}`)}>{m.nome}</Link>)}</div>
        </section>
      )}
      <section className="foglio sezione" id="mondo">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
          <h2>{T("worldH")}</h2><Link className="mono" style={{ textDecoration: "underline" }} href={href(l, "/negozio")}>{T("worldA")}</Link>
        </div>
        <div className="coppia">{guida("casco", "caschi", "w1Tag", "w1T", "w1D")}{guida("itinerari", "giacche", "w2Tag", "w2T", "w2D")}</div>
        <div className="coppia">{guida("manutenzione", "accessori", "w3Tag", "w3T", "w3D")}{guida("second-life", "protezioni", "w4Tag", "w4T", "w4D")}</div>
        <p style={{ marginTop: 10 }}><Link className="tasto" href={href(l, "/negozio")}>{T("worldCta")}</Link></p>
      </section>

      <section className="foglio sezione stili" id="stili">
        <h2 style={{ marginBottom: 24 }}>{T("stylesH")}</h2>
        {([["sport", "rowSportT", "rowSportD"], ["adventure", "rowAdvT", "rowAdvD"], ["touring", "rowTourT", "rowTourD"], ["urban", "rowUrbanT", "rowUrbanD"]] as [string, K, K][]).map(([s, t, d], i) => (
          <Link key={s} className="riga-stile" href={href(l, `/negozio?stile=${s}`)}><span className="mono lieve">0{i + 1}</span><span className="t">{T(t)}</span><span className="d tenue">{T(d)}</span></Link>
        ))}
        <div style={{ borderTop: "1px solid var(--bordo)" }} />
      </section>

      <section className="foglio sezione" id="sl">
        <div className="second-life">
          <Cornice categoria="giacche" alt="" grande />
          <div>
            <h2>Second Life<br /><em style={{ fontStyle: "normal", color: "var(--rosso)" }}>{T("slEm")}</em></h2>
            <p style={{ margin: "18px 0 12px", maxWidth: 520 }}>{T("slP1")}</p>
            <p className="tenue" style={{ marginBottom: 20, maxWidth: 520 }}>{T("slP2")}</p>
            <table className="dati" style={{ marginBottom: 22 }}><tbody>
              <tr><th scope="row">{T("slkCome")}</th><td>{T("slvCome")}</td></tr>
              <tr><th scope="row">{T("slkQuando")}</th><td>{T("slvQuando")}</td></tr>
              <tr><th scope="row">{T("slkCome2")}</th><td>{T("slvCome2")}</td></tr>
            </tbody></table>
            <Link className="tasto" href={href(l, "/aste")}>{T("slCta")}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
