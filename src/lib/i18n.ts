import { traduciTesto } from "./glossario";
import en from "../../dati/lingua-en.json";
import ar from "../../dati/lingua-ar.json";
import contenuti from "../../dati/contenuti.json";

export const LINGUE = ["en", "it", "ar"] as const;
export const LINGUA_BASE: Lingua = "en";
export type Lingua = (typeof LINGUE)[number];

export function èLingua(x: string): x is Lingua {
  return (LINGUE as readonly string[]).includes(x);
}

const DIZ: Record<"en" | "ar", Record<string, string>> = {
  en: { ...(en as Record<string, string>), ...((contenuti as any).en as Record<string, string>) },
  ar: { ...(ar as Record<string, string>), ...((contenuti as any).ar as Record<string, string>) },
};

/** L'italiano è la lingua di partenza: la frase italiana è la chiave.
 *  Se una frase non ha traduzione ripiega sull'italiano e lo dice a chi chiama. */
export function tradotta(lingua: Lingua, frase: string): boolean {
  return lingua === "it" || frase in DIZ[lingua];
}

export function tr(lingua: Lingua, frase: string): string {
  if (lingua === "it") return frase;
  return DIZ[lingua][frase] ?? frase;
}

/** Contenuti scritti a mano (colori, condizioni, note): prima il dizionario del sito, poi il glossario,
    che traduce anche dall'inglese all'italiano («black matt» → «Nero opaco»). */
export function tc(lingua: Lingua, testo: string | null | undefined): string {
  if (!testo) return "";
  const d = lingua === "it" ? undefined : DIZ[lingua][testo];
  return d ?? traduciTesto(testo, lingua);
}

/** Testi nuovi, scritti per il sito vero. Chiave = id; i tre testi insieme, così non si dimentica una lingua. */
export type Voce = { it: string; en: string; ar: string };

export function v(lingua: Lingua, voce: Voce, ...args: (string | number)[]): string {
  let s = voce[lingua] ?? voce.it;
  args.forEach((a, i) => { s = s.replaceAll(`{${i}}`, String(a)); });
  return s;
}

export const DIR: Record<Lingua, "ltr" | "rtl"> = { it: "ltr", en: "ltr", ar: "rtl" };

export function href(lingua: Lingua, percorso: string): string {
  if (lingua === LINGUA_BASE) return percorso;
  return percorso === "/" ? `/${lingua}` : `/${lingua}${percorso}`;
}
