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
# Negozi dove il colore è un'opzione della variante e non sta nel titolo (es. eu.alpinestars.com):
a.add_argument("--colore-da-opzione", action="store_true", help="titolo = MODELLO GRAFICA (maiuscolo) + valore dell'opzione Color/Colore")
a.add_argument("--solo-titoli", default="", help="tieni solo i prodotti il cui titolo contiene una di queste parole, separate da | (es. Helmet)")
a.add_argument("--togli", default="", help="pezzi da togliere dal titolo, separati da | (es. ' Helmet ECE 22.06| Helmet')")
a.add_argument("--codice-colore", action="store_true", help="titoli 'Modello Grafica C5 Finitura' (es. mthelmets.com) -> 'MODELLO GRAFICA Finitura C5'")
a.add_argument("--foto-preferite", default="", help="pezzi del nome file delle foto da mettere per prime, separati da virgola (es. _FR.,_BA.)")
a.add_argument("--senza-mono", action="store_true", help="prodotti senza grafica: nome = modello (niente 'Mono'); per abbigliamento")
a.add_argument("--ordine-foto", default="", help="indici delle foto da usare, la prima è la principale (es. 5,1,0)")
# Negozi con titoli "Jacket Modello | Colore" (es. www.revitsport.com): si tiene solo la parte prima del separatore
a.add_argument("--taglia-titolo", default="", help="separatore dopo cui il titolo viene tagliato (es. ' | '), da usare con --colore-da-opzione")
a.add_argument("--escludi-tag", default="", help="salta i prodotti con uno di questi tag, separati da | (es. OutletEU: prezzo d'outlet, non di listino)")
a.add_argument("--solo-tipi", default="", help="tieni solo questi product_type, separati da | (es. Jackets|Suits)")
x = a.parse_args()

ps, visti = [], set()
for coll in x.collezione.split(","):  # più collezioni separate da virgola: vanno lette tutte insieme (altrimenti colori "spariti" falsi)
    for page in range(1, 20):
        u = f"https://{x.dominio}/collections/{coll}/products.json?limit=250&page={page}"
        d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=60))["products"]
        if not d: break
        ps += [q for q in d if q["id"] not in visti]; visti |= {q["id"] for q in d}
MOD = OrderedDict(sorted(json.load(open(x.modelli)).items(), key=lambda kv: -len(kv[0])))


def tc(s):
    s = s.replace("D.O.C EVO", "D.O.C. EVO").title().replace("Sbk", "SBK").replace(" Ess", " ESS").replace("I-Ess", "i-ESS")
    return re.sub(r"\b(Di|Th|De|Da)\b", lambda m: m.group(1).lower(), s)


def titolo(p):
    t = re.sub(r"\s+", " ", p["title"].strip())
    if x.codice_colore:
        m = re.match(r"^(.*?)\s+([A-Z]{1,2}\d+)\s+(.*)$", t)
        if m: return m.group(1).rstrip(" /").upper() + " " + m.group(3)[:1].upper() + m.group(3)[1:] + " " + m.group(2)
        return t.upper()
    if not x.colore_da_opzione: return t
    if x.taglia_titolo: t = t.split(x.taglia_titolo)[0].strip()
    for z in [z for z in x.togli.split("|") if z]: t = t.replace(z, "")
    t = re.sub(r"^Limited Edition (.*)$", r"\1 Limited Edition", t).strip()
    opt = next((o for o in p["options"] if o["name"].lower() in ("color", "colore", "colour")), None)
    col = opt["values"][0] if opt else ""
    return (t.upper() + " " + col[:1].upper() + col[1:]).strip()


def foto_di(p):
    imgs = [i["src"].split("?")[0] + "?width=1800" for i in p["images"]]
    if x.foto_preferite:
        pref = x.foto_preferite.split(",")
        prime = [next((u for u in imgs if k in u.rsplit("/", 1)[-1]), None) for k in pref]
        prime = [u for u in prime if u]
        return (prime + [u for u in imgs if u not in prime])[: x.foto]
    if x.ordine_foto:
        idx = [int(i) for i in x.ordine_foto.split(",")]
        if len(imgs) > max(idx): return [imgs[i] for i in idx]
    return imgs[: x.foto]


