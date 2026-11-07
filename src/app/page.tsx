import Link from "next/link";
import { lingua, tx } from "@/lib/contesto";
import { db } from "@/lib/db";
import { statoDa } from "@/lib/aste";
import { egp } from "@/lib/regole";
import { Carosello } from "@/componenti/Carosello";
import { Orologio } from "@/componenti/Orologio";
import { href } from "@/lib/i18n";
import home from "../../dati/home.json";
import { ScenaHero } from "@/componenti/ScenaHero";
import { Cornice, Sagoma } from "@/componenti/Sagoma";
import { Scheda } from "@/componenti/Scheda";
import { vetrine, CATEGORIE, ETICHETTA_CAT } from "@/lib/catalogo";
import { tr } from "@/lib/i18n";

const CATFOTO: string[] = ["caschi", "giacche", "pantaloni", "tute", "gilet", "guanti", "stivali", "protezioni", "accessori", "manutenzione"];
type K = keyof typeof home.it;
const Html = ({ t, tag: Tag = "span" }: { t: string; tag?: "span" | "p" | "h3" }) => <Tag dangerouslySetInnerHTML={{ __html: t }} />;

export default async function Home() {
  const l = await lingua();
  const v = await vetrine().catch(() => ({ nuovi: [], offerte: [], piuVenduti: [], marche: [] }));
  const _ = tx(l);
  const adesso = new Date();
  const asta = await db.asta.findFirst({ where: { stato: "APERTA", fine: { gt: adesso }, prodotto: { attivo: true } }, orderBy: { fine: "asc" }, include: { offerte: true, prodotto: { include: { marca: true, foto: { orderBy: { ordine: "asc" }, take: 1 } } } } }).catch(() => null);
  const sa = asta ? statoDa(asta) : null;
  const T = (k: K): string => (l === "it" ? home.it : home[l])[k] ?? home.it[k];
  // Immagini editoriali: public/immagini. Dove manca il file resta la sagoma.
  const IMG: Record<string, string> = { casco: "/immagini/guida-casco.webp", manutenzione: "/immagini/guida-manutenzione.webp", itinerari: "/immagini/guida-itinerari.webp", "second-life": "/immagini/guida-usato.webp" };
  const guida = (id: string, cat: string, tag: K, titolo: K, desc: K) => (
    <Link className="scheda" href={href(l, `/guide/${id}`)} key={id}>
      <Cornice categoria={cat} statica={IMG[id]} larga alt={T(titolo)} />
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

      <section className="asta-home" aria-label={_("Asta della settimana", "Auction of the week", "مزاد الأسبوع")}>
        <div className="foglio asta-home-in">
          <div className="asta-home-foto">
            {asta?.prodotto.foto[0]?.grande ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/media/${asta.prodotto.foto[0].grande}`} alt={asta.prodotto.nome} /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src="/immagini/asta-attesa.webp?v=2" alt="" />}
          </div>
          <div className="asta-home-testo">
            <p className="asta-live mono"><i aria-hidden="true" />{asta ? _("Asta in corso", "Live auction", "مزاد شغّال") : _("Ogni settimana", "Every week", "كل أسبوع")}</p>
            <h2>{_("L'asta della settimana", "The auction of the week", "مزاد الأسبوع")}</h2>
            {asta && sa ? (<>
              <p className="asta-nome"><span className="mono">{asta.prodotto.marca.nome}</span> {asta.prodotto.nome}</p>
              <div className="asta-dati">
                <div><span className="mono">{_("Offerta attuale", "Current bid", "المزايدة الحالية")}</span><b className="tab">{egp(sa.prezzo)}</b></div>
                <div><span className="mono">{_("Si chiude tra", "Ends in", "بيخلص بعد")}</span><b><Orologio fine={asta.fine.toISOString()} aperta aggiorna={false} chiusa={_("Chiusa", "Closed", "اتقفل")} /></b></div>
                <div><span className="mono">{_("Offerenti", "Bidders", "مزايدين")}</span><b className="tab">{sa.offerenti}</b></div>
              </div>
              <Link className="tasto" href={href(l, `/aste/${asta.prodotto.slug}`)}>{_("Fai la tua offerta →", "Place your bid →", "زايد دلوقتي ←")}</Link>
            </>) : (<>
              <p className="asta-nome">{_("Un pezzo raro, super premium o introvabile. Un solo esemplare, vince chi offre di più.", "One rare, super-premium or hard-to-find piece. A single item, the highest bidder wins.", "قطعة نادرة أو فاخرة جداً أو صعب تلاقيها. قطعة واحدة بس، واللي يدفع أكتر ياخدها.")}</p>
              <Link className="tasto" href={href(l, "/aste")}>{_("Scopri le aste →", "See the auctions →", "شوف المزادات ←")}</Link>
            </>)}
          </div>
        </div>
      </section>
      <section className="foglio manifesto"><p><Html t={T("maniText")} /></p><p className="manifesto-tag mono">MotoNova · Italia → Egitto</p></section>


      <section className="foglio sezione" aria-label={T("worldH")}>
        <p className="etichetta-sez mono">{l === "en" ? "Categories" : l === "ar" ? "الفئات" : "Categorie"}</p>
        <Carosello prec={_("Indietro", "Previous", "اللي قبله")} succ={_("Avanti", "Next", "اللي بعده")} etichetta={l === "en" ? "Categories" : l === "ar" ? "الفئات" : "Categorie"}>
          {CATEGORIE.map((c, i) => (
            <Link key={c} role="listitem" className={"cat-card" + (CATFOTO.includes(c) ? "" : " senza")} href={href(l, `/negozio?cat=${c}`)}>
              {CATFOTO.includes(c) ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/immagini/cat-${c}.webp?v=4`} alt="" loading="lazy" /> : <Sagoma categoria={c} />}
              <span className="cat-n mono" dir="ltr">{String(i + 1).padStart(2, "0")}</span>
              <span className="cat-nome">{tr(l, ETICHETTA_CAT[c])}</span>
              <svg className="cat-freccia" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>
            </Link>
          ))}
        </Carosello>
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
        <div className="sez-testa">
          <h2>{T("worldH")}</h2><Link className="tasto vuoto piccolo" href={href(l, "/negozio")}>{T("worldA")}</Link>
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
          <Cornice categoria="giacche" statica="/immagini/second-life.webp" larga alt="Second Life" grande />
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
