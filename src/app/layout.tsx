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
    title: { default: _("MotoNova — attrezzatura per motociclisti", "MotoNova — motorcycle gear", "موتونوفا — معدات الموتوسيكلات"), template: "%s · MotoNova" },
    description: _("Caschi, giacche, guanti e protezioni scelti pezzo per pezzo, importati dall'Italia e consegnati in Egitto.", "Helmets, jackets, gloves and protection chosen piece by piece, imported from Italy and delivered across Egypt.", "خوذ وجاكيتات وجوانتيات وحماية متختارة قطعة قطعة، مستوردة من إيطاليا وبتوصلك في مصر."),
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
          titolo: _("Aggiunto al carrello", "Added to cart", "اتضاف للسلة"), vai: _("Vai al carrello", "Go to cart", "روح للسلة"),
          continua: _("Continua", "Continue", "كمّل"), chiudi: _("Chiudi", "Close", "اقفل"),
          pezzo: _("pezzo", "item", "قطعة"), pezzi: _("pezzi", "items", "قطع"), carrello: _("Vai al carrello", "Go to cart", "روح للسلة"),
        }} />
        <BloccaZoom />
        <SuInAlto etichetta={_("Torna in alto", "Back to top", "ارجع فوق")} />
        <ChatSito t={{
          titolo: _("Scrivici", "Chat with us", "كلمنا"), sottotitolo: _("Rispondiamo appena possibile", "We reply as soon as we can", "بنرد في أسرع وقت"),
          apri: _("Apri la chat", "Open chat", "افتح الشات"), chiudi: _("Chiudi", "Close", "اقفل"),
          vuoto: _("Domande su taglie, spedizione o su un pezzo? Scrivi qui.", "Questions about sizing, shipping or a piece? Write here.", "عندك سؤال عن المقاس أو الشحن أو قطعة؟ اكتب هنا."),
          scrivi: _("Scrivi un messaggio…", "Write a message…", "اكتب رسالة…"), invia: _("Invia", "Send", "ابعت"),
          errore: _("Messaggio non inviato, riprova", "Message not sent, try again", "الرسالة ماتبعتتش، جرّب تاني"),
        }} />
      </body>
    </html>
  );
}
