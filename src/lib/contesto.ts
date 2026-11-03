import { headers } from "next/headers";
import { èLingua, type Lingua } from "./i18n";

export async function lingua(): Promise<Lingua> {
  const x = (await headers()).get("x-lingua") ?? "en";
  return èLingua(x) ? x : "en";
}

export { tx } from "./tx";

export async function baseUrl(): Promise<string> {
  if (process.env.SITO_URL) return process.env.SITO_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** Il percorso corrente senza prefisso di lingua, con la query: serve al cambio lingua. */
export async function percorso(): Promise<string> {
  return (await headers()).get("x-percorso") ?? "/";
}
