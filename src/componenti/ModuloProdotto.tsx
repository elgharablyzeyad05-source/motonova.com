"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { leggiAnnuncio } from "@/lib/vinted";
import { traduciFrasi } from "@/lib/glossario";
import { firmaDi, distanza, media, nomeDi, SOGLIA, type Firma } from "@/lib/colore-foto";

/* Modulo prodotto di /operativo, pensato per il telefono: si sceglie toccando, si scrive solo nome e prezzi.
   I nomi dei campi sono quelli che salvaProdottoAction già legge, così il server non cambia.
   Ogni testo visibile è in italiano e ha la sua voce in dati/operativo-lingua.json (EN e AR). */

export type Pezzo = { id: string; colore: string; taglia: string; prezzo: string; minimo: string; difetti: string; link: string; annuncio: string; costo: string; note: string };
export type DatiProdotto = {
  id?: string; tipo: "NUOVO" | "USATO" | "SECOND_LIFE"; nome: string; marca: string; categoria: string;
  prezzo: string; trattabile: boolean; prezzoMinimo: string; taglie: { taglia: string; n: number }[]; pezzi: Pezzo[];
  partenza: string; riserva: string; astaEsiste: boolean; descrizione: string; attivo: boolean;
  sottotitolo: string; sottocategoria: string; colore: string; genere: string; materiale: string; certificazione: string; moto: string;
  specs: string; stili: string[]; prezzoPrima: string; nota: string; luogo: string; edizione: string;
  fonteUrl: string; costo: string; difetti: string; noteInterne: string; grado: string;
  foto: { id: string; url: string; colore: string; principale: boolean }[];
  stock: { colore: string; taglia: string; n: number }[]; // magazzino del nuovo per colore e taglia
};
type Gruppo = { k: string; nome: string; origine: string | null; qta: Record<string, number> };
type FotoM = { k: string; id?: string; file?: File; url: string; gruppo: string; main: boolean; firma: Firma | null; via?: boolean };
let seq = 0; const chiave = () => "g" + ++seq + Math.random().toString(36).slice(2, 6);
type Props = { azione: (f: FormData) => void; sposta?: (vid: string, f: FormData) => void; dati: DatiProdotto; categorie: [string, string][]; marche: string[]; modelli: string[] };

const LETTERE = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
const SCARPE = ["38", "39", "40", "41", "42", "43", "44", "45", "46", "47"];
const UNICA = "ONE SIZE";
const tagliePer = (cat: string) => (cat === "stivali" ? SCARPE : cat === "accessori" || cat === "manutenzione" ? [UNICA] : LETTERE);
const STILI = ["sport", "street", "adventure", "touring", "urban"];
const GENERI = ["Uomo", "Donna", "Unisex"];
const DURATE = [3, 5, 7, 10];
const vuoto = (): Pezzo => ({ id: "", colore: "", taglia: "", prezzo: "", minimo: "", difetti: "", link: "", annuncio: "", costo: "", note: "" });

