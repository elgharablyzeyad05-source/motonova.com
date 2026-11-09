import GalleriaColori from "@/componenti/GalleriaColori";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prodottoPerSlug, correlati, disponibile, ordinaTaglie, ETICHETTA_CAT, fotoCatalogo } from "@/lib/catalogo";
import { lingua, tx, baseUrl } from "@/lib/contesto";
import { href, tr } from "@/lib/i18n";
import { egp, sconto } from "@/lib/regole";
import { misuraDi, cosaMisura } from "@/lib/misure";
import { Cornice } from "@/componenti/Sagoma";
import { Scheda, Cuore } from "@/componenti/Scheda";
import { AggiungiForm } from "@/componenti/AggiungiForm";
import { utenteCorrente } from "@/lib/sessione";
import { db } from "@/lib/db";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; const l = await lingua();
  const p = await prodottoPerSlug(slug);
  if (!p) return {};
  return {
    title: `${p.marca.nome} ${p.nome}`,
    description: tr(l, p.descrizione[0] ?? p.nota).slice(0, 160),
    alternates: { canonical: href(l, `/prodotto/${p.slug}`) },
    openGraph: p.foto[0] ? { images: [`/media/${p.foto[0].grande}`] } : undefined,
  };
}

export default async function Prodotto({ params }: Props) {
  const { slug } = await params; const l = await lingua(); const _ = tx(l);
  const p = await prodottoPerSlug(slug);
  if (!p || !p.attivo) notFound();
  if (p.tipo === "SECOND_LIFE") redirect(href(l, `/aste/${p.slug}`)); // un pezzo unico si compra solo all'asta
  const [simili, u, base] = await Promise.all([correlati(p), utenteCorrente(), baseUrl()]);
  const pref = u ? !!(await db.preferito.findFirst({ where: { utenteId: u.id, prodottoId: p.id } })) : false;
  const ordT = ordinaTaglie(Array.from(new Set(p.varianti.map((v) => v.taglia))));
  const varianti = [...p.varianti].sort((a, b) => a.colore.localeCompare(b.colore) || ordT.indexOf(a.taglia) - ordT.indexOf(b.taglia));
  const iniziale = (() => {
    const disp = varianti.filter((v) => disponibile(v) > 0);
    if (!disp.length) return "";
    const centro = varianti[Math.floor(varianti.length / 2)];
    return disponibile(centro) > 0 ? centro.id : disp[Math.floor(disp.length / 2)].id;
  })();
  const prezziV = varianti.length ? varianti.map((v) => v.prezzo ?? p.prezzo) : [p.prezzo];
  const prezzoMin = Math.min(...prezziV); const prezzoDiversi = new Set(prezziV).size > 1;
  const pct = sconto(prezzoMin, p.prezzoPrima);
  const extra: [string, string][] = ([["Colore", p.colore], ["Genere", p.genere], ["Materiale", p.materiale], ["Certificazione", p.certificazione], ["Moto compatibili", p.moto]] as [string, string | null][]).filter((x): x is [string, string] => !!x[1]);
  const specsDb = (p.specs as [string, string][]) ?? [];
  const specs = [...extra.filter(([k]) => !specsDb.some(([b]) => b === k)), ...specsDb];
  const omol = specs.find(([k]) => /omolog|membrana|rete|tipo|ce /i.test(k));
  const descr = p.descrizione.length ? p.descrizione : [`${p.marca.nome} ${p.nome} — ${p.nota}`];

  const json = {
    "@context": "https://schema.org", "@type": "Product", name: `${p.marca.nome} ${p.nome}`, brand: { "@type": "Brand", name: p.marca.nome },
    description: tr(l, descr[0]), image: p.foto.map((f) => `${base}/media/${f.grande}`),
    offers: { "@type": "Offer", priceCurrency: "EGP", price: (prezzoMin / 100).toFixed(2), availability: varianti.some((v) => disponibile(v) > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${base}${href(l, `/prodotto/${p.slug}`)}` },
  };

  return (
    <div className="foglio sezione">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json).replace(/</g, "\\u003c") }} />
      <p className="mono lieve" style={{ marginBottom: 18 }}>
        <Link href={href(l, "/negozio")}>{_("Negozio", "Shop", "المتجر")}</Link> / <Link href={href(l, `/negozio?cat=${p.categoria}`)}>{tr(l, ETICHETTA_CAT[p.categoria] ?? p.categoria)}</Link> / {p.marca.nome}
      </p>
      <div className="prodotto">
        <div className="galleria">
          <GalleriaColori foto={p.foto.map((f) => ({ grande: f.grande, piccola: f.piccola, colore: f.colore, principale: f.principale }))} statica={fotoCatalogo(p)} categoria={p.categoria} alt={`${p.marca.nome} ${p.nome}`}
            sopra={<>{pct > 0 && <span className="bollino sconto mono">−{pct}%</span>}<Cuore slug={p.slug} on={pref} torna={href(l, `/prodotto/${p.slug}`)} l={l} /></>} />
          {!p.foto.length && !fotoCatalogo(p) && <p className="mono lieve">{_("La foto arriverà: questo è un disegno, non il prodotto.", "The photo is coming: this is a drawing, not the product.", "الصورة جاية: ده رسم مش المنتج.")}</p>}
        </div>
        <div>
          <Link href={href(l, `/marche/${p.marca.slug}`)} className="mono lieve">{p.marca.nome}</Link>
          <h1 style={{ fontSize: "clamp(28px,4.4vw,46px)", margin: "6px 0 8px" }}>{p.nome}</h1>
          <p className="tenue" style={{ marginBottom: 16 }}>{tr(l, p.sottotitolo)}</p>
          <p className="prezzo-grande tab">{prezzoDiversi ? _("da ", "from ", "من ") : ""}{egp(prezzoMin)}{p.prezzoPrima ? <s>{egp(p.prezzoPrima)}</s> : null}</p>
          <p className="mono lieve" style={{ margin: "6px 0 22px" }}>{_("IVA e dazio inclusi", "VAT and duty included", "شامل الضريبة والجمارك")}</p>
          <AggiungiForm iniziale={iniziale} campioni={Object.fromEntries(p.foto.filter((f) => f.colore && f.principale).map((f) => [f.colore, `/media/${f.piccola}`]))} checkout={href(l, "/checkout")} trattabile={p.trattabile && (Boolean(p.prezzoMinimo) || varianti.some((v) => v.prezzoMinimo))}
            altreOpzioni={href(l, `/negozio?${p.tipo === "USATO" ? "cond=usato&" : ""}cat=${p.categoria}`)}
            varianti={varianti.map((v) => ({ id: v.id, prezzo: v.prezzo ?? p.prezzo, colore: v.colore, difetti: p.tipo === "USATO" ? v.difetti : "", taglia: v.taglia, disponibile: disponibile(v), misura: misuraDi(p.categoria, v.taglia) || undefined }))}
            testi={{
              aggiungi: _("Aggiungi al carrello", "Add to cart", "ضيف للسلة"), aggiunto: _("Aggiunto ✓", "Added ✓", "اتضاف ✓"), esaurito: _("Esaurito", "Sold out", "خلص"),
              taglia: cosaMisura(p.categoria)[l === "en" ? 1 : l === "ar" ? 2 : 0],
              ultimi: _("ultimi {n}", "last {n}", "باقي {n} بس"),
              disp: _("Disponibile — solo {n}", "In stock — only {n}", "متوفر — {n} بس"),
              dispOk: _("Disponibile", "In stock", "متوفر"),
              acquista: _("Acquista ora", "Buy now", "اشتري دلوقتي"),
              offri: "", offertaEtichetta: _("Vuoi proporre un prezzo? Scrivi la tua offerta in EGP per ogni pezzo", "Want to name your price? Enter your offer in EGP per piece", "عايز تقترح سعرك؟ اكتب عرضك بالجنيه للقطعة"),
              offertaInvia: _("Fai un'offerta", "Make an offer", "قدّم عرض"),
              offertaOk: _("Offerta accettata: {p} EGP. È nel carrello ({q}). La spedizione si calcola al checkout.", "Offer accepted: {p} EGP. It is in your cart ({q}). Shipping is calculated at checkout.", "العرض اتقبل: {p} جنيه. في السلة ({q}). الشحن بيتحسب وقت الدفع."),
              offertaVai: _("Vai al carrello", "Go to cart", "روح للسلة"),
              pezzi: _("pezzi", "pieces", "قطعة"),
              restanti: _("Tentativi rimasti: {n}.", "Attempts left: {n}.", "محاولات باقية: {n}."),
              colore: _("Colore", "Colour", "اللون"),
              dispN: _("{n} disponibili", "{n} available", "{n} متوفر"),
              budget: _("Il tuo budget per questo pezzo (EGP)", "Your budget for this piece (EGP)", "ميزانيتك للقطعة دي (جنيه)"),
              budgetInvia: _("Verifica", "Check", "اتأكد"),
              basso1: _("Con questo budget non riusciamo a venirti incontro su questo pezzo. Sei disposto ad alzarlo, oppure preferisci valutare altre opzioni?", "We can't meet this budget on this piece. Are you willing to raise it, or would you rather look at other options?", "مش هنقدر نوصل للميزانية دي في القطعة دي. تحب ترفعها ولا تشوف اختيارات تانية؟"),
              basso2: _("Non riusciamo a trovare un accordo su questo pezzo. Scrivici nella chat del sito: valutiamo insieme altre opzioni.", "We couldn't agree on this piece. Message us in the site chat and we'll look at other options together.", "ماقدرناش نتفق على القطعة دي. كلمنا في شات الموقع ونشوف اختيارات تانية مع بعض."),
              alza: _("Alzo il budget", "Raise my budget", "هرفع الميزانية"),
              altre: _("Vedi altre opzioni", "See other options", "شوف اختيارات تانية"),
              chat: _("Scrivici in chat", "Message us in chat", "كلمنا في الشات"),
              difetti: _("Condizioni e difetti", "Condition and flaws", "الحالة والعيوب"),
            }} />
          <div style={{ marginTop: 28 }}>
            {descr.map((d, i) => <p key={i} style={{ marginBottom: 12 }}>{tr(l, d)}</p>)}
            {p.tipo === "USATO" && p.difetti && <div className="nota" style={{ marginTop: 14 }}><b>{_("Condizioni e difetti", "Condition and flaws", "الحالة والعيوب")}</b> — {p.difetti}</div>}
          </div>
          {omol && <div className="nota" style={{ marginTop: 14 }}><b>{tr(l, omol[0])}</b> — {tr(l, omol[1])}</div>}
        </div>
      </div>

      {specs.length > 0 && (
        <section className="filetto" style={{ marginTop: 56 }}>
          <h2 style={{ marginBottom: 14 }}>{_("Scheda tecnica", "Specifications", "المواصفات")}</h2>
          <table className="dati"><tbody>
            {specs.map(([k, v]) => <tr key={k}><th scope="row">{tr(l, k)}</th><td>{tr(l, v)}</td></tr>)}
            <tr><th scope="row">{_("Taglie", "Sizes", "المقاسات")}</th><td>{varianti.map((v) => v.taglia).join(" · ")}</td></tr>
            {p.luogo && <tr><th scope="row">{_("Origine", "Origin", "بلد المنشأ")}</th><td>{p.luogo}</td></tr>}
          </tbody></table>
        </section>
      )}

      <section className="filetto" style={{ marginTop: 40 }}>
        <h2 style={{ marginBottom: 14 }}>{_("Spedizione e reso", "Shipping and returns", "الشحن والإرجاع")}</h2>
        <p className="tenue" style={{ maxWidth: 640 }}>
          {_("Consegniamo in tutto l'Egitto, da 1 a 5 giorni lavorativi a seconda della zona. Spedizione gratuita sopra EGP 4,000. Il cambio taglia è gratuito.",
             "We deliver across Egypt, in 1 to 5 working days depending on the area. Free shipping over EGP 4,000. Size exchanges are free.",
             "نوصّل إلى كل أنحاء مصر خلال 1 إلى 5 أيام عمل حسب المنطقة. شحن مجاني فوق 4,000 جنيه. تبديل المقاس مجاني.")}
          {" "}<Link href={href(l, "/guide/spedizioni")} style={{ textDecoration: "underline" }}>{_("Tutti i dettagli", "Full details", "التفاصيل كاملة")}</Link>
        </p>
      </section>

      {simili.length > 0 && (
        <section className="filetto" style={{ marginTop: 40 }}>
          <h2 style={{ marginBottom: 20 }}>{_("Potrebbe servirti anche", "You may also need", "ممكن تحتاج كمان")}</h2>
          <div className="griglia">{simili.map((s) => <Scheda key={s.id} p={s} l={l} />)}</div>
        </section>
      )}
    </div>
  );
}
