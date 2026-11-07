import Link from "next/link";
import { href, LINGUE, type Lingua } from "@/lib/i18n";
import { tx } from "@/lib/contesto";
import { Stella } from "./Marchio";
import { CercaTestata } from "./CercaTestata";
import { MenuTelefono } from "./MenuTelefono";

const NOMI: Record<Lingua, string> = { it: "IT", en: "EN", ar: "ع" };

export function Testata({ l, percorso, collegato }: { l: Lingua; percorso: string; collegato: boolean }) {
  const _ = tx(l);
  return (
    <header className="testata">
      <a className="salta" href="#contenuto">{_("Vai al contenuto", "Skip to content", "روح للمحتوى")}</a>
      <div className="foglio riga">
        <Link className="marchio" href={href(l, "/")} aria-label="MotoNova"><Stella /><b>MotoNova</b></Link>
        <nav className="navi" aria-label={_("Principale", "Main", "الرئيسية")}>
          <Link href={href(l, "/negozio")}>{_("Negozio", "Shop", "المتجر")}</Link>
          <Link href={href(l, "/negozio?ed=limited")}>Limited &amp; Special</Link>
          <Link href={href(l, "/aste")}>{_("Aste", "Auctions", "المزادات")}</Link>
          <Link href={href(l, "/guide")}>{_("Guide", "Guides", "أدلة")}</Link>
          <Link href={href(l, "/marche")}>{_("Marche", "Brands", "الماركات")}</Link>
          <Link href={href(l, collegato ? "/account" : "/accedi")}>{collegato ? _("Account", "Account", "حسابي") : _("Accedi", "Sign in", "ادخل")}</Link>
          <Link href={href(l, "/carrello")}>{_("Carrello", "Cart", "السلة")}</Link>
        </nav>
        <CercaTestata azione={href(l, "/negozio")} segnaposto={_("Cerca casco, marca…", "Search helmet, brand…", "دوّر على خوذة، ماركة…")} etichetta={_("Cerca", "Search", "دوّر")} />
        <div className="lingue" role="group" aria-label={_("Lingua", "Language", "اللغة")}>
          {LINGUE.map((x) => (
            <a key={x} href={href(x, percorso)} hrefLang={x} lang={x} aria-current={x === l ? "true" : undefined}>{NOMI[x]}</a>
          ))}
        </div>
        <MenuTelefono azioneCerca={href(l, "/negozio")}
          voci={[
            { href: href(l, "/negozio"), testo: _("Negozio", "Shop", "المتجر") },
            { href: href(l, "/negozio?ed=limited"), testo: "Limited & Special" },
            { href: href(l, "/aste"), testo: _("Aste", "Auctions", "المزادات") },
            { href: href(l, "/guide"), testo: _("Guide", "Guides", "أدلة") },
            { href: href(l, "/marche"), testo: _("Marche", "Brands", "الماركات") },
            { href: href(l, collegato ? "/account" : "/accedi"), testo: collegato ? _("Account", "Account", "حسابي") : _("Accedi", "Sign in", "ادخل") },
            { href: href(l, "/carrello"), testo: _("Carrello", "Cart", "السلة") },
          ]}
          lingue={LINGUE.map((x) => ({ href: href(x, percorso), testo: NOMI[x], codice: x, attiva: x === l }))}
          t={{ apri: _("Apri il menu", "Open menu", "افتح القائمة"), chiudi: _("Chiudi il menu", "Close menu", "اقفل القائمة"), cerca: _("Cerca", "Search", "دوّر"),
            segnaposto: _("Cerca casco, marca…", "Search helmet, brand…", "دوّر على خوذة، ماركة…"), lingua: _("Lingua", "Language", "اللغة"), menu: _("Menu", "Menu", "القائمة") }} />
      </div>
    </header>
  );
}
