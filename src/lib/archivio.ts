import { createHash, createHmac } from "node:crypto";
import { db } from "@/lib/db";

// Foto su Cloudflare R2 (API compatibile S3, firma AWS SigV4 senza librerie esterne).
// Variabili su Vercel: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
// Le foto nuove si salvano ancora nella tabella Media; l'op agenti «spostaFotoR2» le copia su R2
// e svuota i byte nel database (la riga resta, con dati vuoti = «la foto sta su R2»).

const env = () => ({
  // tollera l'indirizzo intero incollato al posto dell'Account ID (https://<id>.r2.cloudflarestorage.com/...)
  conto: (process.env.R2_ACCOUNT_ID ?? "").trim().replace(/^https?:\/\//, "").replace(/\.r2\.cloudflarestorage\.com.*$/, "").replace(/[/\s].*$/, ""),
  chiave: (process.env.R2_ACCESS_KEY_ID ?? "").trim(),
  segreto: (process.env.R2_SECRET_ACCESS_KEY ?? "").trim(),
  secchio: (process.env.R2_BUCKET ?? "").trim(),
});

export const r2Attivo = () => { const e = env(); return !!(e.conto && e.chiave && e.segreto && e.secchio); };

const sha = (d: Buffer | string) => createHash("sha256").update(d).digest("hex");
const hmac = (k: Buffer | string, d: string) => createHmac("sha256", k).update(d).digest();

async function r2(metodo: "GET" | "PUT" | "DELETE", percorso: string, corpo?: Uint8Array) {
  const e = env();
  const host = `${e.conto}.r2.cloudflarestorage.com`;
  const chiaveOggetto = "/" + e.secchio + "/" + percorso.split("/").map(encodeURIComponent).join("/");
  const ora = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const giorno = ora.slice(0, 8);
  const payload = corpo ? Buffer.from(corpo) : Buffer.alloc(0);
  const hashPayload = sha(payload);
  const intestazioni: Record<string, string> = { host, "x-amz-content-sha256": hashPayload, "x-amz-date": ora };
  if (corpo) intestazioni["content-type"] = "image/webp";
  const nomi = Object.keys(intestazioni).sort();
  const canonica = [metodo, chiaveOggetto, "", nomi.map((n) => `${n}:${intestazioni[n]}\n`).join(""), nomi.join(";"), hashPayload].join("\n");
  const ambito = `${giorno}/auto/s3/aws4_request`;
  const daFirmare = ["AWS4-HMAC-SHA256", ora, ambito, sha(canonica)].join("\n");
  const kFirma = hmac(hmac(hmac(hmac("AWS4" + e.segreto, giorno), "auto"), "s3"), "aws4_request");
  const firma = createHmac("sha256", kFirma).update(daFirmare).digest("hex");
  intestazioni.authorization = `AWS4-HMAC-SHA256 Credential=${e.chiave}/${ambito}, SignedHeaders=${nomi.join(";")}, Signature=${firma}`;
  const { host: _h, ...h } = intestazioni;
  if (!/^[0-9a-f]{32}$/.test(e.conto)) throw new Error(`R2_ACCOUNT_ID non valido: servono 32 caratteri esadecimali (ora ${e.conto.length} caratteri)`);
  try {
    return await fetch(`https://${host}${chiaveOggetto}`, { method: metodo, headers: h, body: corpo ? payload : undefined });
  } catch (x) {
    const c = (x as { cause?: { code?: string; message?: string } }).cause;
    throw new Error(`R2 non raggiungibile: ${c?.code ?? ""} ${c?.message ?? (x as Error).message}`.trim());
  }
}

export async function r2Scrivi(percorso: string, dati: Uint8Array) {
  const r = await r2("PUT", percorso, dati);
  if (!r.ok) throw new Error(`R2 PUT ${r.status} ${(await r.text()).slice(0, 200)}`);
}

export async function r2Leggi(percorso: string): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!r2Attivo()) return null;
  const r = await r2("GET", percorso);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`R2 GET ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

export async function r2Cancella(percorso: string) {
  if (r2Attivo()) await r2("DELETE", percorso).catch(() => null);
}

// I byte di una foto, ovunque stiano (database o R2). null se non esiste.
export async function leggiMedia(percorso: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const m = await db.media.findUnique({ where: { percorso } });
  if (!m) return null;
  if (m.dati && m.dati.length > 0) return Uint8Array.from(m.dati);
  return r2Leggi(percorso);
}
