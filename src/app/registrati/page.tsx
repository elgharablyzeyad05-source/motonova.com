import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { lingua, tx } from "@/lib/contesto";
import { href } from "@/lib/i18n";
import { tornaSicuro, utenteCorrente } from "@/lib/sessione";
import { AccessoForm } from "@/componenti/AccessoForm";

export const metadata: Metadata = { title: "Registrati", robots: { index: false } };

export default async function Registrati({ searchParams }: { searchParams: Promise<{ torna?: string }> }) {
  const l = await lingua(); const _ = tx(l); const { torna } = await searchParams;
  const dove = tornaSicuro(torna, href(l, "/account"));
  if (await utenteCorrente()) redirect(dove);
  return (
    <div className="foglio sezione" style={{ maxWidth: 460 }}>
      <h1 style={{ marginBottom: 24 }}>{_("Crea l'account", "Create account", "إنشاء حساب")}</h1>
      <AccessoForm l={l} modo="registrati" torna={dove} />
      <p className="tenue" style={{ marginTop: 20 }}>{_("Hai già un account?", "Already have an account?", "لديك حساب بالفعل؟")} <Link style={{ textDecoration: "underline" }} href={href(l, "/accedi")}>{_("Accedi", "Sign in", "دخول")}</Link></p>
    </div>
  );
}
