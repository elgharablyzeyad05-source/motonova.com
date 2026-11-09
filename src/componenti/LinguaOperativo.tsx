"use client";
import { useEffect, useState } from "react";
import DIZ from "../../dati/operativo-lingua.json";
import { traduciTesto } from "@/lib/glossario";

type L = "it" | "en" | "ar";
const D = DIZ as Record<string, { en: string; ar: string }>;
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const CHIAVI = Object.keys(D).sort((a, b) => b.length - a.length);
const ORIG = new WeakMap<Node, string>();
const ATTR = ["placeholder", "title", "aria-label"];

// Interfaccia: dizionario (frasi intere, poi pezzi lunghi). Contenuti scritti a mano (colori, condizioni…):
// glossario, in tutte e tre le lingue — anche in italiano, così «black matt» diventa «Nero opaco».
function tradu(testo: string, l: L): string {
  const t = norm(testo);
  if (!t) return testo;
  if (l !== "it") {
    const e = D[t];
    if (e) return testo.replace(t, e[l === "ar" ? "ar" : "en"]);
    if (t.length >= 14) {
      let out = testo;
      for (const k of CHIAVI) if (k.length >= 14 && out.includes(k)) out = out.replace(k, D[k][l === "ar" ? "ar" : "en"]);
      if (out !== testo) return out;
    }
  } else if (D[t]) return testo;
  const g = traduciTesto(t, l);
  return g === t ? testo : testo.replace(t, g);
}

function applica(radice: HTMLElement, l: L) {
  const w = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = w.nextNode())) {
    const p = n.parentElement;
    if (!p || ["SCRIPT", "STYLE", "TEXTAREA"].includes(p.tagName)) continue;
    const cur = n.nodeValue ?? "";
    const prima = ORIG.get(n);
    // se il testo non è né l'originale né la sua traduzione, l'ha cambiato React: è il nuovo originale
    if (prima === undefined || (cur !== prima && cur !== tradu(prima, "en") && cur !== tradu(prima, "ar") && cur !== tradu(prima, "it"))) ORIG.set(n, cur);
    const base = ORIG.get(n)!;
    const nuovo = tradu(base, l);
    if (cur !== nuovo) n.nodeValue = nuovo;
  }
  radice.querySelectorAll<HTMLElement>("[placeholder],[title],[aria-label]").forEach((el) => {
    for (const a of ATTR) {
      const v = el.getAttribute(a); if (!v) continue;
      const k = "data-it-" + a;
      if (!el.hasAttribute(k)) el.setAttribute(k, v);
      const base = el.getAttribute(k)!;
      const nuovo = tradu(base, l);
      if (v !== nuovo) el.setAttribute(a, nuovo);
    }
  });
}

export default function LinguaOperativo() {
  const [l, setL] = useState<L>("it");
  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )op_l=(it|en|ar)/);
    if (m) setL(m[1] as L);
  }, []);
  useEffect(() => {
    const radice = document.querySelector<HTMLElement>(".operativo");
    if (!radice) return;
    radice.setAttribute("dir", l === "ar" ? "rtl" : "ltr");
    radice.setAttribute("lang", l);
    let busy = false;
    const run = () => { if (busy) return; busy = true; try { applica(radice, l); } finally { busy = false; } };
    run();
    const mo = new MutationObserver(() => { mo.disconnect(); run(); mo.observe(radice, { childList: true, subtree: true, characterData: true }); });
    mo.observe(radice, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [l]);
  const scegli = (x: L) => { document.cookie = `op_l=${x}; path=/operativo; max-age=31536000; samesite=lax`; setL(x); };
  const NOMI: [L, string][] = [["it", "Italiano"], ["en", "English"], ["ar", "عربي مصري"]];
  return (
    <div className="op-lingua" style={{ display: "flex", gap: 6, margin: "0 0 14px" }} dir="ltr">
      {NOMI.map(([x, n]) => <button key={x} type="button" onClick={() => scegli(x)} className={`tasto piccolo ${l === x ? "" : "vuoto"}`}>{n}</button>)}
    </div>
  );
}
