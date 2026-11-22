#!/usr/bin/env python3
"""Costruisce un piano MotoNova dal catalogo di un negozio ufficiale su Shopify (es. nolan-helmets.com).

  python3 agenti/shopify.py --dominio nolan-helmets.com --collezione tutti-i-caschi --marca Nolan \
      --categoria caschi --modelli agenti/modelli/nolan.json --out /tmp/piano.json

Ogni prodotto Shopify è una colorazione. Il titolo viene diviso in MODELLO (prefisso noto, dal file --modelli),
GRAFICA (parole in maiuscolo dopo il modello) e COLORE (dalla prima parola con minuscole).
Si raggruppano le colorazioni per (modello, prezzo di listino), al massimo 6 colori e 3 grafiche per prodotto.
Restano fuori le colorazioni senza nessuna taglia disponibile o con meno di 3 foto.
Il file --modelli è un oggetto: { "PREFISSO TITOLO": ["Nome", "Sottotitolo", ["stili"], "Materiale", "Descrizione breve in italiano"], ... }
"""
import argparse, json, math, os, re, sys, urllib.request
from collections import OrderedDict, defaultdict

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from mn import prezzo_egp  # noqa: E402

a = argparse.ArgumentParser()
a.add_argument("--dominio", required=True); a.add_argument("--collezione", required=True)
a.add_argument("--marca", required=True); a.add_argument("--categoria", default="caschi")
a.add_argument("--modelli", required=True); a.add_argument("--out", required=True)
a.add_argument("--certificazione", default="ECE 22.06"); a.add_argument("--foto", type=int, default=3)
x = a.parse_args()

ps = []
for page in range(1, 20):
    u = f"https://{x.dominio}/collections/{x.collezione}/products.json?limit=250&page={page}"
    d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=60))["products"]
    if not d: break
    ps += d
MOD = OrderedDict(sorted(json.load(open(x.modelli)).items(), key=lambda kv: -len(kv[0])))


def tc(s):
    s = s.replace("D.O.C EVO", "D.O.C. EVO").title().replace("Sbk", "SBK").replace(" Ess", " ESS").replace("I-Ess", "i-ESS")
    return re.sub(r"\b(Di|Th|De|Da)\b", lambda m: m.group(1).lower(), s)


righe = []
for p in ps:
    t = re.sub(r"\s+", " ", p["title"].strip())
    pref = next((k for k in MOD if t.upper().startswith(k + " ") or t.upper() == k), None)
    if not pref: print("SENZA MODELLO:", t, file=sys.stderr); continue
    resto = t[len(pref):].strip()
    m = re.match(r"^(.*?)\s?([A-Z][a-zà-ù].*)$", resto)
    graf, col = (m.group(1).strip(), m.group(2).strip()) if m else (resto, "")
    col = re.sub(r"\s*/\s*", "/", col)
    disp = [v["title"] for v in p["variants"] if v["available"]]
    imgs = [i["src"].split("?")[0] + "?width=1800" for i in p["images"]]
    if not disp or len(imgs) < 3: continue
    colore = (tc(graf) + " " + col).strip() if graf else col
    if any(r["pref"] == pref and r["colore"] == colore for r in righe): continue
    listino = max(float(v["compare_at_price"] or v["price"]) for v in p["variants"])
    righe.append(dict(pref=pref, graf=tc(graf), colore=colore, listino=listino, taglie=disp, imgs=imgs[: x.foto], special="SPECIAL EDITION" in graf.upper()))

# Stabilità fra un giro e l'altro: un colore che è già sul sito resta nel suo prodotto (si aggiornano solo taglie e prezzo);
# solo i colori che non ci sono ancora formano prodotti nuovi. Così l'ordine del negozio ufficiale può cambiare senza doppioni.
if not os.environ.get("MN_CHIAVE"):
    sys.exit("Serve MN_CHIAVE: senza il catalogo attuale del sito il piano creerebbe doppioni.")
