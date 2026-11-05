"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type M = { id: string; staff: boolean; testo: string; ts: number };
type T = { titolo: string; apri: string; chiudi: string; vuoto: string; scrivi: string; invia: string; errore: string; sottotitolo: string };

export function ChatSito({ t }: { t: T }) {
  const [aperta, setAperta] = useState(false);
  const [msgs, setMsgs] = useState<M[]>([]);
  const [nonLetti, setNonLetti] = useState(0);
  const [testo, setTesto] = useState("");
  const [errore, setErrore] = useState("");
  const [invio, setInvio] = useState(false);
  const fondo = useRef<HTMLDivElement>(null);

  const carica = useCallback(async (apertaOra: boolean) => {
    try {
      const r = await fetch(`/api/chat?aperta=${apertaOra ? 1 : 0}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json(); setMsgs(d.messaggi); setNonLetti(apertaOra ? 0 : d.nonLetti);
    } catch { /* offline: riprova al prossimo giro */ }
  }, []);

  useEffect(() => {
    carica(aperta);
    // aperta: ogni 5 s; chiusa: ogni 45 s, solo per accendere il pallino; mai a scheda nascosta
    const id = setInterval(() => { if (!document.hidden) carica(aperta); }, aperta ? 5000 : 45000);
    return () => clearInterval(id);
  }, [aperta, carica]);
  useEffect(() => { const f = () => setAperta(true); window.addEventListener("mn:chat", f); return () => window.removeEventListener("mn:chat", f); }, []);
  useEffect(() => { fondo.current?.scrollIntoView({ block: "end" }); }, [msgs, aperta]);

  async function manda(e: React.FormEvent) {
    e.preventDefault();
    const v = testo.trim(); if (!v || invio) return;
    setInvio(true); setErrore("");
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testo: v }) });
      if (!r.ok) { setErrore((await r.json().catch(() => ({}))).errore || t.errore); }
      else { setTesto(""); await carica(true); }
    } catch { setErrore(t.errore); }
    setInvio(false);
  }

  return (
    <>
      {aperta && (
        <section className="chat-pannello" role="dialog" aria-label={t.titolo}>
          <header><div><b>{t.titolo}</b><span>{t.sottotitolo}</span></div><button type="button" onClick={() => setAperta(false)} aria-label={t.chiudi}>×</button></header>
          <div className="chat-msgs" aria-live="polite">
            {msgs.length === 0 && <p className="chat-vuoto">{t.vuoto}</p>}
            {msgs.map((m) => <p key={m.id} className={m.staff ? "staff" : "io"}>{m.testo}</p>)}
            <div ref={fondo} />
          </div>
          {errore && <p className="chat-err" role="alert">{errore}</p>}
          <form onSubmit={manda}>
            <input value={testo} onChange={(e) => setTesto(e.target.value)} maxLength={1000} placeholder={t.scrivi} aria-label={t.scrivi} autoComplete="off" />
            <button type="submit" disabled={invio || !testo.trim()}>{t.invia}</button>
          </form>
        </section>
      )}
      <button type="button" className="chat-fab" onClick={() => { setAperta(!aperta); setNonLetti(0); }} aria-label={t.apri} aria-expanded={aperta}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /></svg>
        {nonLetti > 0 && <span className="n">{nonLetti}</span>}
      </button>
    </>
  );
}
