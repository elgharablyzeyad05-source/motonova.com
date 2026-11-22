# Agenti MotoNova — istruzioni operative

Regole decise da Zeyad il 22/11/2026. Ogni agente parte da zero: leggi tutto questo file prima di lavorare.

## Dove sono le cose
- Sito: https://motonova.online (Next.js su Vercel). Repo: github.com/elgharablyzeyad05-source/motonova.com (ramo main).
- Database: Supabase, progetto `umsbfbhlgiaxfwwzhkpn`, schema `motonova`. Prezzi in **piastre** (EGP × 100).
- API agenti: `agenti/mn.py` (client) → `/api/agenti` e `/api/agenti/foto`.
- Chiave: `python3 agenti/mn.py chiave` stampa `MN_CHIAVE=...` e un `insert` da eseguire con Supabase MCP (`execute_sql`). La chiave vale 6 ore. Non scriverla mai in file, commit o messaggi.

## Regole comuni
- Foto: solo foto ufficiali dei marchi. Sfondo già bianco/trasparente → solo ritaglio; sfondo colorato → cambia solo lo sfondo. Lo fa il server (`pulisciFoto`): non ritoccare, non specchiare, non ruotare.
- Foto principale di ogni colore: la 3/4 (preferibilmente verso destra; se il marchio le ha tutte verso sinistra, va bene così). 3 foto per colore.
- Prezzo del nuovo: `prezzo_egp(euro)` in `agenti/mn.py` = (62 × euro arrotondato in su + 7.388) EGP. Euro = prezzo di listino pieno del sito ufficiale italiano/europeo (se c'è uno sconto, il prezzo barrato).
- Nomi e colori come sul sito ufficiale (il sito traduce da solo con il glossario).
- Mai cancellare prodotti, ordini o foto. Mai toccare ordini, utenti, coupon, aste.
- Lavora a ritmo umano sui siti esterni (pause di qualche secondo). Se un sito blocca o chiede login/captcha, salta e scrivilo nel resoconto.
- Alla fine manda il resoconto con l'invio di file/messaggio all'utente (in italiano, breve): cosa è entrato, cosa è stato aggiornato/tolto, cosa aspetta il suo prezzo, errori.

## Agente 1 — Catalogo nuovo (ogni notte, nel cloud)
Pubblica **subito** (attivo), con la formula di prezzo.
1. Ordine di lavoro: prima **tutti i caschi** delle marche famose; finiti i caschi: giacche e tute → guanti e stivali → protezioni e airbag.
   Marche in ordine di priorità: AGV, Nolan, Momodesign (già caricate; aggiorna solo Nolan, vedi punto 5), Shoei, Arai, HJC, Alpinestars, Dainese, Shark, Bell, Scorpion, LS2, MT, X-lite/Suomy/Caberg, poi REV'IT!, Spidi, TCX, Sidi, Held, Klim. «Qualsiasi marca conosciuta di qualità, prima le più famose.»
   Lo stato di avanzamento è in `agenti/stato.json` (marche/categorie fatte): aggiornalo e fai commit + push su main a fine giro.
2. Per ogni marca trova il catalogo ufficiale:
   - Negozi **Shopify** (prova `https://<dominio>/products.json`): usa `agenti/shopify.py` con un file `agenti/modelli/<marca>.json` (prefissi dei titoli → nome, sottotitolo, stili, materiale, descrizione breve in italiano). Stili ammessi: sport, street, adventure, touring, urban.
   - **AGV/Momodesign** (Dainese, CDN thron): pagine famiglia `https://www.agv.com/gb/en/<tipo>/<modello>/?sz=200`, immagini `dainese-cdn.thron.com/.../contents/<id>/image/image?w=1800&h=1800` (ordine: 3/4 = penultima, frontale = ultima, laterale = prima).
   - Altri siti: leggi pagina per pagina e costruisci a mano lo stesso formato di piano (vedi docstring di `agenti/mn.py`).
3. **Nome del prodotto** = modello + nomi delle grafiche che contiene (es. «Spartan GT Pro Carbon Dokhta / Kultram / Ritmo»). «Mono» solo per le tinte unite vere, mai come segnaposto. Due prodotti dello stesso modello non devono avere lo stesso nome.
   Raggruppa le colorazioni in prodotti come fa `shopify.py`: modello + grafica, stesso prezzo, max 6 colori e 3 grafiche per prodotto. Solo colorazioni con almeno una taglia disponibile; giacenza 1 per taglia disponibile.
4. `MN_CHIAVE=... python3 agenti/mn.py carica piano.json`. È idempotente: rilanciarlo non crea doppioni (slug, colori con foto già presenti saltati). Con `aggiornaGiacenze: true` le taglie esaurite vanno a zero e i prezzi si aggiornano.
5. Ogni notte, per le marche già fatte con `shopify.py` (oggi: Nolan): rigenera il piano e ricaricalo (aggiorna taglie, prezzi, colorazioni nuove). Il piano tiene ogni colore già presente nel suo prodotto (chiave modello + colore): usa sempre `shopify.py` con MN_CHIAVE impostata.
   **AGV e Momodesign: per ora NON rigenerarle** (sono state caricate a mano, senza script stabile): saltale finché non c'è `agenti/agv.py`.
   **Sicurezza anti-doppioni:** prima di `carica`, guarda il piano. Per una marca già presente, se il piano contiene prodotti nuovi (voci con `sottotitolo`) per più del 10% dei prodotti già sul sito, NON caricare: è quasi certamente un errore di abbinamento. Scrivilo nel resoconto.
   Per costruire un piano a mano (marche non Shopify) leggi prima il catalogo attuale del sito con `op: catalogo` e non ricreare colori che esistono già per lo stesso modello.
6. Se lo spazio del database (`select pg_size_pretty(pg_database_size(current_database()))`) supera 400 MB, fermati e avvisa: il piano gratuito Supabase arriva a 500 MB.

## Agente 2 — Usato Vinted (13:00 e 22:00, sul Chrome di Zeyad)
Usa **solo** Claude in Chrome (la sessione Vinted di Zeyad). Un solo agente, a ritmo umano: pause 3–6 s fra le pagine, al primo 429 aspetta 60 s, alla seconda volta fermati.
1. Modelli da cercare: tutti i modelli del catalogo nuovo e dell'usato (`/api/agenti` op `catalogo` per marca, oppure SQL su `motonova."Prodotto"`).
2. Ricerca: `https://www.vinted.it/catalog?search_text=<marca modello>&status_ids[]=6&status_ids[]=1&status_ids[]=2&order=newest_first` (solo «Nuovo con cartellino», «Nuovo senza cartellino», «Ottime»). Venditori Italia + UE. Nessun tetto di prezzo.
   Leggi il catalogo con fetch dello stesso sito (`a[href*="/items/"][title]`), poi la pagina dell'annuncio (`script[type="application/ld+json"]` Product + `[itemprop=status|color]`). Scarta accessori (visiere, interni, interfoni, ricambi, abbigliamento se cerchi caschi).
3. Annuncio già caricato? `op: esiste` con `fonteUrl` (forma `https://www.vinted.it/items/<id>`). Se sì, salta.
4. Classifica dalla descrizione (non solo dallo stato Vinted):
   - **Nuovo di zecca** («mai usato/indossato», «con etichette», «never worn», «jamais porté», «nuevo sin usar»…) → va nel **nuovo**: variante in più (stesso colore, taglia, `pezzo` successivo) del prodotto nuovo corrispondente, con `fonteUrl`, `prezzoAnnuncio`, nota «da Vinted». Prodotto nuovo esistente → resta attivo. Se il modello nuovo non c'è nel catalogo, mettilo nell'usato con nota «nuovo di zecca, modello non a catalogo».
   - **Usato** → prodotto USATO **della sua colorazione**: un prodotto per ogni colorazione/grafica/replica, mai colorazioni diverse nello stesso prodotto (es. «K1 S Rossi Soleluna 2018» da solo, «K1 S Matt Black» da solo). Slug `<marca>-<modello>-<colorazione>-used` (colorazione ignota: `<marca>-<modello>-da-riconoscere-used`), nome «Modello Colorazione», `sottocategoria` «Marca Modello» (così sul sito restano raggruppati sotto il modello), `edizione` «special»/«limited» per repliche ed edizioni limitate, `attivo: false`, `trattabile: true`, prezzo 0: variante con taglia, colore, `fonteUrl`, `prezzoAnnuncio` (es. «180 €»), `difetti` (solo i difetti scritti nella descrizione, brevi, in italiano), `noteInterne` «[Vinted: stato] titolo». Taglia non scritta → «DA VERIFICARE». **Resta nascosto: lo pubblica Zeyad** dopo aver messo il prezzo.
   - Prodotto USATO nuovo appena creato: aggiungi 1 foto ufficiale (3/4) del modello con `/api/agenti/foto` (campo `src`) o copiandola dal prodotto nuovo.
5. **Venduti**: per ogni annuncio già caricato con giacenza > 0 (`op: catalogo` → `annunci`), apri la pagina; se è venduto, riservato, rimosso o 404 → `python3 agenti/mn.py venduto <url>`. Controllane al massimo 60 per giro, partendo dai più vecchi.
6. Resoconto: annunci nuovi (usato / nuovo di zecca), venduti tolti, taglie da verificare.

## Cosa NON fare
- Non inserire password, non accettare cookie diversi dal minimo, non comprare, non scrivere ai venditori.
- Non pubblicare l'usato (resta `attivo: false`).
- Non cambiare codice del sito salvo `agenti/` (stato, modelli). Se serve una modifica al sito, scrivila nel resoconto.

## Agente 3 — Riconoscimento e foto dell'usato (13:20 e 22:20, sul Chrome di Zeyad, dopo l'agente Vinted)
Scopo: ogni pezzo preso da Vinted deve sapere **esattamente che prodotto è** e avere **foto ufficiali pulite, a sfondo bianco, del suo colore**.
1. Leggi prima `agenti/coda.json` (voci segnalate dal Controllo qualità): sistemale per prime.
2. Poi `python3 agenti/mn.py api '{"op":"daRiconoscere"}'`: considera i pezzi con `fotoDelColore = 0`, colore generico (es. «Nero / Rosso», «Da verificare»), taglia «DA VERIFICARE» o note che dicono «verificare».
3. Per ogni pezzo apri l'annuncio (`fonteUrl`) con Claude in Chrome, a ritmo umano: leggi titolo, descrizione, etichette e **guarda le foto** (screenshot/zoom). Riconosci marca, modello esatto (es. K3 vs K3 SV, Pista GP R vs RR), grafica/colorazione ufficiale e, se si vede, la taglia sull'etichetta interna.
   Se l'annuncio è venduto/rimosso: `python3 agenti/mn.py venduto <url>` e passa oltre.
4. **Un prodotto per colorazione.** Quando correggi il colore di un pezzo usato con l'op `variante`, il server lo sposta da solo nel prodotto della sua colorazione (creandolo se manca; il vecchio prodotto, se resta vuoto, sparisce). Per spostarlo senza cambiare colore: `python3 agenti/mn.py api '{"op":"spostaPezzo","varianteId":"..."}'` (slug e nome li ricava il server; per repliche/limited aggiungi `"edizione":"special"` o `"limited"`). Le foto di quel colore vanno con lui.
   Correggi il pezzo: `python3 agenti/mn.py api '{"op":"variante","varianteId":"...","colore":"<nome ufficiale della colorazione>","taglia":"...","noteInterne":"... [riconosciuto: modello, colorazione, come]"}'`. Se il modello è sbagliato (es. è un K3 SV finito nel K3), scrivilo nelle note con «[MODELLO ERRATO → …]» e segnalalo nel resoconto (lo sposta Zeyad).
5. Foto del colore:
   - Se la stessa colorazione è nel catalogo nuovo (`op: fotoCatalogo` per marca): **riusa** le foto con `op: copiaFoto` (fotoId → prodottoId del pezzo, colore = colore del pezzo). Prima la 3/4 come principale, poi le altre 2.
   - Altrimenti cerca la versione nuova online, **solo foto ufficiali** (sito del marchio, o rivenditori ufficiali con la foto del marchio) e caricala con `python3 agenti/mn.py foto <prodottoId> "<colore>" <url-o-file> 1` (il server fa solo ritaglio / cambio sfondo). Mai foto dell'annuncio Vinted.
   - Se non esiste nessuna foto ufficiale (edizioni rarissime), scrivi nelle note «[foto ufficiale non trovata]» e mettilo nel resoconto.
6. Lancia i prezzi: `python3 agenti/mn.py api '{"op":"prezzi"}'` (vedi Agente 5).
7. Togli da `agenti/coda.json` le voci sistemate, commit + push (solo `agenti/`).
7. Resoconto: pezzi riconosciuti, colori rinominati, foto riusate/caricate, modelli errati, cose non risolte.

## Agente 4 — Controllo qualità (ogni mattina, nel cloud)
Non serve la chiave: lavora con query SQL di sola lettura (Supabase MCP), stesse informazioni di `daRiconoscere`.
Scopo: controllare il lavoro dei Riconoscimenti e **avvisarlo** (tramite `agenti/coda.json`) di quello che ha saltato o sbagliato. Non corregge da solo, salvo errori evidenti e sicuri.
1. `python3 agenti/mn.py api '{"op":"daRiconoscere"}'` e query SQL di controllo (Supabase MCP). Cerca:
   - pezzi disponibili senza foto del loro colore (`fotoDelColore = 0`), soprattutto i **più vecchi** (caricati da più di 24 ore);
   - colori ancora generici o «Da verificare», taglie «DA VERIFICARE»;
   - prodotti USATO senza nessuna foto; foto con `colore` che non corrisponde a nessun pezzo del prodotto;
   - prodotti usati che contengono **più colorazioni** (devono essere uno per colorazione) → voce in coda per ogni pezzo da spostare;
   - incoerenze fra note/titolo dell'annuncio e prodotto (es. note che citano «K3 SV» in un prodotto K3, «Pista GP R» dentro «Pista GP RR»);
   - foto sospette: scarica le immagini (`https://motonova.online/media/<percorso>`) e guardale: devono essere foto da catalogo, sfondo bianco, del modello e del colore giusti, non foto di annunci.
2. Scrivi in `agenti/coda.json` → `da_sistemare` una voce per problema: `{ "varianteId": "...", "motivo": "...", "quando": "AAAA-MM-GG" }` (niente doppioni; se una voce è lì da più di 3 giorni, segnalala come «ignorata» nel resoconto). Commit + push (solo `agenti/`).
3. Controlla anche gli agenti: se l'ultimo giro di Vinted/Riconoscimento non risulta (nessun pezzo nuovo da giorni, `coda.json` mai svuotata), scrivilo.
4. Resoconto per Zeyad: quanti pezzi a posto / da sistemare, i problemi più gravi con link all'annuncio, e cosa deve decidere lui.

## Agente 5 — Prezzi (dopo ogni giro del Riconoscimento, nel cloud)
Regola di Zeyad (23/11/2026) per ogni pezzo preso da Vinted, nuovo di zecca o usato:
- **prezzo di vendita = euro dell'annuncio × 62 + 2.000 + 7.000 EGP**
- **minimo trattabile = euro dell'annuncio × 62 + 2.000 + 4.000 EGP**
Il prezzo si mette solo ai pezzi **pronti**: foto ufficiale del loro colore e taglia verificata (non «DA VERIFICARE»). I prezzi già presenti (anche messi a mano da Zeyad) non si toccano.
Un prodotto USATO va **online da solo** quando ha almeno un pezzo pronto e disponibile; sul sito si vedono solo i pezzi pronti. Prezzo del prodotto = il più basso dei pezzi pronti.
Tutto questo lo fa una chiamata: `python3 agenti/mn.py api '{"op":"prezzi"}'` (risponde con prezzati, nonPronti, senzaPrezzoAnnuncio, pubblicati).
Anche il Riconoscimento la lancia alla fine di ogni suo giro.
