import Link from "next/link";
import { egp, sconto } from "@/lib/regole";
import { href, tr, type Lingua } from "@/lib/i18n";
import { tx } from "@/lib/contesto";
import { totaleDisponibile, type ProdottoLista } from "@/lib/catalogo";
import { Cornice } from "./Sagoma";
import { preferitoAction } from "@/app/azioni";

export function Cuore({ slug, on, torna, l }: { slug: string; on: boolean; torna: string; l: Lingua }) {
  const _ = tx(l);
  return (
    <form action={preferitoAction} className="cuore" data-on={on}>
      <input type="hidden" name="slug" value={slug} /><input type="hidden" name="torna" value={torna} />
      <button type="submit" aria-pressed={on} aria-label={on ? _("Togli dai preferiti", "Remove from favourites", "إزالة من المفضلة") : _("Salva nei preferiti", "Save to favourites", "حفظ في المفضلة")}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.6-7-9.4A4.1 4.1 0 0 1 12 7a4.1 4.1 0 0 1 7 3.6C19 15.4 12 20 12 20z" /></svg>
      </button>
    </form>
  );
}

export function Scheda({ p, l, preferito, torna }: { p: ProdottoLista; l: Lingua; preferito?: boolean; torna?: string }) {
  const _ = tx(l);
  const pct = sconto(p.prezzo, p.prezzoPrima);
  const esaurito = totaleDisponibile(p) <= 0;
  return (
    <div style={{ position: "relative" }}>
      <Link href={href(l, `/prodotto/${p.slug}`)} className="scheda">
        <Cornice foto={p.foto[0]?.piccola} categoria={p.categoria} alt={`${p.marca.nome} ${p.nome}`}>
          {pct > 0 && <span className="bollino sconto mono">−{pct}%</span>}
        </Cornice>
        <span className="marca mono">{p.marca.nome}</span>
        <span className="nome">{p.nome}</span>
        <span className="mono lieve">{tr(l, p.sottotitolo)}</span>
        <span className="prezzo tab">
          {esaurito ? <span className="esaurito">{_("Esaurito", "Sold out", "نفد")}</span> : <>{egp(Math.min(...(p.varianti.length ? p.varianti.map((v) => v.prezzo ?? p.prezzo) : [p.prezzo])))}{p.prezzoPrima ? <s>{egp(p.prezzoPrima)}</s> : null}</>}
        </span>
      </Link>
      {preferito !== undefined && torna && <Cuore slug={p.slug} on={preferito} torna={torna} l={l} />}
    </div>
  );
}
