"use client";
import { useEffect, useRef } from "react";
// @ts-expect-error — modulo JavaScript portato dal prototipo, senza tipi
import { avviaScena } from "./scena-hero.js";

/** Il fascio di traiettorie che si raccoglie nella stella del marchio. Solo canvas 2D, nessuna libreria:
 *  parte anche su connessioni lente. Si ferma quando esce di scena e quando la pagina è nascosta. */
export function ScenaHero({ children }: { children: React.ReactNode }) {
  const hero = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ferma = avviaScena(hero.current, canvas.current);
    return () => { if (typeof ferma === "function") ferma(); };
  }, []);
  return (
    <section className="hero-home" ref={hero}>
      <canvas ref={canvas} aria-hidden="true" className="hero-canvas" />
      <div className="hero-copy">{children}</div>
    </section>
  );
}
