"use client";
import { useEffect } from "react";

/** Pagine fisse: niente zoom con le dita né con il doppio tocco (iOS ignora user-scalable=no, quindi si blocca anche qui). */
export function BloccaZoom() {
  useEffect(() => {
    const ferma = (e: Event) => e.preventDefault();
    let ultimo = 0;
    const doppio = (e: TouchEvent) => { const t = Date.now(); if (t - ultimo < 320 && e.touches.length === 1) e.preventDefault(); ultimo = t; };
    const pinch = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    document.addEventListener("gesturestart", ferma);
    document.addEventListener("gesturechange", ferma);
    document.addEventListener("touchstart", doppio, { passive: false });
    document.addEventListener("touchmove", pinch, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", ferma);
      document.removeEventListener("gesturechange", ferma);
      document.removeEventListener("touchstart", doppio);
      document.removeEventListener("touchmove", pinch);
    };
  }, []);
  return null;
}
