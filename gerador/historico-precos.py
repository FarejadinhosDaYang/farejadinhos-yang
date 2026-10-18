"""
HISTÓRICO DE PREÇOS (roda sozinho pelo GitHub Actions)

Lê o histórico do git do ofertas.json — cada oferta nova, edição, importação em lote
e cada "Precos conferidos automaticamente" (de hora em hora) — e guarda a evolução do
preço de cada produto em historico-precos.json, na raiz do site.

- Só processa os commits novos desde a última rodada (campo "ultimoCommit").
- Um ponto novo entra quando o preço muda (ou na primeira vez que o produto aparece).
- Produto = mesmo link de afiliado; se o mesmo produto voltar com outro link (mesmo nome
  completo e mesma loja), continua no mesmo histórico.
- Produto que sai do ofertas.json (oferta vencida) continua no histórico com "noAr": false.

Uso:  python gerador/historico-precos.py            (incremental)
      python gerador/historico-precos.py --refazer  (refaz tudo desde o começo)
"""
import hashlib, json, os, re, subprocess, sys, unicodedata
from datetime import datetime, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARQ = os.path.join(RAIZ, "historico-precos.json")
REFAZER = "--refazer" in sys.argv


def git(*args):
    return subprocess.run(["git", "-C", RAIZ, *args], capture_output=True, text=True, encoding="utf-8", check=True).stdout


def numero(p):
    s = re.sub(r"[^\d.,]", "", str(p or ""))
    if not s: return None
    if "," in s: s = s.replace(".", "").replace(",", ".")
    elif s.count(".") > 1 or re.search(r"\.\d{3}$", s): s = s.replace(".", "")
    try:
        v = round(float(s), 2)
        return v if v > 0 else None
    except ValueError:
        return None


def norm(t):
    t = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def loja(link):
    l = str(link or "")
    if re.search(r"shopee|shp\.ee", l, re.I): return "Shopee"
    if re.search(r"mercadoli[vb]re|meli\.la", l, re.I): return "Mercado Livre"
    if re.search(r"amazon\.|amzn\.", l, re.I): return "Amazon"
    return ""


def utc(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------- estado anterior ----------
hist = {"versao": 1, "atualizado": None, "ultimoCommit": None, "produtos": {}}
if os.path.exists(ARQ) and not REFAZER:
    with open(ARQ, encoding="utf-8") as f:
        hist = json.load(f)
P = hist["produtos"]
por_link, por_nome = {}, {}
for pid, p in P.items():
    for l in p.get("links", []): por_link[l] = pid
    por_nome[(norm(p.get("nomeCompleto") or p.get("nome")), p.get("loja", ""))] = pid

# ---------- commits novos que mexeram no ofertas.json ----------
intervalo = f"{hist['ultimoCommit']}..HEAD" if hist.get("ultimoCommit") else "HEAD"
try:
    linhas = git("log", "--reverse", "--format=%H %cI", intervalo, "--", "ofertas.json").split("\n")
except subprocess.CalledProcessError:
    # commit antigo sumiu (história reescrita): refaz tudo
    hist = {"versao": 1, "atualizado": None, "ultimoCommit": None, "produtos": {}}
    P, por_link, por_nome = hist["produtos"], {}, {}
    linhas = git("log", "--reverse", "--format=%H %cI", "HEAD", "--", "ofertas.json").split("\n")
commits = [l.split() for l in linhas if l.strip()]

ultimo_lido = None
for sha, quando in commits:
    try:
        ofertas = json.loads(git("show", f"{sha}:ofertas.json"))
    except Exception:
        continue  # versão quebrada/no meio de edição: pula
    if isinstance(ofertas, dict): ofertas = ofertas.get("ofertas", [ofertas])
    t = utc(quando)
    vistos = set()
    for o in ofertas:
        if not isinstance(o, dict): continue
        link = str(o.get("link") or "").strip()
        preco = numero(o.get("preco"))
        if not link or not preco: continue
        nome_completo = o.get("produtoOriginal") or o.get("produto") or ""
        lj = loja(link)
        pid = por_link.get(link)
        if not pid:
            # mesmo produto voltando com outro link? (mas não se o "irmão" está no ar
            # neste mesmo momento com outro link — aí são duas ofertas diferentes)
            pid = por_nome.get((norm(nome_completo), lj))
            if pid and pid in vistos: pid = None
        if not pid:
            pid = hashlib.sha1(link.encode()).hexdigest()[:10]
            P[pid] = {"nome": "", "nomeCompleto": "", "loja": lj, "links": [], "pontos": [], "primeiro": t}
        p = P[pid]
        if link not in p["links"]: p["links"].append(link)
        por_link[link] = pid
        por_nome.setdefault((norm(nome_completo), lj), pid)
        p["nome"] = o.get("produto") or p["nome"]
        p["nomeCompleto"] = nome_completo or p["nomeCompleto"]
        p["slug"] = o.get("slug") or p.get("slug", "")
        p["imagem"] = o.get("imagem") or p.get("imagem", "")
        p["categoria"] = o.get("categoria") or p.get("categoria", "")
        brutos = p.setdefault("brutos", list(p["pontos"]))
        if not brutos or abs(brutos[-1][1] - preco) >= 0.01:
            brutos.append([t, preco])
        p["ultimo"] = t
        vistos.add(pid)
    for pid, p in P.items():
        p["noAr"] = pid in vistos
    ultimo_lido = sha

if ultimo_lido is None and not REFAZER:
    print("Nenhuma mudança nova no ofertas.json.")
    sys.exit(0)

# leituras estranhas: a conferência automática às vezes pega o preço de outra variação/kit
# (ex.: R$ 35 -> R$ 338 -> R$ 35). Com 3+ leituras, o que for mais que o dobro ou menos que
# a metade da mediana vai pra "suspeitos" e não entra no gráfico nem no mínimo/máximo.
def limpar(p):
    brutos = p.get("brutos") or p["pontos"]
    p["brutos"] = brutos
    vals = sorted(v for _, v in brutos)
    if len(vals) >= 3:
        med = vals[len(vals) // 2] if len(vals) % 2 else (vals[len(vals) // 2 - 1] + vals[len(vals) // 2]) / 2
        bons = [pt for pt in brutos if med / 2 <= pt[1] <= med * 2]
        p["suspeitos"] = [pt for pt in brutos if not (med / 2 <= pt[1] <= med * 2)]
    else:
        bons, p["suspeitos"] = list(brutos), []
    limpos = []
    for pt in bons:
        if not limpos or abs(limpos[-1][1] - pt[1]) >= 0.01: limpos.append(pt)
    p["pontos"] = limpos or brutos[-1:]
    if not p["suspeitos"]: del p["suspeitos"]
    if p["brutos"] == p["pontos"]: del p["brutos"]

# resumo pronto pra usar no site
for p in P.values():
    limpar(p)
    vals = [v for _, v in p["pontos"]]
    p["atual"] = vals[-1]
    p["min"] = min(vals)
    p["max"] = max(vals)

hist["ultimoCommit"] = ultimo_lido or hist.get("ultimoCommit")
hist["atualizado"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
hist["produtos"] = dict(sorted(P.items(), key=lambda kv: kv[1].get("ultimo", ""), reverse=True))

with open(ARQ, "w", encoding="utf-8", newline="\n") as f:
    json.dump(hist, f, ensure_ascii=False, separators=(",", ":"))
    f.write("\n")

mudaram = sum(1 for p in P.values() if len(p["pontos"]) > 1)
print(f"{len(commits)} commit(s) lido(s). {len(P)} produto(s) no histórico, {mudaram} com mudança de preço.")
