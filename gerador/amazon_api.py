"""Amazon Creators API (API de criadores dos Associados da Amazon).

Segredos no GitHub: AMAZON_CLIENT_ID, AMAZON_CLIENT_SECRET e AMAZON_PARTNER_TAG
(a mesma tag de afiliado do site, ex.: farejadinho07-20).
Credenciais versão 3.1: o login é pelo api.amazon.com (Login with Amazon).

Uso:
    python gerador/amazon_api.py teste      -> grava radar/teste-amazon.json (só status e
                                                uma amostra dos produtos, NUNCA as chaves)
Funções usadas pelo radar_amazon.py: buscar(palavras, pagina, no=None).
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN_URL = "https://api.amazon.com/auth/o2/token"
API = "https://creatorsapi.amazon/catalog/v1/"
MARKETPLACE = "www.amazon.com.br"
RECURSOS = [
    "itemInfo.title",
    "images.primary.large",
    "offersV2.listings.price",
    "offersV2.listings.availability",
    "browseNodeInfo.websiteSalesRank",
    "browseNodeInfo.browseNodes.salesRank",
]

_token = {"valor": None, "expira": 0}


def chaves():
    g = lambda k: os.environ.get(k, "").strip()
    return g("AMAZON_CLIENT_ID"), g("AMAZON_CLIENT_SECRET"), g("AMAZON_PARTNER_TAG")


def _post(url, corpo, cabecalhos):
    req = urllib.request.Request(url, data=json.dumps(corpo).encode(), method="POST",
                                 headers={"Content-Type": "application/json", **cabecalhos})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        texto = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(texto)
        except Exception:
            return e.code, {"erro": texto[:500]}


def token():
    if _token["valor"] and _token["expira"] > time.time() + 60:
        return _token["valor"]
    cid, seg, _ = chaves()
    st, j = _post(TOKEN_URL, {"grant_type": "client_credentials", "client_id": cid,
                              "client_secret": seg, "scope": "creatorsapi::default"}, {})
    if st != 200 or "access_token" not in j:
        raise RuntimeError(f"login na Amazon falhou (status {st}): {str(j)[:300]}")
    _token.update(valor=j["access_token"], expira=time.time() + int(j.get("expires_in", 3600)))
    return _token["valor"]


def chamar(operacao, corpo):
    """Chama uma operação (searchItems, getItems, getBrowseNodes). Tenta de novo se a Amazon pedir calma (429)."""
    _, _, tag = chaves()
    corpo = {"partnerTag": tag, "marketplace": MARKETPLACE, **corpo}
    for tentativa in range(4):
        st, j = _post(API + operacao, corpo, {"Authorization": "Bearer " + token(), "x-marketplace": MARKETPLACE})
        if st == 429 and tentativa < 3:
            time.sleep(2 + 3 * tentativa)
            continue
        return st, j
    return st, j


def buscar(palavras, pagina=1, no=None):
    corpo = {"keywords": palavras, "itemCount": 10, "itemPage": pagina, "resources": RECURSOS}
    if no:
        corpo["browseNodeId"] = str(no)
    return chamar("searchItems", corpo)


def teste():
    saida = os.path.join(SITE, "radar", "teste-amazon.json")
    cid, seg, tag = chaves()
    r = {"quando": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
         "temClientId": bool(cid), "temSecret": bool(seg), "tag": tag or None}
    try:
        token()
        r["login"] = "ok"
        for palavras in ["air fryer", "organizador cozinha"]:
            st, j = buscar(palavras)
            itens = (((j or {}).get("searchResult") or {}).get("items")) or []
            r[palavras] = {"status": st, "quantos": len(itens),
                           "chaves": list(j.keys()) if isinstance(j, dict) else None,
                           "amostra": itens[:2] if itens else j}
            time.sleep(1.5)
    except Exception as e:
        r["erro"] = str(e)[:500]
    json.dump(r, open(saida, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in r.items() if k not in ("air fryer", "organizador cozinha")}, ensure_ascii=False))


if __name__ == "__main__":
    if sys.argv[1:2] == ["teste"]:
        teste()
