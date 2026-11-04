"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Riga scorrevole: col dito scorre da sola; sul computer ci sono le frecce e si può trascinare col mouse. */
export function Carosello({ children, prec, succ, etichetta }: { children: React.ReactNode; prec: string; succ: string; etichetta: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [puo, setPuo] = useState({ indietro: false, avanti: false });
  const trascina = useRef({ giu: false, x: 0, sx: 0, mosso: false });

  const aggiorna = useCallback(() => {
    const el = ref.current; if (!el) return;
    const max = el.scrollWidth - el.clientWidth - 2;
    const pos = Math.abs(el.scrollLeft);
    setPuo({ indietro: pos > 2, avanti: pos < max });
  }, []);

  useEffect(() => {
    aggiorna();
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(aggiorna); ro.observe(el);
    return () => ro.disconnect();
  }, [aggiorna]);

  const vai = (verso: 1 | -1) => {
    const el = ref.current; if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: verso * (rtl ? -1 : 1) * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="caro">
      <div ref={ref} className="cat-scorri" role="list" aria-label={etichetta} onScroll={aggiorna}
        onMouseDown={(e) => { const el = ref.current!; trascina.current = { giu: true, x: e.clientX, sx: el.scrollLeft, mosso: false }; }}
        onMouseMove={(e) => {
          const t = trascina.current; if (!t.giu) return;
          const d = e.clientX - t.x;
          if (Math.abs(d) > 5) { t.mosso = true; ref.current!.classList.add("trascinando"); }
          if (t.mosso) ref.current!.scrollLeft = t.sx - d;
        }}
        onMouseUp={() => { trascina.current.giu = false; ref.current?.classList.remove("trascinando"); }}
        onMouseLeave={() => { trascina.current.giu = false; ref.current?.classList.remove("trascinando"); }}
        onClickCapture={(e) => { if (trascina.current.mosso) { e.preventDefault(); e.stopPropagation(); trascina.current.mosso = false; } }}
        onDragStart={(e) => e.preventDefault()}>
        {children}
      </div>
      <button type="button" className="caro-freccia indietro" aria-label={prec} onClick={() => vai(-1)} hidden={!puo.indietro}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <button type="button" className="caro-freccia avanti" aria-label={succ} onClick={() => vai(1)} hidden={!puo.avanti}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );
}
