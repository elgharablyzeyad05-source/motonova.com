import nodemailer from "nodemailer";
import { db } from "./db";
import { render, type Chiave, type Lingua } from "./email-testi";

export const postaConfigurata = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

function html(corpo: string, rtl: boolean) {
  const esc = corpo.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lnk = esc.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>");
  return `<div dir="${rtl ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0B0B0C">${lnk}</div>`;
}

/** Non lancia mai: una conferma che fallisce non deve far fallire l'ordine.
 *  Ogni email lascia una riga in `Posta`, così il pannello sa chi va chiamato. */
export async function inviaEmail(
  tipo: Chiave, a: string | null | undefined, lingua: string, vars: Record<string, string>,
): Promise<"INVIATA" | "NON_CONFIGURATA" | "ERRORE" | "SENZA_INDIRIZZO"> {
  if (!a) return "SENZA_INDIRIZZO";
  const l: Lingua = lingua === "it" || lingua === "ar" ? lingua : "en";
  let t;
  try { t = render(tipo, l, vars); } catch (e) {
    await db.posta.create({ data: { a, oggetto: tipo, tipo, esito: "ERRORE", errore: String(e).slice(0, 300) } }).catch(() => {});
    return "ERRORE";
  }
  if (!postaConfigurata()) {
    await db.posta.create({ data: { a, oggetto: t.oggetto, tipo, esito: "NON_CONFIGURATA" } }).catch(() => {});
    return "NON_CONFIGURATA";
  }
  try {
    const tr = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await tr.sendMail({ from: process.env.SMTP_FROM, to: a, subject: t.oggetto, text: t.corpo, html: html(t.corpo, t.rtl) });
    await db.posta.create({ data: { a, oggetto: t.oggetto, tipo, esito: "INVIATA" } });
    return "INVIATA";
  } catch (e) {
    await db.posta.create({ data: { a, oggetto: t.oggetto, tipo, esito: "ERRORE", errore: String(e).slice(0, 300) } }).catch(() => {});
    return "ERRORE";
  }
}
