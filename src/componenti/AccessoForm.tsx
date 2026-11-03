"use client";
import { useActionState } from "react";
import { accediAction, registratiAction, type StatoAccesso } from "@/app/azioni";
import { tx } from "@/lib/tx";
import type { Lingua } from "@/lib/i18n";

export function AccessoForm({ l, modo, torna }: { l: Lingua; modo: "accedi" | "registrati"; torna: string }) {
  const _ = tx(l);
  const [s, azione, inCorso] = useActionState<StatoAccesso, FormData>(modo === "accedi" ? accediAction : registratiAction, {});
  const v = s.valori ?? {};
  return (
    <form action={azione} noValidate>
      <input type="hidden" name="torna" value={torna} />
      {s.errore && <p className="nota avviso" role="alert" style={{ marginBottom: 16 }}>{s.errore}</p>}
      {modo === "registrati" && <div className="campo"><label htmlFor="nome">{_("Nome e cognome", "Full name", "الاسم الكامل")}</label><input id="nome" name="nome" defaultValue={v.nome} autoComplete="name" /></div>}
      <div className="campo"><label htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={v.email} autoComplete="email" dir="ltr" /></div>
      {modo === "registrati" && <div className="campo"><label htmlFor="telefono">{_("Telefono (facoltativo)", "Phone (optional)", "الهاتف (اختياري)")}</label><input id="telefono" name="telefono" type="tel" defaultValue={v.telefono} autoComplete="tel" dir="ltr" /></div>}
      <div className="campo"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete={modo === "accedi" ? "current-password" : "new-password"} dir="ltr" />
        {modo === "registrati" && <p className="mono lieve" style={{ marginTop: 6 }}>{_("Almeno 8 caratteri", "At least 8 characters", "8 أحرف على الأقل")}</p>}</div>
      <button type="submit" className={"tasto pieno " + (modo === "accedi" ? "entra" : "registrati")} disabled={inCorso}>{modo === "accedi" ? _("Entra", "Sign in", "دخول") : _("Crea l'account", "Create account", "إنشاء الحساب")}</button>
    </form>
  );
}