export default function ModuloProdotto({ azione, sposta, dati, categorie, marche, modelli }: Props) {
  const [tipo, setTipo] = useState(dati.tipo);
  const [cat, setCat] = useState(dati.categoria);
  const [marca, setMarca] = useState(dati.marca);
  const [trattabile, setTrattabile] = useState(dati.trattabile);
  // Colori: uno per colorazione. Nel nuovo ogni colore ha il suo magazzino per taglia.
  const [gruppi, setGruppi] = useState<Gruppo[]>(() => {
    const nomi = [...new Set([...dati.foto.map((f) => f.colore), ...dati.stock.map((s) => s.colore)])];
    if (!nomi.length) nomi.push("");
    return nomi.map((n) => ({ k: chiave(), nome: n, origine: n, qta: Object.fromEntries(dati.stock.filter((s) => s.colore === n).map((s) => [s.taglia, s.n])) }));
  });
  const [extra, setExtra] = useState<string[]>(() => [...dati.stock.map((t) => t.taglia), ...dati.taglie.map((t) => t.taglia)]);
  const [nuovaTaglia, setNuovaTaglia] = useState("");
  const [tagliaAsta, setTagliaAsta] = useState(dati.tipo === "SECOND_LIFE" ? dati.taglie[0]?.taglia ?? "" : "");
  const [pezzi, setPezzi] = useState<Pezzo[]>(() => (dati.pezzi.length ? dati.pezzi : [vuoto()]));
  const [tolti, setTolti] = useState<string[]>([]);
  const [giorni, setGiorni] = useState(7);
  const [foto, setFoto] = useState<FotoM[]>(() => dati.foto.map((f) => ({ k: chiave(), id: f.id, url: f.url, gruppo: "", main: f.principale, firma: null, colore: f.colore }) as FotoM & { colore: string }));
  const [errore, setErrore] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Le taglie proposte dipendono dalla categoria; quelle già salvate fuori elenco restano visibili.
  const proposte = useMemo(() => { const b = tagliePer(cat); return [...b, ...extra.filter((t) => !b.includes(t))]; }, [cat, extra]);
  // Le foto salvate entrano nel gruppo del loro colore; poi ne calcolo la firma per riconoscere quelle nuove.
  useEffect(() => {
    setFoto((fs) => fs.map((f) => (f.gruppo ? f : { ...f, gruppo: gruppi.find((g) => g.origine === (f as FotoM & { colore?: string }).colore)?.k ?? gruppi[0].k })));
    dati.foto.forEach((d) => firmaDi(d.url).then((firma) => setFoto((fs) => fs.map((f) => (f.id === d.id ? { ...f, firma } : f)))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const salvate = useMemo(() => new Set(dati.stock.map((t) => `${t.colore}|${t.taglia}`)), [dati.stock]);
  // Le combinazioni già salvate restano anche a zero, così il server azzera il magazzino invece di ignorarle.
  const stock = gruppi.flatMap((g) => Object.entries(g.qta).filter(([t, n]) => n > 0 || salvate.has(`${g.origine}|${t}`)).map(([t, n]) => ({ colore: g.nome.trim(), taglia: t, n })));
  const totalePezzi = stock.reduce((a, x) => a + x.n, 0);
  const vive = foto.filter((f) => !f.via);
  const nuove = vive.filter((f) => f.file);

  // Le foto del telefono pesano 3–6 MB e Vercel accetta ~4 MB a salvataggio: le rimpicciolisco qui a 1800 px
  // (il sito ne usa al massimo 1600), così se ne caricano molte insieme senza perdere qualità visibile.
  const [lavoro, setLavoro] = useState(false);
  const aggiungiFoto = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setLavoro(true);
    const files = await Promise.all(Array.from(lista).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)).map(riduci));
    const arrivate: FotoM[] = await Promise.all(files.map(async (file) => ({ k: chiave(), file, url: URL.createObjectURL(file), gruppo: "", main: false, firma: await firmaDi(file) })));
    // Riconosco la colorazione: ogni foto va nel colore con l'aspetto più vicino, altrimenti apre un colore nuovo.
    let gs = [...gruppi]; let tutte = [...foto];
    for (const f of arrivate) {
      const centri = gs.map((g) => { const fs = tutte.filter((x) => !x.via && x.gruppo === g.k && x.firma).map((x) => x.firma!); return fs.length ? { g, d: f.firma ? distanza(f.firma, media(fs)) : 9 } : null; }).filter(Boolean) as { g: Gruppo; d: number }[];
      const vicino = centri.sort((a, b) => a.d - b.d)[0];
      let g = vicino && vicino.d < SOGLIA ? vicino.g : undefined;
      if (!g) {
        const libero = gs.find((x) => !tutte.some((y) => !y.via && y.gruppo === x.k) && !x.nome);
        const base = f.firma ? nomeDi(f.firma) : "";
        let nome = base, i = 2; while (nome && gs.some((x) => x.nome === nome)) nome = `${base} ${i++}`;
        if (libero) { g = { ...libero, nome: libero.nome || nome }; gs = gs.map((x) => (x.k === libero.k ? g! : x)); }
        else { g = { k: chiave(), nome, origine: null, qta: {} }; gs = [...gs, g]; }
      }
      const haMain = tutte.some((x) => !x.via && x.gruppo === g!.k && x.main);
      tutte = [...tutte, { ...f, gruppo: g.k, main: !haMain }];
    }
    // Vercel accetta ~4 MB a salvataggio: le foto oltre restano fuori e lo dico.
    let peso = 0; const scartate = new Set<string>();
    for (const f of tutte.filter((x) => x.file && !x.via)) { if (peso + f.file!.size > 3.8 * 1024 * 1024) scartate.add(f.k); else peso += f.file!.size; }
    if (scartate.size) { setErrore("Troppe foto in una volta: salva queste, poi aggiungi le altre"); tutte = tutte.filter((x) => !scartate.has(x.k)); }
    setGruppi(gs); setFoto(tutte); sincronizza(tutte); setLavoro(false);
  };
  const sincronizza = (tutte: FotoM[]) => { const dt = new DataTransfer(); tutte.filter((f) => f.file && !f.via).forEach((f) => dt.items.add(f.file!)); if (fileRef.current) fileRef.current.files = dt.files; };
  const aggiornaFoto = (fn: (fs: FotoM[]) => FotoM[]) => setFoto((fs) => { const n = fn(fs); sincronizza(n); return n; });
  const principale = (f: FotoM) => aggiornaFoto((fs) => fs.map((x) => (x.gruppo === f.gruppo ? { ...x, main: x.k === f.k } : x)));
  const togliFoto = (f: FotoM) => aggiornaFoto((fs) => {
    const n = f.file ? fs.filter((x) => x.k !== f.k) : fs.map((x) => (x.k === f.k ? { ...x, via: true, main: false } : x));
    if (f.main) { const altra = n.find((x) => !x.via && x.gruppo === f.gruppo); if (altra) return n.map((x) => (x.k === altra.k ? { ...x, main: true } : x)); }
    return n;
  });
  const spostaFoto = (f: FotoM, dest: string) => {
    let k = dest;
    if (dest === "+") { const g = { k: chiave(), nome: "", origine: null, qta: {} }; setGruppi((gs) => [...gs, g]); k = g.k; }
    aggiornaFoto((fs) => {
      const haMain = fs.some((x) => !x.via && x.gruppo === k && x.main && x.k !== f.k);
      let n = fs.map((x) => (x.k === f.k ? { ...x, gruppo: k, main: !haMain } : x));
      if (f.main) { const altra = n.find((x) => !x.via && x.gruppo === f.gruppo); if (altra) n = n.map((x) => (x.k === altra.k ? { ...x, main: true } : x)); }
      return n;
    });
  };
  const gruppo = (k: string, d: Partial<Gruppo>) => setGruppi((gs) => gs.map((g) => (g.k === k ? { ...g, ...d } : g)));
  const togliGruppo = (k: string) => setGruppi((gs) => (gs.length > 1 ? gs.filter((g) => g.k !== k) : gs));

  const cambia = (g: Gruppo, t: string, d: number) => gruppo(g.k, { qta: { ...g.qta, [t]: Math.max(0, Math.min(999, (g.qta[t] ?? 0) + d)) } });
  const aggiungiTaglia = () => { const t = nuovaTaglia.trim().toUpperCase(); if (!t) return; if (!proposte.includes(t)) setExtra((e) => [...e, t]); setNuovaTaglia(""); };
  const pezzo = (i: number, k: keyof Pezzo, v: string) => setPezzi((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const togliPezzo = (i: number) => { const p = pezzi[i]; if (p.id) setTolti((t) => [...t, p.id]); setPezzi((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : [vuoto()])); };

  // Scrivendo «AGV K1 S» nel nome, marca e categoria si scelgono da sole (e il nome si accorcia a «K1 S»).
  const riconosci = (el: HTMLInputElement) => {
    const v = el.value.trim(); if (v.length < 3) return;
    const r = leggiAnnuncio(`${marca} ${v}`, cat || undefined);
    if (!r.modello || !r.marca) return;
    if (!marca) setMarca(r.marca);
    if (!cat && r.categoria) setCat(r.categoria);
    if (r.nome && v.toLowerCase().startsWith(r.marca.toLowerCase())) el.value = v.slice(r.marca.length).trim();
  };

  const controlla = (e: React.FormEvent<HTMLFormElement>) => {
    if ((e.nativeEvent as SubmitEvent).submitter?.hasAttribute("data-sposta")) return; // lo spostamento non chiede il modulo completo
    const f = new FormData(e.currentTarget);
    const num = (k: string) => Number(String(f.get(k) ?? "").replace(",", "."));
    let msg = "";
    if (String(f.get("nome") ?? "").trim().length < 3) msg = "Scrivi il nome del prodotto";
    else if (!marca.trim()) msg = "Scegli o scrivi la marca";
    else if (!cat) msg = "Scegli la categoria";
    else if (tipo === "NUOVO" && !(num("prezzo") > 0)) msg = "Scrivi il prezzo";
    else if (tipo === "NUOVO" && trattabile && !(num("prezzoMinimo") > 0 && num("prezzoMinimo") <= num("prezzo"))) msg = "Scrivi il prezzo minimo: più di zero e non sopra il prezzo";
    else if (tipo === "NUOVO" && !totalePezzi && !stock.length) msg = "Indica quanti pezzi hai per almeno una taglia";
    else if (gruppi.length > 1 && gruppi.some((g) => !g.nome.trim() && (vive.some((f) => f.gruppo === g.k) || Object.values(g.qta).some((n) => n > 0)))) msg = "Dai un nome a ogni colore";
    else if (new Set(gruppi.map((g) => g.nome.trim().toLowerCase())).size < gruppi.length) msg = "Due colori hanno lo stesso nome";
    else if (tipo === "SECOND_LIFE" && !(num("partenza") > 0)) msg = "Scrivi il prezzo di partenza";
    else if (tipo === "SECOND_LIFE" && !tagliaAsta) msg = "Scegli la taglia del pezzo";
    else if (tipo === "USATO" && !pezzi.some((p) => p.taglia)) msg = "Scegli la taglia di almeno un pezzo";
    else if (tipo === "USATO" && pezzi.some((p) => p.taglia && p.minimo && p.prezzo && Number(p.minimo) > Number(p.prezzo))) msg = "Il minimo di un pezzo supera il suo prezzo";
    if (msg) { e.preventDefault(); setErrore(msg); requestAnimationFrame(() => document.getElementById("mp-errore")?.scrollIntoView({ block: "center", behavior: "smooth" })); }
    else setErrore("");
  };

  const titolo = dati.id ? "Modifica prodotto" : tipo === "SECOND_LIFE" ? "Nuova asta" : "Nuovo prodotto";
  const salva = dati.id ? "Salva modifiche" : tipo === "SECOND_LIFE" ? "Apri l'asta" : "Pubblica";

  return (
    <form ref={formRef} action={azione} onSubmit={controlla} encType="multipart/form-data" className="mp" noValidate>
      {dati.id && <input type="hidden" name="id" value={dati.id} />}
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="categoria" value={cat} />
      <input type="hidden" name="taglie" value={tipo === "SECOND_LIFE" ? (tagliaAsta ? `${tagliaAsta}:1` : "") : ""} />
      {tipo === "NUOVO" && <input type="hidden" name="stock" value={JSON.stringify(stock)} />}
      <input type="hidden" name="colori" value={JSON.stringify(gruppi.map((g) => ({ nome: g.nome.trim(), prima: g.origine })))} />
      {nuove.map((f) => <span key={f.k}><input type="hidden" name="foto_colore" value={gruppi.find((g) => g.k === f.gruppo)?.nome.trim() ?? ""} /><input type="hidden" name="foto_main" value={f.main ? "1" : ""} /></span>)}
      {foto.filter((f) => f.id).map((f) => <span key={f.k}><input type="hidden" name="fe_id" value={f.id} /><input type="hidden" name="fe_colore" value={gruppi.find((g) => g.k === f.gruppo)?.nome.trim() ?? ""} /><input type="hidden" name="fe_main" value={f.main ? "1" : ""} /><input type="hidden" name="fe_via" value={f.via ? "1" : ""} /></span>)}
      <input type="hidden" name="trattabile" value={tipo === "NUOVO" && trattabile ? "on" : ""} />
      <h2 className="mp-titolo">{titolo}</h2>

      {/* 1 — tipo */}
      <section className="mp-blocco">
        <h3><span>1</span>Come lo vendi?</h3>
        <div className="mp-tipi" role="radiogroup">
          {([["NUOVO", "Nuovo", "Più pezzi e taglie"], ["USATO", "Usato", "Pezzi unici, prezzo trattabile"], ["SECOND_LIFE", "Asta", "Un solo pezzo, offerte a tempo"]] as const).map(([v, n, s]) => (
            <button key={v} type="button" role="radio" aria-checked={tipo === v} disabled={Boolean(dati.id) && dati.tipo !== v} className={tipo === v ? "si" : ""} onClick={() => setTipo(v)}><b>{n}</b><small>{s}</small></button>
          ))}
        </div>
      </section>

      {/* 2 — categoria */}
      <section className="mp-blocco">
        <h3><span>2</span>Categoria</h3>
        <div className="mp-chip">
          {categorie.map(([k, n]) => <button key={k} type="button" aria-pressed={cat === k} className={cat === k ? "si" : ""} onClick={() => setCat(k)}>{n}</button>)}
        </div>
      </section>

      {/* 3 — foto e colori */}
      <section className="mp-blocco">
        <h3><span>3</span>{tipo === "NUOVO" ? "Foto, colori e pezzi" : "Foto e colori"}</h3>
        <label className="mp-foto" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); aggiungiFoto(e.dataTransfer.files); }}>
          <input ref={fileRef} type="file" name="foto" accept="image/*" multiple onChange={(e) => { aggiungiFoto(e.target.files); }} />
          <b>{lavoro ? "Preparo le foto…" : "+ Aggiungi foto"}</b><small>Anche di più colori insieme: le divido io per colore. Tocca una foto per farla principale (quella a 3/4 verso destra).</small>
        </label>
        {gruppi.map((g) => { const fs = vive.filter((f) => f.gruppo === g.k); return (
          <div key={g.k} className="mp-colore">
            <div className="mp-colore-testa">
              <input value={g.nome} onChange={(e) => gruppo(g.k, { nome: e.target.value })} placeholder={gruppi.length > 1 ? "Nome del colore" : "Colore (facoltativo)"} aria-label="Nome del colore" list="mp-nomi-colore" />
              {gruppi.length > 1 && !fs.length && !g.origine && <button type="button" className="mp-togli" onClick={() => togliGruppo(g.k)}>Togli</button>}
            </div>
            <Anteprima testo={g.nome} />
            {fs.length > 0 && <div className="mp-anteprime">{fs.map((f) => (
              <figure key={f.k} className={f.main ? "main" : ""}>
                {/* eslint-disable-next-line @next/next/no-img-element */}<img src={f.url} alt="" onClick={() => principale(f)} />
                <button type="button" aria-label="Togli" onClick={() => togliFoto(f)}>×</button>
                {f.main ? <figcaption>★ Principale</figcaption> : <figcaption className="tocca" onClick={() => principale(f)}>Rendi principale</figcaption>}
                {gruppi.length > 0 && <select aria-label="Sposta in un altro colore" value="" onChange={(e) => e.target.value && spostaFoto(f, e.target.value)}>
                  <option value="">Sposta…</option>
                  {gruppi.filter((x) => x.k !== g.k).map((x) => <option key={x.k} value={x.k}>{x.nome || "Senza nome"}</option>)}
                  <option value="+">Nuovo colore</option>
                </select>}
              </figure>
            ))}</div>}
            {tipo === "NUOVO" && cat && <><p className="mp-etichetta">Pezzi per taglia</p><div className="mp-taglie">{proposte.map((t) => (
              <div key={t} className={"mp-taglia" + ((g.qta[t] ?? 0) > 0 ? " si" : "")}>
                <b dir="ltr">{t === UNICA ? "Taglia unica" : t}</b>
                <div><button type="button" aria-label="Meno" onClick={() => cambia(g, t, -1)}>−</button><output>{g.qta[t] ?? 0}</output><button type="button" aria-label="Più" onClick={() => cambia(g, t, 1)}>+</button></div>
              </div>
            ))}</div></>}
          </div>
        ); })}
        <datalist id="mp-nomi-colore">{["Nero", "Nero opaco", "Bianco", "Grigio", "Rosso", "Blu", "Giallo fluo", "Verde", "Arancione"].map((c) => <option key={c} value={c} />)}</datalist>
        <button type="button" className="tasto vuoto pieno" onClick={() => setGruppi((gs) => [...gs, { k: chiave(), nome: "", origine: null, qta: {} }])}>+ Aggiungi un colore</button>
        {tipo === "NUOVO" && !cat && <p className="tenue">Scegli prima la categoria.</p>}
        {tipo === "NUOVO" && cat && <div className="mp-altra"><input value={nuovaTaglia} onChange={(e) => setNuovaTaglia(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aggiungiTaglia(); } }} placeholder="Altra taglia" dir="ltr" /><button type="button" className="tasto piccolo vuoto" onClick={aggiungiTaglia}>+ Aggiungi</button></div>}
      </section>

      {/* 4 — nome e marca */}
      <section className="mp-blocco">
        <h3><span>4</span>Nome e marca</h3>
        <div className="campo"><label htmlFor="mp-nome">Nome del modello</label><input id="mp-nome" name="nome" defaultValue={dati.nome} onBlur={(e) => riconosci(e.target)} placeholder="es. AGV K1 S" autoComplete="off" /></div>
        <div className="mp-chip piccole">
          {marche.slice(0, 14).map((m) => <button key={m} type="button" aria-pressed={marca === m} className={marca === m ? "si" : ""} onClick={() => setMarca(m)} dir="ltr">{m}</button>)}
        </div>
        <div className="campo"><label htmlFor="mp-marca">Marca</label><input id="mp-marca" name="marca" list="mp-marche" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Tocca sopra o scrivi una marca nuova" autoComplete="off" /><datalist id="mp-marche">{marche.map((m) => <option key={m} value={m} />)}</datalist></div>
      </section>

      {/* 5 — prezzo e pezzi, diverso per tipo */}
      {tipo === "NUOVO" && <section className="mp-blocco">
        <h3><span>5</span>Prezzo</h3>
        <div className="campo"><label htmlFor="mp-prezzo">Prezzo (EGP)</label><input id="mp-prezzo" name="prezzo" inputMode="decimal" className="mp-grande" defaultValue={dati.prezzo} placeholder="0" /></div>
        <label className="mp-interruttore"><input type="checkbox" checked={trattabile} onChange={(e) => setTrattabile(e.target.checked)} /><span /> Il cliente può trattare</label>
        {trattabile && <div className="campo"><label htmlFor="mp-min">Minimo che accetti (EGP)</label><input id="mp-min" name="prezzoMinimo" inputMode="decimal" defaultValue={dati.prezzoMinimo} placeholder="0" /><small className="lieve">Il cliente vede solo il prezzo sopra.</small></div>}
      </section>}

      {tipo === "SECOND_LIFE" && <section className="mp-blocco">
        <h3><span>5</span>Asta</h3>
        <div className="mp-due">
          <div className="campo"><label htmlFor="mp-partenza">Prezzo di partenza (EGP)</label><input id="mp-partenza" name="partenza" inputMode="decimal" className="mp-grande" defaultValue={dati.partenza} placeholder="0" /></div>
          <div className="campo"><label htmlFor="mp-riserva">Riserva segreta (facoltativa)</label><input id="mp-riserva" name="riserva" inputMode="decimal" defaultValue={dati.riserva} placeholder="0" /></div>
        </div>
        <p className="mp-etichetta">Taglia del pezzo</p>
        {!cat ? <p className="tenue">Scegli prima la categoria.</p> : <div className="mp-chip">{proposte.map((t) => <button key={t} type="button" dir="ltr" className={tagliaAsta === t ? "si" : ""} aria-pressed={tagliaAsta === t} onClick={() => setTagliaAsta(t)}>{t === UNICA ? "Taglia unica" : t}</button>)}</div>}
        {dati.astaEsiste ? <p className="tenue">L&apos;asta di questo pezzo è già aperta: la segui nella scheda Aste.</p> : <>
          <p className="mp-etichetta">Durata</p>
          <input type="hidden" name="giorni" value={giorni} />
          <div className="mp-chip">{DURATE.map((d) => <button key={d} type="button" className={giorni === d ? "si" : ""} aria-pressed={giorni === d} onClick={() => setGiorni(d)}>{d} giorni</button>)}</div>
        </>}
        <details className="mp-piu"><summary>Condizioni e acquisto</summary>
          <div className="campo"><label htmlFor="mp-grado">Condizione (es. Come nuovo)</label><input id="mp-grado" name="grado" defaultValue={dati.grado} /></div>
          <div className="campo"><label htmlFor="mp-difetti">Difetti (li vede il cliente)</label><InputConAnteprima id="mp-difetti" name="difetti" iniziale={dati.difetti} /></div>
          <SoloPerTe dati={dati} />
        </details>
      </section>}

      {tipo === "USATO" && <section className="mp-blocco">
        <h3><span>5</span>Pezzi usati</h3>
        <p className="tenue mp-aiuto">Un riquadro per ogni pezzo. Il prezzo è trattabile: il cliente vede il prezzo, tu accetti fino al minimo.</p>
        {pezzi.map((z, i) => (
          <div className="mp-pezzo" key={z.id || "n" + i}>
            <div className="mp-pezzo-testa"><b>Pezzo {i + 1}</b><span>{z.id && sposta && <button data-sposta formAction={sposta.bind(null, z.id)} formNoValidate className="mp-sposta">È nuovo di zecca → sposta nel nuovo</button>}<button type="button" className="mp-togli" onClick={() => togliPezzo(i)}>Togli</button></span></div>
            <input type="hidden" name="pz_id" value={z.id} />
            <input type="hidden" name="pz_taglia" value={z.taglia} />
            <p className="mp-etichetta">Taglia</p>
            {!cat ? <p className="tenue">Scegli prima la categoria.</p> : <div className="mp-chip piccole">{[...proposte, ...(z.taglia && !proposte.includes(z.taglia) ? [z.taglia] : [])].map((t) => <button key={t} type="button" dir="ltr" className={z.taglia === t ? "si" : ""} aria-pressed={z.taglia === t} onClick={() => pezzo(i, "taglia", t)}>{t === UNICA ? "Taglia unica" : t}</button>)}</div>}
            <div className="mp-due">
              <div className="campo"><label>Prezzo (EGP)</label><input name="pz_prezzo" inputMode="decimal" value={z.prezzo} onChange={(e) => pezzo(i, "prezzo", e.target.value)} placeholder="0" /></div>
              <div className="campo"><label>Minimo (EGP)</label><input name="pz_minimo" inputMode="decimal" value={z.minimo} onChange={(e) => pezzo(i, "minimo", e.target.value)} placeholder="0" /></div>
            </div>
            <details className="mp-piu"><summary>{z.colore || z.difetti ? `${[z.colore, z.difetti && "difetti"].filter(Boolean).join(" · ")} — ` : ""}Colore, difetti, acquisto</summary>
              <div className="campo"><label>Colore</label><input name="pz_colore" list="mp-gruppi" value={z.colore} onChange={(e) => pezzo(i, "colore", e.target.value)} placeholder="es. Nero lucido" /></div>
              <div className="campo"><label>Difetti (li vede il cliente)</label><input name="pz_difetti" value={z.difetti} onChange={(e) => pezzo(i, "difetti", e.target.value)} placeholder="Nessuno" /><Anteprima testo={z.difetti} /></div>
              <p className="mp-etichetta">Solo per te</p>
              <div className="campo"><label>Link annuncio Vinted</label><input name="pz_link" type="url" dir="ltr" value={z.link} onChange={(e) => pezzo(i, "link", e.target.value)} placeholder="https://www.vinted.it/items/…" /></div>
              <div className="mp-due">
                <div className="campo"><label>Prezzo annuncio</label><input name="pz_annuncio" value={z.annuncio} onChange={(e) => pezzo(i, "annuncio", e.target.value)} placeholder="130 €" /></div>
                <div className="campo"><label>Costo acquisto (EGP)</label><input name="pz_costo" inputMode="decimal" value={z.costo} onChange={(e) => pezzo(i, "costo", e.target.value)} placeholder="0" /></div>
              </div>
              <div className="campo"><label>Note interne</label><input name="pz_note" value={z.note} onChange={(e) => pezzo(i, "note", e.target.value)} /></div>
            </details>
          </div>
        ))}
        {/* I pezzi tolti vanno dopo quelli completi: il server legge i campi per posizione. */}
        {tolti.map((id) => <span key={id}><input type="hidden" name="pz_id" value={id} /><input type="hidden" name="pz_taglia" value="" /></span>)}
        <datalist id="mp-gruppi">{gruppi.filter((g) => g.nome.trim()).map((g) => <option key={g.k} value={g.nome.trim()} />)}</datalist>
        <button type="button" className="tasto vuoto pieno" onClick={() => setPezzi((ps) => [...ps, vuoto()])}>+ Aggiungi un altro pezzo</button>
      </section>}

      <label className="mp-interruttore mp-visibile"><input type="checkbox" name="attivo" defaultChecked={dati.attivo} /><span /> Visibile sul sito</label>

      <details className="mp-piu mp-blocco">
        <summary>Altri dettagli (facoltativi)</summary>
        <div className="campo"><label htmlFor="mp-descr">Descrizione</label><InputConAnteprima id="mp-descr" name="descrizione" iniziale={dati.descrizione} area placeholder="Frasi brevi e semplici: si traducono da sole (es. «Come nuovo. Graffi leggeri sulla visiera»)." /></div>
        <div className="campo"><label htmlFor="mp-sotto">Modello per il filtro Usato (es. AGV K1 S)</label><input id="mp-sotto" name="sottocategoria" list="mp-modelli" defaultValue={dati.sottocategoria} /><datalist id="mp-modelli">{[...new Set(modelli)].map((m) => <option key={m} value={m} />)}</datalist></div>
        <div className="campo"><label htmlFor="mp-sottotitolo">Sottotitolo</label><input id="mp-sottotitolo" name="sottotitolo" defaultValue={dati.sottotitolo} /></div>
        <div className="mp-due">
          <div className="campo"><label htmlFor="mp-colore">Colore</label><input id="mp-colore" name="colore" defaultValue={dati.colore} /></div>
          <div className="campo"><label htmlFor="mp-materiale">Materiale</label><input id="mp-materiale" name="materiale" defaultValue={dati.materiale} placeholder="Pelle, Tessuto…" /></div>
        </div>
        <Scelta nome="genere" titolo="Per chi" opzioni={GENERI.map((g) => [g, g])} iniziale={dati.genere} />
        <Scelta nome="edizione" titolo="Edizione premium" opzioni={[["", "Nessuna"], ["limited", "Limited edition"], ["special", "Special edition"]]} iniziale={dati.edizione} />
        <fieldset className="campo mp-fs"><legend>Stile di guida</legend><div className="mp-chip piccole">{STILI.map((s) => <label key={s} className="mp-spunta"><input type="checkbox" name="stili" value={s} defaultChecked={dati.stili.includes(s)} /><span>{s[0].toUpperCase() + s.slice(1)}</span></label>)}</div></fieldset>
        <div className="campo"><label htmlFor="mp-cert">Certificazione (es. ECE 22.06, CE livello 2)</label><input id="mp-cert" name="certificazione" defaultValue={dati.certificazione} /></div>
        <div className="campo"><label htmlFor="mp-specs">Caratteristiche tecniche (una per riga, «Nome: valore»)</label><textarea id="mp-specs" name="specs" rows={3} defaultValue={dati.specs} /></div>
        {tipo === "NUOVO" && <div className="campo"><label htmlFor="mp-prima">Prezzo di prima (solo se in offerta)</label><input id="mp-prima" name="prezzoPrima" inputMode="decimal" defaultValue={dati.prezzoPrima} /></div>}
        <div className="campo"><label htmlFor="mp-moto">Moto compatibili</label><input id="mp-moto" name="moto" defaultValue={dati.moto} /></div>
        <div className="mp-due">
          <div className="campo"><label htmlFor="mp-nota">Nota breve</label><input id="mp-nota" name="nota" defaultValue={dati.nota} /></div>
          <div className="campo"><label htmlFor="mp-luogo">Origine</label><input id="mp-luogo" name="luogo" defaultValue={dati.luogo} /></div>
        </div>
        {tipo === "NUOVO" && <SoloPerTe dati={dati} />}
        {tipo === "USATO" && <><input type="hidden" name="fonteUrl" value={dati.fonteUrl} /><input type="hidden" name="costo" value={dati.costo} /><input type="hidden" name="noteInterne" value={dati.noteInterne} /><input type="hidden" name="difetti" value={dati.difetti} /><input type="hidden" name="grado" value={dati.grado} /></>}
        {tipo === "NUOVO" && <><input type="hidden" name="difetti" value={dati.difetti} /><input type="hidden" name="grado" value={dati.grado} /></>}
      </details>

      {errore && <p id="mp-errore" className="nota" role="alert"><b>{errore}</b></p>}
      <div className="mp-salva"><button className="tasto">{salva}</button><a className="tasto vuoto" href="/operativo?tab=prodotti">Indietro</a></div>
    </form>
  );
}

