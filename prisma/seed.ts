// Seme: i 31 prodotti di prova del prototipo + le aste Second Life + il primo amministratore.
// I prodotti sono INVENTATI (nomi e prezzi plausibili): si cancellano dal pannello man mano
// che si caricano quelli veri. Non gira su un database che ha già prodotti, salvo --forza.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { slugDi } from "../src/lib/regole";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const id = () => "c" + randomBytes(12).toString("hex");

type P = {
  id: string; brand: string; name: string; sub?: string; cat: string; stili: string[]; prezzo: number; was?: number;
  taglie: string[]; stock: number; sl?: boolean; grado?: string; place?: string; nota?: string;
  specs?: [string, string][]; report?: [string, string, string][]; descr?: string[];
};

/** Stesse scorte del prototipo: ripartite sulle taglie, con qualche taglia esaurita come in un negozio vero. */
function scortePerTaglia(p: P): Record<string, number> {
  const out: Record<string, number> = {}; const n = p.taglie.length;
  if (!n) return out;
  if (p.stock <= 0) { p.taglie.forEach((t) => (out[t] = 0)); return out; }
  const base = Math.floor(p.stock / n), resto = p.stock - base * n;
  p.taglie.forEach((t, i) => {
    out[t] = base + (i < resto ? 1 : 0);
    const seed = (p.id.charCodeAt(0) + p.id.charCodeAt(p.id.length - 1) + i * 13) % 7;
    const centrale = i === Math.floor(n / 2);
    if (seed === 0 && out[t] <= 1 && n > 2 && !centrale) out[t] = 0;
  });
  if (!p.taglie.some((t) => out[t] > 0)) out[p.taglie[0]] = p.stock;
  return out;
}

async function main() {
  const forza = process.argv.includes("--forza");
  const esistenti = await db.prodotto.count();
  if (esistenti > 0 && !forza) {
    console.log(`Il database ha già ${esistenti} prodotti: non tocco niente. (--forza per ricaricare i prodotti di prova)`);
  } else {
    const cat = JSON.parse(readFileSync("dati/catalogo.json", "utf8")) as { prodotti: P[] };
    const marche = new Map<string, string>();
    for (const p of cat.prodotti) {
      if (!marche.has(p.brand)) {
        const m = await db.marca.upsert({ where: { nome: p.brand }, update: {}, create: { id: id(), nome: p.brand, slug: slugDi(p.brand) } });
        marche.set(p.brand, m.id);
      }
    }
    let nuovi = 0, aste = 0;
    for (const p of cat.prodotti) {
      const scorte = scortePerTaglia(p);
      const creato = await db.prodotto.upsert({
        where: { slug: p.id },
        update: {},
        create: {
          id: id(), slug: p.id, marcaId: marche.get(p.brand)!, nome: p.name, sottotitolo: p.sub ?? "",
          categoria: p.cat, stili: p.stili, tipo: p.sl ? "SECOND_LIFE" : "NUOVO", prezzo: p.prezzo,
          prezzoPrima: p.was ?? null, nota: p.nota ?? "", luogo: p.place ?? "", grado: p.grado ?? null,
          descrizione: p.descr ?? [], specs: p.specs ?? [], report: p.report ?? undefined,
          varianti: { create: p.taglie.map((t) => ({ id: id(), taglia: t, giacenza: scorte[t] ?? 0 })) },
        },
      });
      nuovi++;
      if (p.sl) {
        // partenza a metà prezzo, riserva all'80%: valori di partenza, si cambiano dal pannello
        const arrot = (x: number) => Math.round(x / 10000) * 10000;
        await db.asta.upsert({
          where: { prodottoId: creato.id },
          update: {},
          create: {
            id: id(), prodottoId: creato.id, inizio: new Date(Date.now() - 3600_000), fine: new Date(Date.now() + 7 * 864e5),
            partenza: arrot(p.prezzo * 0.5), riserva: arrot(p.prezzo * 0.8), stato: "APERTA",
          },
        });
        aste++;
      }
    }
    console.log(`Prodotti: ${nuovi} · marche: ${marche.size} · aste: ${aste}`);
  }

  const email = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
  const pw = process.env.ADMIN_PASSWORD ?? "";
  if (email && pw) {
    const a = await db.utente.findUnique({ where: { email } });
    if (!a) {
      await db.utente.create({ data: { id: id(), email, nome: "Amministratore", passwordHash: await bcrypt.hash(pw, 11), ruolo: "ADMIN" } });
      console.log(`Amministratore creato: ${email}`);
    } else console.log(`Amministratore già presente: ${email}`);
  }
}

main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
