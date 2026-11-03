import Link from "next/link";
import { href, type Lingua } from "@/lib/i18n";
import { tx } from "@/lib/contesto";
import { NewsletterForm } from "./NewsletterForm";

export function Piede({ l }: { l: Lingua }) {
  const _ = tx(l);
  return (
    <footer className="piede">
      <div className="foglio colonne">
        <div>
          <h3>MotoNova</h3>
          <p className="tenue" style={{ maxWidth: 320 }}>
            {_("Attrezzatura scelta pezzo per pezzo, importata dall'Italia e consegnata in Egitto.",
               "Gear chosen piece by piece, imported from Italy and delivered in Egypt.",
               "معدات مختارة قطعة قطعة، مستوردة من إيطاليا وتُسلَّم في مصر.")}
          </p>
        </div>
        <div>
          <h3>{_("Aiuto", "Help", "مساعدة")}</h3>
          <ul>
            <li><Link href={href(l, "/guide/spedizioni")}>{_("Spedizioni e resi", "Shipping and returns", "الشحن والإرجاع")}</Link></li>
            <li><Link href={href(l, "/guide/taglie")}>{_("Come prendere la taglia", "How to take your size", "كيف تأخذ مقاسك")}</Link></li>
            <li><Link href={href(l, "/pagina/contatti")}>{_("Contatti", "Contact", "اتصل بنا")}</Link></li>
          </ul>
        </div>
        <div>
          <h3>{_("Legale", "Legal", "قانوني")}</h3>
          <ul>
            <li><Link href={href(l, "/pagina/termini")}>{_("Termini di vendita", "Terms of sale", "شروط البيع")}</Link></li>
            <li><Link href={href(l, "/pagina/privacy")}>Privacy</Link></li>
          </ul>
        </div>
        <div className="newsletter">
          <h3>{_("Newsletter", "Newsletter", "النشرة البريدية")}</h3>
          <p className="tenue" style={{ marginBottom: 10 }}>{_("Nuovi arrivi, aste e guide. Niente spam.", "New arrivals, auctions and guides. No spam.", "وصولات جديدة ومزادات وأدلة. بلا إزعاج.")}</p>
          <NewsletterForm testi={{ etichetta: _("La tua email", "Your email", "بريدك الإلكتروني"), segnaposto: _("La tua email", "Your email", "بريدك الإلكتروني"), invia: _("Iscriviti", "Subscribe", "اشترك") }} />
        </div>
      </div>
      <div className="foglio" style={{ marginTop: 28 }}><span className="mono lieve">© {new Date().getFullYear()} MotoNova</span></div>
    </footer>
  );
}
