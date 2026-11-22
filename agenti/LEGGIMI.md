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
   Marche in ordine di priorità: AGV, Nolan, Momodesign (già caricate, solo aggiornare), Shoei, Arai, HJC, Alpinestars, Dainese, Shark, Bell, Scorpion, LS2, MT, X-lite/Suomy/Caberg, poi REV'IT!, Spidi, TCX, Sidi, Held, Klim. «Qualsiasi marca conosciuta di qualità, prima le più famose.»
   Lo stato di avanzamento è in `agenti/stato.json` (marche/categorie fatte): aggiornalo e fai commit + push su main a fine giro.
2. Per ogni marca trova il catalogo ufficiale:
   - Negozi **Shopify** (prova `https://<dominio>/products.json`): usa `agenti/shopify.py` con un file `agenti/modelli/<marca>.json` (prefissi dei titoli → nome, sottotitolo, stili, materiale, descrizione breve in italiano). Stili ammessi: sport, street, adventure, touring, urban.
   - **AGV/Momodesign** (Dainese, CDN thron): pagine famiglia `https://www.agv.com/gb/en/<tipo>/<modello>/?sz=200`, immagini `dainese-cdn.thron.com/.../contents/<id>/image/image?w=1800&h=1800` (ordine: 3/4 = penultima, frontale = ultima, laterale = prima).
   - Altri siti: leggi pagina per pagina e costruisci a mano lo stesso formato di piano (vedi docstring di `agenti/mn.py`).
3. Raggruppa le colorazioni in prodotti come fa `shopify.py`: modello + grafica, stesso prezzo, max 6 colori e 3 grafiche per prodotto. Solo colorazioni con almeno una taglia disponibile; giacenza 1 per taglia disponibile.
4. `MN_CHIAVE=... python3 agenti/mn.py carica piano.json`. È idempotente: rilanciarlo non crea doppioni (slug, colori con foto già presenti saltati). Con `aggiornaGiacenze: true` le taglie esaurite vanno a zero e i prezzi si aggiornano.
5. Ogni notte, per le marche già fatte: rigenera il piano e ricaricalo (aggiorna taglie, prezzi, colorazioni nuove).
6. Se lo spazio del database (`select pg_size_pretty(pg_database_size(current_database()))`) supera 400 MB, fermati e avvisa: il piano gratuito Supabase arriva a 500 MB.

## Agente 2 — Usato Vinted (13:00 e 22:00, sul Chrome di Zeyad)
Usa **solo** Claude in Chrome (la sessione Vinted di Zeyad). Un solo agente, a ritmo umano: pause 3–6 s fra le pagine, al primo 429 aspetta 60 s, alla seconda volta fermati.
1. Modelli da cercare: tutti i modelli del catalogo nuovo e dell'usato (`/api/agenti` op `catalogo` per marca, oppure SQL su `motonova."Prodotto"`).
2. Ricerca: `https://www.vinted.it/catalog?search_text=<marca modello>&status_ids[]=6&status_ids[]=1&status_ids[]=2&order=newest_first` (solo «Nuovo con cartellino», «Nuovo senza cartellino», «Ottime»). Venditori Italia + UE. Nessun tetto di prezzo.
   Leggi il catalogo con fetch dello stesso sito (`a[href*="/items/"][title]`), poi la pagina dell'annuncio (`script[type="application/ld+json"]` Product + `[itemprop=status|color]`). Scarta accessori (visiere, interni, interfoni, ricambi, abbigliamento se cerchi caschi).
3. Annuncio già caricato? `op: esiste` con `fonteUrl` (forma `https://www.vinted.it/items/<id>`). Se sì, salta.
4. Classifica dalla descrizione (non solo dallo stato Vinted):
   - **Nuovo di zecca** («mai usato/indossato», «con etichette», «never worn», «jamais porté», «nuevo sin usar»…) → va nel **nuovo**: variante in più (stesso colore, taglia, `pezzo` successivo) del prodotto nuovo corrispondente, con `fonteUrl`, `prezzoAnnuncio`, nota «da Vinted». Prodotto nuovo esistente → resta attivo. Se il modello nuovo non c'è nel catalogo, mettilo nell'usato con nota «nuovo di zecca, modello non a catalogo».
   - **Usato** → prodotto USATO del modello (slug `<marca>-<modello>-used`, `sottocategoria` «Marca Modello», `attivo: false`, `trattabile: true`, prezzo 0): variante con taglia, colore, `fonteUrl`, `prezzoAnnuncio` (es. «180 €»), `difetti` (solo i difetti scritti nella descrizione, brevi, in italiano), `noteInterne` «[Vinted: stato] titolo». Taglia non scritta → «DA VERIFICARE». **Resta nascosto: lo pubblica Zeyad** dopo aver messo il prezzo.
   - Prodotto USATO nuovo appena creato: aggiungi 1 foto ufficiale (3/4) del modello con `/api/agenti/foto` (campo `src`) o copiandola dal prodotto nuovo.
5. **Venduti**: per ogni annuncio già caricato con giacenza > 0 (`op: catalogo` → `annunci`), apri la pagina; se è venduto, riservato, rimosso o 404 → `python3 agenti/mn.py venduto <url>`. Controllane al massimo 60 per giro, partendo dai più vecchi.
6. Resoconto: annunci nuovi (usato / nuovo di zecca), venduti tolti, taglie da verificare.

## Cosa NON fare
- Non inserire password, non accettare cookie diversi dal minimo, non comprare, non scrivere ai venditori.
- Non pubblicare l'usato (resta `attivo: false`).
- Non cambiare codice del sito salvo `agenti/` (stato, modelli). Se serve una modifica al sito, scrivila nel resoconto.
