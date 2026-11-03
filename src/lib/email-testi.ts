// MotoNova — testi email in IT / EN / AR
// Segnaposto: {nome}, {numero}, ecc. Si sostituiscono con render().
// Lingua: Ordine.lingua ("it" | "en" | "ar"). Per "ar" l'HTML va avvolto in dir="rtl".
// I prezzi vanno passati già formattati (es. "EGP 5,920") e restano LTR anche in arabo.

export type Lingua = "it" | "en" | "ar";
export type Chiave = "ordineConfermato" | "superato" | "aggiudicato";

type Testo = { oggetto: string; corpo: string };

export const EMAIL: Record<Chiave, Record<Lingua, Testo>> = {
  // Variabili: nome, numero, righe, totale, pagamento, indirizzo, linkOrdine
  ordineConfermato: {
    it: {
      oggetto: "Ordine {numero} ricevuto — MotoNova",
      corpo: `Ciao {nome},

abbiamo ricevuto il tuo ordine {numero}. Grazie.

{righe}

Totale: {totale}
Pagamento: {pagamento}
Consegna a: {indirizzo}

Puoi seguire lo stato dell'ordine qui:
{linkOrdine}

Ti scriveremo a ogni cambio di stato.

MotoNova`,
    },
    en: {
      oggetto: "Order {numero} received — MotoNova",
      corpo: `Hi {nome},

we've received your order {numero}. Thank you.

{righe}

Total: {totale}
Payment: {pagamento}
Delivery to: {indirizzo}

You can follow the status of your order here:
{linkOrdine}

We'll email you each time the status changes.

MotoNova`,
    },
    ar: {
      oggetto: "تم استلام طلبك رقم {numero} — MotoNova",
      corpo: `مرحباً {nome}،

استلمنا طلبك رقم {numero}. شكراً لك.

{righe}

الإجمالي: {totale}
الدفع: {pagamento}
التوصيل إلى: {indirizzo}

يمكنك متابعة حالة الطلب من هنا:
{linkOrdine}

سنراسلك عند كل تغيير في حالة الطلب.

MotoNova`,
    },
  },

  // Variabili: nome, pezzo, prezzoAttuale, minimoPerRilanciare, chiusura, linkAsta
  superato: {
    it: {
      oggetto: "Ti hanno superato: {pezzo}",
      corpo: `Ciao {nome},

qualcuno ha superato la tua offerta su «{pezzo}».

Prezzo attuale: {prezzoAttuale}
Per tornare in testa serve almeno: {minimoPerRilanciare}
L'asta chiude: {chiusura}

Come funziona: indica il massimo che sei disposto a pagare. Noi rilanciamo per te al minimo necessario, e il prezzo finale è quello del secondo offerente più un piccolo scatto, mai il tuo massimo. Se rilanci negli ultimi 2 minuti, la chiusura slitta a 2 minuti da quel momento.

Rilancia qui:
{linkAsta}

MotoNova Second Life`,
    },
    en: {
      oggetto: "You've been outbid: {pezzo}",
      corpo: `Hi {nome},

someone has outbid you on "{pezzo}".

Current price: {prezzoAttuale}
To take the lead again you need at least: {minimoPerRilanciare}
Auction closes: {chiusura}

How it works: enter the most you're willing to pay. We bid for you at the minimum needed, and the final price is the second-highest bidder's amount plus one small step, never your maximum. A bid in the last 2 minutes moves the closing time to 2 minutes from that moment.

Bid again here:
{linkAsta}

MotoNova Second Life`,
    },
    ar: {
      oggetto: "تم تجاوز عرضك: {pezzo}",
      corpo: `مرحباً {nome}،

قام شخص آخر بتجاوز عرضك على «{pezzo}».

السعر الحالي: {prezzoAttuale}
للعودة إلى الصدارة تحتاج على الأقل إلى: {minimoPerRilanciare}
يغلق المزاد: {chiusura}

كيف يعمل: حدّد أقصى مبلغ أنت مستعد لدفعه. نزايد نيابةً عنك بالحد الأدنى اللازم، والسعر النهائي هو عرض صاحب المركز الثاني مضافاً إليه زيادة صغيرة، وليس أقصى مبلغ حدّدته أنت. أي عرض في آخر دقيقتين يؤجّل الإغلاق إلى دقيقتين من لحظة العرض.

زايد من جديد من هنا:
{linkAsta}

MotoNova Second Life`,
    },
  },

  // Variabili: nome, pezzo, prezzoFinale, linkCassa
  aggiudicato: {
    it: {
      oggetto: "Te lo sei aggiudicato: {pezzo}",
      corpo: `Ciao {nome},

«{pezzo}» è tuo.

Prezzo finale: {prezzoFinale}

Per completare l'acquisto vai in cassa:
{linkCassa}

È un pezzo unico: se non completi l'ordine, lo rimettiamo in vendita. Ti scriviamo una sola volta prima di farlo.

MotoNova Second Life`,
    },
    en: {
      oggetto: "You won: {pezzo}",
      corpo: `Hi {nome},

"{pezzo}" is yours.

Final price: {prezzoFinale}

To complete your purchase, go to checkout:
{linkCassa}

This is a one-of-a-kind piece: if you don't complete the order, we'll put it back on sale. We'll write to you once before we do.

MotoNova Second Life`,
    },
    ar: {
      oggetto: "فزت بالمزاد: {pezzo}",
      corpo: `مرحباً {nome}،

«{pezzo}» أصبح لك.

السعر النهائي: {prezzoFinale}

لإتمام الشراء انتقل إلى صفحة الدفع:
{linkCassa}

هذه قطعة فريدة: إذا لم تُكمل الطلب فسنعيد عرضها للبيع. سنراسلك مرة واحدة فقط قبل ذلك.

MotoNova Second Life`,
    },
  },
};

export function render(
  chiave: Chiave,
  lingua: Lingua,
  vars: Record<string, string>,
): Testo & { rtl: boolean } {
  const t = EMAIL[chiave][lingua] ?? EMAIL[chiave].it;
  const sub = (s: string) =>
    s.replace(/\{(\w+)\}/g, (m, k) => {
      if (!(k in vars)) throw new Error(`Variabile mancante: ${k} in ${chiave}/${lingua}`);
      return vars[k];
    });
  return { oggetto: sub(t.oggetto), corpo: sub(t.corpo), rtl: lingua === "ar" };
}