righe = []
for p in ps:
    if x.solo_titoli and not any(w in p["title"] for w in x.solo_titoli.split("|")): continue
    if x.escludi_tag and set(x.escludi_tag.split("|")) & set(p.get("tags", [])): continue
    if x.solo_tipi and p.get("product_type") not in x.solo_tipi.split("|"): continue
    t = titolo(p)
    pref = next((k for k in MOD if t.upper().startswith(k + " ") or t.upper() == k), None)
    if not pref: print("SENZA MODELLO:", t, file=sys.stderr); continue
    resto = t[len(pref):].strip()
    m = re.match(r"^(.*?)\s?([A-Z][a-zà-ù].*)$", resto)
    graf, col = (m.group(1).strip(), m.group(2).strip()) if m else (resto, "")
    col = re.sub(r"\s*/\s*", "/", col)
    # taglia = valore dell'opzione Size/Taglia (se la variante ha anche il colore, il titolo sarebbe "M / Black")
    i_tg = next((i for i, o in enumerate(p.get("options", [])) if o["name"].lower() in ("size", "taglia", "talla", "taille", "größe")), None)
    disp = [(v.get(f"option{i_tg + 1}") if i_tg is not None else None) or v["title"] for v in p["variants"] if v["available"]]
    disp = list(dict.fromkeys(disp))  # stessa taglia in più lunghezze (standard/short/long) = una taglia
    imgs = foto_di(p)
    if not disp or len(imgs) < min(3, x.foto): continue
    colore = (tc(graf) + " " + col).strip() if graf else col
    if any(r["pref"] == pref and r["colore"] == colore for r in righe): continue
    listino = max(float(v["compare_at_price"] or v["price"]) for v in p["variants"])
    righe.append(dict(pref=pref, graf=tc(graf), colore=colore, listino=listino, taglie=disp, imgs=imgs, special="SPECIAL EDITION" in graf.upper()))

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
# solo i prodotti dei modelli di questo file: così un giro "giacche" non tocca i caschi della stessa marca (e viceversa)
tutti_slug = {e["slug"] for e in esistenti}
esistenti = [e for e in esistenti if mod_di(e["nome"])]
dove = {(mod_di(e["nome"]), c): e for e in esistenti for c in e["colori"]}
k_di = lambda r: (MOD[r["pref"]][0], r["colore"])
piano, slugs = [], set(tutti_slug)
per_e = defaultdict(list)
for r in righe:
    if k_di(r) in dove: per_e[dove[k_di(r)]["slug"]].append(r)
tutti = {k_di(r) for r in righe}
for e in esistenti:
    rs = per_e.get(e["slug"], [])
    # i prodotti con annunci Vinted non si toccano: i loro colori non vengono dal negozio ufficiale
    sp = [] if e.get("annunci") else [c for c in e["colori"] if (mod_di(e["nome"]), c) not in tutti]
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
    nome0, sotto, stili, mat, descr = MOD[pref][:5]
    genere = MOD[pref][5] if len(MOD[pref]) > 5 else None
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
        nome = nome0 if x.senza_mono and grafs == ["Mono"] else nome0 + " " + " / ".join(grafs)
        piano.append(dict(slug=slugdi(f"{x.marca}-{nome}"), marca=x.marca, nome=nome, sottotitolo=sotto, categoria=x.categoria, stili=stili,
                          tipo="NUOVO", prezzo=prezzo_egp(eur), materiale=mat, certificazione=x.certificazione, descrizione=[descr],
                          edizione="special" if spec else None, attivo=True, aggiornaGiacenze=True, **({"genere": genere} if genere else {}),
                          varianti=[dict(colore=c["colore"], taglia=t, giacenza=1) for c in ch for t in c["taglie"]],
                          foto=[dict(src=u, colore=c["colore"], principale=(j == 0)) for c in ch for j, u in enumerate(c["imgs"])]))
json.dump(piano, open(x.out, "w"), ensure_ascii=False)
print(f"{len(righe)} colorazioni: {len(righe) - len(righe_nuove)} già sul sito, {len(righe_nuove)} nuove -> {sum(1 for p in piano if 'sottotitolo' in p)} prodotti nuovi, {len(piano)} voci nel piano")
