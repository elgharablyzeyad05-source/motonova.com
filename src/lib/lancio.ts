import { db } from "./db";
import { richiediAdmin } from "./sessione";

/** Data del drop: fino ad allora negozio, aste, categorie e marche mostrano «Coming soon» con il conto alla rovescia.
    Per spostarla basta cambiare questa riga. Ora del Cairo. */
export const LANCIO = new Date("2026-11-17T13:00:00+02:00");

/** Chiuso finché non arriva la data, e comunque finché non c'è almeno un prodotto visibile
    (così, se il drop slitta, nessuno trova un negozio vuoto). L'amministratore vede sempre tutto. */
export async function negozioChiuso(): Promise<boolean> {
  if (await richiediAdmin()) return false;
  if (Date.now() < LANCIO.getTime()) return true;
  return (await db.prodotto.count({ where: { attivo: true } })) === 0;
}
