import { db } from "./db";
import { Prisma } from "@/generated/prisma/client";

export const CATEGORIE = ["caschi", "giacche", "pantaloni", "tute", "gilet", "guanti", "stivali", "protezioni", "accessori", "manutenzione"] as const;
export const STILI = ["sport", "street", "adventure", "touring", "urban"] as const;

export const ETICHETTA_CAT: Record<string, string> = {
  caschi: "Caschi", giacche: "Giacche", guanti: "Guanti", stivali: "Stivali e scarpe",
  protezioni: "Protezioni", accessori: "Accessori",
  pantaloni: "Pantaloni", tute: "Tute", gilet: "Gilet", manutenzione: "Cura e manutenzione",
};
export const ETICHETTA_STILE: Record<string, string> = {
  sport: "Sport", street: "Street", adventure: "Adventure", touring: "Touring", urban: "Urban",
};

export type Filtri = {
  q?: string; cat?: string; stile?: string; marca?: string; taglia?: string;
  max?: number; solo?: boolean; ord?: string;
  sotto?: string; colore?: string; genere?: string; materiale?: string; cert?: string; moto?: string;
};

const conVarianti = {
  marca: true,
  foto: { orderBy: { ordine: "asc" as const }, take: 1 },
  varianti: { orderBy: { taglia: "asc" as const } },
} satisfies Prisma.ProdottoInclude;

export type ProdottoLista = Prisma.ProdottoGetPayload<{ include: typeof conVarianti }>;

export const disponibile = (v: { giacenza: number; impegnati: number }) => Math.max(0, v.giacenza - v.impegnati);
export const totaleDisponibile = (p: { varianti: { giacenza: number; impegnati: number }[] }) =>
  p.varianti.reduce((s, v) => s + disponibile(v), 0);

