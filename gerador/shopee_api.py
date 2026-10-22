"""Preço da Shopee pela API oficial de afiliados (Open API).

A página da Shopee bloqueia robôs, então a conferência automática não
consegue ler o preço abrindo o link. A API de afiliados devolve o preço
atual de um produto a partir do shopId + itemId.

Segredos no GitHub: SHOPEE_APP_ID e SHOPEE_SECRET.

Uso pelo conferir-precos.ps1:
    python gerador/shopee_api.py lote <saida.json> [--teste] [--limite N]
grava { link: {"preco": "R$ 79,90", "produto": "...", "ids": "shop.item"}
        ou {"erro": "..."} } pra cada link da Shopee das ofertas.
Os ids de cada link curto ficam guardados em precos/shopee-ids.json (pra
não precisar resolver o link toda hora).
"""
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anuncios_comum import SITE, agora_iso, ler, preco_br  # noqa: E402

API_URL = "https://open-api.affiliate.shopee.com.br/graphql"
CACHE = os.path.join(SITE, "precos", "shopee-ids.json")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def eh_shopee(link):
    return bool(re.search(r"shopee|shp\.ee", str(link or ""), re.I))


def chaves():
    return os.environ.get("SHOPEE_APP_ID", "").strip(), os.environ.get("SHOPEE_SECRET", "").strip()


# ---------------- link -> shopId.itemId ----------------
def ids_no_texto(texto, url=True):
    t = str(texto or "")
    padroes = [r"-i\.(\d+)\.(\d+)", r"/product/(\d+)/(\d+)"]
    if url:  # shopee.com.br/<loja>/<shopId>/<itemId>
        padroes.append(r"shopee\.com\.br/[^/?#]+/(\d{3,})/(\d{5,})(?:[/?#]|$)")
    for _ in range(4):  # links dentro de links (origin_link=..., redir=...)
        for padrao in padroes:
            m = re.search(padrao, t)
            if m:
                return f"{m.group(1)}.{m.group(2)}"
        m1 = re.search(r"shop_?id[=:\"]+(\d+)", t, re.I)
        m2 = re.search(r"item_?id[=:\"]+(\d+)", t, re.I)
        if m1 and m2:
            return f"{m1.group(1)}.{m2.group(1)}"
        t2 = urllib.parse.unquote(t)
        if t2 == t:
            break
        t = t2
    return ""


class _SemRedirecionar(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def resolver(link):
    """Segue o link curto (s.shopee.com.br/...) até achar os ids."""
    ids = ids_no_texto(link)
    if ids:
        return ids
    abridor = urllib.request.build_opener(_SemRedirecionar)
    url = link
    for _ in range(8):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9"})
        try:
            r = abridor.open(req, timeout=20)
            corpo = r.read(400000).decode("utf-8", "ignore")
            return ids_no_texto(r.geturl()) or ids_no_texto(corpo, url=False)
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308) and e.headers.get("Location"):
                url = urllib.parse.urljoin(url, e.headers["Location"])
                ids = ids_no_texto(url)
                if ids:
                    return ids
                continue
            corpo = e.read(400000).decode("utf-8", "ignore") if e.fp else ""
            return ids_no_texto(corpo, url=False)
    return ""


