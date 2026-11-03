import Link from "next/link";
import { href, LINGUE, type Lingua } from "@/lib/i18n";
import { tx } from "@/lib/contesto";
import { Stella } from "./Marchio";
import { CercaTestata } from "./CercaTestata";

const NOMI: Record<Lingua, string> = { it: "IT", en: "EN", ar: "ع" };

export function Testata({ l, percorso, collegato }: { l: Lingua; percorso: string; collegato: boolean }) {
  const _ = tx(l);
  return (
    <header className="testata">
      <a className="salta" href="#contenuto">{_("Vai al contenuto", "Skip to content", "انتقل إلى المحتوى")}</a>
      <div className="foglio riga">
        <Link className="marchio" href={href(l, "/")} aria-label="MotoNova"><Stella /><b>MotoNova</b></Link>
        <nav className="navi" aria-label={_("Principale", "Main", "الرئيسية")}>
          <Link href={href(l, "/negozio")}>{_("Negozio", "Shop", "المتجر")}</Link>
          <Link href={href(l, "/aste")}>Second Life</Link>
          <Link href={href(l, "/guide")}>{_("Guide", "Guides", "أدلة")}</Link>
          <Link href={href(l, "/marche")}>{_("Marche", "Brands", "الماركات")}</Link>
          <Link href={href(l, collegato ? "/account" : "/accedi")}>{collegato ? _("Account", "Account", "حسابي") : _("Accedi", "Sign in", "دخول")}</Link>
          <Link href={href(l, "/carrello")}>{_("Carrello", "Cart", "السلة")}</Link>
        </nav>
        <CercaTestata azione={href(l, "/negozio")} segnaposto={_("Cerca casco, marca…", "Search helmet, brand…", "ابحث عن خوذة، ماركة…")} etichetta={_("Cerca", "Search", "بحث")} />
        <div className="lingue" role="group" aria-label={_("Lingua", "Language", "اللغة")}>
          {LINGUE.map((x) => (
            <a key={x} href={href(x, percorso)} hrefLang={x} lang={x} aria-current={x === l ? "true" : undefined}>{NOMI[x]}</a>
          ))}
        </div>
      </div>
    </header>
  );
}
