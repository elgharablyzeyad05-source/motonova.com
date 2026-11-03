import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prodottoPerSlug, correlati, disponibile, ordinaTaglie, ETICHETTA_CAT } from "@/lib/catalogo";
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
  const varianti = ordinaTaglie(p.varianti.map((v) => v.taglia)).map((t) => p.varianti.find((v) => v.taglia === t)!);
  const iniziale = (() => {
    const disp = varianti.filter((v) => disponibile(v) > 0);
    if (!disp.length) return "";
    const centro = varianti[Math.floor(varianti.length / 2)];
    return disponibile(centro) > 0 ? centro.id : disp[Math.floor(disp.length / 2)].id;
  })();
  const pct = sconto(p.prezzo, p.prezzoPrima);
  const specs = (p.specs as [string, string][]) ?? [];
  const omol = specs.find(([k]) => /omolog|membrana|rete|tipo|ce /i.test(k));
  const descr = p.descrizione.length ? p.descrizione : [`${p.marca.nome} ${p.nome} — ${p.nota}`];
  const foto = p.foto.length ? p.foto : [null];

  const json = {
    "@context": "https://schema.org", "@type": "Product", name: `${p.marca.nome} ${p.nome}`, brand: { "@type": "Brand", name: p.marca.nome },
    description: tr(l, descr[0]), image: p.foto.map((f) => `${base}/media/${f.grande}`),
    offers: { "@type": "Offer", priceCurrency: "EGP", price: (p.prezzo / 100).toFixed(2), availability: varianti.some((v) => disponibile(v) > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${base}${href(l, `/prodotto/${p.slug}`)}` },
  };

  return (
    <div className="foglio sezione">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json).replace(/</g, "\\u003c") }} />
      <p className="mono lieve" style={{ marginBottom: 18 }}>
        <Link href={href(l, "/negozio")}>{_("Negozio", "Shop", "المتجر")}</Link> / <Link href={href(l, `/negozio?cat=${p.categoria}`)}>{tr(l, ETICHETTA_CAT[p.categoria] ?? p.categoria)}</Link> / {p.marca.nome}
      </p>
      <div className="prodotto">
        <div className="galleria">
          <div style={{ position: "relative" }}>
            <Cornice foto={foto[0]?.grande} categoria={p.categoria} alt={`${p.marca.nome} ${p.nome}`} grande>
              {pct > 0 && <span className="bollino sconto mono">−{pct}%</span>}
            </Cornice>
            <Cuore slug={p.slug} on={pref} torna={href(l, `/prodotto/${p.slug}`)} l={l} />
          </div>
          {foto.length > 1 && (
            <div className="miniature">{foto.slice(1).map((f, i) => <Cornice key={i} foto={f?.piccola} categoria={p.categoria} alt={`${p.nome} ${i + 2}`} />)}</div>
          )}
          {!p.foto.length && <p className="mono lieve">{_("La foto arriverà: questo è un disegno, non il prodotto.", "The photo is coming: this is a drawing, not the product.", "الصورة قادمة: هذا رسم وليس المنتج.")}</p>}
        </div>
        <div>
          <Link href={href(l, `/marche/${p.marca.slug}`)} className="mono lieve">{p.marca.nome}</Link>
          <h1 style={{ fontSize: "clamp(28px,4.4vw,46px)", margin: "6px 0 8px" }}>{p.nome}</h1>
          <p className="tenue" style={{ marginBottom: 16 }}>{tr(l, p.sottotitolo)}</p>
          <p className="prezzo-grande tab">{egp(p.prezzo)}{p.prezzoPrima ? <s>{egp(p.prezzoPrima)}</s> : null}</p>
          <p className="mono lieve" style={{ margin: "6px 0 22px" }}>{_("IVA e dazio inclusi", "VAT and duty included", "شامل الضريبة والجمارك")}</p>
          <AggiungiForm iniziale={iniziale}
            varianti={varianti.map((v) => ({ id: v.id, taglia: v.taglia, disponibile: disponibile(v), misura: misuraDi(p.categoria, v.taglia) || undefined }))}
            testi={{
              aggiungi: _("Aggiungi al carrello", "Add to cart", "أضف إلى السلة"), aggiunto: _("Aggiunto ✓", "Added ✓", "تمت الإضافة ✓"), esaurito: _("Esaurito", "Sold out", "نفد"),
              taglia: cosaMisura(p.categoria)[l === "en" ? 1 : l === "ar" ? 2 : 0],
              ultimi: _("ultimi {n}", "last {n}", "آخر {n}"),
              disp: _("Disponibile — solo {n}", "In stock — only {n}", "متوفر — {n} فقط"),
              dispOk: _("Disponibile", "In stock", "متوفر"),
            }} />
          <div style={{ marginTop: 28 }}>
            {descr.map((d, i) => <p key={i} style={{ marginBottom: 12 }}>{tr(l, d)}</p>)}
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
            {p.luogo && <tr><th scope="row">{_("Origine", "Origin", "المنشأ")}</th><td>{p.luogo}</td></tr>}
          </tbody></table>
        </section>
      )}

      <section className="filetto" style={{ marginTop: 40 }}>
        <h2 style={{ marginBottom: 14 }}>{_("Spedizione e reso", "Shipping and returns", "الشحن والإرجاع")}</h2>
        <p className="tenue" style={{ maxWidth: 640 }}>
          {_("Consegniamo in tutto l'Egitto: dal giorno dopo al Cairo fino a 4–5 giorni alla frontiera. Spedizione gratuita sopra EGP 4,000. Il cambio taglia è gratuito.",
             "We deliver across Egypt: next day in Cairo up to 4–5 working days at the frontier. Free shipping over EGP 4,000. Size exchanges are free.",
             "نوصّل إلى كل أنحاء مصر: من اليوم التالي في القاهرة حتى 4–5 أيام عمل في المناطق الحدودية. شحن مجاني فوق 4,000 جنيه. تبديل المقاس مجاني.")}
          {" "}<Link href={href(l, "/guide/spedizioni")} style={{ textDecoration: "underline" }}>{_("Tutti i dettagli", "Full details", "التفاصيل كاملة")}</Link>
        </p>
      </section>

      {simili.length > 0 && (
        <section className="filetto" style={{ marginTop: 40 }}>
          <h2 style={{ marginBottom: 20 }}>{_("Potrebbe servirti anche", "You may also need", "قد تحتاج أيضاً")}</h2>
          <div className="griglia">{simili.map((s) => <Scheda key={s.id} p={s} l={l} />)}</div>
        </section>
      )}
    </div>
  );
}
