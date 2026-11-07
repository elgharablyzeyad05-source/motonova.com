"use client";
import { useActionState } from "react";
import { offertaAction, type StatoOfferta } from "@/app/azioni";
import { tx } from "@/lib/tx";
import { egp } from "@/lib/regole";
import type { Lingua } from "@/lib/i18n";

export function OffertaForm({ l, slug, minimo, aperta, collegato }: { l: Lingua; slug: string; minimo: number; aperta: boolean; collegato: boolean }) {
  const _ = tx(l);
  const [s, azione, inCorso] = useActionState<StatoOfferta, FormData>(offertaAction, {});
  if (!aperta) return <p className="nota">{_("Asta chiusa.", "Auction closed.", "المزاد اتقفل.")}</p>;
  return (
    <form action={azione} noValidate>
      <input type="hidden" name="slug" value={slug} />
      <div className="campo">
        <label htmlFor="massimo">{_("Il tuo massimo (EGP)", "Your maximum (EGP)", "أقصى حد عندك (جنيه)")}</label>
        <input id="massimo" name="massimo" inputMode="numeric" placeholder={String(Math.ceil(minimo / 100))} dir="ltr" autoComplete="off" />
        <p className="mono lieve" style={{ marginTop: 6 }}>{_(`Offerta minima ${egp(minimo)}. Il tuo massimo resta segreto: paghi solo quanto serve per stare davanti.`, `Minimum bid ${egp(minimo)}. Your maximum stays secret: you only pay what it takes to stay ahead.`, `الحد الأدنى للعرض ${egp(minimo)}. يبقى حدك الأقصى سرياً: تدفع فقط ما يلزم للبقاء في الصدارة.`)}</p>
      </div>
      <button type="submit" className="tasto pieno fai-offerta" disabled={inCorso}>{collegato ? _("Fai l'offerta", "Place bid", "قدّم العرض") : _("Accedi per offrire", "Sign in to bid", "سجّل دخولك عشان تزايد")}</button>
      {s.messaggio && <p className={"nota " + (s.esito === "ok" ? "ok" : "avviso")} role="status" style={{ marginTop: 12 }}>{s.messaggio}</p>}
    </form>
  );
}
