import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { richiediAdmin } from "@/lib/sessione";
import { egp } from "@/lib/regole";
import { prossimi } from "@/lib/ordini";
import { CATEGORIE } from "@/lib/catalogo";
import MODELLI from "../../../dati/usato-modelli.json";
import { statoDa } from "@/lib/aste";
import { creaCouponAction, creaAstaAction, garanziaAction, rispondiChatAction, eliminaFotoAction, interruttoreCouponAction, salvaProdottoAction, caricaVelocePezzoAction, statoOrdineAction, accontoRicevutoAction } from "./azioni";

export const metadata = { title: "Operativo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TABS = ["oggi", "ordini", "chat", "prodotti", "veloce", "aste", "clienti", "altro", "coupon", "posta", "iscritti"] as const;
const STILI = ["sport", "street", "adventure", "touring", "urban"];
const NOME_STATO: Record<string, string> = { DA_CONFERMARE: "Da confermare", CONFERMATO: "Confermato", PREPARAZIONE: "In preparazione", SPEDITO: "Spedito", CONSEGNATO: "Consegnato", ANNULLATO: "Annullato" };
const fmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Cairo" });
const dt = (d: Date | null) => (d ? d.toISOString().slice(0, 16) : "");

const ALTRO = ["coupon", "posta", "iscritti"];
const NOME_TAB: Record<string, string> = { oggi: "Oggi", ordini: "Ordini", chat: "Messaggi", prodotti: "Prodotti", veloce: "Carica usato", aste: "Aste", clienti: "Clienti", altro: "Altro" };

export default async function Operativo({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  // Chi non è amministratore vede una pagina inesistente, non un invito ad accedere.
  if (!(await richiediAdmin())) notFound();
  const q = await searchParams;
  const tab = (TABS as readonly string[]).includes(q.tab ?? "") ? q.tab! : "oggi";
  const [daLeggere, daGestire] = await Promise.all([
    db.messaggio.count({ where: { daStaff: false, letto: false } }),
    db.ordine.count({ where: { stato: { in: ["DA_CONFERMARE", "CONFERMATO", "PREPARAZIONE"] } } }),
  ]);
  const attivo = (t: string) => t === tab || (t === "altro" && ALTRO.includes(tab));
  const badge: Record<string, number> = { ordini: daGestire, chat: daLeggere };
  return (
    <div className="foglio sezione operativo">
      <h1 style={{ marginBottom: 6 }}>Operativo</h1>
      <nav className="op-nav" aria-label="Sezioni">
        {Object.keys(NOME_TAB).map((t) => <Link key={t} href={`/operativo?tab=${t}`} className={`tasto piccolo ${attivo(t) ? "" : "vuoto"}`}>{NOME_TAB[t]}{badge[t] > 0 ? <b className="op-badge">{badge[t]}</b> : null}</Link>)}
      </nav>
      {ALTRO.includes(tab) || tab === "altro" ? <nav className="op-sub" aria-label="Altro">
        {[["coupon", "Codici sconto"], ["posta", "Email inviate"], ["iscritti", "Newsletter"]].map(([t, n]) => <Link key={t} href={`/operativo?tab=${t}`} aria-current={t === tab ? "page" : undefined}>{n}</Link>)}
      </nav> : null}
      {q.ok && <p className="nota ok" role="status" style={{ marginBottom: 18 }}>{q.ok}</p>}
      {q.err && <p className="nota" role="alert" style={{ marginBottom: 18 }}><b>{q.err}</b></p>}
      {tab === "oggi" && <Oggi />}
      {tab === "ordini" && <Ordini tutti={q.tutti === "1"} />}
      {tab === "chat" && <Chat conv={q.conv} />}
      {tab === "prodotti" && <Prodotti modifica={q.modifica} tipo={q.tipo} />}
      {tab === "veloce" && <CaricaVeloce />}
      {tab === "clienti" && <Clienti />}
      {tab === "coupon" && <Coupon />}
      {tab === "aste" && <Aste />}
      {tab === "posta" && <PostaLog />}
      {tab === "iscritti" && <Iscritti />}
      {tab === "altro" && <p className="tenue">Scegli sopra: codici sconto, email inviate o newsletter.</p>}
    </div>
  );
}

async function Oggi() {
  const adesso = new Date();
  const [daConf, inPrep, bloccoAtt, daLeggere, asta, prodotti] = await Promise.all([
    db.ordine.count({ where: { stato: "DA_CONFERMARE" } }),
    db.ordine.count({ where: { stato: { in: ["CONFERMATO", "PREPARAZIONE"] } } }),
    db.ordine.count({ where: { stato: "DA_CONFERMARE", bloccoScade: { not: null }, bloccoPagato: false } }),
    db.messaggio.count({ where: { daStaff: false, letto: false } }),
    db.asta.findFirst({ where: { stato: "APERTA", fine: { gt: adesso } }, orderBy: { fine: "asc" }, include: { prodotto: true, offerte: true } }),
    db.prodotto.findMany({ where: { attivo: true }, include: { varianti: true } }),
  ]);
  const esauriti = prodotti.filter((p) => p.varianti.every((v) => v.giacenza - v.impegnati <= 0)).length;
  const sa = asta ? statoDa(asta) : null;
  return <>
    <div className="op-azioni">
      <Link className="tasto" href="/operativo?tab=prodotti&modifica=nuovo">+ Nuovo prodotto</Link>
      <Link className="tasto" href="/operativo?tab=prodotti&modifica=nuovo&tipo=asta">+ Nuova asta</Link>
    </div>
    <div className="op-carte">
      <Link href="/operativo?tab=ordini" className={"op-carta" + (daConf > 0 ? " urgente" : "")}><span className="mono">Ordini nuovi</span><b>{daConf}</b><small>{daConf > 0 ? "da confermare" : "nessuno in attesa"}</small></Link>
      <Link href="/operativo?tab=ordini" className="op-carta"><span className="mono">In lavorazione</span><b>{inPrep}</b><small>da preparare o spedire</small></Link>
      <Link href="/operativo?tab=chat" className={"op-carta" + (daLeggere > 0 ? " urgente" : "")}><span className="mono">Messaggi</span><b>{daLeggere}</b><small>{daLeggere > 0 ? "da leggere" : "tutto letto"}</small></Link>
      <Link href="/operativo?tab=prodotti" className="op-carta"><span className="mono">Prodotti</span><b>{prodotti.length}</b><small>{esauriti > 0 ? `${esauriti} esauriti` : "tutti disponibili"}</small></Link>
    </div>
    {bloccoAtt > 0 && <p className="nota avviso" style={{ margin: "18px 0" }}><b>{bloccoAtt} blocco/i prezzo</b> in attesa dell&apos;acconto di 800 EGP. <Link style={{ textDecoration: "underline" }} href="/operativo?tab=ordini">Vai agli ordini</Link></p>}
    <h2 style={{ margin: "28px 0 12px", fontSize: 22 }}>Asta della settimana</h2>
    {asta && sa ? <Link href="/operativo?tab=aste" className="op-carta larga"><span className="mono">In corso · chiude {fmt.format(asta.fine)}</span><b>{asta.prodotto.nome}</b><small>Offerta attuale {egp(sa.prezzo)} · {sa.offerenti} offerenti</small></Link>
      : <p className="nota">Nessuna asta aperta. <Link style={{ textDecoration: "underline" }} href="/operativo?tab=prodotti&modifica=nuovo&tipo=asta">Crea la prossima</Link> — il sito mostra intanto il pezzo coperto.</p>}
  </>;
}

async function Ordini({ tutti }: { tutti: boolean }) {
  const ordini = await db.ordine.findMany({ where: tutti ? {} : { stato: { notIn: ["CONSEGNATO", "ANNULLATO"] } }, orderBy: { creato: "desc" }, take: 100, include: { righe: true } });
  const sel = <p style={{ margin: "0 0 14px" }}><Link className="tasto piccolo vuoto" href={`/operativo?tab=ordini${tutti ? "" : "&tutti=1"}`}>{tutti ? "Mostra solo da gestire" : "Mostra anche consegnati e annullati"}</Link></p>;
  if (!ordini.length) return <>{sel}<p className="tenue">{tutti ? "Nessun ordine." : "Nessun ordine da gestire."}</p></>;
  return <div>{sel}{ordini.map((o) => (
    <article key={o.id} className="filetto" style={{ padding: "16px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <b dir="ltr">{o.numero}</b><span className="mono">{fmt.format(o.creato)} · {NOME_STATO[o.stato]}</span><b className="tab">{egp(o.totale)}</b>
      </div>
      <p className="tenue" style={{ margin: "6px 0" }}>{o.nome} · <span dir="ltr">{o.telefono}</span> · {o.indirizzo}, {o.governatorato}{o.note ? ` · «${o.note}»` : ""}</p>
      <p className="tenue">{o.righe.map((r) => `${r.marca} ${r.nome} (${r.taglia}) ×${r.quantita}`).join(" · ")}</p>
      <p className="mono lieve" style={{ margin: "6px 0 10px" }}>{o.pagamento}{o.pagamento === "CONTRASSEGNO" ? ` · contanti alla consegna ${egp(o.contanti)}${o.acconto ? ` · acconto ${egp(o.acconto)}` : ""}` : ""}{o.coupon ? ` · coupon ${o.coupon} (−${egp(o.sconto)})` : ""}</p>
      {o.bloccoScade && o.stato === "DA_CONFERMARE" && (
        <p className="nota avviso" style={{ margin: "0 0 10px" }}>
          <b>Blocco prezzo</b> · acconto {egp(o.acconto)} {o.bloccoPagato ? "ricevuto" : "DA RICEVERE"} · scade {fmt.format(o.bloccoScade)}
          {!o.bloccoPagato && <form action={accontoRicevutoAction} style={{ display: "inline", marginInlineStart: 10 }}><input type="hidden" name="id" value={o.id} /><button className="tasto piccolo">Acconto ricevuto → parte il blocco di 48 ore</button></form>}
        </p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {prossimi(o.stato).map((s) => (
          <form key={s} action={statoOrdineAction}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="stato" value={s} />
            <button className={`tasto piccolo ${s === "ANNULLATO" ? "vuoto" : ""}`}>{s === "ANNULLATO" ? "Annulla ordine" : `→ ${NOME_STATO[s]}`}</button></form>
        ))}
      </div>
    </article>
  ))}</div>;
}

async function Prodotti({ modifica, tipo }: { modifica?: string; tipo?: string }) {
  if (modifica) return <FormProdotto id={modifica} tipoIniziale={tipo === "asta" ? "SECOND_LIFE" : undefined} />;
  const ps = await db.prodotto.findMany({ orderBy: { creato: "desc" }, include: { marca: true, varianti: true } });
  return <>
    <p style={{ marginBottom: 16 }}><Link className="tasto" href="/operativo?tab=prodotti&modifica=nuovo">+ Nuovo prodotto</Link></p>
    <table className="dati"><thead><tr><th>Prodotto</th><th>Tipo</th><th>Prezzo</th><th>Magazzino</th><th></th></tr></thead><tbody>
      {ps.map((p) => {
        const disp = p.varianti.reduce((s, v) => s + Math.max(0, v.giacenza - v.impegnati), 0);
        return <tr key={p.id}><td>{p.marca.nome} {p.nome}{!p.attivo && <span className="mono lieve"> · ritirato</span>}</td><td>{p.tipo === "NUOVO" ? "Nuovo" : "Second Life"}</td>
          <td className="tab">{egp(p.prezzo)}</td><td className="tab" style={{ color: disp === 0 ? "var(--rosso)" : undefined }}>{disp} · {p.varianti.map((v) => `${v.taglia}:${v.giacenza - v.impegnati}`).join(" ")}</td>
          <td><Link style={{ textDecoration: "underline" }} href={`/operativo?tab=prodotti&modifica=${p.id}`}>Modifica</Link></td></tr>;
      })}
    </tbody></table></>;
}

async function FormProdotto({ id, tipoIniziale }: { id: string; tipoIniziale?: string }) {
  const p = id === "nuovo" ? null : await db.prodotto.findUnique({ where: { id }, include: { marca: true, varianti: true, foto: { orderBy: { ordine: "asc" } }, asta: true } });
  if (id !== "nuovo" && !p) notFound();
  const marche = await db.marca.findMany({ orderBy: { nome: "asc" } });
  const taglie = p?.varianti.filter((v) => !v.colore).map((v) => `${v.taglia}:${v.giacenza}`).join(", ") ?? "";
  const pezzi = [...(p?.varianti ?? []).filter((v) => p?.tipo === "USATO"), ...Array.from({ length: 3 }, () => null)];
  const tipo = p?.tipo ?? tipoIniziale ?? "NUOVO";
  const astaNuova = tipo === "SECOND_LIFE" && !p?.asta;
  return <>
    <form action={salvaProdottoAction} encType="multipart/form-data" className="form-prod" style={{ maxWidth: 680 }}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <h2 style={{ fontSize: 22, margin: "0 0 16px" }}>{p ? "Modifica" : tipo === "SECOND_LIFE" ? "Nuova asta" : "Nuovo prodotto"}</h2>
      <fieldset className="campo scelta-tipo"><legend>Come lo vendi?</legend>
        <label><input type="radio" name="tipo" id="tipo-nuovo" value="NUOVO" defaultChecked={tipo === "NUOVO"} /> Vendita normale (nuovo)</label>
        <label><input type="radio" name="tipo" id="tipo-usato" value="USATO" defaultChecked={tipo === "USATO"} /> Usato (prezzo trattabile)</label>
        <label><input type="radio" name="tipo" id="tipo-asta" value="SECOND_LIFE" defaultChecked={tipo === "SECOND_LIFE"} /> Asta (un solo pezzo)</label>
      </fieldset>
      <div className="campo"><label htmlFor="foto">Foto (puoi sceglierne più d&apos;una)</label><input id="foto" name="foto" type="file" accept="image/jpeg,image/png,image/webp" multiple /></div>
      <div className="campo"><label htmlFor="nome">Nome</label><input id="nome" name="nome" defaultValue={p?.nome} required /></div>
      <div className="campo"><label htmlFor="marca">Marca</label><input id="marca" name="marca" list="elenco-marche" defaultValue={p?.marca.nome} required /><datalist id="elenco-marche">{marche.map((m) => <option key={m.id} value={m.nome} />)}</datalist></div>
      <div className="campo"><label htmlFor="categoria">Categoria</label><select id="categoria" name="categoria" defaultValue={p?.categoria ?? ""} required><option value="">—</option>{CATEGORIE.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="campo solo-nuovo"><label htmlFor="prezzo">Prezzo (EGP)</label><input id="prezzo" name="prezzo" inputMode="decimal" defaultValue={p ? p.prezzo / 100 : ""} /></div>
      <div className="campo solo-taglie"><label htmlFor="taglie">Taglie e pezzi <span className="lieve">— es. «M:3, L:5». Per l&apos;asta una sola, es. «L:1»</span></label><input id="taglie" name="taglie" placeholder="S:3, M:6, L:4" defaultValue={taglie} required /></div>
      <div className="solo-usato">
        <h3 style={{ fontSize: 16, margin: "6px 0 4px" }}>Pezzi usati (uno per colore e taglia)</h3>
        <p className="tenue" style={{ margin: "0 0 12px", fontSize: 13 }}>Per ogni pezzo: colore, taglia, link Vinted, prezzo scritto nell&apos;annuncio e difetti. Per togliere un pezzo svuota la taglia.</p>
        {pezzi.map((z, i) => (
          <div className="pezzo-riga" key={z?.id ?? "n" + i}>
            <input type="hidden" name="pz_id" value={z?.id ?? ""} />
            <input name="pz_colore" placeholder="Colore (es. Nero lucido)" defaultValue={z?.colore ?? ""} />
            <input name="pz_taglia" placeholder="Taglia" defaultValue={z?.taglia ?? ""} />
            <input name="pz_qta" inputMode="numeric" placeholder="Pezzi" defaultValue={z ? z.giacenza : ""} />
            <input name="pz_link" type="url" placeholder="Link annuncio Vinted" defaultValue={z?.fonteUrl ?? ""} />
            <input name="pz_annuncio" placeholder="Prezzo annuncio (es. 130 €)" defaultValue={z?.prezzoAnnuncio ?? ""} />
            <input name="pz_costo" inputMode="decimal" placeholder="Costo acquisto EGP" defaultValue={z?.costo ? z.costo / 100 : ""} />
            <input name="pz_difetti" placeholder="Difetti (li vede il cliente)" defaultValue={z?.difetti ?? ""} />
            <input name="pz_note" placeholder="Note interne" defaultValue={z?.noteInterne ?? ""} />
          </div>
        ))}
      </div>
      <div className="solo-asta">
        <div className="campo"><label htmlFor="partenza">Prezzo di partenza (EGP)</label><input id="partenza" name="partenza" inputMode="decimal" defaultValue={p?.asta ? p.asta.partenza / 100 : ""} /></div>
        <div className="campo"><label htmlFor="riserva">Riserva segreta (EGP, facoltativa)</label><input id="riserva" name="riserva" inputMode="decimal" defaultValue={p?.asta?.riserva ? p.asta.riserva / 100 : ""} /></div>
        {astaNuova || !p ? <div className="campo"><label htmlFor="giorni">Durata (giorni)</label><input id="giorni" name="giorni" inputMode="numeric" defaultValue={7} /></div> : <p className="tenue">L&apos;asta di questo pezzo è già stata creata: la gestisci nella scheda Aste.</p>}
      </div>
      <div className="campo solo-nuovo"><label><input type="checkbox" name="trattabile" defaultChecked={p?.trattabile ?? false} /> Il cliente può trattare il prezzo</label></div>
      <div className="campo solo-nuovo"><label htmlFor="prezzoMinimo">Prezzo minimo accettato (EGP) <span className="lieve">— solo se la trattativa è attiva; il prezzo sopra è il massimo pubblicato</span></label><input id="prezzoMinimo" name="prezzoMinimo" inputMode="decimal" defaultValue={p?.prezzoMinimo ? p.prezzoMinimo / 100 : ""} /></div>
      <div className="campo"><label htmlFor="descrizione">Descrizione</label><textarea id="descrizione" name="descrizione" rows={4} defaultValue={p?.descrizione.join("\n")} /></div>
      <label className="campo" style={{ display: "block" }}><input type="checkbox" name="attivo" defaultChecked={p ? p.attivo : true} /> Visibile sul sito (togli la spunta per ritirarlo)</label>
      <details className="altri-dettagli">
        <summary>Altri dettagli (facoltativi)</summary>
        <div className="campo"><label htmlFor="sottotitolo">Sottotitolo</label><input id="sottotitolo" name="sottotitolo" defaultValue={p?.sottotitolo} /></div>
        <div className="campo"><label htmlFor="sottocategoria">Sottocategoria / modello usato (es. AGV K1 S, Integrali)</label><input id="sottocategoria" name="sottocategoria" list="modelli-usato" defaultValue={p?.sottocategoria ?? ""} /><datalist id="modelli-usato">{Object.entries(MODELLI as unknown as Record<string, string[]>).filter(([k]) => k !== "_nota").flatMap(([, v]) => v).map((m) => <option key={m} value={m} />)}</datalist></div>
        <div className="campo"><label htmlFor="colore">Colore</label><input id="colore" name="colore" defaultValue={p?.colore ?? ""} /></div>
        <div className="campo"><label htmlFor="genere">Genere (Uomo, Donna, Unisex)</label><input id="genere" name="genere" defaultValue={p?.genere ?? ""} /></div>
        <div className="campo"><label htmlFor="materiale">Materiale (es. Pelle, Tessuto)</label><input id="materiale" name="materiale" defaultValue={p?.materiale ?? ""} /></div>
        <div className="campo"><label htmlFor="certificazione">Certificazione (es. CE livello 2, ECE 22.06)</label><input id="certificazione" name="certificazione" defaultValue={p?.certificazione ?? ""} /></div>
        <div className="campo"><label htmlFor="moto">Moto compatibili</label><input id="moto" name="moto" defaultValue={p?.moto ?? ""} /></div>
        <div className="campo"><label htmlFor="specs">Caratteristiche tecniche (una per riga, «Nome: valore»)</label><textarea id="specs" name="specs" rows={4} defaultValue={((p?.specs as [string, string][] | null) ?? []).map(([k, v]) => `${k}: ${v}`).join("\n")} /></div>
        <fieldset className="campo"><legend>Stili</legend>{STILI.map((s) => <label key={s} style={{ marginInlineEnd: 14 }}><input type="checkbox" name="stili" value={s} defaultChecked={p?.stili.includes(s)} /> {s}</label>)}</fieldset>
        <div className="campo solo-nuovo"><label htmlFor="prezzoPrima">Prezzo di prima (EGP, solo se in offerta)</label><input id="prezzoPrima" name="prezzoPrima" inputMode="decimal" defaultValue={p?.prezzoPrima ? p.prezzoPrima / 100 : ""} /></div>
        <div className="campo"><label htmlFor="nota">Nota</label><input id="nota" name="nota" defaultValue={p?.nota} /></div>
        <div className="campo"><label htmlFor="luogo">Luogo</label><input id="luogo" name="luogo" defaultValue={p?.luogo} /></div>
        <div className="campo"><label htmlFor="fonteUrl">Link annuncio Vinted (solo per te)</label><input id="fonteUrl" name="fonteUrl" type="url" defaultValue={p?.fonteUrl ?? ""} /></div>
        <div className="campo"><label htmlFor="costo">Prezzo d&apos;acquisto (EGP, solo per te)</label><input id="costo" name="costo" inputMode="decimal" defaultValue={p?.costo ? p.costo / 100 : ""} /></div>
        <div className="campo"><label htmlFor="difetti">Difetti (li vede il cliente)</label><input id="difetti" name="difetti" defaultValue={p?.difetti ?? ""} /></div>
        <div className="campo"><label htmlFor="noteInterne">Note interne (solo per te)</label><input id="noteInterne" name="noteInterne" defaultValue={p?.noteInterne ?? ""} /></div>
        <div className="campo"><label htmlFor="grado">Condizione / grado</label><input id="grado" name="grado" defaultValue={p?.grado ?? ""} /></div>
      </details>
      <div className="op-salva"><button className="tasto salva-prodotto">{p ? "Salva" : tipo === "SECOND_LIFE" ? "Crea e apri l'asta" : "Pubblica"}</button> <Link className="tasto vuoto" href="/operativo?tab=prodotti">Indietro</Link></div>
    </form>
    {p && p.foto.length > 0 && <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>{p.foto.map((f) => (
      <form key={f.id} action={eliminaFotoAction}><input type="hidden" name="id" value={f.id} />
        {/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/media/${f.piccola}`} alt="" width={120} /><br /><button className="tasto piccolo vuoto">Togli</button></form>
    ))}</div>}
  </>;
}

async function Coupon() {
  const cs = await db.coupon.findMany({ orderBy: { codice: "asc" }, include: { usi: true } });
  const adesso = new Date();
  const stato = (c: (typeof cs)[number]) => !c.attivo ? "spento" : c.fine && c.fine < adesso ? "scaduto" : c.inizio && c.inizio > adesso ? "non ancora" : c.usiMax !== null && c.usiFatti >= c.usiMax ? "esaurito" : "vale";
  return <>
    <table className="dati"><thead><tr><th>Codice</th><th>Sconto</th><th>Stato</th><th>Usi</th><th>Costo reale</th><th></th></tr></thead><tbody>
      {cs.map((c) => <tr key={c.id}><td dir="ltr">{c.codice}</td><td>{c.tipo === "FISSO" ? egp(c.valore) : `${c.valore}%`}{c.minimo ? ` da ${egp(c.minimo)}` : ""}</td><td>{stato(c)}</td>
        <td className="tab">{c.usiFatti}{c.usiMax !== null ? `/${c.usiMax}` : ""}</td><td className="tab">{egp(c.usi.reduce((s, u) => s + u.sconto, 0))}</td>
        <td><form action={interruttoreCouponAction}><input type="hidden" name="id" value={c.id} /><button className="tasto piccolo vuoto">{c.attivo ? "Spegni" : "Riaccendi"}</button></form></td></tr>)}
    </tbody></table>
    <h2 style={{ margin: "32px 0 14px" }}>Nuovo coupon</h2>
    <form action={creaCouponAction} style={{ maxWidth: 520 }}>
      <div className="campo"><label htmlFor="codice">Codice</label><input id="codice" name="codice" required /></div>
      <div className="campo"><label htmlFor="ctipo">Tipo</label><select id="ctipo" name="tipo"><option value="PERCENTUALE">Percentuale</option><option value="FISSO">Importo fisso (EGP)</option></select></div>
      <div className="campo"><label htmlFor="valore">Valore (% oppure EGP)</label><input id="valore" name="valore" inputMode="decimal" required /></div>
      <div className="campo"><label htmlFor="minimo">Spesa minima (EGP, facoltativo)</label><input id="minimo" name="minimo" inputMode="decimal" /></div>
      <div className="campo"><label htmlFor="inizio">Inizio</label><input id="inizio" name="inizio" type="datetime-local" /></div>
      <div className="campo"><label htmlFor="fine">Fine</label><input id="fine" name="fine" type="datetime-local" /></div>
      <div className="campo"><label htmlFor="usiMax">Usi totali massimi</label><input id="usiMax" name="usiMax" inputMode="numeric" /></div>
      <div className="campo"><label htmlFor="perPersona">Usi per persona</label><input id="perPersona" name="perPersona" inputMode="numeric" /></div>
      <button className="tasto">Crea coupon</button>
    </form></>;
}

async function Aste() {
  const [aste, liberi] = await Promise.all([
    db.asta.findMany({ orderBy: { fine: "desc" }, include: { prodotto: true, offerte: true, vincitore: true } }),
    db.prodotto.findMany({ where: { tipo: "SECOND_LIFE", asta: null } }),
  ]);
  return <>
    <p style={{ marginBottom: 16 }}><Link className="tasto" href="/operativo?tab=prodotti&modifica=nuovo&tipo=asta">+ Nuova asta</Link></p>
    <table className="dati"><thead><tr><th>Pezzo</th><th>Stato</th><th>Chiude</th><th>Prezzo</th><th>Offerte</th><th>Vincitore</th></tr></thead><tbody>
      {aste.map((a) => { const s = statoDa(a); return <tr key={a.id}><td>{a.prodotto.nome}</td><td>{a.stato}</td><td>{fmt.format(a.fine)}</td><td className="tab">{egp(a.prezzoFinale ?? s.prezzo)}</td><td className="tab">{a.offerte.length}</td><td>{a.vincitore?.email ?? "—"}</td></tr>; })}
    </tbody></table>
    {liberi.length > 0 && <><h2 style={{ margin: "32px 0 14px" }}>Apri un&apos;asta</h2>
      <form action={creaAstaAction} style={{ maxWidth: 520 }}>
        <div className="campo"><label htmlFor="prodottoId">Pezzo</label><select id="prodottoId" name="prodottoId">{liberi.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
        <div className="campo"><label htmlFor="partenza">Prezzo di partenza (EGP)</label><input id="partenza" name="partenza" inputMode="decimal" required /></div>
        <div className="campo"><label htmlFor="riserva">Riserva segreta (EGP, facoltativa)</label><input id="riserva" name="riserva" inputMode="decimal" /></div>
        <div className="campo"><label htmlFor="giorni">Durata (giorni)</label><input id="giorni" name="giorni" inputMode="numeric" defaultValue={7} /></div>
        <button className="tasto">Apri asta</button>
      </form></>}
    <p className="tenue" style={{ marginTop: 24 }}>Le aste si chiudono da sole: serve il cron che chiama <code>/api/giro</code> ogni minuto.</p></>;
}

async function PostaLog() {
  const r = await db.posta.findMany({ orderBy: { ts: "desc" }, take: 100 });
  return r.length ? <table className="dati"><thead><tr><th>Quando</th><th>A</th><th>Oggetto</th><th>Esito</th></tr></thead><tbody>
    {r.map((m) => <tr key={m.id}><td>{fmt.format(m.ts)}</td><td dir="ltr">{m.a}</td><td>{m.oggetto}</td><td style={{ color: m.esito === "INVIATA" ? undefined : "var(--rosso)" }}>{m.esito}{m.errore ? ` · ${m.errore}` : ""}</td></tr>)}
  </tbody></table> : <p className="tenue">Nessuna email ancora.</p>;
}

async function Iscritti() {
  const n = await db.iscritto.count();
  return <p>{n} iscritti alla newsletter. <a style={{ textDecoration: "underline" }} href="/operativo/iscritti">Scarica CSV</a></p>;
}

async function Chat({ conv }: { conv?: string }) {
  const lista = await db.conversazione.findMany({
    orderBy: { ultimo: "desc" }, take: 50,
    include: { messaggi: { orderBy: { ts: "desc" }, take: 1 }, _count: { select: { messaggi: { where: { daStaff: false, letto: false } } } } },
  });
  const aperta = conv ? await db.conversazione.findUnique({ where: { id: conv }, include: { messaggi: { orderBy: { ts: "asc" }, take: 300 } } }) : null;
  if (aperta) await db.messaggio.updateMany({ where: { conversazioneId: aperta.id, daStaff: false, letto: false }, data: { letto: true } });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 300px) 1fr", gap: 24 }} className="chat-admin">
      <div>
        {!lista.length && <p className="tenue">Nessuna conversazione.</p>}
        {lista.map((c) => (
          <Link key={c.id} href={`/operativo?tab=chat&conv=${c.id}`} className="filetto" style={{ display: "block", padding: "10px 0", fontWeight: c.id === conv ? 700 : 400 }}>
            {c.nome || "Visitatore"} {c._count.messaggi > 0 && <b style={{ color: "var(--rosso)" }}>({c._count.messaggi})</b>}
            <span className="mono lieve" style={{ display: "block" }}>{fmt.format(c.ultimo)} · {c.messaggi[0]?.testo.slice(0, 40)}</span>
          </Link>
        ))}
      </div>
      <div>
        {aperta ? (<>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {aperta.messaggi.map((m) => <p key={m.id} style={{ alignSelf: m.daStaff ? "flex-end" : "flex-start", maxWidth: "80%", padding: "9px 12px", background: m.daStaff ? "var(--inchiostro)" : "var(--fondo-2)", color: m.daStaff ? "var(--carta)" : undefined, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.testo}<span className="mono" style={{ display: "block", fontSize: 10, opacity: .6 }}>{fmt.format(m.ts)}</span></p>)}
          </div>
          <form action={rispondiChatAction}><input type="hidden" name="id" value={aperta.id} />
            <div className="campo"><label htmlFor="testo">Risposta</label><textarea id="testo" name="testo" rows={3} maxLength={1000} required /></div>
            <button className="tasto">Invia</button></form>
        </>) : <p className="tenue">Scegli una conversazione.</p>}
      </div>
    </div>
  );
}

async function Clienti() {
  const us = await db.utente.findMany({ orderBy: { creato: "desc" }, take: 200, include: { ordini: { select: { totale: true, stato: true } } } });
  return us.length ? <table className="dati"><thead><tr><th>Nome</th><th>Email</th><th>Iscritto</th><th>Ordini</th><th>Speso</th><th>Garanzia aste</th></tr></thead><tbody>
    {us.map((u) => { const validi = u.ordini.filter((o) => o.stato !== "ANNULLATO"); return (
      <tr key={u.id}><td>{u.nome}{u.ruolo === "ADMIN" ? " · admin" : ""}</td><td dir="ltr">{u.email}</td><td>{fmt.format(u.creato)}</td><td className="tab">{validi.length}</td><td className="tab">{egp(validi.reduce((s, o) => s + o.totale, 0))}</td>
        <td>{u.ruolo === "ADMIN" ? "" : (<form action={garanziaAction}><input type="hidden" name="id" value={u.id} /><button className="tasto piccolo vuoto">{u.garanzia ? "Sì · togli" : "No · concedi"}</button></form>)}</td></tr>); })}
  </tbody></table> : <p className="tenue">Nessun cliente registrato.</p>;
}

function CaricaVeloce() {
  return (
    <form action={caricaVelocePezzoAction} className="form-prod" style={{ maxWidth: 680 }}>
      <h2 style={{ fontSize: 22, margin: "0 0 6px" }}>Carica un usato da Vinted</h2>
      <p className="tenue" style={{ margin: "0 0 18px" }}>Incolla il testo dell&apos;annuncio e il link. Riconosco modello, categoria, colore, taglia e difetti. La foto è quella da catalogo del modello. Il prezzo di vendita lo metti dopo, da Prodotti.</p>
      <div className="campo"><label htmlFor="testo">Testo dell&apos;annuncio (titolo + descrizione)</label><textarea id="testo" name="testo" rows={7} required placeholder="Incolla qui il testo copiato da Vinted" /></div>
      <div className="campo"><label htmlFor="link">Link annuncio Vinted</label><input id="link" name="link" type="url" placeholder="https://www.vinted.it/items/…" /></div>
      <div className="campo"><label htmlFor="annuncio">Prezzo dell&apos;annuncio (come scritto su Vinted)</label><input id="annuncio" name="annuncio" placeholder="130" /></div>
      <details className="altri-dettagli"><summary>Correggi quello che ho riconosciuto</summary>
        <div className="campo"><label htmlFor="v-categoria">Categoria</label><select id="v-categoria" name="categoria" defaultValue=""><option value="">Riconosci da solo</option>{CATEGORIE.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="campo"><label htmlFor="v-marca">Marca</label><input id="v-marca" name="marca" /></div>
        <div className="campo"><label htmlFor="v-nome">Nome del modello</label><input id="v-nome" name="nome" /></div>
        <div className="campo"><label htmlFor="v-colore">Colore</label><input id="v-colore" name="colore" /></div>
        <div className="campo"><label htmlFor="v-taglia">Taglia</label><input id="v-taglia" name="taglia" /></div>
        <div className="campo"><label htmlFor="v-difetti">Difetti (li vede il cliente)</label><input id="v-difetti" name="difetti" /></div>
      </details>
      <div className="op-salva"><button className="tasto">Aggiungi</button></div>
    </form>
  );
}
