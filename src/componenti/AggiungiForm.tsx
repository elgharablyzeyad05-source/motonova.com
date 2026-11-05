"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aggiungiAlCarrello, offriPrezzo } from "@/app/azioni";

type V = { id: string; colore: string; difetti: string; taglia: string; disponibile: number; misura?: string };

export function AggiungiForm({ varianti, testi, iniziale, checkout, trattabile, altreOpzioni }: {
  varianti: V[]; iniziale: string; checkout: string; trattabile?: boolean; altreOpzioni: string;
  testi: { aggiungi: string; aggiunto: string; esaurito: string; taglia: string; ultimi: string; disp: string; dispOk: string; acquista: string; offri: string; offertaEtichetta: string; offertaInvia: string; offertaOk: string; offertaVai: string; pezzi: string; restanti: string; colore: string; dispN: string; budget: string; budgetInvia: string; basso1: string; basso2: string; alza: string; altre: string; chat: string; difetti: string };
}) {
  const colori = Array.from(new Set(varianti.map((x) => x.colore).filter(Boolean)));
  const [colore, setColore] = useState("");
  const [scelta, setScelta] = useState(colori.length ? "" : iniziale);
  const [fallimenti, setFallimenti] = useState(0);
  const visibili = colori.length ? varianti.filter((x) => x.colore === colore) : varianti;
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [inCorso, avvia] = useTransition();
  const router = useRouter();
  const [offerta, setOfferta] = useState("");
  const [qOfferta, setQOfferta] = useState("1");
  const [esitoOfferta, setEsitoOfferta] = useState<{ ok: boolean; testo: string } | null>(null);
  const v = varianti.find((x) => x.id === scelta);
  const nessuna = varianti.every((x) => x.disponibile <= 0);

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!v || v.disponibile <= 0) return;
      setMessaggio(null);
      avvia(async () => {
        const r = await aggiungiAlCarrello(v.id, 1);
        if (r.ok) {
          setPronto(true); setTimeout(() => setPronto(false), 1800);
          window.dispatchEvent(new CustomEvent("mn:aggiunto", { detail: { ...r, taglia: v.taglia } }));
        } else setMessaggio(r.messaggio);
      });
    }}>
      {colori.length > 0 && (
        <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
          <legend className="mono tenue" style={{ marginBottom: 8, padding: 0 }}>{testi.colore}</legend>
          <div className="taglie">
            {colori.map((c) => { const n = varianti.filter((x) => x.colore === c).reduce((a, x) => a + x.disponibile, 0); return (
              <label key={c}>
                <input type="radio" name="colore" value={c} checked={colore === c} disabled={n <= 0} onChange={() => { setColore(c); setScelta(""); setFallimenti(0); setEsitoOfferta(null); }} />
                <span className="t">{c}<small>{n <= 0 ? testi.esaurito : testi.dispN.replace("{n}", String(n))}</small></span>
              </label>
            ); })}
          </div>
        </fieldset>
      )}
      {(colori.length === 0 || colore) && <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
        <legend className="mono tenue" style={{ marginBottom: 8, padding: 0 }}>{testi.taglia}</legend>
        <div className="taglie">
          {visibili.map((x) => (
            <label key={x.id}>
              <input type="radio" name="variante" value={x.id} checked={scelta === x.id} disabled={x.disponibile <= 0} onChange={() => { setScelta(x.id); setFallimenti(0); setEsitoOfferta(null); }} />
              <span className="t">{x.taglia}<small>{x.misura ?? (x.disponibile <= 0 ? testi.esaurito : testi.dispN.replace("{n}", String(x.disponibile)))}</small></span>
            </label>
          ))}
        </div>
      </fieldset>}
      {v && v.difetti && <div className="nota" style={{ marginBottom: 14 }}><b>{testi.difetti}</b> — {v.difetti}</div>}
      {v && v.disponibile > 0 && <p className="mono lieve" style={{ marginBottom: 12 }}>{(v.disponibile <= 3 ? testi.disp.replace("{n}", String(v.disponibile)) : testi.dispOk)}</p>}
      <button type="submit" className="tasto pieno aggiungi-carrello" disabled={nessuna || !v || v.disponibile <= 0 || inCorso}>
        {nessuna ? testi.esaurito : pronto ? testi.aggiunto : testi.aggiungi}
      </button>
      <button type="button" className="tasto" style={{ width: "100%", marginTop: 10 }} disabled={nessuna || !v || v.disponibile <= 0 || inCorso}
        onClick={() => {
          if (!v || v.disponibile <= 0) return;
          setMessaggio(null);
          avvia(async () => {
            const r = await aggiungiAlCarrello(v.id, 1);
            if (r.ok) router.push(checkout); else setMessaggio(r.messaggio);
          });
        }}>{testi.acquista}</button>
      {trattabile && v && v.disponibile > 0 && (
        <div className="trattativa" style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--linea, #333)" }}>
          <label htmlFor="offerta" className="mono tenue" style={{ display: "block", marginBottom: 8 }}>{testi.budget}</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input aria-label={testi.pezzi} type="number" min={1} max={Math.min(20, v.disponibile)} value={qOfferta} onChange={(e) => setQOfferta(e.target.value)} dir="ltr" style={{ width: 64 }} />
            <input id="offerta" inputMode="decimal" value={offerta} onChange={(e) => setOfferta(e.target.value)} placeholder="EGP" dir="ltr" style={{ flex: 1, minWidth: 0 }} />
            <button type="button" className="tasto" disabled={inCorso || !offerta.trim()} onClick={() => {
              setEsitoOfferta(null);
              avvia(async () => {
                const r = await offriPrezzo(v.id, offerta, Number(qOfferta) || 1);
                if (r.ok) {
                  setEsitoOfferta({ ok: true, testo: testi.offertaOk.replace("{p}", String(r.prezzo / 100)).replace("{q}", `${r.quantita} ${testi.pezzi}`) });
                  window.dispatchEvent(new CustomEvent("mn:aggiunto", { detail: { ...r, taglia: v.taglia } }));
                } else {
                  const n = r.restanti === 0 ? 2 : fallimenti + 1; setFallimenti(n);
                  setEsitoOfferta({ ok: false, testo: r.restanti === undefined ? r.messaggio : (n < 2 ? testi.basso1 : testi.basso2) });
                }
              });
            }}>{testi.budgetInvia}</button>
          </div>
          {esitoOfferta && !esitoOfferta.ok && <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {fallimenti < 2 && <button type="button" className="tasto" onClick={() => { setEsitoOfferta(null); document.getElementById("offerta")?.focus(); }}>{testi.alza}</button>}
            <a className="tasto vuoto" href={altreOpzioni}>{testi.altre}</a>
            {fallimenti >= 2 && <button type="button" className="tasto pieno" onClick={() => window.dispatchEvent(new CustomEvent("mn:chat"))}>{testi.chat}</button>}
          </div>}
          {esitoOfferta && <p className={esitoOfferta.ok ? "nota ok" : "nota avviso"} role="status" style={{ marginTop: 12 }}>{esitoOfferta.testo}{esitoOfferta.ok && <> <a href={checkout.replace("/checkout", "/carrello")}>{testi.offertaVai}</a></>}</p>}
        </div>
      )}
      {messaggio && <p className="nota avviso" role="alert" style={{ marginTop: 12 }}>{messaggio}</p>}
    </form>
  );
}
