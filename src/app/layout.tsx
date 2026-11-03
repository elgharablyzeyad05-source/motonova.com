import type { Metadata, Viewport } from "next";
import "./globals.css";
import { lingua, percorso, tx } from "@/lib/contesto";
import { DIR, href } from "@/lib/i18n";
import { utenteCorrente } from "@/lib/sessione";
import { contaPezzi } from "@/lib/carrello";
import { Testata } from "@/componenti/Testata";
import { Piede } from "@/componenti/Piede";
import { FabCarrello } from "@/componenti/FabCarrello";
import { ChatSito } from "@/componenti/ChatSito";
import { SuInAlto } from "@/componenti/SuInAlto";
import { BloccaZoom } from "@/componenti/BloccaZoom";

export async function generateMetadata(): Promise<Metadata> {
  const l = await lingua(); const _ = tx(l);
  return {
    title: { default: _("MotoNova — attrezzatura per motociclisti", "MotoNova — motorcycle gear", "موتونوفا — معدات الدراجات النارية"), template: "%s · MotoNova" },
    description: _("Caschi, giacche, guanti e protezioni scelti pezzo per pezzo, importati dall'Italia e consegnati in Egitto.", "Helmets, jackets, gloves and protection chosen piece by piece, imported from Italy and delivered across Egypt.", "خوذ وجاكيتات وقفازات وحماية مختارة قطعة قطعة، مستوردة من إيطاليا وتُسلَّم في مصر."),
    metadataBase: new URL(process.env.SITO_URL ?? "http://localhost:3000"),
  };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, minimumScale: 1, maximumScale: 1, userScalable: false };

export default async function Layout({ children }: { children: React.ReactNode }) {
  const l = await lingua(); const _ = tx(l);
  const [u, pezzi, p] = await Promise.all([utenteCorrente(), contaPezzi(), percorso()]);
  return (
    <html lang={l} dir={DIR[l]}>
      <body>
        <Testata l={l} percorso={p} collegato={!!u} />
        <main id="contenuto">{children}</main>
        <Piede l={l} />
        <FabCarrello pezziIniziali={pezzi} href={href(l, "/carrello")} etichette={{
          titolo: _("Aggiunto al carrello", "Added to cart", "أُضيف إلى السلة"), vai: _("Vai al carrello", "Go to cart", "اذهب إلى السلة"),
          continua: _("Continua", "Continue", "تابع"), chiudi: _("Chiudi", "Close", "إغلاق"),
          pezzo: _("pezzo", "item", "قطعة"), pezzi: _("pezzi", "items", "قطع"), carrello: _("Vai al carrello", "Go to cart", "اذهب إلى السلة"),
        }} />
        <BloccaZoom />
        <SuInAlto etichetta={_("Torna in alto", "Back to top", "العودة إلى الأعلى")} />
        <ChatSito t={{
          titolo: _("Scrivici", "Chat with us", "تحدث معنا"), sottotitolo: _("Rispondiamo appena possibile", "We reply as soon as we can", "نرد في أقرب وقت"),
          apri: _("Apri la chat", "Open chat", "افتح المحادثة"), chiudi: _("Chiudi", "Close", "إغلاق"),
          vuoto: _("Domande su taglie, spedizione o su un pezzo? Scrivi qui.", "Questions about sizing, shipping or a piece? Write here.", "أسئلة عن المقاس أو الشحن أو قطعة؟ اكتب هنا."),
          scrivi: _("Scrivi un messaggio…", "Write a message…", "اكتب رسالة…"), invia: _("Invia", "Send", "إرسال"),
          errore: _("Messaggio non inviato, riprova", "Message not sent, try again", "لم تُرسل الرسالة، حاول مرة أخرى"),
        }} />
      </body>
    </html>
  );
}
