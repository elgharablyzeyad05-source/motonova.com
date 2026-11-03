import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { richiediAdmin } from "@/lib/sessione";
import { egp } from "@/lib/regole";
import { prossimi } from "@/lib/ordini";
import { CATEGORIE } from "@/lib/catalogo";
import { statoDa } from "@/lib/aste";
import { creaCouponAction, creaAstaAction, garanziaAction, rispondiChatAction, eliminaFotoAction, interruttoreCouponAction, salvaProdottoAction, statoOrdineAction, accontoRicevutoAction } from "./azioni";

export const metadata = { title: "Operativo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TABS = ["ordini", "chat", "prodotti", "clienti", "coupon", "aste", "posta", "iscritti"] as const;
const STILI = ["sport", "street", "adventure", "touring", "urban"];
const NOME_STATO: Record<string, string> = { DA_CONFERMARE: "Da confermare", CONFERMATO: "Confermato", PREPARAZIONE: "In preparazione", SPEDITO: "Spedito", CONSEGNATO: "Consegnato", ANNULLATO: "Annullato" };
const fmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Cairo" });
const dt = (d: Date | null) => (d ? d.toISOString().slice(0, 16) : "");

export default async function Operativo({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  // Chi non è amministratore vede una pagina inesistente, non un invito ad accedere.
  if (!(await richiediAdmin())) notFound();
  const q = await searchParams;
  const tab = (TABS as readonly string[]).includes(q.tab ?? "") ? q.tab! : "ordini";
  const daLeggere = await db.messaggio.count({ where: { daStaff: false, letto: false } });
  return (
    <div className="foglio sezione operativo">
      <h1 style={{ marginBottom: 6 }}>Operativo</h1>
      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0 24px" }}>
        {TABS.map((t) => <Link key={t} href={`/operativo?tab=${t}`} className={`tasto piccolo ${t === tab ? "" : "vuoto"}`}>{t}{t === "chat" && daLeggere > 0 ? ` (${daLeggere})` : ""}</Link>)}
      </nav>
      {q.ok && <p className="nota ok" role="status" style={{ marginBottom: 18 }}>{q.ok}</p>}
      {q.err && <p className="nota" role="alert" style={{ marginBottom: 18 }}><b>{q.err}</b></p>}
      {tab === "ordini" && <Ordini />}
      {tab === "chat" && <Chat conv={q.conv} />}
      {tab === "prodotti" && <Prodotti modifica={q.modifica} />}
      {tab === "clienti" && <Clienti />}
      {tab === "coupon" && <Coupon />}
      {tab === "aste" && <Aste />}
      {tab === "posta" && <PostaLog />}
      {tab === "iscritti" && <Iscritti />}
    </div>
  );
}

async function Ordini() {
  const ordini = await db.ordine.findMany({ orderBy: { creato: "desc" }, take: 100, include: { righe: true } });
  if (!ordini.length) return <p className="tenue">Nessun ordine.</p>;
  return <div>{ordini.map((o) => (
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

async function Prodotti({ modifica }: { modifica?: string }) {
  if (modifica) return <FormProdotto id={modifica} />;
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

async function FormProdotto({ id }: { id: string }) {
  const p = id === "nuovo" ? null : await db.prodotto.findUnique({ where: { id }, include: { marca: true, varianti: true, foto: { orderBy: { ordine: "asc" } } } });
  if (id !== "nuovo" && !p) notFound();
  const taglie = p?.varianti.map((v) => `${v.taglia}:${v.giacenza}`).join(", ") ?? "";
  return <>
    <form action={salvaProdottoAction} encType="multipart/form-data" style={{ maxWidth: 680 }}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="campo"><label htmlFor="nome">Nome</label><input id="nome" name="nome" defaultValue={p?.nome} required /></div>
      <div className="campo"><label htmlFor="marca">Marca</label><input id="marca" name="marca" defaultValue={p?.marca.nome} required /></div>
      <div className="campo"><label htmlFor="sottotitolo">Sottotitolo</label><input id="sottotitolo" name="sottotitolo" defaultValue={p?.sottotitolo} /></div>
      <div className="campo"><label htmlFor="categoria">Categoria</label><select id="categoria" name="categoria" defaultValue={p?.categoria ?? ""} required><option value="">—</option>{CATEGORIE.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="campo"><label htmlFor="tipo">Tipo</label><select id="tipo" name="tipo" defaultValue={p?.tipo ?? "NUOVO"}><option value="NUOVO">Nuovo</option><option value="SECOND_LIFE">Second Life (pezzo unico, asta)</option></select></div>
      <div className="campo"><label htmlFor="sottocategoria">Sottocategoria (es. Integrali, Modulari, Racing)</label><input id="sottocategoria" name="sottocategoria" defaultValue={p?.sottocategoria ?? ""} /></div>
      <div className="campo"><label htmlFor="colore">Colore</label><input id="colore" name="colore" defaultValue={p?.colore ?? ""} /></div>
      <div className="campo"><label htmlFor="genere">Genere (Uomo, Donna, Unisex)</label><input id="genere" name="genere" defaultValue={p?.genere ?? ""} /></div>
      <div className="campo"><label htmlFor="materiale">Materiale (es. Pelle, Tessuto)</label><input id="materiale" name="materiale" defaultValue={p?.materiale ?? ""} /></div>
      <div className="campo"><label htmlFor="certificazione">Certificazione (es. CE livello 2, ECE 22.06)</label><input id="certificazione" name="certificazione" defaultValue={p?.certificazione ?? ""} /></div>
      <div className="campo"><label htmlFor="moto">Moto compatibili (facoltativo)</label><input id="moto" name="moto" defaultValue={p?.moto ?? ""} /></div>
      <div className="campo"><label htmlFor="specs">Caratteristiche tecniche (una per riga, «Nome: valore»)</label><textarea id="specs" name="specs" rows={4} defaultValue={((p?.specs as [string, string][] | null) ?? []).map(([k, v]) => `${k}: ${v}`).join("\n")} /></div>
      <fieldset className="campo"><legend>Stili</legend>{STILI.map((s) => <label key={s} style={{ marginInlineEnd: 14 }}><input type="checkbox" name="stili" value={s} defaultChecked={p?.stili.includes(s)} /> {s}</label>)}</fieldset>
      <div className="campo"><label htmlFor="prezzo">Prezzo (EGP)</label><input id="prezzo" name="prezzo" inputMode="decimal" defaultValue={p ? p.prezzo / 100 : ""} required /></div>
      <div className="campo"><label><input type="checkbox" name="trattabile" defaultChecked={p?.trattabile ?? false} /> Permetti al cliente di trattare il prezzo (solo prodotti nuovi)</label></div>
      <div className="campo"><label htmlFor="prezzoMinimo">Prezzo minimo accettato (EGP) — obbligatorio se la trattativa è attiva; il prezzo sopra è il massimo pubblicato</label><input id="prezzoMinimo" name="prezzoMinimo" inputMode="decimal" defaultValue={p?.prezzoMinimo ? p.prezzoMinimo / 100 : ""} /></div>
      <div className="campo"><label htmlFor="prezzoPrima">Prezzo di prima (EGP, solo se in offerta)</label><input id="prezzoPrima" name="prezzoPrima" inputMode="decimal" defaultValue={p?.prezzoPrima ? p.prezzoPrima / 100 : ""} /></div>
      <div className="campo"><label htmlFor="taglie">Taglie e pezzi</label><input id="taglie" name="taglie" placeholder="S:3, M:6, L:4" defaultValue={taglie} required /></div>
      <div className="campo"><label htmlFor="descrizione">Descrizione (un paragrafo per riga)</label><textarea id="descrizione" name="descrizione" rows={5} defaultValue={p?.descrizione.join("\n")} /></div>
      <div className="campo"><label htmlFor="nota">Nota</label><input id="nota" name="nota" defaultValue={p?.nota} /></div>
      <div className="campo"><label htmlFor="luogo">Luogo (Second Life)</label><input id="luogo" name="luogo" defaultValue={p?.luogo} /></div>
      <div className="campo"><label htmlFor="grado">Grado (Second Life)</label><input id="grado" name="grado" defaultValue={p?.grado ?? ""} /></div>
      <div className="campo"><label htmlFor="foto">Aggiungi foto (JPG, PNG o WebP)</label><input id="foto" name="foto" type="file" accept="image/jpeg,image/png,image/webp" multiple /></div>
      <label className="campo" style={{ display: "block" }}><input type="checkbox" name="attivo" defaultChecked={p ? p.attivo : true} /> In vendita (togli la spunta per ritirarlo)</label>
      <button className="tasto salva-prodotto">Salva</button> <Link className="tasto vuoto" href="/operativo?tab=prodotti">Indietro</Link>
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
