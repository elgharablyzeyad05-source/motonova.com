import type { Metadata } from "next";
import Link from "next/link";
import { trovaCarrello, vistaCarrello } from "@/lib/carrello";
import { lingua, tx } from "@/lib/contesto";
import { href } from "@/lib/i18n";
import { egp } from "@/lib/regole";
import { Cornice } from "@/componenti/Sagoma";
import { quantitaAction, rimuoviAction, couponAction, togliCouponAction } from "../azioni";

export const metadata: Metadata = { title: "Carrello", robots: { index: false } };
type SP = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Carrello({ searchParams }: { searchParams: Promise<SP> }) {
  const l = await lingua(); const _ = tx(l); const sp = await searchParams;
  const v = await vistaCarrello(await trovaCarrello());
  const motivo = uno(sp.coupon);
  const erroreCoupon: Record<string, string> = {
    NON_VALIDO: _("Codice non valido", "Invalid code", "الكود مش صحيح"),
    SCADUTO: _("Questo codice è scaduto", "This code has expired", "الكود ده خلصت مدته"),
    ESAURITO: _("Questo codice è esaurito", "This code has been used up", "الكود ده خلص"),
    SOTTO_MINIMO: _(`Il codice vale da ${egp(Number(uno(sp.min)))} di merce`, `This code applies from ${egp(Number(uno(sp.min)))} of goods`, `يسري الرمز من ${egp(Number(uno(sp.min)))} من البضاعة`),
    GIA_USATO: _("Hai già usato questo codice", "You have already used this code", "إنت استخدمت الكود ده قبل كده"),
  };
  return (
    <div className="foglio sezione">
      <h1 style={{ marginBottom: 28 }}>{_("Carrello", "Cart", "السلة")}</h1>
      {v.righe.length === 0 ? (
        <div className="nota"><b>{_("Il carrello è vuoto", "Your cart is empty", "السلة فاضية")}</b>
          <p style={{ marginTop: 10 }}><Link className="tasto" href={href(l, "/negozio")}>{_("Vai al negozio", "Go to the shop", "روح للمتجر")}</Link></p></div>
      ) : (
        <div className="due-col">
          <div>
            {v.righe.map((r) => (
              <div className="riga-carr" key={r.id}>
                <Cornice foto={r.foto} categoria={r.categoria} alt={r.nome} />
                <div>
                  <span className="mono lieve">{r.marca}</span>
                  <p style={{ fontWeight: 700 }}><Link href={href(l, `/prodotto/${r.slug}`)}>{r.nome}</Link></p>
                  <p className="mono lieve">{r.taglia}</p>
                  <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 10 }}>
                    {r.unico ? <span className="mono">{_("Pezzo unico", "One-off piece", "قطعة واحدة بس")}</span> : r.pattuito ? <span className="mono">{_(`Prezzo concordato · ${r.quantita} pz`, `Agreed price · ${r.quantita} pc`, `سعر متفق عليه · ${r.quantita} قطعة`)}</span> : (
                      <form action={quantitaAction} className="qta">
                        <input type="hidden" name="riga" value={r.id} />
                        <button name="quantita" value={r.quantita - 1} aria-label={_("Riduci quantità", "Decrease quantity", "قلّل الكمية")}>−</button>
                        <span aria-live="polite">{r.quantita}</span>
                        <button name="quantita" value={r.quantita + 1} aria-label={_("Aumenta quantità", "Increase quantity", "زوّد الكمية")} disabled={r.quantita >= r.disponibile}>+</button>
                      </form>
                    )}
                    <form action={rimuoviAction}><input type="hidden" name="riga" value={r.id} /><button className="link-tasto mono lieve">{_("Rimuovi", "Remove", "شيل")}</button></form>
                  </div>
                  {!r.unico && r.disponibile <= 2 && r.disponibile > 0 && <p className="mono" style={{ color: "var(--giallo)", marginTop: 8 }}>{_(`Ne restano ${r.disponibile}`, `${r.disponibile} left`, `تبقّى ${r.disponibile}`)}</p>}
                </div>
                <span className="mono tab">{egp(r.prezzo * r.quantita)}</span>
              </div>
            ))}
          </div>
          <aside className="riepilogo" aria-label={_("Riepilogo", "Summary", "الملخص")}>
            <h2 style={{ fontSize: 18, marginBottom: 14 }}>{_("Riepilogo", "Summary", "الملخص")}</h2>
            <div className="r"><span>{_("Merce", "Goods", "البضاعة")} ({v.pezzi})</span><span className="tab">{egp(v.subtotale)}</span></div>
            {v.coupon && <div className="r verde"><span>{_("Codice", "Code", "الكود")} {v.coupon.codice}</span><span className="tab">−{egp(v.coupon.sconto)}</span></div>}
            <div className="r"><span className="lieve">{_("Spedizione", "Shipping", "الشحن")}</span><span className="lieve">{_("alla cassa", "at checkout", "وقت الدفع")}</span></div>
            <div className="r tot"><span>{_("Totale merce", "Goods total", "إجمالي البضاعة")}</span><span className="tab">{egp(v.subtotale - (v.coupon?.sconto ?? 0))}</span></div>
            <div style={{ marginTop: 18 }}>
              {v.coupon ? (
                <form action={togliCouponAction}><button className="link-tasto mono">{_("Togli il codice", "Remove code", "شيل الكود")}</button></form>
              ) : (
                <form action={couponAction}>
                  <label htmlFor="codice">{_("Codice sconto", "Discount code", "كود الخصم")}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input id="codice" name="codice" autoComplete="off" autoCapitalize="characters" /><button className="tasto coupon-applica" type="submit">{_("Applica", "Apply", "طبّق")}</button>
                  </div>
                </form>
              )}
              {motivo && erroreCoupon[motivo] && <p className="nota avviso" role="alert" style={{ marginTop: 10 }}>{erroreCoupon[motivo]}</p>}
              {v.couponErrore && <p className="nota avviso" style={{ marginTop: 10 }}>{erroreCoupon[v.couponErrore]}</p>}
            </div>
            <p style={{ marginTop: 20 }}><Link className="tasto pieno vai-alla-cassa" href={href(l, "/checkout")}>{_("Vai alla cassa", "Go to checkout", "كمّل الطلب")}</Link></p>
            <p className="mono lieve" style={{ marginTop: 12 }}>{_("Spedizione gratis sopra EGP 4,000", "Free shipping over EGP 4,000", "شحن مجاني فوق 4,000 جنيه")}</p>
          </aside>
        </div>
      )}
    </div>
  );
}
