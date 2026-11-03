import type { Lingua } from "./i18n";
/** Piccolo traduttore: `const _ = tx(l); _("Carrello", "Cart", "السلة")`. Puro, usabile anche nei componenti client. */
export const tx = (l: Lingua) => (it: string, en: string, ar: string) => (l === "en" ? en : l === "ar" ? ar : it);
