"use client";
import { useEffect, useState } from "react";

/** Freccia che riporta in cima: compare solo dopo aver scorso un po' e sparisce da sola tornando su. */
export function SuInAlto({ etichetta }: { etichetta: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const su = () => setOn(window.scrollY > 420);
    su();
    window.addEventListener("scroll", su, { passive: true });
    return () => window.removeEventListener("scroll", su);
  }, []);
  return (
    <button type="button" className={"su-in-alto" + (on ? " on" : "")} aria-label={etichetta} title={etichetta} tabIndex={on ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
    </button>
  );
}