from mn import _post
_cat = _post("/api/agenti", {"op": "catalogo", "marca": x.marca})
if not _cat.get("ok"):
    sys.exit(f"Catalogo del sito non leggibile: {_cat.get('errore')}")
esistenti = _cat.get("prodotti", [])
NOMI = sorted({v[0] for v in MOD.values()}, key=len, reverse=True)
mod_di = lambda nome: next((n for n in NOMI if nome == n or nome.startswith(n + " ")), "")
dove = {(mod_di(e["nome"]), c): e for e in esistenti for c in e["colori"]}
k_di = lambda r: (MOD[r["pref"]][0], r["colore"])
piano, slugs = [], {e["slug"] for e in esistenti}
per_e = defaultdict(list)
for r in righe:
    if k_di(r) in dove: per_e[dove[k_di(r)]["slug"]].append(r)
tutti = {k_di(r) for r in righe}
for e in esistenti:
    rs = per_e.get(e["slug"], [])
    sp = [c for c in e["colori"] if (mod_di(e["nome"]), c) not in tutti]
    if not rs and not sp: continue
    q = dict(slug=e["slug"], marca=x.marca, nome=e["nome"], categoria=x.categoria, tipo="NUOVO", aggiornaGiacenze=True,
             varianti=[dict(colore=c["colore"], taglia=t, giacenza=1) for c in rs for t in c["taglie"]],
             foto=[dict(src=u, colore=c["colore"], principale=(j == 0)) for c in rs for j, u in enumerate(c["imgs"])])
    if rs: q["prezzo"] = prezzo_egp(max(c["listino"] for c in rs))
    if sp: q["coloriSpariti"] = sp
    piano.append(q)
righe_nuove = [r for r in righe if k_di(r) not in dove]

gr = defaultdict(list)
for r in righe_nuove: gr[(r["pref"], math.ceil(r["listino"]), r["special"])].append(r)


def slugdi(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-"); b, i = s, 2
    while s in slugs: s = f"{b}-{i}"; i += 1
    slugs.add(s); return s


for (pref, eur, spec), rs in sorted(gr.items(), key=lambda kv: (list(MOD).index(kv[0][0]), kv[0][1])):
    nome0, sotto, stili, mat, descr = MOD[pref]
    pg = OrderedDict()
    for c in sorted(rs, key=lambda c: (c["graf"] or "Mono", c["colore"])): pg.setdefault(c["graf"] or "Mono", []).append(c)
    chunks, cur, gs = [], [], []
    for g, cs in pg.items():
        for i in range(0, len(cs), 6):
            part = cs[i:i + 6]
            if cur and (len(cur) + len(part) > 6 or len(gs) >= 3): chunks.append((gs, cur)); cur, gs = [], []
            cur += part
            if g not in gs: gs.append(g)
    if cur: chunks.append((gs, cur))
    for grafs, ch in chunks:
        nome = nome0 + " " + " / ".join(grafs)
        piano.append(dict(slug=slugdi(f"{x.marca}-{nome}"), marca=x.marca, nome=nome, sottotitolo=sotto, categoria=x.categoria, stili=stili,
                          tipo="NUOVO", prezzo=prezzo_egp(eur), materiale=mat, certificazione=x.certificazione, descrizione=[descr],
                          edizione="special" if spec else None, attivo=True, aggiornaGiacenze=True,
                          varianti=[dict(colore=c["colore"], taglia=t, giacenza=1) for c in ch for t in c["taglie"]],
                          foto=[dict(src=u, colore=c["colore"], principale=(j == 0)) for c in ch for j, u in enumerate(c["imgs"])]))
json.dump(piano, open(x.out, "w"), ensure_ascii=False)
print(f"{len(righe)} colorazioni: {len(righe) - len(righe_nuove)} già sul sito, {len(righe_nuove)} nuove -> {sum(1 for p in piano if 'sottotitolo' in p)} prodotti nuovi, {len(piano)} voci nel piano")
