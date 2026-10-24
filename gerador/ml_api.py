"""API oficial do Mercado Livre (aplicação "Farejadinhos da Yang" no DevCenter).

Token pelo fluxo Client Credentials (sem login de ninguém).
Segredos no GitHub: ML_CLIENT_ID e ML_CLIENT_SECRET.

Uso:
    python gerador/ml_api.py teste     -> grava radar/teste-ml.json com o que cada rota devolve
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anuncios_comum import SITE, ler  # noqa: E402

API = "https://api.mercadolibre.com"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
_token = {"valor": "", "ate": 0}


def chaves():
    return os.environ.get("ML_CLIENT_ID", "").strip(), os.environ.get("ML_CLIENT_SECRET", "").strip()


def token():
    if _token["valor"] and time.time() < _token["ate"] - 60:
        return _token["valor"]
    cid, sec = chaves()
    corpo = urllib.parse.urlencode({"grant_type": "client_credentials", "client_id": cid, "client_secret": sec}).encode()
    req = urllib.request.Request(API + "/oauth/token", data=corpo, method="POST", headers={
        "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        j = json.loads(r.read().decode())
    _token["valor"] = j["access_token"]
    _token["ate"] = time.time() + int(j.get("expires_in", 21600))
    return _token["valor"]


def get(caminho, com_token=True):
    """-> (status, json|texto)"""
    h = {"Accept": "application/json", "User-Agent": "farejadinhos-yang/1.0"}
    if com_token:
        h["Authorization"] = "Bearer " + token()
    req = urllib.request.Request(API + caminho, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        corpo = e.read().decode("utf-8", "ignore")[:600]
        try:
            corpo = json.loads(corpo)
        except Exception:  # noqa: BLE001
            pass
        return e.code, corpo


# ---------- link curto (meli.la) -> código do anúncio / produto ----------
class _SemRedir(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def ids_no_texto(t):
    """-> ("item", "MLB123") | ("produto", "MLB123") | None"""
    t = urllib.parse.unquote(str(t or ""))
    m = re.search(r"/p/(MLB\d{5,})", t)
    if m:
        return ("produto", m.group(1))
    m = re.search(r"\b(MLB)-?(\d{6,})", t)
    if m:
        return ("item", m.group(1) + m.group(2))
    m = re.search(r"item_id[=:\"]+(MLB\d+)", t, re.I)
    if m:
        return ("item", m.group(1))
    return None


def resolver(link):
    achado = ids_no_texto(link)
    if achado:
        return achado
    abridor = urllib.request.build_opener(_SemRedir)
    url = link
    for _ in range(8):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9"})
        try:
            r = abridor.open(req, timeout=20)
            return ids_no_texto(r.geturl()) or ids_no_texto(r.read(300000).decode("utf-8", "ignore"))
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308) and e.headers.get("Location"):
                url = urllib.parse.urljoin(url, e.headers["Location"])
                achado = ids_no_texto(url)
                if achado:
                    return achado
                continue
            return ids_no_texto(e.read(300000).decode("utf-8", "ignore") if e.fp else "")
    return None


def teste():
    saida = {"quando": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    cid, sec = chaves()
    if not cid or not sec:
        saida["erro"] = "segredos ML_CLIENT_ID / ML_CLIENT_SECRET não configurados"
    else:
        try:
            token()
            saida["token"] = "ok"
        except urllib.error.HTTPError as e:
            saida["token"] = f"erro {e.code}: {e.read().decode('utf-8', 'ignore')[:300]}"
        except Exception as e:  # noqa: BLE001
            saida["token"] = f"erro: {e}"
        if saida["token"] == "ok":
            def resumo(st, j, n=2):
                if isinstance(j, dict):
                    j = {k: (v[:n] if isinstance(v, list) else v) for k, v in list(j.items())[:25]}
                elif isinstance(j, list):
                    j = j[:n]
                return {"status": st, "resposta": j}
            saida["variacoes"] = {
                "categorias_sem_token": resumo(*get("/sites/MLB/categories", com_token=False), n=3),
                "users_me": resumo(*get("/users/me"), n=3),
                "item_sem_token": resumo(*get("/items/MLB4161617218", com_token=False), n=3),
                "item_com_token": resumo(*get("/items/MLB4161617218"), n=3),
                "produto_sem_token": resumo(*get("/products/MLB19941202", com_token=False), n=3),
                "highlights_sem_token": resumo(*get("/highlights/MLB/category/MLB1574", com_token=False), n=3),
                "busca_sem_token": resumo(*get("/sites/MLB/search?q=air%20fryer&limit=1", com_token=False), n=1),
                "categoria_MLB1574": resumo(*get("/categories/MLB1574"), n=3),
            }
            saida["categorias"] = resumo(*get("/sites/MLB/categories"), n=40)
            saida["tendencias"] = resumo(*get("/trends/MLB"), n=10)
            saida["maisVendidos_MLB1574_casa"] = resumo(*get("/highlights/MLB/category/MLB1574"), n=5)
            saida["busca"] = resumo(*get("/sites/MLB/search?q=air%20fryer&limit=2"), n=2)
            # links das ofertas do site
            links = [o["link"] for o in ler() if isinstance(o, dict) and re.search(r"meli\.la|mercadoli", str(o.get("link")))][:4]
            saida["links"] = []
            for l in links:
                r = {"link": l}
                try:
                    r["resolvido"] = resolver(l)
                except Exception as e:  # noqa: BLE001
                    r["resolvido"] = f"erro: {e}"
                if isinstance(r["resolvido"], tuple):
                    tipo, i = r["resolvido"]
                    if tipo == "item":
                        st, j = get(f"/items/{i}")
                        r["item"] = {"status": st, "preco": j.get("price") if isinstance(j, dict) else None,
                                     "titulo": j.get("title") if isinstance(j, dict) else None,
                                     "catalogo": j.get("catalog_product_id") if isinstance(j, dict) else None,
                                     "erro": None if st == 200 else j}
                    else:
                        st, j = get(f"/products/{i}")
                        r["produto"] = {"status": st, "nome": j.get("name") if isinstance(j, dict) else None,
                                        "buy_box": (j.get("buy_box_winner") or {}).get("price") if isinstance(j, dict) else None,
                                        "erro": None if st == 200 else j}
                        st2, j2 = get(f"/products/{i}/items?limit=1")
                        r["produto_itens"] = {"status": st2, "resposta": (j2.get("results") or [])[:1] if isinstance(j2, dict) else j2}
                saida["links"].append(r)
    os.makedirs(os.path.join(SITE, "radar"), exist_ok=True)
    with open(os.path.join(SITE, "radar", "teste-ml.json"), "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=1, default=str)
    print(json.dumps(saida, ensure_ascii=False, default=str)[:3000])


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "teste":
        teste()
