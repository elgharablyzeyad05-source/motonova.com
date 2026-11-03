import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { lingua, tx } from "@/lib/contesto";
import { href } from "@/lib/i18n";
import { egp, ZONE } from "@/lib/regole";
import { FLUSSO, tokenValido } from "@/lib/ordini";
import { confermaBloccoAction } from "@/app/azioni";
import { utenteCorrente } from "@/lib/sessione";

export const metadata: Metadata = { title: "Il tuo ordine", robots: { index: false, follow: false } };
type SP = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Ordine({ params, searchParams }: { params: Promise<{ numero: string }>; searchParams: Promise<SP> }) {
  const l = await lingua(); const _ = tx(l);
  const { numero } = await params; const sp = await searchParams;
  const o = await db.ordine.findUnique({ where: { numero }, include: { righe: true, storia: { orderBy: { ts: "asc" } } } });
  const u = await utenteCorrente();
  // il numero si indovina: i dati di una persona si mostrano solo a chi ha il link dell'email o è il proprietario
  const autorizzato = o && (tokenValido(o.token, uno(sp.t)) || (u && (o.utenteId === u.id || u.ruolo === "ADMIN")));
  if (!o || !autorizzato) notFound();

  const etichette: Record<string, string> = {
    DA_CONFERMARE: _("Ricevuto", "Received", "تم الاستلام"), CONFERMATO: _("Confermato", "Confirmed", "مؤكد"), PREPARAZIONE: _("In preparazione", "Preparing", "قيد التجهيز"),
    SPEDITO: _("Spedito", "Shipped", "تم الشحن"), CONSEGNATO: _("Consegnato", "Delivered", "تم التسليم"), ANNULLATO: _("Annullato", "Cancelled", "ملغى"),
  };
  const idx = FLUSSO.indexOf(o.stato);
  const ts = Object.fromEntries(o.storia.map((s) => [s.stato, s.ts]));
  const fmt = new Intl.DateTimeFormat(l === "ar" ? "ar-EG" : l === "en" ? "en-GB" : "it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" });
  const nuovo = o.creato.getTime() > Date.now() - 10 * 60_000; // appena fatto: il banner di ringraziamento

  return (
    <div className="foglio sezione" style={{ maxWidth: 820 }}>
      {nuovo && <div className="nota ok" role="status" style={{ marginBottom: 24 }}><b>{_("Ordine ricevuto. Grazie.", "Order received. Thank you.", "تم استلام الطلب. شكراً لك.")}</b>
        <p>{_("Ti chiamiamo per confermare prima di spedire.", "We will call you to confirm before shipping.", "سنتصل بك للتأكيد قبل الشحن.")}</p></div>}
      {o.bloccoScade && o.stato === "DA_CONFERMARE" && (
        <div className="nota avviso" role="status" style={{ marginBottom: 24 }}>
          <b>{_("Prezzo bloccato", "Price on hold", "السعر محجوز")}</b>
          {o.bloccoPagato ? <>
            <p>{_(`Il tuo prezzo e i tuoi pezzi sono riservati fino a ${fmt.format(o.bloccoScade)}. Per completare l'acquisto conferma qui sotto: l'acconto di ${egp(o.acconto)} è già detratto, il resto si paga alla consegna.`, `Your price and pieces are held until ${fmt.format(o.bloccoScade)}. To complete the purchase, confirm below: the ${egp(o.acconto)} deposit is already deducted and the rest is paid on delivery.`, `سعرك وقطعك محجوزة حتى ${fmt.format(o.bloccoScade)}. لإتمام الشراء أكّد أدناه: تم خصم العربون ${egp(o.acconto)} والباقي يُدفع عند الاستلام.`)}</p>
            <p className="lieve">{_("Se non confermi entro la scadenza il blocco decade e l'acconto non viene rimborsato.", "If you do not confirm before the deadline the hold lapses and the deposit is not refunded.", "إذا لم تؤكد قبل الموعد ينتهي الحجز ولا يُسترد العربون.")}</p>
            <form action={confermaBloccoAction} style={{ marginTop: 12 }}><input type="hidden" name="numero" value={o.numero} /><input type="hidden" name="t" value={uno(sp.t)} />
              <button className="tasto pieno">{_("Conferma l'acquisto", "Confirm purchase", "تأكيد الشراء")}</button></form>
          </> : <p>{_(`Per attivare il blocco servono ${egp(o.acconto)} di acconto. Scrivici nella chat del sito: ti diamo le istruzioni. Se l'acconto non arriva entro ${fmt.format(o.bloccoScade)} il blocco decade.`, `To activate the hold we need a ${egp(o.acconto)} deposit. Write to us in the site chat for instructions. If the deposit does not arrive before ${fmt.format(o.bloccoScade)} the hold lapses.`, `لتفعيل الحجز نحتاج عربوناً قدره ${egp(o.acconto)}. راسلنا في دردشة الموقع لنرسل لك التعليمات. إذا لم يصل العربون قبل ${fmt.format(o.bloccoScade)} ينتهي الحجز.`)}</p>}
        </div>
      )}
      {uno(sp.blocco) === "ok" && <div className="nota ok" role="status" style={{ marginBottom: 24 }}>{_("Acquisto confermato. Ti chiamiamo per la consegna.", "Purchase confirmed. We will call you about delivery.", "تم تأكيد الشراء. سنتصل بك بخصوص التسليم.")}</div>}
      {uno(sp.blocco) === "errore" && <div className="nota avviso" role="alert" style={{ marginBottom: 24 }}>{_("Non è stato possibile confermare: il blocco potrebbe essere scaduto.", "Could not confirm: the hold may have expired.", "تعذّر التأكيد: ربما انتهى الحجز.")}</div>}
      {uno(sp.codice) === "perso" && <div className="nota avviso" role="status" style={{ marginBottom: 24 }}>
        {_("Il codice sconto non valeva più al momento dell'ordine: l'ordine è a prezzo pieno.", "The discount code was no longer valid when the order was placed: the order is at full price.", "لم يعد رمز الخصم صالحاً وقت الطلب: الطلب بالسعر الكامل.")}</div>}
      {o.email && <p className="mono lieve" style={{ marginBottom: 8 }}>{_("Conferma inviata a", "Confirmation sent to", "أُرسل التأكيد إلى")} {o.email}</p>}
      <span className="mono lieve">{_("Numero ordine", "Order number", "رقم الطلب")}</span>
      <h1 style={{ fontSize: "clamp(28px,5vw,48px)", margin: "6px 0 20px" }} dir="ltr">{o.numero}</h1>

      {o.stato === "ANNULLATO" ? <p className="nota avviso"><b>{etichette.ANNULLATO}</b></p> : (
        <ol className="passi" aria-label={_("Stato dell'ordine", "Order status", "حالة الطلب")}>
          {FLUSSO.map((s, i) => (
            <li key={s} className={i < idx ? "fatto" : i === idx ? "ora" : ""} aria-current={i === idx ? "step" : undefined}>
              {etichette[s]}{ts[s] && i <= idx ? <><br /><span className="lieve">{fmt.format(ts[s])}</span></> : null}
            </li>
          ))}
        </ol>
      )}

      <table className="dati" style={{ marginTop: 20 }}><tbody>
        {o.righe.map((r) => <tr key={r.id}><td>{r.marca} {r.nome} <span className="lieve">({r.taglia}) × {r.quantita}</span></td><td className="tab" style={{ textAlign: "end" }}>{egp(r.prezzo * r.quantita)}</td></tr>)}
        <tr><td>{_("Spedizione", "Shipping", "الشحن")}</td><td className="tab" style={{ textAlign: "end" }}>{o.spedizione ? egp(o.spedizione) : _("Gratis", "Free", "مجاني")}</td></tr>
        {o.commissione > 0 && <tr><td>{_("Commissione contrassegno", "Cash-on-delivery fee", "عمولة الدفع عند الاستلام")}</td><td className="tab" style={{ textAlign: "end" }}>{egp(o.commissione)}</td></tr>}
        {o.sconto > 0 && <tr><td>{_("Codice", "Code", "الرمز")} {o.coupon}</td><td className="tab" style={{ textAlign: "end" }}>−{egp(o.sconto)}</td></tr>}
        <tr><th scope="row">{_("Totale", "Total", "الإجمالي")}</th><td className="tab" style={{ textAlign: "end", fontWeight: 700 }}>{egp(o.totale)}</td></tr>
        {o.acconto > 0 && <tr><td>{_("Acconto online", "Online deposit", "عربون إلكتروني")}</td><td className="tab" style={{ textAlign: "end" }}>{egp(o.acconto)}</td></tr>}
        {o.pagamento === "CONTRASSEGNO" && <tr><td>{_("Da pagare al corriere", "To pay the courier", "للدفع للمندوب")}</td><td className="tab" style={{ textAlign: "end" }}>{egp(o.contanti)}</td></tr>}
      </tbody></table>

      <p style={{ marginTop: 24 }} className="tenue">{o.nome} · <span dir="ltr">{o.telefono}</span><br />{o.indirizzo}, {o.governatorato} · {ZONE[o.zona]?.giorni}</p>
      <p style={{ marginTop: 28 }}><Link className="tasto vuoto" href={href(l, "/negozio")}>{_("Continua gli acquisti", "Keep shopping", "تابع التسوق")}</Link></p>
    </div>
  );
}
