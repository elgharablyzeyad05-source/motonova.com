import { tx } from "@/lib/contesto";
import type { Lingua } from "@/lib/i18n";
import { LANCIO } from "@/lib/lancio";
import ContoAllaRovescia from "./ContoAllaRovescia";
import { NewsletterForm } from "./NewsletterForm";

/** Pagina «Coming soon» al posto di negozio, aste, categorie e marche fino al drop. */
export default function Prossimamente({ l, dove }: { l: Lingua; dove?: string }) {
  const _ = tx(l);
  return (
    <section className="cs">
      <p className="mono cs-occhiello">{dove ? `${dove} · ` : ""}MotoNova</p>
      <h1 className="cs-titolo">Coming soon</h1>
      <p className="cs-sotto">{_("Il primo drop arriva tra", "The first drop lands in", "أول دروب جاي بعد")}</p>
      <ContoAllaRovescia fine={LANCIO.toISOString()} etichette={[_("giorni", "days", "يوم"), _("ore", "hours", "ساعة"), _("minuti", "min", "دقيقة"), _("secondi", "sec", "ثانية")]} finito={_("Ci siamo quasi: il drop è questione di ore.", "Almost there: the drop is hours away.", "خلاص قربنا: الدروب مسألة ساعات.")} />
      <div className="cs-iscriviti">
        <h2>{_("Sii il primo a saperlo", "Be the first to know", "خليك أول واحد يعرف")}</h2>
        <p>{_("Caschi, giacche e protezioni scelti pezzo per pezzo, pezzi unici compresi: vanno via in fretta. Lascia la tua email e ti scriviamo appena apre il drop, prima di tutti.", "Helmets, jackets and protection chosen piece by piece, one-offs included: they go fast. Leave your email and we'll tell you the moment the drop opens, before anyone else.", "خوذ وجواكت وحمايات متختارة قطعة قطعة، ومنها قطع فريدة: بتخلص بسرعة. سيب إيميلك وهنبعتلك أول ما الدروب يفتح، قبل أي حد.")}</p>
        <NewsletterForm id="cs-email" testi={{ etichetta: _("La tua email", "Your email", "إيميلك"), segnaposto: _("La tua email", "Your email", "إيميلك"), invia: _("Avvisami", "Notify me", "بلّغني") }} />
      </div>
    </section>
  );
}
