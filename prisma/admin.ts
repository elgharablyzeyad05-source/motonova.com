// Crea solo l'amministratore (nessun prodotto di prova). Idempotente.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const email = (process.env.ADMIN_EMAIL ?? "").toLowerCase(); const pw = process.env.ADMIN_PASSWORD ?? "";
if (!email || pw.length < 10) { console.error("Servono ADMIN_EMAIL e ADMIN_PASSWORD (almeno 10 caratteri)"); process.exit(1); }
if (await db.utente.findUnique({ where: { email } })) console.log("Amministratore già presente");
else { await db.utente.create({ data: { id: "c" + randomBytes(12).toString("hex"), email, nome: "Amministratore", passwordHash: await bcrypt.hash(pw, 11), ruolo: "ADMIN" } }); console.log("Amministratore creato:", email); }
await db.$disconnect();
