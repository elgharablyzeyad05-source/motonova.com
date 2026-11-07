"use client";
import { useActionState, useMemo, useState } from "react";
import { ordineAction, couponAction, type StatoCassa } from "@/app/azioni";
import { totali, egp, ZONE, RATE_OFFERTE, rata, zonaDi, ACCONTO_PERCENTUALE, ACCONTO_SOPRA, type Metodo } from "@/lib/regole";
import { tx } from "@/lib/tx";
import type { Lingua } from "@/lib/i18n";

type Prefill = { nome: string; telefono: string; email: string };
type RigaR = { nome: string; marca: string; taglia: string; quantita: number; prezzo: number };

export function CassaForm({ l, righe, subtotale, sconto, codice, cartaAttiva, haAsta, haPattuito, prefill, erroreCoupon }: {
  l: Lingua; righe: RigaR[]; subtotale: number; sconto: number; codice: string | null; cartaAttiva: boolean; haAsta: boolean; haPattuito: boolean; prefill: Prefill; erroreCoupon: string | null;
}) {
  const _ = tx(l);
  const [stato, azione, inCorso] = useActionState<StatoCassa, FormData>(ordineAction, {});
  const [v, setV] = useState({ nome: prefill.nome, telefono: prefill.telefono, email: prefill.email, governatorato: "", indirizzo: "", note: "" });
  const [metodo, setMetodo] = useState<Metodo>(haAsta ? "CARTA" : "CONTRASSEGNO");
  const [mesi, setMesi] = useState<number>(6);
  const zona = v.governatorato ? zonaDi(v.governatorato) : -1;
  const t = useMemo(() => totali(subtotale, zona >= 0 ? zona : null, metodo, sconto), [subtotale, zona, metodo, sconto]);
  const err = (k: string) => stato.errori?.[k];
  const imposta = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const campo = (k: keyof typeof v, etichetta: string, tipo = "text", extra: object = {}) => (
    <div className="campo">
      <label htmlFor={k}>{etichetta}</label>
      <input id={k} name={k} type={tipo} value={v[k]} onChange={imposta(k)} aria-invalid={!!err(k)} aria-describedby={err(k) ? k + "-e" : undefined} {...extra} />
      {err(k) && <p className="errore" id={k + "-e"} role="alert">{err(k)}</p>}
    </div>
  );

  return (
    <>
      {/* il form del codice sta FUORI dall'ordine: un form dentro un form è HTML non valido. I campi lo raggiungono con l'attributo form. */}
      <form id="coupon-form" action={couponAction}><input type="hidden" name="torna" value="checkout" /></form>
      <form action={azione} className="due-col" noValidate>
        <div>
          {stato.generale && <p className="nota avviso" role="alert" style={{ marginBottom: 16 }}>{stato.generale}</p>}
          {stato.esaurito && (
            <div className="nota avviso" role="alert" style={{ marginBottom: 16 }}>
              <b>{_("Qualcuno è stato più veloce", "Someone was faster", "حد سبقك")}</b>
              {stato.esaurito.map((e, i) => <p key={i}>{e.nome} ({e.taglia}): {e.disponibile > 0 ? _(`ne restano ${e.disponibile}`, `${e.disponibile} left`, `تبقّى ${e.disponibile}`) : _("esaurito", "sold out", "خلص")}</p>)}
              <p>{_("Torna al carrello e aggiorna le quantità.", "Go back to the cart and update quantities.", "ارجع للسلة وظبّط الكميات.")}</p>
            </div>
          )}
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>{_("I tuoi dati", "Your details", "بياناتك")}</h2>
          {campo("nome", _("Nome e cognome", "Full name", "الاسم بالكامل"), "text", { autoComplete: "name" })}
          {campo("telefono", _("Telefono (per il corriere)", "Phone (for the courier)", "الموبايل (للمندوب)"), "tel", { autoComplete: "tel", inputMode: "tel", placeholder: "01X XXXX XXXX", dir: "ltr" })}
          {campo("email", _("Email (per la conferma, facoltativa)", "Email (for confirmation, optional)", "الإيميل (للتأكيد، اختياري)"), "email", { autoComplete: "email", dir: "ltr" })}
          <h2 style={{ fontSize: 20, margin: "26px 0 16px" }}>{_("Consegna", "Delivery", "التوصيل")}</h2>
          <div className="campo">
            <label htmlFor="governatorato">{_("Governatorato", "Governorate", "المحافظة")}</label>
            <select id="governatorato" name="governatorato" value={v.governatorato} onChange={imposta("governatorato")} aria-invalid={!!err("governatorato")}>
              <option value="">{_("Scegli…", "Choose…", "اختار…")}</option>
              {ZONE.map((z, i) => (
                <optgroup key={i} label={`${z.nome} · ${z.giorni}`}>{[...z.governatorati].sort().map((g) => <option key={g} value={g}>{g}</option>)}</optgroup>
              ))}
            </select>
            {err("governatorato") && <p className="errore" role="alert">{err("governatorato")}</p>}
          </div>
          {campo("indirizzo", _("Quartiere, via, numero", "District, street, number", "الحي، الشارع، رقم العمارة"), "text", { autoComplete: "street-address" })}
          <div className="campo"><label htmlFor="note">{_("Note per il corriere (facoltative)", "Notes for the courier (optional)", "ملاحظات للمندوب (اختياري)")}</label><textarea id="note" name="note" value={v.note} onChange={imposta("note")} /></div>

          <h2 style={{ fontSize: 20, margin: "26px 0 16px" }}>{_("Pagamento", "Payment", "الدفع")}</h2>
          <input type="hidden" name="metodo" value={metodo} />
          <div className={"pag-opz" + (haAsta ? " spenta" : "")}>
            <input type="radio" id="m-cod" name="metodo-scelta" checked={metodo === "CONTRASSEGNO"} disabled={haAsta} onChange={() => setMetodo("CONTRASSEGNO")} />
            <label htmlFor="m-cod"><b>{_("Contrassegno", "Cash on delivery", "الدفع عند الاستلام")}</b><br /><span className="tenue" style={{ fontSize: 13 }}>
              {haAsta ? _("Non disponibile per i pezzi vinti all'asta", "Not available for auction pieces", "مش متاح للقطع اللي اتكسبت بالمزاد")
                : _(`Paghi al corriere. Commissione 1,5% (minimo EGP 25). Sopra EGP ${ACCONTO_SOPRA / 100} serve un acconto del ${ACCONTO_PERCENTUALE * 100}%, rimborsato se rifiuti.`,
                    `Pay the courier. 1.5% fee (minimum EGP 25). Above EGP ${ACCONTO_SOPRA / 100} a ${ACCONTO_PERCENTUALE * 100}% deposit is required, refunded if you refuse.`,
                    `تدفع للمندوب. عمولة 1.5% (حد أدنى 25 جنيه). فوق ${ACCONTO_SOPRA / 100} جنيه يلزم عربون ${ACCONTO_PERCENTUALE * 100}% يُردّ إذا رفضت.`)}</span></label>
          </div>
          <div className={"pag-opz" + (cartaAttiva ? "" : " spenta")}>
            <input type="radio" id="m-carta" name="metodo-scelta" checked={metodo === "CARTA"} disabled={!cartaAttiva} onChange={() => setMetodo("CARTA")} />
            <label htmlFor="m-carta"><b>{_("Carta", "Card", "كارت")}</b><br /><span className="tenue" style={{ fontSize: 13 }}>
              {cartaAttiva ? _("Pagamento sicuro: i dati della carta non passano dai nostri sistemi.", "Secure payment: card details never touch our systems.", "دفع آمن: بيانات الكارت مابتعدّيش على أنظمتنا.")
                : _("Non ancora attiva: serve l'attivazione del fornitore di pagamento.", "Not active yet: the payment provider has to be activated.", "لسه مش شغّال: لازم يتفعّل مزوّد الدفع.")}</span></label>
          </div>
          <div className={"pag-opz" + (cartaAttiva ? "" : " spenta")}>
            <input type="radio" id="m-rate" name="metodo-scelta" checked={metodo === "RATE"} disabled={!cartaAttiva} onChange={() => setMetodo("RATE")} />
            <label htmlFor="m-rate"><b>{_("A rate", "Instalments", "بالتقسيط")}</b><br /><span className="tenue" style={{ fontSize: 13 }}>
              {_("valU, Souhoola, Aman e banche convenzionate. Tu paghi a rate, noi incassiamo subito.", "valU, Souhoola, Aman and partner banks. You pay in instalments, we are paid upfront.", "valU وسوهولة وأمان وبنوك شريكة. إنت بتدفع بالتقسيط واحنا بنقبض على طول.")}</span></label>
            {metodo === "RATE" && cartaAttiva && (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {RATE_OFFERTE.map((m) => <button type="button" key={m} className={"tasto piccolo" + (mesi === m ? "" : " vuoto")} aria-pressed={mesi === m} onClick={() => setMesi(m)}>{m}× · {egp(rata(t.totale, m))}</button>)}
              </div>
            )}
          </div>
          {err("metodo") && <p className="errore" role="alert" style={{ color: "var(--rosso)" }}>{err("metodo")}</p>}
        </div>

        <aside className="riepilogo" aria-label={_("Riepilogo ordine", "Order summary", "ملخص الطلب")}>
          <h2 style={{ fontSize: 18, marginBottom: 14 }}>{_("Il tuo ordine", "Your order", "طلبك")}</h2>
          {righe.map((r, i) => <div className="r" key={i}><span>{r.marca} {r.nome} <span className="lieve">({r.taglia}) × {r.quantita}</span></span><span className="tab">{egp(r.prezzo * r.quantita)}</span></div>)}
          <div className="r" style={{ marginTop: 8 }}><span>{_("Merce", "Goods", "البضاعة")}</span><span className="tab">{egp(subtotale)}</span></div>
          {t.sconto > 0 && <div className="r verde"><span>{_("Codice", "Code", "الكود")} {codice}</span><span className="tab">−{egp(t.sconto)}</span></div>}
          <div className="r"><span>{_("Spedizione", "Shipping", "الشحن")}{zona >= 0 && <span className="lieve"> · {ZONE[zona].giorni}</span>}</span>
            <span className="tab">{zona < 0 ? "—" : t.spedizioneGratis ? _("Gratis", "Free", "مجاني") : egp(t.spedizione)}</span></div>
          {metodo === "CONTRASSEGNO" && <div className="r"><span>{_("Commissione contrassegno", "Cash-on-delivery fee", "رسوم الدفع عند الاستلام")}</span><span className="tab">{egp(t.commissione)}</span></div>}
          <div className="r tot"><span>{_("Totale", "Total", "الإجمالي")}</span><span className="tab" data-totale>{egp(t.totale)}</span></div>
          {t.acconto > 0 && (<>
            <div className="r"><span>{_("Acconto online adesso", "Deposit online now", "عربون أونلاين دلوقتي")}</span><span className="tab">{egp(t.acconto)}</span></div>
            <div className="r"><span>{_("Al corriere", "To the courier", "للمندوب")}</span><span className="tab">{egp(t.contanti)}</span></div>
          </>)}
          {metodo === "CONTRASSEGNO" && t.acconto === 0 && zona >= 0 && <div className="r"><span>{_("Al corriere", "To the courier", "للمندوب")}</span><span className="tab">{egp(t.contanti)}</span></div>}

          <div style={{ marginTop: 18 }}>
            {codice ? <p className="mono" style={{ color: "var(--verde)" }}>{_("Codice applicato", "Code applied", "الكود اتطبّق")}: {codice}</p> : (
              <>
                <label htmlFor="codice">{_("Codice sconto", "Discount code", "كود الخصم")}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input id="codice" name="codice" form="coupon-form" autoComplete="off" />
                  <button type="submit" form="coupon-form" className="tasto coupon-applica">{_("Applica", "Apply", "طبّق")}</button>
                </div>
              </>
            )}
            {erroreCoupon && <p className="nota avviso" role="alert" style={{ marginTop: 10 }}>{erroreCoupon}</p>}
          </div>
          <button type="submit" className="tasto pieno conferma-ordine" style={{ marginTop: 20 }} disabled={inCorso}>{inCorso ? _("Un attimo…", "One moment…", "لحظة…") : _("Conferma l'ordine", "Place order", "أكّد الطلب")}</button>
          {haPattuito && !haAsta && metodo === "CONTRASSEGNO" && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--linea, #333)" }}>
              <p className="lieve" style={{ marginBottom: 10 }}>{_("Non puoi pagare adesso? Blocca il prezzo trattato per 48 ore con un acconto di EGP 800: viene detratto dal totale. Se poi non acquisti, l'acconto non viene rimborsato.", "Cannot pay now? Hold your negotiated price for 48 hours with an EGP 800 deposit: it is deducted from the total. If you then do not buy, the deposit is not refunded.", "مش قادر تدفع دلوقتي؟ احجز السعر المتفق عليه 48 ساعة بعربون 800 جنيه: بيتخصم من الإجمالي. ولو ماشتريتش بعد كده العربون مابيترجّعش.")}</p>
              <button type="submit" name="blocco" value="1" className="tasto" disabled={inCorso}>{_("Blocca il prezzo per 48 ore — EGP 800", "Hold the price for 48 hours — EGP 800", "احجز السعر 48 ساعة — 800 جنيه")}</button>
            </div>
          )}
          <p className="mono lieve" style={{ marginTop: 12 }}>{_("Ti chiamiamo per confermare prima di spedire.", "We call you to confirm before shipping.", "هنتصل بيك نأكد قبل الشحن.")}</p>
        </aside>
      </form>
    </>
  );
}
