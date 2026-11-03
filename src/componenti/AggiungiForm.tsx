"use client";
import { useState, useTransition } from "react";
import { aggiungiAlCarrello } from "@/app/azioni";

type V = { id: string; taglia: string; disponibile: number; misura?: string };

export function AggiungiForm({ varianti, testi, iniziale }: {
  varianti: V[]; iniziale: string;
  testi: { aggiungi: string; aggiunto: string; esaurito: string; taglia: string; ultimi: string; disp: string; dispOk: string };
}) {
  const [scelta, setScelta] = useState(iniziale);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [inCorso, avvia] = useTransition();
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
      {messaggio && <p className="nota avviso" role="alert" style={{ marginTop: 12 }}>{messaggio}</p>}
    </form>
  );
}