/** Sotto i testi che vede il cliente: come appariranno in italiano, inglese e arabo. Se una parte non si traduce, lo dice. */
function Anteprima({ testo }: { testo: string }) {
  const [lin, setLin] = useState<"it" | "en" | "ar">("it");
  useEffect(() => setLin(lingua()), []);
  if (!testo.trim()) return null;
  const r = { it: traduciFrasi(testo, "it"), en: traduciFrasi(testo, "en"), ar: traduciFrasi(testo, "ar") };
  const ok = r.en.tutto && r.ar.tutto;
  return <div className={"mp-anteprima" + (ok ? "" : " ko")} data-no-tr>
    <span dir="ltr">IT · {r.it.testo}</span><span dir="ltr">EN · {r.en.testo}</span><span dir="rtl">AR · {r.ar.testo}</span>
    {!ok && <b>{AVVISO[lin]}</b>}
  </div>;
}
// L'avviso è nella lingua del pannello (l'anteprima è esclusa dal traduttore automatico).
const AVVISO = { it: "Una parte resta come l'hai scritta: usa parole più semplici", en: "Part of it stays as written: use simpler words", ar: "جزء هيفضل زي ما كتبته: استخدم كلام أبسط" };
const lingua = (): "it" | "en" | "ar" => { try { const m = document.cookie.match(/(?:^|; )op_l=(it|en|ar)/); return (m?.[1] as "it" | "en" | "ar") ?? "it"; } catch { return "it"; } };

