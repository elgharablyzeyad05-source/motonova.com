import type { Metadata } from "next";
import Link from "next/link";
import { cerca, opzioniFiltri, conteggiModelli, ETICHETTA_CAT, ETICHETTA_STILE, CATEGORIE, STILI } from "@/lib/catalogo";
import { lingua, tx } from "@/lib/contesto";
import { href, tr } from "@/lib/i18n";
import { Scheda } from "@/componenti/Scheda";
import { utenteCorrente } from "@/lib/sessione";
import { db } from "@/lib/db";
import FOTO from "../../../dati/foto-modelli.json";
import MODELLI from "../../../dati/usato-modelli.json";

type SP = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const l = await lingua(); const _ = tx(l); const sp = await searchParams;
  const cat = uno(sp.cat);
  return { title: cat && ETICHETTA_CAT[cat] ? tr(l, ETICHETTA_CAT[cat]) : _("Il negozio", "The shop", "المتجر"), alternates: { canonical: href(l, "/negozio") + (cat ? `?cat=${cat}` : "") } };
}

export default async function Negozio({ searchParams }: { searchParams: Promise<SP> }) {
  const l = await lingua(); const _ = tx(l); const sp = await searchParams;
  const f = {
    q: uno(sp.q), cat: uno(sp.cat), stile: uno(sp.stile), marca: uno(sp.marca), taglia: uno(sp.taglia),
    max: Number(uno(sp.max)) * 100 || undefined, solo: uno(sp.solo) === "1", ord: uno(sp.ord),
    sotto: uno(sp.sotto), colore: uno(sp.colore), genere: uno(sp.genere), materiale: uno(sp.materiale), cert: uno(sp.cert), moto: uno(sp.moto), cond: ["usato","nuovo","tutti"].includes(uno(sp.cond)) ? uno(sp.cond) : "", ed: ["limited", "special"].includes(uno(sp.ed)) ? uno(sp.ed) : "",
  };
  const [lista, opz, u] = await Promise.all([cerca(f), opzioniFiltri(f.cond), utenteCorrente()]);
  const usato = f.cond === "usato";
  const modelliCat = usato && f.cat ? ((MODELLI as unknown as Record<string, string[]>)[f.cat] ?? []) : [];
  const conteggi = usato && f.cat ? await conteggiModelli(f.cat) : {};
  const q = (extra: Record<string, string>) => { const p = new URLSearchParams(extra); return href(l, "/negozio") + (p.toString() ? "?" + p.toString() : ""); };
  const pref = u ? new Set((await db.preferito.findMany({ where: { utenteId: u.id }, select: { prodotto: { select: { slug: true } } } })).map((x) => x.prodotto.slug)) : new Set<string>();
  const attivi = [f.q, f.cat, f.stile, f.marca, f.taglia, f.max, f.solo ? "1" : "", f.sotto, f.colore, f.genere, f.materiale, f.cert, f.moto, f.cond, f.ed].filter(Boolean).length;
  const torna = href(l, "/negozio") + (Object.keys(sp).length ? "?" + new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : [[k, uno(v)]]))).toString() : "");

  if (f.ed && !f.cond) {
    const [nN, nU] = await Promise.all([cerca({ ...f, cond: "nuovo" }), cerca({ ...f, cond: "usato" })]);
    const nome = f.ed === "limited" ? "Limited edition" : "Special edition";
    const sc = [
      { c: "nuovo", t: _("Nuovo", "New", "جديد"), n: nN.length },
      { c: "usato", t: _("Usato", "Used", "مستعمل"), n: nU.length },
      { c: "tutti", t: _("Nuovo e usato", "New and used", "جديد ومستعمل"), n: lista.length },
    ];
    return (
      <div className="foglio sezione">
        <h1 style={{ margin: "8px 0 8px" }}>{nome}</h1>
        <p className="tenue" style={{ marginBottom: 24 }}>{_("Dove vuoi cercare?", "Where do you want to look?", "عايز تدوّر فين؟")}</p>
        <div className="modelli-griglia">
          {sc.map((x) => (
            <Link key={x.c} href={q({ ed: f.ed, cond: x.c })} className="modello-card">
              <span style={{ fontWeight: 600, fontSize: 18 }}>{x.t}</span>
              <span className="mono lieve">{x.n} {_("pezzi", "pieces", "قطعة")}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="foglio sezione">
      <span className="mono lieve">{lista.length} {_("pezzi", "pieces", "قطعة")}</span>
      <h1 style={{ margin: "8px 0 14px" }}>{_("Il negozio", "The shop", "المتجر")}</h1>
      <p className="tenue" style={{ maxWidth: 620, marginBottom: 28 }}>
        {_("Attrezzatura scelta pezzo per pezzo, importata dall'Italia e consegnata in Egitto. Ogni scheda dice materiali, certificazioni e misure reali.",
           "Gear chosen piece by piece, imported from Italy and delivered in Egypt. Every listing states materials, certifications and real measurements.",
           "معدات مختارة قطعة قطعة، مستوردة من إيطاليا وتُسلَّم في مصر. كل بطاقة تذكر المواد والشهادات والمقاسات الحقيقية.")}
      </p>
      <div className="cond-chips" style={{ marginBottom: 12 }}>
        <div className="chips-riga">
          <Link href={q({ ...(usato ? { cond: "usato" } : {}) })} className={"chip" + (!f.ed ? " on" : "")}>{_("Tutti", "All", "الكل")}</Link>
          <Link href={q({ ed: "limited", ...(f.cond ? { cond: f.cond } : {}) })} className={"chip" + (f.ed === "limited" ? " on" : "")}>Limited edition</Link>
          <Link href={q({ ed: "special", ...(f.cond ? { cond: f.cond } : {}) })} className={"chip" + (f.ed === "special" ? " on" : "")}>Special edition</Link>
        </div>
      </div>
      <div className="cond-switch" role="tablist">
        <Link href={f.ed ? q({ ed: f.ed, cond: "nuovo" }) : href(l, "/negozio")} className={"cond-tab" + ((f.ed ? f.cond === "nuovo" : !usato) ? " on" : "")} role="tab" aria-selected={!usato}>{_("Nuovo", "New", "جديد")}</Link>
        <Link href={q({ cond: "usato", ...(f.ed ? { ed: f.ed } : {}) })} className={"cond-tab" + (usato ? " on" : "")} role="tab" aria-selected={usato}>{_("Usato", "Used", "مستعمل")}</Link>
      </div>
      {usato && (
        <div className="cond-chips">
          <div className="chips-riga">
            <Link href={q({ cond: "usato" })} className={"chip" + (!f.cat ? " on" : "")}>{_("Tutto", "All", "الكل")}</Link>
            {CATEGORIE.map((c) => <Link key={c} href={q({ cond: "usato", cat: c })} className={"chip" + (f.cat === c ? " on" : "")}>{tr(l, ETICHETTA_CAT[c])}</Link>)}
          </div>
          {modelliCat.length > 0 && (
            <div className="modelli-griglia">
              {modelliCat.map((m) => {
                const n = conteggi[m.toLowerCase()] ?? 0;
                const slug = m.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                const propria = (FOTO as string[]).includes(`${f.cat}-${slug}.webp`);
                const img = propria ? `/immagini/modelli/${f.cat}-${slug}.webp` : `/immagini/cat-${f.cat}.webp?v=4`;
                return (
                  <Link key={m} href={q({ cond: "usato", cat: f.cat, sotto: m })} className={"modello-card" + (f.sotto.toLowerCase() === m.toLowerCase() ? " on" : "") + (n === 0 ? " zero" : "")}>
                    <span className="modello-img"><img src={img} alt={m} loading="lazy" /></span>
                    <strong>{m}</strong>
                    <small>{n > 0 ? `${n} ${_("in asta", "at auction", "في المزاد")}` : _("Nessun pezzo ora", "None right now", "لا توجد قطع الآن")}</small>
                  </Link>
                );
              })}
            </div>
          )}
          <p className="tenue" style={{ fontSize: 13, margin: "10px 0 0" }}>{_("Pezzi unici: ognuno si vende all'asta, uno alla volta.", "One-off pieces: each is sold by auction, one at a time.", "قطع فريدة: كل قطعة تُباع بالمزاد، واحدة تلو الأخرى.")}</p>
        </div>
      )}
      <input type="checkbox" id="tf" className="tf-chk" aria-hidden="true" tabIndex={-1} />
      <label htmlFor="tf" className="tasto vuoto apri-filtri">{_("Filtri", "Filters", "مرشحات")}{attivi > 0 ? ` · ${attivi}` : ""}</label>
      <div className="negozio">
        <form className="filtri" method="get" action={href(l, "/negozio")} aria-label={_("Filtri", "Filters", "مرشحات")}>
          {f.cond && <input type="hidden" name="cond" value={f.cond} />}{f.ed && <input type="hidden" name="ed" value={f.ed} />}
          <div className="campo"><label htmlFor="q">{_("Cerca", "Search", "بحث")}</label><input id="q" name="q" type="search" defaultValue={f.q} placeholder={_("Cerca casco, marca, modello…", "Search helmet, brand, model…", "ابحث عن خوذة، ماركة، موديل…")} /></div>
          <fieldset><legend>{_("Categoria", "Category", "الفئة")}</legend>
            {CATEGORIE.map((c) => { const n = opz.cat[c] ?? 0; return (
              <div key={c} className={"opz" + (n === 0 ? " spenta" : "")}><input type="radio" name="cat" id={"c-" + c} value={c} defaultChecked={f.cat === c} disabled={n === 0} /><label htmlFor={"c-" + c} style={{ margin: 0, textTransform: "none", letterSpacing: 0, fontFamily: "var(--x)", fontSize: 14, color: "inherit" }}>{tr(l, ETICHETTA_CAT[c])}</label><span className="n mono">{n}</span></div>); })}
            <div className="opz"><input type="radio" name="cat" id="c-tutti" value="" defaultChecked={!f.cat} /><label htmlFor="c-tutti" style={{ margin: 0, textTransform: "none", letterSpacing: 0, fontFamily: "var(--x)", fontSize: 14, color: "inherit" }}>{_("Tutte", "All", "الكل")}</label></div>
          </fieldset>
          <fieldset><legend>{_("Stile di guida", "Riding style", "أسلوب القيادة")}</legend>
            {STILI.map((s) => { const n = opz.stili[s] ?? 0; return (
              <div key={s} className={"opz" + (n === 0 ? " spenta" : "")}><input type="radio" name="stile" id={"s-" + s} value={s} defaultChecked={f.stile === s} disabled={n === 0} /><label htmlFor={"s-" + s} style={{ margin: 0, textTransform: "none", letterSpacing: 0, fontFamily: "var(--x)", fontSize: 14, color: "inherit" }}>{ETICHETTA_STILE[s]}</label><span className="n mono">{n}</span></div>); })}
            <div className="opz"><input type="radio" name="stile" id="s-tutti" value="" defaultChecked={!f.stile} /><label htmlFor="s-tutti" style={{ margin: 0, textTransform: "none", letterSpacing: 0, fontFamily: "var(--x)", fontSize: 14, color: "inherit" }}>{_("Tutti", "All", "الكل")}</label></div>
          </fieldset>
          <fieldset><legend>{_("Marca", "Brand", "الماركة")}</legend>
            <select name="marca" defaultValue={f.marca} aria-label={_("Marca", "Brand", "الماركة")}>
              <option value="">{_("Tutte", "All", "الكل")}</option>
              {opz.marche.map((m) => <option key={m.slug} value={m.slug}>{m.nome} ({m.n})</option>)}
            </select>
          </fieldset>
          <fieldset><legend>{_("Taglia", "Size", "المقاس")}</legend>
            <select name="taglia" defaultValue={f.taglia} aria-label={_("Taglia", "Size", "المقاس")}>
              <option value="">{_("Tutte", "All", "الكل")}</option>
              {opz.taglie.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </fieldset>
          <fieldset><legend>{_("Prezzo massimo (EGP)", "Maximum price (EGP)", "السعر الأقصى (جنيه)")}</legend>
            <input name="max" type="number" min="0" step="100" inputMode="numeric" defaultValue={f.max ? f.max / 100 : ""} aria-label={_("Prezzo massimo", "Maximum price", "السعر الأقصى")} />
          </fieldset>
          {([["sotto", "Sottocategoria", "Subcategory", "الفئة الفرعية", opz.sotto, f.sotto], ["colore", "Colore", "Colour", "اللون", opz.colori, f.colore], ["genere", "Genere", "Gender", "الجنس", opz.generi, f.genere], ["materiale", "Materiale", "Material", "الخامة", opz.materiali, f.materiale], ["cert", "Certificazione", "Certification", "الشهادة", opz.cert, f.cert]] as [string, string, string, string, string[], string][]).filter(([, , , , v]) => v.length > 0).map(([k, it, en, ar, vals, cur]) => (
            <fieldset key={k}><legend>{_(it, en, ar)}</legend>
              <select name={k} defaultValue={cur} aria-label={_(it, en, ar)}><option value="">{_("Tutti", "All", "الكل")}</option>{vals.map((v) => <option key={v} value={v}>{v}</option>)}</select>
            </fieldset>
          ))}
          <fieldset><legend>{_("Modello di moto", "Motorcycle model", "موديل الدراجة")}</legend>
            <input name="moto" defaultValue={f.moto} placeholder={_("es. MT-07", "e.g. MT-07", "مثال: MT-07")} aria-label={_("Modello di moto", "Motorcycle model", "موديل الدراجة")} />
          </fieldset>
          <fieldset><legend>{_("Disponibilità", "Availability", "التوفر")}</legend>
            <div className="opz"><input type="checkbox" name="solo" id="solo" value="1" defaultChecked={f.solo} /><label htmlFor="solo" style={{ margin: 0, textTransform: "none", letterSpacing: 0, fontFamily: "var(--x)", fontSize: 14, color: "inherit" }}>{_("Solo disponibili", "In stock only", "المتوفر فقط")}</label></div>
          </fieldset>
          <fieldset><legend>{_("Ordina", "Sort", "الترتيب")}</legend>
            <select name="ord" defaultValue={f.ord} aria-label={_("Ordina", "Sort", "الترتيب")}>
              <option value="">{_("Consigliati", "Recommended", "موصى به")}</option>
              <option value="prezzo-asc">{_("Prezzo crescente", "Price low to high", "السعر من الأقل")}</option>
              <option value="prezzo-desc">{_("Prezzo decrescente", "Price high to low", "السعر من الأعلى")}</option>
              <option value="novita">{_("Novità", "New in", "الجديد")}</option>
              <option value="sconto">{_("Sconto maggiore", "Biggest discount", "أكبر خصم")}</option>
            </select>
          </fieldset>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="submit" className="tasto">{_("Applica", "Apply", "تطبيق")}</button>
            {attivi > 0 && <Link className="tasto vuoto" href={href(l, "/negozio")}>{_("Azzera", "Clear", "مسح")}</Link>}
          </div>
        </form>
        <section aria-label={_("Risultati", "Results", "النتائج")}>
          {lista.length === 0 ? (
            <div className="nota">
              <b>{_("Nessun pezzo con questi filtri", "Nothing matches these filters", "لا توجد قطع بهذه المرشحات")}</b>
              <p>{_("Prova ad allargare la ricerca: spesso basta togliere la taglia o alzare il prezzo massimo.", "Try widening the search: usually dropping the size or raising the price cap is enough.", "جرّب توسيع البحث: غالباً يكفي إلغاء المقاس أو رفع السعر الأقصى.")}</p>
              <p style={{ marginTop: 10 }}><Link className="tasto vuoto piccolo" href={href(l, "/negozio")}>{_("Azzera i filtri", "Clear filters", "مسح المرشحات")}</Link></p>
            </div>
          ) : (
            <div className="griglia">{lista.map((p) => <Scheda key={p.id} p={p} l={l} preferito={u ? pref.has(p.slug) : undefined} torna={u ? torna : undefined} />)}</div>
          )}
        </section>
      </div>
    </div>
  );
}
