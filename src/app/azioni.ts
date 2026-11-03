"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { nuovoId } from "@/lib/id";
import { lingua, tx, baseUrl } from "@/lib/contesto";
import { href } from "@/lib/i18n";
import { cifra, confronta, creaSessione, chiudiSessione, tornaSicuro, utenteCorrente } from "@/lib/sessione";
import * as carrelloLib from "@/lib/carrello";
import { creaOrdine, emailConferma, confermaBlocco } from "@/lib/ordini";
import { emailValida, egp, telefonoEgiziano, type Metodo } from "@/lib/regole";
import { limita, azzera } from "@/lib/limite";
import { offri } from "@/lib/aste";
import { postaConfigurata } from "@/lib/posta";
import { disponibile } from "@/lib/catalogo";

async function ip() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "locale").split(",")[0].trim();
}
const testo = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ── carrello ────────────────────────────────────────────────────────────────

export type RispostaAggiungi =
  | { ok: true; marca: string; nome: string; taglia: string; prezzo: number; pezzi: number; totale: number }
  | { ok: false; messaggio: string };

export async function aggiungiAlCarrello(varianteId: string, quantita: number): Promise<RispostaAggiungi> {
  const l = await lingua(); const _ = tx(l);
  if (!(await limita(`agg:${await ip()}`, 120, 60_000))) return { ok: false, messaggio: _("Troppe richieste, riprova tra poco", "Too many requests, try again shortly", "طلبات كثيرة، حاول بعد قليل") };
  const esito = await carrelloLib.aggiungi(varianteId, quantita);
  if (esito === "ESAURITO") return { ok: false, messaggio: _("Questa taglia è esaurita", "This size is sold out", "هذا المقاس نفد") };
  if (esito === "SOLO_ASTA") return { ok: false, messaggio: _("Questo pezzo si compra solo all'asta", "This piece is sold at auction only", "هذه القطعة تُباع بالمزاد فقط") };
  if (esito !== "OK") return { ok: false, messaggio: _("Prodotto non trovato", "Product not found", "المنتج غير موجود") };
  const v = await db.variante.findUnique({ where: { id: varianteId }, include: { prodotto: { include: { marca: true } } } });
  const vista = await carrelloLib.vistaCarrello(await carrelloLib.trovaCarrello());
  return { ok: true, marca: v!.prodotto.marca.nome, nome: v!.prodotto.nome, taglia: v!.taglia, prezzo: v!.prodotto.prezzo, pezzi: vista.pezzi, totale: vista.subtotale };
}

export type RispostaOfferta =
  | { ok: true; prezzo: number; quantita: number; marca: string; nome: string; taglia: string; pezzi: number; totale: number }
  | { ok: false; messaggio: string; restanti?: number };

