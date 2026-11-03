import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { trovaCarrello, vistaCarrello } from "@/lib/carrello";
import { lingua, tx } from "@/lib/contesto";
import { href } from "@/lib/i18n";
import { utenteCorrente } from "@/lib/sessione";
import { egp } from "@/lib/regole";
import { CassaForm } from "@/componenti/CassaForm";

export const metadata: Metadata = { title: "Cassa", robots: { index: false } };
type SP = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Checkout({ searchParams }: { searchParams: Promise<SP> }) {
  const l = await lingua(); const _ = tx(l); const sp = await searchParams;
  const k = await trovaCarrello();
  const v = await vistaCarrello(k);
  if (!v.righe.length) redirect(href(l, "/carrello"));
  const u = await utenteCorrente();
  const e: Record<string, string> = {
    NON_VALIDO: _("Codice non valido", "Invalid code", "رمز غير صالح"),
    SCADUTO: _("Questo codice è scaduto", "This code has expired", "انتهت صلاحية هذا الرمز"),
    ESAURITO: _("Questo codice è esaurito", "This code has been used up", "نفد هذا الرمز"),
    SOTTO_MINIMO: _(`Il codice vale da ${egp(Number(uno(sp.min)))} di merce`, `This code applies from ${egp(Number(uno(sp.min)))} of goods`, `يسري الرمز من ${egp(Number(uno(sp.min)))} من البضاعة`),
    GIA_USATO: _("Hai già usato questo codice", "You have already used this code", "لقد استخدمت هذا الرمز من قبل"),
  };
  const errore = e[uno(sp.coupon)] ?? (v.couponErrore ? e[v.couponErrore] : null) ?? null;
  return (
    <div className="foglio sezione">
      <p className="mono lieve" style={{ marginBottom: 10 }}><Link href={href(l, "/carrello")}>← {_("Carrello", "Cart", "السلة")}</Link></p>
      <h1 style={{ marginBottom: 28 }}>{_("Cassa", "Checkout", "إتمام الشراء")}</h1>
      <CassaForm l={l} subtotale={v.subtotale} sconto={v.coupon?.sconto ?? 0} codice={v.coupon?.codice ?? null}
        righe={v.righe.map((r) => ({ nome: r.nome, marca: r.marca, taglia: r.taglia, quantita: r.quantita, prezzo: r.prezzo }))}
        cartaAttiva={Boolean(process.env.PAYMOB_API_KEY)} haAsta={v.righe.some((r) => r.unico)} haPattuito={v.righe.some((r) => r.pattuito)}
        prefill={{ nome: u?.nome ?? "", telefono: u?.telefono ?? "", email: u?.email ?? "" }} erroreCoupon={errore} />
    </div>
  );
}
