#!/usr/bin/env python3
"""Client degli agenti MotoNova verso https://motonova.online/api/agenti.

Uso:
  python3 agenti/mn.py chiave                 -> crea una chiave usa-e-getta e stampa l'SQL da eseguire (Supabase MCP)
  MN_CHIAVE=... python3 agenti/mn.py carica piano.json   -> crea/aggiorna i prodotti del piano e carica le foto mancanti
  MN_CHIAVE=... python3 agenti/mn.py venduto URL [URL...] -> azzera i pezzi presi da quegli annunci

Formato di piano.json: lista di prodotti
  { "slug", "marca", "nome", "sottotitolo", "categoria", "stili", "tipo", "prezzo" (piastre: EGP*100),
    "materiale", "certificazione", "descrizione": [..], "edizione", "attivo", "aggiornaGiacenze": true,
    "varianti": [{ "colore", "taglia", "giacenza" , ...usato: "fonteUrl","prezzoAnnuncio","difetti","noteInterne"}],
    "foto": [{ "src", "colore", "principale": bool }] }
Le foto di un colore che ha già foto sul sito non vengono ricaricate.
"""
import hashlib, json, os, secrets, sys, time, urllib.request, uuid

BASE = os.environ.get("MN_BASE", "https://motonova.online")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36"


# Tabella di Zeyad (24/11/2026) per il nuovo: listino in euro -> prezzo in EGP.
# Fra due punti si interpola in linea retta; sotto 1.000 EUR 85 EGP per euro; sopra 1.400 EUR lo stesso rapporto di 1.400 (130.000/1.400).
TABELLA_NUOVO = [(0, 0), (1000, 85000), (1100, 87000), (1150, 90000), (1200, 92000), (1300, 110000), (1400, 130000)]


def prezzo_egp(euro: float) -> int:
    """Prezzo del nuovo dal listino in euro (arrotondato all'euro sopra), con la TABELLA_NUOVO. Restituisce PIASTRE (EGP x 100), arrotondato a 10 EGP."""
    import math
    e = math.ceil(euro)
    t = TABELLA_NUOVO
    if e >= t[-1][0]:
        egp = e * t[-1][1] / t[-1][0]
    else:
        for (e0, p0), (e1, p1) in zip(t, t[1:]):
            if e0 <= e <= e1:
                egp = p0 + (p1 - p0) * (e - e0) / (e1 - e0)
                break
    return int(round(egp / 10)) * 10 * 100


def euro_da_vecchio_prezzo(piastre: int):
    """Inverte la formula vecchia del nuovo ((62 x euro + 7.388) EGP): restituisce gli euro, o None se il prezzo non viene da quella formula."""
    egp = piastre // 100
    if piastre % 100 or egp <= 7388 or (egp - 7388) % 62:
        return None
    return (egp - 7388) // 62


def _post(path, data=None, files=None):
    chiave = os.environ["MN_CHIAVE"]
    if files is None:
        body = json.dumps(data).encode()
        h = {"content-type": "application/json"}
    else:
        b = uuid.uuid4().hex
        parts = []
        for k, v in data.items():
            parts.append(f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
        for k, (name, blob) in files.items():
            parts.append(f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"; filename=\"{name}\"\r\nContent-Type: application/octet-stream\r\n\r\n".encode() + blob + b"\r\n")
        parts.append(f"--{b}--\r\n".encode())
        body = b"".join(parts)
        h = {"content-type": f"multipart/form-data; boundary={b}"}
    h["x-agenti"] = chiave
    req = urllib.request.Request(BASE + path, data=body, headers=h, method="POST")
    for t in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            txt = e.read().decode(errors="replace")[:300]
            if e.code in (401, 400):
                return {"ok": False, "errore": f"HTTP {e.code} {txt}"}
            err = f"HTTP {e.code} {txt}"
        except Exception as e:  # rete
            err = str(e)
        time.sleep(3 * (t + 1))
    return {"ok": False, "errore": err}


def scarica(src):
    req = urllib.request.Request(src, headers={"User-Agent": UA, "Accept": "image/webp,image/*;q=0.9"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def carica(piano):
    tot = {"prodotti_nuovi": 0, "aggiornati": 0, "varianti_nuove": 0, "foto": 0, "errori": []}
    for p in piano:
        foto = p.pop("foto", [])
        r = _post("/api/agenti", {"op": "prodotto", **p})
        if not r.get("ok"):
            tot["errori"].append(f"{p['slug']}: {r.get('errore')}"); continue
        tot["prodotti_nuovi"] += int(r["creato"]); tot["varianti_nuove"] += r["nuove"]; tot["aggiornati"] += r["aggiornate"]
        e = _post("/api/agenti", {"op": "esiste", "slug": p["slug"]})
        gia = set(e.get("coloriFoto", [])); ordine = e.get("maxOrdine", -1) + 1
        for f in foto:
            if f.get("colore", "") in gia:
                continue
            try:
                blob = scarica(f["src"])
                rr = _post("/api/agenti/foto", {"prodottoId": r["id"], "colore": f.get("colore", ""), "principale": "1" if f.get("principale") else "0", "ordine": str(ordine)}, {"f": ("f", blob)})
            except Exception as ex:
                rr = {"ok": False, "errore": str(ex)}
            if rr.get("ok"):
                tot["foto"] += 1; ordine += 1
            else:
                tot["errori"].append(f"foto {p['slug']} {f.get('colore')}: {rr.get('errore')}")
    return tot


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "chiave":
        k = secrets.token_urlsafe(32)
        h = hashlib.sha256(k.encode()).hexdigest()
        print("MN_CHIAVE=" + k)
        print("-- esegui con Supabase MCP (progetto umsbfbhlgiaxfwwzhkpn):")
        print(f"insert into motonova.\"Limite\"(chiave,conteggio,scade) values ('agenti:{h}',0,now()+interval '6 hours') on conflict (chiave) do update set scade=excluded.scade;")
    elif cmd == "carica":
        print(json.dumps(carica(json.load(open(sys.argv[2]))), ensure_ascii=False, indent=1))
    elif cmd == "api":  # chiamata diretta: python3 agenti/mn.py api '{"op":"daRiconoscere"}'
        print(json.dumps(_post("/api/agenti", json.loads(sys.argv[2])), ensure_ascii=False, indent=1))
    elif cmd == "foto":  # python3 agenti/mn.py foto <prodottoId> <colore> <src-o-file> [principale]
        pid, col, src = sys.argv[2], sys.argv[3], sys.argv[4]
        blob = open(src, "rb").read() if os.path.exists(src) else scarica(src)
        print(_post("/api/agenti/foto", {"prodottoId": pid, "colore": col, "principale": "1" if len(sys.argv) > 5 and sys.argv[5] in ("1", "si", "true") else "0"}, {"f": ("f", blob)}))
    elif cmd == "venduto":
        for u in sys.argv[2:]:
            print(u, _post("/api/agenti", {"op": "venduto", "fonteUrl": u}))
    else:
        print(__doc__)