/** Trattativa: il minimo non lascia mai il server. Chi prova a indovinarlo ha tre tentativi per prodotto al giorno. */
export async function offriPrezzo(varianteId: string, offertaEgp: string, quantita = 1): Promise<RispostaOfferta> {
  const l = await lingua(); const _ = tx(l);
  const cifre = Number(String(offertaEgp).replace(/[^0-9.,]/g, "").replace(",", "."));
  const offerta = Math.round(cifre * 100);
  if (!Number.isFinite(offerta) || offerta <= 0) return { ok: false, messaggio: _("Scrivi un prezzo valido", "Enter a valid price", "اكتب سعراً صحيحاً") };
  const v = await db.variante.findUnique({ where: { id: varianteId }, include: { prodotto: { include: { marca: true } } } });
  const p = v?.prodotto;
  if (!v || !p || !p.attivo || p.tipo !== "NUOVO" || !p.trattabile || !p.prezzoMinimo) return { ok: false, messaggio: _("Questo prodotto ha prezzo fisso", "This product has a fixed price", "هذا المنتج بسعر ثابت") };
  if (!(await limita(`trat:ip:${await ip()}`, 40, 24 * 3600_000))) return { ok: false, messaggio: _("Troppi tentativi, riprova domani", "Too many attempts, try again tomorrow", "محاولات كثيرة، حاول غداً") };
  if (!(await limita(`trat:${await ip()}:${p.id}`, 6, 24 * 3600_000))) return { ok: false, restanti: 0, messaggio: _("Hai esaurito i tentativi per questo prodotto. Puoi comprarlo al prezzo di listino.", "You have used all your attempts for this product. You can still buy it at the listed price.", "استنفدت محاولاتك لهذا المنتج. يمكنك شراءه بالسعر المعروض.") };
  const k = await carrelloLib.assicuraCarrello();
  const MAX = 3;
  if (!(await limita(`trat:${k.id}:${p.id}`, MAX, 24 * 3600_000))) {
    return { ok: false, restanti: 0, messaggio: _("Hai esaurito i tentativi per questo prodotto. Puoi comprarlo al prezzo di listino.", "You have used all your attempts for this product. You can still buy it at the listed price.", "استنفدت محاولاتك لهذا المنتج. يمكنك شراءه بالسعر المعروض.") };
  }
  const usati = await db.limite.findUnique({ where: { chiave: `trat:${k.id}:${p.id}` } });
  const restanti = Math.max(0, MAX - (usati?.conteggio ?? MAX));
  // Se altri clienti hanno già concordato un prezzo per questo prodotto (carrelli attivi nelle ultime 24 ore),
  // il minimo sale alla loro offerta più alta: chi arriva dopo deve almeno eguagliarla.
  const altri = await db.rigaCarrello.aggregate({
    _max: { prezzoPattuito: true },
    where: { prezzoPattuito: { not: null }, carrelloId: { not: k.id }, variante: { prodottoId: p.id }, carrello: { aggiornato: { gt: new Date(Date.now() - 24 * 3600_000) } } },
  });
  const minimoAttuale = Math.max(p.prezzoMinimo, altri._max.prezzoPattuito ?? 0);
  if (offerta < minimoAttuale && offerta >= p.prezzoMinimo) {
    return { ok: false, restanti, messaggio: _("Altri clienti stanno trattando questo prodotto: serve un'offerta più alta.", "Other customers are negotiating this product: a higher offer is needed.", "عملاء آخرون يتفاوضون على هذا المنتج: يلزم عرض أعلى.") };
  }
  if (offerta < minimoAttuale) {
    return { ok: false, restanti, messaggio: _("Offerta troppo bassa, il venditore non può accettarla. Prova con una cifra più alta.", "Offer too low, the seller cannot accept it. Try a higher amount.", "العرض منخفض جداً ولا يمكن للبائع قبوله. جرّب مبلغاً أعلى.") };
  }
  const prezzo = Math.min(offerta, p.prezzo);
  const q = Math.min(Math.max(1, Math.floor(Number(quantita) || 1)), 20, Math.max(1, disponibile(v)));
  const esito = await carrelloLib.aggiungiPattuito(varianteId, prezzo, q);
  if (esito === "ESAURITO") return { ok: false, messaggio: _("Questa taglia è esaurita", "This size is sold out", "هذا المقاس نفد") };
  if (esito !== "OK") return { ok: false, messaggio: _("Prodotto non trovato", "Product not found", "المنتج غير موجود") };
  const vista = await carrelloLib.vistaCarrello(await carrelloLib.trovaCarrello());
  return { ok: true, prezzo, quantita: q, marca: p.marca.nome, nome: p.nome, taglia: v.taglia, pezzi: vista.pezzi, totale: vista.subtotale };
}

export async function quantitaAction(f: FormData) {
  const l = await lingua();
  await carrelloLib.impostaQuantita(testo(f, "riga"), Number(testo(f, "quantita")));
  redirect(href(l, "/carrello"));
}
export async function rimuoviAction(f: FormData) {
  const l = await lingua();
  await carrelloLib.rimuovi(testo(f, "riga"));
  redirect(href(l, "/carrello"));
}
export async function couponAction(f: FormData) {
  const l = await lingua();
  const r = await carrelloLib.applicaCoupon(testo(f, "codice"));
  const dove = testo(f, "torna") === "checkout" ? "/checkout" : "/carrello";
  redirect(href(l, dove) + (r.ok ? "" : `?coupon=${r.motivo}${r.minimo ? `&min=${r.minimo}` : ""}`));
}
export async function togliCouponAction() {
  const l = await lingua();
  await carrelloLib.togliCoupon();
  redirect(href(l, "/carrello"));
}

// ── cassa ───────────────────────────────────────────────────────────────────

