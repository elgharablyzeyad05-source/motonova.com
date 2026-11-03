import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { GUIDE, PAGINE } from "@/lib/editoriale";
import { LINGUE, href } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.SITO_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const [prodotti, marche] = await Promise.all([
    db.prodotto.findMany({ where: { attivo: true }, select: { slug: true, tipo: true, creato: true } }),
    db.marca.findMany({ select: { slug: true } }),
  ]);
  const percorsi: { p: string; mod?: Date }[] = [
    { p: "/" }, { p: "/negozio" }, { p: "/aste" }, { p: "/guide" }, { p: "/marche" },
    ...GUIDE.map((g) => ({ p: `/guide/${g.id}` })), ...PAGINE.map((g) => ({ p: `/pagina/${g.id}` })),
    ...prodotti.map((x) => ({ p: x.tipo === "SECOND_LIFE" ? `/aste/${x.slug}` : `/prodotto/${x.slug}`, mod: x.creato })),
    ...marche.map((m) => ({ p: `/marche/${m.slug}` })),
  ];
  // ogni pagina in tre lingue, con le alternative dichiarate: Google serve la lingua giusta
  return percorsi.flatMap(({ p, mod }) => LINGUE.map((l) => ({
    url: base + href(l, p), lastModified: mod,
    alternates: { languages: { ...Object.fromEntries(LINGUE.map((x) => [x, base + href(x, p)])), "x-default": base + href("en", p) } },
  })));
}
