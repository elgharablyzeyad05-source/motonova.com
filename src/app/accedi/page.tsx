import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { lingua, tx } from "@/lib/contesto";
import { href } from "@/lib/i18n";
import { tornaSicuro, utenteCorrente } from "@/lib/sessione";
import { AccessoForm } from "@/componenti/AccessoForm";

export const metadata: Metadata = { title: "Accedi", robots: { index: false } };

export default async function Accedi({ searchParams }: { searchParams: Promise<{ torna?: string }> }) {
  const l = await lingua(); const _ = tx(l); const { torna } = await searchParams;
  const dove = tornaSicuro(torna, href(l, "/account"));
  if (await utenteCorrente()) redirect(dove);
  return (
    <div className="foglio sezione" style={{ maxWidth: 460 }}>
      <h1 style={{ marginBottom: 24 }}>{_("Accedi", "Sign in", "ادخل")}</h1>
      <AccessoForm l={l} modo="accedi" torna={dove} />
      <p className="tenue" style={{ marginTop: 20 }}>{_("Non hai un account?", "No account yet?", "لسه معندكش حساب؟")} <Link style={{ textDecoration: "underline" }} href={href(l, "/registrati") + (torna ? `?torna=${encodeURIComponent(dove)}` : "")}>{_("Registrati", "Sign up", "اعمل حساب")}</Link></p>
      <p className="mono lieve" style={{ marginTop: 10 }}>{_("L'account non serve per comprare: puoi ordinare anche come ospite.", "You don't need an account to buy: you can check out as a guest.", "مش لازم يكون عندك حساب عشان تشتري: تقدر تطلب كضيف.")}</p>
    </div>
  );
}