const ERRORI: Record<string, [string, string]> = {
  nome: ["Enter your name", "اكتب اسمك"],
  telefono: ["Invalid Egyptian number: 01X XXXX XXXX", "رقم مصري غير صالح: 01X XXXX XXXX"],
  email: ["Invalid email", "بريد إلكتروني غير صالح"],
  governatorato: ["Choose your governorate", "اختر المحافظة"],
  indirizzo: ["Enter district, street and number", "اكتب الحي والشارع والرقم"],
};
function erroreCampo(l: string, campo: string, it: string) {
  if (l === "it") return it;
  const i = l === "ar" ? 1 : 0;
  if (campo === "metodo") {
    if (/asta/i.test(it)) return [ "Auction pieces are paid online: cash on delivery is not available for this order", "القطع المربوحة بالمزاد تُدفع إلكترونياً: الدفع عند الاستلام غير متاح لهذا الطلب" ][i];
    if (/carta/i.test(it)) return [ "Card payment is not active yet: choose cash on delivery", "الدفع بالبطاقة غير مفعّل بعد: اختر الدفع عند الاستلام" ][i];
    return ["Choose how to pay", "اختر طريقة الدفع"][i];
  }
  return ERRORI[campo]?.[i] ?? it;
}

export type StatoCassa = {
  errori?: Record<string, string>; esaurito?: { nome: string; taglia: string; disponibile: number }[];
  valori?: Record<string, string>; generale?: string;
};

export async function ordineAction(_prev: StatoCassa, f: FormData): Promise<StatoCassa> {
  const l = await lingua(); const _ = tx(l);
  const valori = Object.fromEntries(["nome", "telefono", "email", "governatorato", "indirizzo", "note", "metodo"].map((k) => [k, testo(f, k)]));
  if (!(await limita(`ord:${await ip()}`, 12, 10 * 60_000))) return { valori, generale: _("Troppi tentativi: riprova tra qualche minuto", "Too many attempts: try again in a few minutes", "محاولات كثيرة: حاول بعد بضع دقائق") };
  const k = await carrelloLib.trovaCarrello();
  if (!k) return { valori, generale: _("Il carrello è vuoto", "Your cart is empty", "السلة فارغة") };
  const u = await utenteCorrente();
  const r = await creaOrdine(k.id, {
    nome: valori.nome, telefono: valori.telefono, email: valori.email || u?.email, governatorato: valori.governatorato,
    indirizzo: valori.indirizzo, note: valori.note, metodo: (valori.metodo || "CONTRASSEGNO") as Metodo, lingua: l, utenteId: u?.id, blocco: testo(f, "blocco") === "1",
  });
  if (!r.ok) {
    const e = r.errore;
    if ("campo" in e) return { valori, errori: { [e.campo]: erroreCampo(l, e.campo, e.messaggio) } };
    if ("esaurito" in e) return { valori, esaurito: e.esaurito };
    return { valori, generale: _("Il carrello è vuoto", "Your cart is empty", "السلة فارغة") };
  }
  // la conferma via email non deve mai far fallire l'ordine
  emailConferma(r.id, await baseUrl()).catch(() => {});
  redirect(href(l, `/ordine/${r.numero}`) + `?t=${r.token}` + (r.couponPerso ? "&codice=perso" : ""));
}

export async function confermaBloccoAction(f: FormData) {
  const l = await lingua();
  const numero = testo(f, "numero"); const t = testo(f, "t");
  const r = await confermaBlocco(numero, t);
  redirect(href(l, `/ordine/${numero}`) + `?t=${t}` + (r.ok ? "&blocco=ok" : `&blocco=errore`));
}

// ── account ─────────────────────────────────────────────────────────────────

export type StatoAccesso = { errore?: string; valori?: Record<string, string> };

