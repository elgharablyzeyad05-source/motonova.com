import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { lingua, tx } from "@/lib/contesto";
import { href } from "@/lib/i18n";
import { utenteCorrente } from "@/lib/sessione";
import { egp } from "@/lib/regole";
import { esciAction, cambiaPasswordAction } from "../azioni";
import { Scheda } from "@/componenti/Scheda";

export const metadata: Metadata = { title: "Il mio account", robots: { index: false } };

export default async function Account({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const l = await lingua(); const _ = tx(l); const sp = await searchParams;
  const u = await utenteCorrente();
  if (!u) redirect(href(l, "/accedi") + `?torna=${encodeURIComponent(href(l, "/account"))}`);
  const [ordini, pref, vinte] = await Promise.all([
    db.ordine.findMany({ where: { utenteId: u.id }, orderBy: { creato: "desc" }, include: { righe: true } }),
    db.preferito.findMany({ where: { utenteId: u.id }, orderBy: { creato: "desc" }, include: { prodotto: { include: { marca: true, foto: { orderBy: { ordine: "asc" }, take: 1 }, varianti: true } } } }),
    db.asta.findMany({ where: { vincitoreId: u.id, stato: "CHIUSA" }, include: { prodotto: true } }),
  ]);
  const stati: Record<string, string> = {
    DA_CONFERMARE: _("Ricevuto", "Received", "تم الاستلام"), CONFERMATO: _("Confermato", "Confirmed", "مؤكد"), PREPARAZIONE: _("In preparazione", "Preparing", "قيد التجهيز"),
    SPEDITO: _("Spedito", "Shipped", "تم الشحن"), CONSEGNATO: _("Consegnato", "Delivered", "تم التسليم"), ANNULLATO: _("Annullato", "Cancelled", "ملغى"),
  };
  const fmt = new Intl.DateTimeFormat(l === "ar" ? "ar-EG" : l === "en" ? "en-GB" : "it-IT", { dateStyle: "medium", timeZone: "Africa/Cairo" });
  return (
    <div className="foglio sezione">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
        <div><span className="mono lieve">{u.email}</span><h1 style={{ marginTop: 6 }}>{u.nome}</h1></div>
        <form action={esciAction}><button className="tasto vuoto esci">{_("Esci", "Sign out", "خروج")}</button></form>
      </div>
      {vinte.length > 0 && <div className="nota ok" style={{ marginBottom: 28 }}><b>{_("Hai vinto", "You won", "لقد فزت")}</b>{vinte.map((a) => <p key={a.id}>{a.prodotto.nome} — {egp(a.prezzoFinale ?? 0)} · <Link style={{ textDecoration: "underline" }} href={href(l, "/carrello")}>{_("Vai alla cassa", "Go to checkout", "إتمام الشراء")}</Link></p>)}</div>}
      <section><h2 style={{ marginBottom: 16 }}>{_("I miei ordini", "My orders", "طلباتي")}</h2>
        {ordini.length === 0 ? <p className="tenue">{_("Nessun ordine ancora.", "No orders yet.", "لا توجد طلبات بعد.")}</p> : (
          <table className="dati"><thead><tr><th>{_("Ordine", "Order", "الطلب")}</th><th>{_("Data", "Date", "التاريخ")}</th><th>{_("Stato", "Status", "الحالة")}</th><th style={{ textAlign: "end" }}>{_("Totale", "Total", "الإجمالي")}</th></tr></thead><tbody>
            {ordini.map((o) => <tr key={o.id}><td><Link style={{ textDecoration: "underline" }} href={href(l, `/ordine/${o.numero}`)} dir="ltr">{o.numero}</Link></td><td>{fmt.format(o.creato)}</td><td>{stati[o.stato]}</td><td className="tab" style={{ textAlign: "end" }}>{egp(o.totale)}</td></tr>)}
          </tbody></table>)}
      </section>
      <section className="filetto" style={{ marginTop: 44 }}><h2 style={{ marginBottom: 20 }}>{_("Preferiti", "Favourites", "المفضلة")}</h2>
        {pref.length === 0 ? <p className="tenue">{_("Tocca il cuore su un prodotto per salvarlo qui.", "Tap the heart on a product to save it here.", "اضغط على القلب في أي منتج لحفظه هنا.")}</p> : (
          <div className="griglia">{pref.map((f) => (
            <div key={f.id}>
              <Scheda p={f.prodotto} l={l} preferito torna={href(l, "/account")} />
              {f.prodotto.prezzo !== f.prezzoSalvato && <p className="mono" style={{ marginTop: 6, color: f.prodotto.prezzo < f.prezzoSalvato ? "var(--verde)" : "var(--testo-2)" }}>{_("Prezzo quando l'hai salvato", "Price when saved", "السعر عند الحفظ")}: {egp(f.prezzoSalvato)}</p>}
            </div>))}</div>)}
      </section>

      <section className="filetto" id="password" style={{ marginTop: 44, maxWidth: 440 }}>
        <h2 style={{ marginBottom: 16 }}>{_("Cambia password", "Change password", "تغيير كلمة المرور")}</h2>
        {sp.pw === "ok" && <p className="nota ok" role="status" style={{ marginBottom: 14 }}>{_("Password aggiornata. Gli altri dispositivi sono stati scollegati.", "Password updated. Other devices were signed out.", "تم تحديث كلمة المرور وتسجيل الخروج من الأجهزة الأخرى.")}</p>}
        {sp.pw && sp.pw !== "ok" && <p className="nota avviso" role="alert" style={{ marginBottom: 14 }}>{sp.pw === "errata" ? _("La password attuale non è corretta", "Current password is wrong", "كلمة المرور الحالية غير صحيحة") : sp.pw === "corta" ? _("La nuova password deve avere almeno 10 caratteri", "New password must be at least 10 characters", "يجب ألا تقل كلمة المرور الجديدة عن 10 أحرف") : _("Troppi tentativi, riprova tra poco", "Too many attempts, try again shortly", "محاولات كثيرة، حاول بعد قليل")}</p>}
        <form action={cambiaPasswordAction}>
          <div className="campo"><label htmlFor="vecchia">{_("Password attuale", "Current password", "كلمة المرور الحالية")}</label><input id="vecchia" name="vecchia" type="password" autoComplete="current-password" required /></div>
          <div className="campo"><label htmlFor="nuova">{_("Nuova password (almeno 10 caratteri)", "New password (min. 10 characters)", "كلمة المرور الجديدة (10 أحرف على الأقل)")}</label><input id="nuova" name="nuova" type="password" autoComplete="new-password" minLength={10} required /></div>
          <button className="tasto">{_("Aggiorna", "Update", "تحديث")}</button>
        </form>
      </section>
    </div>
  );
}
