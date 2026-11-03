"use client";
import { useEffect, useRef, useState } from "react";

type Voce = { href: string; testo: string; attiva?: boolean };
type Lingua = { href: string; testo: string; codice: string; attiva: boolean };

/** Menu da telefono: tre strisce → pannello scuro a tutto schermo con le voci, la ricerca e la lingua. */
export function MenuTelefono({ voci, lingue, azioneCerca, t }: {
  voci: Voce[]; lingue: Lingua[]; azioneCerca: string;
  t: { apri: string; chiudi: string; cerca: string; segnaposto: string; lingua: string; menu: string };
}) {
  const [aperto, setAperto] = useState(false);
  const chiudiRef = useRef<HTMLButtonElement>(null);
  const apriRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aperto) return;
    const prima = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    chiudiRef.current?.focus();
    const tasto = (e: KeyboardEvent) => { if (e.key === "Escape") setAperto(false); };
    window.addEventListener("keydown", tasto);
    return () => { document.body.style.overflow = prima; window.removeEventListener("keydown", tasto); apriRef.current?.focus(); };
  }, [aperto]);

  // tornando su un computer il pannello non deve restare aperto
  useEffect(() => {
    const m = window.matchMedia("(min-width: 861px)");
    const su = () => { if (m.matches) setAperto(false); };
    m.addEventListener("change", su);
    return () => m.removeEventListener("change", su);
  }, []);

  return (
    <>
      <button ref={apriRef} type="button" className="hamburger" aria-label={t.apri} aria-expanded={aperto} aria-controls="menu-telefono" onClick={() => setAperto(true)}>
        <span /><span /><span />
      </button>
      <div id="menu-telefono" className={"menu-tel" + (aperto ? " aperto" : "")} role="dialog" aria-modal="true" aria-label={t.menu}
        inert={!aperto}>
        <div className="menu-tel-testa">
          <span className="mono">{t.menu}</span>
          <button ref={chiudiRef} type="button" className="menu-tel-chiudi" aria-label={t.chiudi} onClick={() => setAperto(false)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg>
          </button>
        </div>
        <nav className="menu-tel-voci" aria-label={t.menu}>
          {voci.map((v, i) => (
            <a key={v.href} href={v.href} aria-current={v.attiva ? "page" : undefined} onClick={() => setAperto(false)} style={{ transitionDelay: aperto ? `${60 + i * 45}ms` : "0ms" }}>
              <span>{v.testo}</span>
            </a>
          ))}
        </nav>
        <form action={azioneCerca} method="get" className="menu-tel-cerca" role="search">
          <label htmlFor="menu-q" className="salta">{t.cerca}</label>
          <input id="menu-q" name="q" type="search" placeholder={t.segnaposto} autoComplete="off" />
        </form>
        <div className="menu-tel-lingue" role="group" aria-label={t.lingua}>
          {lingue.map((x) => <a key={x.codice} href={x.href} hrefLang={x.codice} lang={x.codice} aria-current={x.attiva ? "true" : undefined}>{x.testo}</a>)}
        </div>
      </div>
    </>
  );
}