/** Filtri e ricerca li fa il database, non il browser. */
export async function cerca(f: Filtri): Promise<ProdottoLista[]> {
  const where: Prisma.ProdottoWhereInput = { attivo: true, tipo: "NUOVO" };
  if (f.cat && (CATEGORIE as readonly string[]).includes(f.cat)) where.categoria = f.cat;
  if (f.stile && (STILI as readonly string[]).includes(f.stile)) where.stili = { has: f.stile };
  if (f.marca) where.marca = { slug: f.marca };
  if (f.max && f.max > 0) where.prezzo = { lte: f.max };
  if (f.sotto) where.sottocategoria = { equals: f.sotto, mode: "insensitive" };
  if (f.colore) where.colore = { equals: f.colore, mode: "insensitive" };
  if (f.genere) where.genere = { equals: f.genere, mode: "insensitive" };
  if (f.materiale) where.materiale = { equals: f.materiale, mode: "insensitive" };
  if (f.cert) where.certificazione = { contains: f.cert, mode: "insensitive" };
  if (f.moto) where.moto = { contains: f.moto.slice(0, 60), mode: "insensitive" };
  const q = f.q?.trim();
  if (q) {
    where.OR = [
      { nome: { contains: q, mode: "insensitive" } },
      { sottotitolo: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { marca: { nome: { contains: q, mode: "insensitive" } } },
      { moto: { contains: q, mode: "insensitive" } },
      { sottocategoria: { contains: q, mode: "insensitive" } },
    ];
  }
  if (f.taglia || f.solo) {
    const righe = f.taglia
      ? await db.$queryRaw<{ id: string }[]>`SELECT DISTINCT "prodottoId" AS id FROM "Variante" WHERE "giacenza" > "impegnati" AND "taglia" = ${f.taglia}`
      : await db.$queryRaw<{ id: string }[]>`SELECT DISTINCT "prodottoId" AS id FROM "Variante" WHERE "giacenza" > "impegnati"`;
    where.id = { in: righe.map((r) => r.id) };
  }
  const lista = await db.prodotto.findMany({ where, include: conVarianti, orderBy: { creato: "desc" } });
  switch (f.ord) {
    case "prezzo-asc": lista.sort((a, b) => a.prezzo - b.prezzo); break;
    case "prezzo-desc": lista.sort((a, b) => b.prezzo - a.prezzo); break;
    case "sconto": lista.sort((a, b) => scontoNum(b) - scontoNum(a)); break;
    case "novita": break;
    default: lista.sort((a, b) => Number(!!b.prezzoPrima) - Number(!!a.prezzoPrima) || a.nome.localeCompare(b.nome));
  }
  return lista;
}

function scontoNum(p: { prezzo: number; prezzoPrima: number | null }) {
  return p.prezzoPrima ? 1 - p.prezzo / p.prezzoPrima : 0;
}

/** Conteggi per i filtri: opzioni che si spengono a zero risultati. */
export async function opzioniFiltri() {
  const distinti = async (campo: "sottocategoria" | "colore" | "genere" | "materiale" | "certificazione") =>
    (await db.prodotto.findMany({ where: { attivo: true, tipo: "NUOVO", NOT: { [campo]: null } }, distinct: [campo], select: { [campo]: true }, orderBy: { [campo]: "asc" } }))
      .map((r) => (r as unknown as Record<string, string | null>)[campo]).filter((v): v is string => !!v);
  const [cat, stili, marche, taglie, sotto, colori, generi, materiali, cert] = await Promise.all([
    db.prodotto.groupBy({ by: ["categoria"], where: { attivo: true, tipo: "NUOVO" }, _count: true }),
    db.$queryRaw<{ s: string; n: bigint }[]>`SELECT s, COUNT(*) AS n FROM "Prodotto", UNNEST("stili") AS s WHERE "attivo" AND "tipo" = 'NUOVO' GROUP BY s`,
    db.marca.findMany({ where: { prodotti: { some: { attivo: true, tipo: "NUOVO" } } }, orderBy: { nome: "asc" }, select: { slug: true, nome: true, _count: { select: { prodotti: { where: { attivo: true, tipo: "NUOVO" } } } } } }),
    db.$queryRaw<{ taglia: string }[]>`SELECT DISTINCT v."taglia" FROM "Variante" v JOIN "Prodotto" p ON p.id = v."prodottoId" WHERE p."attivo" AND p."tipo" = 'NUOVO' ORDER BY v."taglia"`,
    distinti("sottocategoria"), distinti("colore"), distinti("genere"), distinti("materiale"), distinti("certificazione"),
  ]);
  return {
    cat: Object.fromEntries(cat.map((c) => [c.categoria, c._count])) as Record<string, number>,
    stili: Object.fromEntries(stili.map((r) => [r.s, Number(r.n)])) as Record<string, number>,
    marche: marche.map((m) => ({ slug: m.slug, nome: m.nome, n: m._count.prodotti })),
    taglie: ordinaTaglie(taglie.map((t) => t.taglia)),
    sotto, colori, generi, materiali, cert,
  };
}

const ORDINE_TAGLIE = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];
export function ordinaTaglie(t: string[]) {
  return [...t].sort((a, b) => {
    const ia = ORDINE_TAGLIE.indexOf(a), ib = ORDINE_TAGLIE.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

export async function prodottoPerSlug(slug: string) {
  return db.prodotto.findUnique({
    where: { slug },
    include: { marca: true, foto: { orderBy: { ordine: "asc" } }, varianti: true, asta: true },
  });
}

export async function correlati(p: { id: string; categoria: string; stili: string[] }, n = 3) {
  const stessa = await db.prodotto.findMany({
    where: { attivo: true, tipo: "NUOVO", id: { not: p.id }, categoria: p.categoria },
    include: conVarianti, take: n, orderBy: { creato: "desc" },
  });
  if (stessa.length >= n) return stessa;
  const altri = await db.prodotto.findMany({
    where: { attivo: true, tipo: "NUOVO", id: { notIn: [p.id, ...stessa.map((s) => s.id)] }, categoria: { not: p.categoria }, stili: { hasSome: p.stili } },
    include: conVarianti, take: n - stessa.length,
  });
  return [...stessa, ...altri];
}

export async function suggerimenti(q: string) {
  const t = q.trim();
  if (t.length < 2) return [];
  return db.prodotto.findMany({
    where: {
      attivo: true, tipo: "NUOVO",
      OR: [{ nome: { contains: t, mode: "insensitive" } }, { marca: { nome: { contains: t, mode: "insensitive" } } }, { slug: { contains: t, mode: "insensitive" } }],
    },
    select: { slug: true, nome: true, marca: { select: { nome: true } } }, take: 6,
  });
}

/** Vetrine della home: se non c'è nulla da mostrare, la sezione sparisce (niente scaffali vuoti). */
export async function vetrine() {
  const base = { attivo: true, tipo: "NUOVO" as const };
  const [nuovi, offerte, venduti, marche] = await Promise.all([
    db.prodotto.findMany({ where: base, include: conVarianti, orderBy: { creato: "desc" }, take: 4 }),
    db.prodotto.findMany({ where: { ...base, prezzoPrima: { not: null } }, include: conVarianti, orderBy: { creato: "desc" }, take: 4 }),
    db.$queryRaw<{ id: string }[]>`SELECT p."id" FROM "RigaOrdine" r JOIN "Ordine" o ON o."id" = r."ordineId" JOIN "Variante" v ON v."id" = r."varianteId" JOIN "Prodotto" p ON p."id" = v."prodottoId"
      WHERE o."stato" <> 'ANNULLATO' AND p."attivo" AND p."tipo" = 'NUOVO' GROUP BY p."id" ORDER BY SUM(r."quantita") DESC LIMIT 4`,
    db.marca.findMany({ where: { prodotti: { some: base } }, orderBy: { nome: "asc" }, select: { slug: true, nome: true }, take: 12 }),
  ]);
  const piuVenduti = venduti.length
    ? (await db.prodotto.findMany({ where: { id: { in: venduti.map((v) => v.id) } }, include: conVarianti })).sort((a, b) => venduti.findIndex((v) => v.id === a.id) - venduti.findIndex((v) => v.id === b.id))
    : [];
  return { nuovi, offerte, piuVenduti, marche };
}
