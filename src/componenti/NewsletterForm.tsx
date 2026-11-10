"use client";
import { useActionState } from "react";
import { iscrivitiAction, type StatoNewsletter } from "@/app/azioni";

export function NewsletterForm({ testi, id = "nl-email" }: { testi: { etichetta: string; segnaposto: string; invia: string }; id?: string }) {
  const [s, azione, inCorso] = useActionState<StatoNewsletter, FormData>(iscrivitiAction, {});
  return (
    <form action={azione}>
      <label htmlFor={id} className="salta">{testi.etichetta}</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input id={id} name="email" type="email" required placeholder={testi.segnaposto} autoComplete="email" />
        <button type="submit" className="tasto iscriviti" disabled={inCorso}>{testi.invia}</button>
      </div>
      {s.messaggio && <p className={"nota " + (s.esito === "errore" ? "avviso" : "ok")} role="status" style={{ marginTop: 10 }}>{s.messaggio}</p>}
    </form>
  );
}