export async function accediAction(_p: StatoAccesso, f: FormData): Promise<StatoAccesso> {
  const l = await lingua(); const _ = tx(l);
  const email = testo(f, "email").toLowerCase(); const password = String(f.get("password") ?? "");
  const torna = tornaSicuro(f.get("torna"), href(l, "/account"));
  const generico = _("Email o password non corrette", "Wrong email or password", "البريد أو كلمة المرور غير صحيحة");
  if (!(await limita(`login:${await ip()}`, 20, 10 * 60_000)) || !(await limita(`login:${email}`, 8, 10 * 60_000)))
    return { valori: { email }, errore: _("Troppi tentativi: riprova tra qualche minuto", "Too many attempts: try again in a few minutes", "محاولات كثيرة: حاول بعد بضع دقائق") };
  const u = email ? await db.utente.findUnique({ where: { email } }) : null;
  // si confronta comunque: tempi uguali, così non si scopre quali email hanno un account
  const ok = await confronta(password, u?.passwordHash ?? "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali");
  if (!u || !ok) return { valori: { email }, errore: generico };
  await azzera(`login:${email}`);
  await creaSessione(u.id);
  await carrelloLib.fondiAlLogin(u.id);
  redirect(torna);
}

export async function registratiAction(_p: StatoAccesso, f: FormData): Promise<StatoAccesso> {
  const l = await lingua(); const _ = tx(l);
  const nome = testo(f, "nome"); const email = testo(f, "email").toLowerCase(); const password = String(f.get("password") ?? "");
  const tel = testo(f, "telefono"); const valori = { nome, email, telefono: tel };
  if (!(await limita(`reg:${await ip()}`, 10, 60 * 60_000))) return { valori, errore: _("Troppi tentativi: riprova più tardi", "Too many attempts: try again later", "محاولات كثيرة: حاول لاحقاً") };
  if (nome.length < 2) return { valori, errore: _("Scrivi il tuo nome", "Enter your name", "اكتب اسمك") };
  if (!emailValida(email)) return { valori, errore: _("Email non valida", "Invalid email", "بريد إلكتروني غير صالح") };
  if (password.length < 8) return { valori, errore: _("La password deve avere almeno 8 caratteri", "Password must be at least 8 characters", "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل") };
  if (tel && !telefonoEgiziano(tel)) return { valori, errore: _("Numero egiziano non valido", "Invalid Egyptian number", "رقم مصري غير صالح") };
  if (await db.utente.findUnique({ where: { email } }))
    return { valori, errore: _("Esiste già un account con questa email: accedi", "An account with this email already exists: sign in", "يوجد حساب بهذا البريد: سجّل الدخول") };
  const u = await db.utente.create({ data: { id: nuovoId(), email, nome, telefono: tel ? telefonoEgiziano(tel) : null, passwordHash: await cifra(password) } });
  await creaSessione(u.id);
  await carrelloLib.fondiAlLogin(u.id);
  redirect(tornaSicuro(f.get("torna"), href(l, "/account")));
}

export async function esciAction() {
  const l = await lingua();
  await chiudiSessione();
  redirect(href(l, "/"));
}

export async function preferitoAction(f: FormData) {
  const l = await lingua();
  const u = await utenteCorrente();
  const slug = testo(f, "slug");
  const torna = tornaSicuro(f.get("torna"), href(l, "/negozio"));
  if (!u) redirect(href(l, "/accedi") + `?torna=${encodeURIComponent(torna)}`);
  const p = await db.prodotto.findUnique({ where: { slug } });
  if (p) {
    const gia = await db.preferito.findUnique({ where: { utenteId_prodottoId: { utenteId: u.id, prodottoId: p.id } } });
    if (gia) await db.preferito.delete({ where: { id: gia.id } });
    else await db.preferito.create({ data: { id: nuovoId(), utenteId: u.id, prodottoId: p.id, prezzoSalvato: p.prezzo } });
  }
  redirect(torna);
}

// ── newsletter ──────────────────────────────────────────────────────────────

export type StatoNewsletter = { esito?: "ok" | "gia" | "errore"; messaggio?: string };

export async function iscrivitiAction(_p: StatoNewsletter, f: FormData): Promise<StatoNewsletter> {
  const l = await lingua(); const _ = tx(l);
  const email = testo(f, "email").toLowerCase();
  if (!(await limita(`nl:${await ip()}`, 6, 60 * 60_000))) return { esito: "errore", messaggio: _("Troppi tentativi", "Too many attempts", "محاولات كثيرة") };
  if (!emailValida(email)) return { esito: "errore", messaggio: _("Email non valida", "Invalid email", "بريد إلكتروني غير صالح") };
  const gia = await db.iscritto.findUnique({ where: { email } });
  if (gia) return { esito: "gia", messaggio: _("Sei già nella lista.", "You're already on the list.", "أنت موجود في القائمة بالفعل.") };
  await db.iscritto.create({ data: { id: nuovoId(), email, lingua: l } });
  // non si promette una lettera che non si può spedire
  return {
    esito: "ok",
    messaggio: postaConfigurata()
      ? _("Sei nella lista.", "You're on the list.", "تم تسجيلك في القائمة.")
      : _("Sei nella lista: le lettere partiranno da quando la posta sarà attiva.", "You're on the list: letters will start once mail is set up.", "تم تسجيلك: ستبدأ الرسائل عند تفعيل البريد."),
  };
}

