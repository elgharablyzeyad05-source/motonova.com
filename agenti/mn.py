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


def prezzo_egp(euro: float) -> int:
    """Formula di MotoNova per il nuovo: 62 x listino in euro (arrotondato all'euro sopra) + 7.388 EGP. Restituisce PIASTRE."""
    import math
    return (62 * math.ceil(euro) + 7388) * 100


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
    elif cmd == "venduto":
        for u in sys.argv[2:]:
            print(u, _post("/api/agenti", {"op": "venduto", "fonteUrl": u}))
    else:
        print(__doc__)
