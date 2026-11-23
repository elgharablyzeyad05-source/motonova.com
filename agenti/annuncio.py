#!/usr/bin/env python3
"""Legge un annuncio Vinted dal cloud (Chromium di Playwright, nessun login) e ne scarica le foto del venditore.

Le foto del venditore servono SOLO per riconoscere il prodotto (guardarle, ricerca per immagine):
non vanno mai caricate sul sito.

Uso:
  python3 agenti/annuncio.py <url-annuncio> <cartella>           -> annuncio.json + foto_1.webp, foto_2.webp ... in <cartella>
  python3 agenti/annuncio.py <url-annuncio> <cartella> --cerca   -> in più: ricerca per immagine (Yandex) della prima foto,
                                                                    con i siti trovati in cerca.json (solo indizi: verificare sempre)
Uscita: stampa titolo, descrizione, colore Vinted, prezzo, stato (InStock / venduto) e il numero di foto.
Ritmo umano: una pagina per chiamata; chi lo usa in serie aspetti 3-6 s fra un annuncio e l'altro.
Google Lens dal cloud chiede il captcha: si usa Yandex (o Google Lens dal Chrome di Zeyad).
"""
import json, os, sys, time, urllib.parse, urllib.request
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"


def leggi(url, cartella, cerca=False):
    os.makedirs(cartella, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        c = b.new_context(locale="it-IT", user_agent=UA)
        p = c.new_page()
        r = p.goto(url, timeout=45000)
        p.wait_for_timeout(3000)
        stato_http = r.status if r else 0
        dati = p.evaluate("""() => {
          const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { return JSON.parse(s.textContent) } catch (e) { return null } }).find(x => x && x['@type'] === 'Product') || {};
          const imgs = [...new Set([...document.querySelectorAll('img')].map(i => i.src).filter(s => /images\\d*\\.vinted\\.net\\/t\\/.*\\/f800\\//.test(s)))];
          const testo = document.body.innerText;
          return { titolo: ld.name || document.title, descrizione: ld.description || '', colore: ld.color || '', prezzo: ld.offers ? ld.offers.price + ' ' + ld.offers.priceCurrency : '',
                   disponibilita: ld.offers ? ld.offers.availability : '', venduto: /Venduto|Riservato|Sold|Vendu/.test(testo.slice(0, 4000)), immagini: imgs };
        }""")
        dati["url"] = p.url
        dati["http"] = stato_http
        n = 0
        for i, src in enumerate(dati["immagini"][:10], 1):
            try:
                req = urllib.request.Request(src, headers={"User-Agent": UA, "Referer": "https://www.vinted.it/"})
                open(os.path.join(cartella, f"foto_{i}.webp"), "wb").write(urllib.request.urlopen(req, timeout=30).read())
                n += 1
            except Exception as e:
                print("foto non scaricata:", e, file=sys.stderr)
        dati["fotoScaricate"] = n
        json.dump(dati, open(os.path.join(cartella, "annuncio.json"), "w"), ensure_ascii=False, indent=1)
        if cerca and dati["immagini"]:
            time.sleep(3)
            q = c.new_page()
            q.goto("https://yandex.com/images/search?rpt=imageview&url=" + urllib.parse.quote(dati["immagini"][0], safe=""), timeout=45000)
            q.wait_for_timeout(5000)
            ris = q.evaluate("""() => ({ testo: document.body.innerText.slice(0, 3000),
              link: [...new Set([...document.querySelectorAll('a')].map(a => a.href).filter(h => h.startsWith('http') && !/yandex|ya\\.ru/.test(h)))].slice(0, 40) })""")
            json.dump(ris, open(os.path.join(cartella, "cerca.json"), "w"), ensure_ascii=False, indent=1)
        b.close()
    return dati


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    d = leggi(sys.argv[1], sys.argv[2], "--cerca" in sys.argv)
    print(json.dumps({k: v for k, v in d.items() if k != "immagini"}, ensure_ascii=False, indent=1))