function InputConAnteprima({ id, name, iniziale, area, placeholder }: { id: string; name: string; iniziale: string; area?: boolean; placeholder?: string }) {
  const [v, setV] = useState(iniziale);
  return <>{area ? <textarea id={id} name={name} rows={4} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} /> : <input id={id} name={name} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} />}<Anteprima testo={v} /></>;
}

function SoloPerTe({ dati }: { dati: DatiProdotto }) {
  return <>
    <p className="mp-etichetta">Solo per te</p>
    <div className="campo"><label htmlFor="mp-fonte">Link annuncio Vinted</label><input id="mp-fonte" name="fonteUrl" type="url" dir="ltr" defaultValue={dati.fonteUrl} /></div>
    <div className="campo"><label htmlFor="mp-costo">Costo acquisto (EGP)</label><input id="mp-costo" name="costo" inputMode="decimal" defaultValue={dati.costo} /></div>
    <div className="campo"><label htmlFor="mp-note">Note interne</label><input id="mp-note" name="noteInterne" defaultValue={dati.noteInterne} /></div>
  </>;
}

function Scelta({ nome, titolo, opzioni, iniziale }: { nome: string; titolo: string; opzioni: [string, string][]; iniziale: string }) {
  const [v, setV] = useState(iniziale);
  return <fieldset className="campo mp-fs"><legend>{titolo}</legend><input type="hidden" name={nome} value={v} />
    <div className="mp-chip piccole">{opzioni.map(([k, n]) => <button key={k || "nessuna"} type="button" className={v === k ? "si" : ""} aria-pressed={v === k} onClick={() => setV(v === k && k ? "" : k)}>{n}</button>)}</div>
  </fieldset>;
}

async function riduci(f: File): Promise<File> {
  try {
    const img = await createImageBitmap(f, { imageOrientation: "from-image" });
    const k = Math.min(1, 1800 / Math.max(img.width, img.height));
    if (k === 1 && f.size < 900 * 1024 && /jpeg|png|webp/.test(f.type)) { img.close(); return f; }
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); img.close();
    const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
    return b ? new File([b], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : f;
  } catch { return f; }
}
