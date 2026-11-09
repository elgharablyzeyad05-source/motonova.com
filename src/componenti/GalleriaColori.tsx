"use client";
import { useEffect, useState } from "react";
import { Cornice } from "./Sagoma";

/* Galleria della scheda prodotto divisa per colore. Senza colore scelto: grande la foto principale (3/4 destra)
   del primo colore, sotto le principali degli altri colori. Scelto un colore (qui o nel modulo d'acquisto):
   tutte e sole le foto di quel colore, principale per prima. */
type F = { grande: string; piccola: string; colore: string; principale: boolean };

export default function GalleriaColori({ foto, categoria, alt, statica, sopra }: { foto: F[]; categoria: string; alt: string; statica?: string; sopra?: React.ReactNode }) {
  const [colore, setColore] = useState("");
  const [vista, setVista] = useState(0);
  useEffect(() => {
    const h = (e: Event) => { setColore((e as CustomEvent<string>).detail ?? ""); setVista(0); };
    window.addEventListener("mn:colore", h);
    return () => window.removeEventListener("mn:colore", h);
  }, []);
  const colori = [...new Set(foto.map((f) => f.colore).filter(Boolean))];
  const delColore = foto.filter((f) => f.colore === colore);
  const elenco = colore && delColore.length ? delColore : colori.length > 1 ? colori.map((c) => foto.find((f) => f.colore === c && f.principale) ?? foto.find((f) => f.colore === c)!).concat(foto.filter((f) => !f.colore)) : foto;
  const sceltoPerColore = !(colore && delColore.length) && colori.length > 1;
  const grande = elenco[vista] ?? elenco[0];
  const tocca = (i: number) => {
    if (sceltoPerColore && elenco[i]?.colore) { window.dispatchEvent(new CustomEvent("mn:colore-scelto", { detail: elenco[i].colore })); setColore(elenco[i].colore); setVista(0); }
    else setVista(i);
  };
  return (
    <>
      <div style={{ position: "relative" }}>
        <Cornice foto={grande?.grande} statica={foto.length ? undefined : statica} categoria={categoria} alt={alt} grande>{sopra}</Cornice>
      </div>
      {elenco.length > 1 && (
        <div className="miniature">{elenco.map((f, i) => (
          <button key={f.piccola} type="button" className={"miniatura" + (f === grande ? " si" : "")} onClick={() => tocca(i)} aria-label={f.colore || `${alt} ${i + 1}`} title={f.colore || undefined}>
            <Cornice foto={f.piccola} categoria={categoria} alt="" />
          </button>
        ))}</div>
      )}
    </>
  );
}
