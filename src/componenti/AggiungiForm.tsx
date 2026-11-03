"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aggiungiAlCarrello, offriPrezzo } from "@/app/azioni";

type V = { id: string; taglia: string; disponibile: number; misura?: string };

export function AggiungiForm({ varianti, testi, iniziale, checkout, trattabile }: {
  varianti: V[]; iniziale: string; checkout: string; trattabile?: boolean;
  testi: { aggiungi: string; aggiunto: string; esaurito: string; taglia: string; ultimi: string; disp: string; dispOk: string; acquista: string; offri: string; offertaEtichetta: string; offertaInvia: string; offertaOk: string; offertaVai: string; restanti: string };
}) {
  const [scelta, setScelta] = useState(iniziale);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [inCorso, avvia] = useTransition();
  const router = useRouter();
  const [offerta, setOfferta] = useState("");
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
      <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
        <legend className="mono tenue" style={{ marginBottom: 8, padding: 0 }}>{testi.taglia}</legend>
        <div className="taglie">
          {varianti.map((x) => (
            <label key={x.id}>
              <input type="radio" name="variante" value={x.id} checked={scelta === x.id} disabled={x.disponibile <= 0} onChange={() => setScelta(x.id)} />
              <span className="t">{x.taglia}<small>{x.misura ?? (x.disponibile <= 0 ? testi.esaurito : x.disponibile <= 2 ? testi.ultimi.replace("{n}", String(x.disponibile)) : "")}</small></span>
            </label>
          ))}
        </div>
      </fieldset>
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
          <label htmlFor="offerta" className="mono tenue" style={{ display: "block", marginBottom: 8 }}>{testi.offertaEtichetta}</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="offerta" inputMode="decimal" value={offerta} onChange={(e) => setOfferta(e.target.value)} placeholder="EGP" dir="ltr" style={{ flex: 1, minWidth: 0 }} />
            <button type="button" className="tasto" disabled={inCorso || !offerta.trim()} onClick={() => {
              setEsitoOfferta(null);
              avvia(async () => {
                const r = await offriPrezzo(v.id, offerta);
                if (r.ok) {
                  setEsitoOfferta({ ok: true, testo: testi.offertaOk.replace("{p}", String(r.prezzo / 100)) });
                  window.dispatchEvent(new CustomEvent("mn:aggiunto", { detail: { ...r, taglia: v.taglia } }));
                } else setEsitoOfferta({ ok: false, testo: r.messaggio + (r.restanti ? " " + testi.restanti.replace("{n}", String(r.restanti)) : "") });
              });
            }}>{testi.offertaInvia}</button>
          </div>
          {esitoOfferta && <p className={esitoOfferta.ok ? "nota ok" : "nota avviso"} role="status" style={{ marginTop: 12 }}>{esitoOfferta.testo}{esitoOfferta.ok && <> <a href={checkout.replace("/checkout", "/carrello")}>{testi.offertaVai}</a></>}</p>}
        </div>
      )}
      {messaggio && <p className="nota avviso" role="alert" style={{ marginTop: 12 }}>{messaggio}</p>}
    </form>
  );
}
