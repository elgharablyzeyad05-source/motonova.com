#!/usr/bin/env python3
"""Completa le foto dei colori caricati a metà (es. quando il CDN Shopify ha risposto 429/502 durante `mn.py carica`).

  MN_CHIAVE=... python3 agenti/completa.py "<Marca>" piano1.json[,piano2.json...] /tmp/completa

`carica` salta i colori che hanno già almeno una foto, quindi un colore rimasto con 1 foto su 3 non si completa da solo.
Questo script, per ogni colore con meno foto del piano:
  1. riconosce quali foto del piano sono già sul sito (confronto del soggetto con un hash, sfondo tolto);
  2. carica solo quelle che mancano;
  3. scrive /tmp/completa.sql: UNA sola UPDATE che rimette ordine e «principale» come nel piano
     (la prima foto del piano = principale). Eseguila con Supabase MCP (execute_sql).
Non cancella niente.
"""
import io, json, re, sys, concurrent.futures as cf

sys.path.insert(0, __file__.rsplit("/", 1)[0])
import mn  # noqa: E402
from PIL import Image, ImageChops  # noqa: E402


def ah(b, n=16):
    """hash del soggetto: sfondo (colore dell'angolo o trasparenza) tolto, ritaglio sul soggetto, 16x16 a soglia"""
    im = Image.open(io.BytesIO(b)).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); bg.alpha_composite(im); rgb = bg.convert("RGB")
    ang = rgb.getpixel((2, 2))
    m = ImageChops.difference(rgb, Image.new("RGB", rgb.size, ang)).convert("L").point(lambda v: 255 if v > 28 else 0)
    bb = m.getbbox()
    m = (m.crop(bb) if bb else m).resize((n, n))
    return [1 if p > 127 else 0 for p in m.getdata()]


dist = lambda a, b: sum(x != y for x, y in zip(a, b))


def main():
    marca, piani, out = sys.argv[1], sys.argv[2].split(","), sys.argv[3]
    cat = {p["nome"]: p for p in mn._post("/api/agenti", {"op": "fotoCatalogo", "marca": marca})["prodotti"]}
    lavori, pos = [], {}
    for f in piani:
        for q in json.load(open(f)):
            p = cat.get(q["nome"])
            if not p:
                continue
            sito = {c["colore"]: c["foto"] for c in p["colori"]}
            for k, col in enumerate(dict.fromkeys(x["colore"] for x in q["foto"])):
                pos[(p["id"], col)] = k
                voluti = [x for x in q["foto"] if x["colore"] == col]
                if 0 < len(sito.get(col, [])) < len(voluti):
                    lavori.append((p["id"], col, voluti, sito[col]))
    print("colori da completare:", len(lavori))

    def fai(l):
        pid, col, voluti, ci = l
        try:
            hs = [(f["id"], ah(mn.scarica("https://motonova.online" + f["url"]))) for f in ci]
            blobs = [mn.riduci(mn.scarica(v["src"])) for v in voluti]
            ids, usati = [], set()
            for i, b in enumerate(blobs):
                h = ah(b)
                d, fid = min(((dist(h, x), i_) for i_, x in hs if i_ not in usati), default=(999, None))
                if d <= 20:
                    usati.add(fid); ids.append(fid); continue
                r = mn._post("/api/agenti/foto", {"prodottoId": pid, "colore": col, "principale": "1" if i == 0 else "0", "ordine": "99"}, {"f": ("f", b)})
                if not r.get("ok"):
                    return (pid, col, None, [], f"upload: {r.get('errore')}")
                ids.append(r["id"])
            return (pid, col, ids, [i_ for i_, _ in hs if i_ not in usati], "")
        except Exception as e:  # noqa: BLE001
            return (pid, col, None, [], str(e))

    ris = list(cf.ThreadPoolExecutor(2).map(fai, lavori))
    val = []
    for pid, col, ids, avanzi, _ in ris:
        if ids is None:
            continue
        base = pos[(pid, col)] * 3
        val += [f"('{fid}',{base + i},{'true' if i == 0 else 'false'})" for i, fid in enumerate(ids)]
        val += [f"('{fid}',{base + len(ids) + k},false)" for k, fid in enumerate(avanzi)]
    sql = ('update motonova."Foto" f set ordine=v.o, principale=v.p from (values ' + ",".join(val) + ") v(id,o,p) where f.id=v.id;") if val else ""
    open(out + ".sql", "w").write(sql)
    json.dump(ris, open(out + ".json", "w"))
    print("completati:", sum(1 for r in ris if r[2] is not None), "errori:", [r[4][:80] for r in ris if r[2] is None][:5])
    print("SQL da eseguire:", out + ".sql" if sql else "(niente)")


if __name__ == "__main__":
    main()