# ---------------- API ----------------
def consultar(shop_id, item_id):
    app_id, secret = chaves()
    query = ("{productOfferV2(shopId:%s,itemId:%s,limit:1){nodes{itemId shopId productName "
             "priceMin priceMax priceDiscountRate imageUrl offerLink productLink}}}" % (int(shop_id), int(item_id)))
    corpo = json.dumps({"query": query}, separators=(",", ":"))
    ts = str(int(time.time()))
    assinatura = hashlib.sha256((app_id + ts + corpo + secret).encode("utf-8")).hexdigest()
    req = urllib.request.Request(API_URL, data=corpo.encode("utf-8"), method="POST", headers={
        "Content-Type": "application/json",
        "Authorization": f"SHA256 Credential={app_id}, Timestamp={ts}, Signature={assinatura}",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        j = json.loads(r.read().decode("utf-8"))
    if j.get("errors"):
        e = j["errors"][0]
        cod = (e.get("extensions") or {}).get("code", "")
        raise RuntimeError(f"API Shopee {cod}: {(e.get('extensions') or {}).get('message') or e.get('message')}")
    nodes = (((j.get("data") or {}).get("productOfferV2") or {}).get("nodes")) or []
    return nodes[0] if nodes else None


def preco_do_link(link, cache):
    """-> {"preco": "R$ x", "produto": ..., "ids": ...} ou {"erro": ...}"""
    ids = cache.get(link) or ""
    if not ids:
        try:
            ids = resolver(link)
        except Exception as e:  # noqa: BLE001
            return {"erro": f"não consegui abrir o link curto: {str(e)[:120]}"}
        if not ids:
            return {"erro": "não achei o código do produto no link"}
        cache[link] = ids
    shop, item = ids.split(".")
    n = consultar(shop, item)
    if not n:
        return {"erro": "a API não achou esse produto (pode ter saído do ar ou do programa de afiliados)", "ids": ids}
    try:
        valor = float(n.get("priceMin") or 0)
    except ValueError:
        valor = 0
    if valor <= 0:
        return {"erro": "a API devolveu sem preço", "ids": ids}
    r = {"preco": preco_br(valor), "produto": n.get("productName") or "", "ids": ids}
    try:
        maximo = float(n.get("priceMax") or 0)
        if maximo > valor * 1.01:
            r["variacoes"] = f"{preco_br(valor)} a {preco_br(maximo)}"
    except ValueError:
        pass
    return r


def ler_cache():
    try:
        with open(CACHE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return {}


def salvar_cache(cache):
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    texto = json.dumps(dict(sorted(cache.items())), ensure_ascii=False, indent=2)
    antigo = None
    try:
        with open(CACHE, encoding="utf-8") as f:
            antigo = f.read()
    except Exception:  # noqa: BLE001
        pass
    if texto != antigo:
        with open(CACHE, "w", encoding="utf-8", newline="\n") as f:
            f.write(texto)


def lote(saida, teste=False, limite=0):
    app_id, secret = chaves()
    resultado = {"_status": {"quando": agora_iso(), "teste": teste}}
    if not app_id or not secret:
        resultado["_status"]["erro"] = "segredos SHOPEE_APP_ID / SHOPEE_SECRET não configurados no GitHub"
        print(resultado["_status"]["erro"])
    else:
        cache = ler_cache()
        links = []
        for o in ler():
            if isinstance(o, dict) and eh_shopee(o.get("link")) and o.get("link") not in links:
                links.append(o["link"])
        if limite:
            links = links[:limite]
        ok = erros = 0
        for link in links:
            try:
                r = preco_do_link(link, cache)
            except Exception as e:  # noqa: BLE001
                r = {"erro": str(e)[:200]}
                if "10020" in r["erro"] or "10035" in r["erro"]:
                    # chave errada / sem acesso: não adianta seguir
                    resultado["_status"]["erro"] = r["erro"]
                    resultado[link] = r
                    print(r["erro"])
                    break
            resultado[link] = r
            if "preco" in r:
                ok += 1
            else:
                erros += 1
            time.sleep(0.25)
        resultado["_status"].update({"links": len(links), "ok": ok, "erros": erros})
        print(f"API Shopee: {ok} preço(s) lido(s), {erros} sem preço, de {len(links)} link(s).")
        salvar_cache(cache)
    with open(saida, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "lote":
        limite = 0
        if "--limite" in args:
            limite = int(args[args.index("--limite") + 1] or 0)
        lote(args[1], teste="--teste" in args, limite=limite)
    else:
        print(__doc__)
