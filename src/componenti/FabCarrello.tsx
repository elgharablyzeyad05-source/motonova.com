"use client";
import { useEffect, useRef, useState } from "react";
import { egp } from "@/lib/regole";

type Dati = { marca: string; nome: string; taglia: string; prezzo: number; pezzi: number; totale: number };
const SVG = (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2.2l2.3 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21 8H6" /><circle cx="10" cy="20" r="1.3" /><circle cx="17.5" cy="20" r="1.3" /></svg>
);

/** Popup «aggiunto al carrello» che dopo 6 secondi si rimpicciolisce nel bottone tondo in basso:
 *  il bottone resta su ogni pagina finché il carrello ha qualcosa, e sparisce a carrello vuoto. */
export function FabCarrello({ pezziIniziali, href, etichette }: {
  pezziIniziali: number; href: string;
  etichette: { titolo: string; vai: string; continua: string; chiudi: string; pezzo: string; pezzi: string; carrello: string };
}) {
  const [pezzi, setPezzi] = useState(pezziIniziali);
  const [aperto, setAperto] = useState(false);
  const [verso, setVerso] = useState<{ x: number; y: number } | null>(null);
  const [dati, setDati] = useState<Dati | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pop = useRef<HTMLDivElement>(null);
  const fab = useRef<HTMLAnchorElement>(null);
  const finale = typeof window !== "undefined" && /\/(carrello|checkout)/.test(window.location.pathname);

  const nascondi = () => {
    clearTimeout(timer.current);
    if (pop.current && fab.current) {
      const p = pop.current.getBoundingClientRect(), f = fab.current.getBoundingClientRect();
      setVerso({ x: f.left + f.width / 2 - (p.left + p.width / 2), y: f.top + f.height / 2 - (p.top + p.height / 2) });
    }
    setAperto(false);
  };
  const avvia = () => { clearTimeout(timer.current); timer.current = setTimeout(nascondi, 6000); };

  useEffect(() => {
    const su = (e: Event) => {
      const d = (e as CustomEvent<Dati>).detail;
      setDati(d); setPezzi(d.pezzi); setVerso(null); setAperto(true); avvia();
    };
    window.addEventListener("mn:aggiunto", su);
    return () => { window.removeEventListener("mn:aggiunto", su); clearTimeout(timer.current); };
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && aperto) nascondi(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  });

  const stile = verso && !aperto ? ({ "--dx": `${verso.x}px`, "--dy": `${verso.y}px` } as React.CSSProperties) : undefined;
  return (
    <>
      <div ref={pop} className={"mc-pop" + (aperto ? " on" : "") + (verso && !aperto ? " verso-fab" : "")} style={stile} role="status" aria-live="polite"
        onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={avvia} aria-hidden={!aperto}>
        <div className="testa mono">{SVG}<span>{etichette.titolo}</span><button type="button" aria-label={etichette.chiudi} onClick={nascondi} tabIndex={aperto ? 0 : -1}>×</button></div>
        {dati && (
          <div className="corpo">
            <span className="mono lieve">{dati.marca}</span>
            <p style={{ fontWeight: 700 }}>{dati.nome}</p>
            <p className="mono lieve">{dati.taglia}</p>
            <p className="mono tab" style={{ marginTop: 8 }}>{dati.pezzi} {dati.pezzi === 1 ? etichette.pezzo : etichette.pezzi} · {egp(dati.totale)}</p>
          </div>
        )}
        <div className="azioni">
          <a className="tasto piccolo" href={href} tabIndex={aperto ? 0 : -1}>{etichette.vai}</a>
          <button type="button" className="tasto piccolo vuoto" onClick={nascondi} tabIndex={aperto ? 0 : -1}>{etichette.continua}</button>
        </div>
      </div>
      <a ref={fab} href={href} className={"mc-fab" + (pezzi > 0 && !aperto && !finale ? " on" : "")} aria-label={etichette.carrello} data-fab>
        {SVG}<span className="n">{pezzi}</span>
      </a>
    </>
  );
}