// ── aste ────────────────────────────────────────────────────────────────────

export type StatoOfferta = { esito?: "ok" | "errore"; messaggio?: string };

export async function offertaAction(_p: StatoOfferta, f: FormData): Promise<StatoOfferta> {
  const l = await lingua(); const _ = tx(l);
  const u = await utenteCorrente();
  const slug = testo(f, "slug");
  if (!u) redirect(href(l, "/accedi") + `?torna=${encodeURIComponent(href(l, `/aste/${slug}`))}`);
  const massimo = Math.round(Number(testo(f, "massimo").replace(/[.,\s](?=\d{3}\b)/g, "")) * 100);
  if (!(await limita(`off:${u.id}`, 30, 60_000))) return { esito: "errore", messaggio: _("Troppe offerte ravvicinate", "Too many bids in a row", "عروض كثيرة متتالية") };
  if (!Number.isFinite(massimo) || massimo <= 0) return { esito: "errore", messaggio: _("Scrivi un importo valido", "Enter a valid amount", "اكتب مبلغاً صالحاً") };
  const r = await offri(slug, u.id, massimo, await baseUrl());
  if (r.ok) return { esito: "ok", messaggio: r.prolungata ? _("Offerta registrata. L'asta è stata prolungata di due minuti.", "Bid placed. The auction was extended by two minutes.", "تم تسجيل العرض. تم تمديد المزاد دقيقتين.") : _("Offerta registrata. Il tuo massimo resta segreto.", "Bid placed. Your maximum stays secret.", "تم تسجيل العرض. يبقى حدك الأقصى سرياً.") };
  const m: Record<string, string> = {
    SOTTO_MINIMO: _(`Offerta troppo bassa: serve almeno ${egp(r.minimo ?? 0)}`, `Bid too low: at least ${egp(r.minimo ?? 0)} needed`, `العرض منخفض: يلزم ${egp(r.minimo ?? 0)} على الأقل`),
    ABBASSA_MASSIMO: _("Il tuo massimo si può solo alzare", "Your maximum can only go up", "يمكن رفع حدك الأقصى فقط"),
    CHIUSA: _("L'asta è chiusa", "The auction is closed", "المزاد مغلق"),
    INVALIDA: _("Importo non valido", "Invalid amount", "مبلغ غير صالح"),
    SERVE_GARANZIA: _("Per offrire serve una carta a garanzia: non è ancora attiva", "A card guarantee is required to bid: it is not yet active", "يلزم ضمان ببطاقة للمزايدة: غير مفعّل بعد"),
  };
  return { esito: "errore", messaggio: m[r.motivo] ?? _("Offerta non riuscita", "Bid failed", "تعذّر تسجيل العرض") };
}

export async function cambiaPasswordAction(f: FormData) {
  const l = await lingua();
  const u = await utenteCorrente();
  if (!u) redirect(href(l, "/accedi"));
  const dest = (r: string) => redirect(`${href(l, "/account")}?pw=${r}#password`);
  if (!(await limita(`pw:${u.id}`, 6, 10 * 60_000))) dest("troppi");
  const vecchia = String(f.get("vecchia") ?? ""), nuova = String(f.get("nuova") ?? "");
  if (!(await confronta(vecchia, u.passwordHash))) dest("errata");
  if (nuova.length < 10 || nuova.length > 200) dest("corta");
  await db.utente.update({ where: { id: u.id }, data: { passwordHash: await cifra(nuova) } });
  // le altre sessioni (altri dispositivi) si chiudono: chi aveva la vecchia password perde l'accesso
  await db.sessione.deleteMany({ where: { utenteId: u.id } });
  await creaSessione(u.id);
  dest("ok");
}
