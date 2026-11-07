"""Lote "mais do mesmo tipo": procura na Shopee (API de afiliados) os mais
vendidos de cada tipo pedido e transforma num lote comum (link de afiliado,
preço, foto), que o gerar-lote.ps1 publica depois.

Item do lote:
  {"acao": "mais-do-tipo", "tipos": ["liquidificador", "chaleira elétrica"],
   "porTipo": 6, "categoria": ""}
Só entra produto com nota >= 4.5 e >= 100 vendas, que ainda não está no site,
sem palavra bloqueada (radar/config.json) e que É do tipo pedido (não peça
nem acessório dele: copo de liquidificador, lâmina, tampa...).

Uso: python gerador/mais_do_tipo.py entrada/lote-XXXX.json
Segredos: SHOPEE_APP_ID, SHOPEE_SECRET.
"""
import json
import os
import re
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anuncios_comum import SITE, ler, preco_br  # noqa: E402
from radar_shopee import bloqueado, buscar, norm, numero  # noqa: E402

NOTA_MIN = 4.5
VENDAS_MIN = 100
CAMPOS = ["itemId", "shopId", "productName", "priceMin", "priceMax", "priceDiscountRate",
          "imageUrl", "offerLink", "sales", "ratingStar"]
# peça/acessório do produto, não o produto
PECAS = ["copo", "jarra", "lamina", "faca", "tampa", "base", "borracha", "acoplamento", "engrenagem",
         "reparo", "reposicao", "peca", "pecas", "capa", "adesivo", "suporte", "filtro", "resistencia",
         "botao", "chave", "vedacao", "anel", "cabo", "rele", "motor", "kit reparo", "escova"]


def eh_do_tipo(nome, tipo):
    n = norm(nome).split()
    t = norm(tipo).split()
    if not t:
        return False
    # o tipo tem que aparecer logo no começo do nome (até a 4ª palavra),
    # sem nome de peça antes ("Copo para Liquidificador", "Tampa de Chaleira")
    for i in range(min(4, len(n))):
        if [w.rstrip("s") for w in n[i:i + len(t)]] == [w.rstrip("s") for w in t]:
            return not any(w in PECAS for w in n[:i])
    return False


def ids_no_site():
    ids = set()
    try:
        with open(os.path.join(SITE, "precos", "shopee-ids.json"), encoding="utf-8") as f:
            ids.update(str(v).split(".")[-1] for v in json.load(f).values() if v)
    except Exception:  # noqa: BLE001
        pass
    for o in ler():
        if not isinstance(o, dict):
            continue
        for l in [o.get("link")] + [a.get("link") for a in (o.get("anuncios") or []) if isinstance(a, dict)]:
            m = re.search(r"-i\.\d+\.(\d+)|/product/\d+/(\d+)", str(l or ""))
            if m:
                ids.add(m.group(1) or m.group(2))
    return ids


def nomes_do_site():
    return {norm(o.get("produto")) for o in ler() if isinstance(o, dict)}


def node(nomes, categoria_fixa):
    """encurta os nomes e sugere a categoria com o mesmo código do painel."""
    js = r"""
const fs=require("fs"),vm=require("vm"),path=require("path");
const raiz=process.argv[1];const ctx={window:{},console};ctx.window.window=ctx.window;vm.createContext(ctx);
for(const a of ["assets/categorias-config.js","assets/categorias.js","assets/nomes.js"]) vm.runInContext(fs.readFileSync(path.join(raiz,a),"utf8"),ctx);
const w=ctx.window;const nomes=JSON.parse(fs.readFileSync(0,"utf8"));
process.stdout.write(JSON.stringify(nomes.map(n=>[w.FarejadinhosNomes.encurtar(n),w.FarejadinhosCategorias.sugerir(n)])));
"""
    r = subprocess.run(["node", "-e", js, SITE], input=json.dumps(nomes), capture_output=True, text=True, check=True)
    out = json.loads(r.stdout)
    return [(a, categoria_fixa or b) for a, b in out]


def main(arquivo):
    with open(arquivo, encoding="utf-8-sig") as f:
        bruto = json.load(f)
    lista = bruto if isinstance(bruto, list) else [bruto]
    pedidos = [i for i in lista if isinstance(i, dict) and i.get("acao") == "mais-do-tipo"]
    if not pedidos:
        return
    cfg = {}
    try:
        with open(os.path.join(SITE, "radar", "config.json"), encoding="utf-8") as f:
            cfg = json.load(f)
    except Exception:  # noqa: BLE001
        pass
    bloquear = cfg.get("bloquear") or []
    ja = ids_no_site()
    nomes_site = nomes_do_site()
    achados = []  # (produto completo, item)
    for ped in pedidos:
        por_tipo = max(1, min(20, int(ped.get("porTipo") or 6)))
        for tipo in ped.get("tipos") or []:
            try:
                nodes = buscar(tipo, 50, CAMPOS)
            except Exception as e:  # noqa: BLE001
                print(f"  ⚠️ {tipo}: {e}")
                continue
            bons = []
            for n in nodes:
                nome = n.get("productName") or ""
                item_id = str(n.get("itemId") or "")
                preco = numero(n.get("priceMin"))
                if (item_id in ja or not n.get("offerLink") or preco <= 0
                        or numero(n.get("ratingStar")) < NOTA_MIN or numero(n.get("sales")) < VENDAS_MIN
                        or bloqueado(nome, bloquear) or not eh_do_tipo(nome, tipo)
                        or norm(nome) in nomes_site):
                    continue
                bons.append(n)
            bons.sort(key=lambda n: numero(n.get("sales")), reverse=True)
            print(f"  {tipo}: {len(nodes)} achados na Shopee, {len(bons)} servem, pegando {min(por_tipo, len(bons))}")
            for n in bons[:por_tipo]:
                ja.add(str(n.get("itemId")))
                preco = numero(n.get("priceMin"))
                taxa = numero(n.get("priceDiscountRate"))
                item = {"preco": preco_br(preco), "link": n["offerLink"], "imagemUrl": n.get("imageUrl") or ""}
                if 3 <= taxa < 95:
                    item["precoAntigo"] = preco_br(preco / (1 - taxa / 100))
                achados.append((n.get("productName") or "", item, ped.get("categoria") or ""))
            time.sleep(1)
    itens = []
    if achados:
        # categoria fixa do pedido vale pra todos daquele pedido
        nomes = node([a[0] for a in achados], "")
        for (nome, item, cat_fixa), (curto, cat) in zip(achados, nomes):
            item = {"produto": curto, **item, "categoria": cat_fixa or cat}
            itens.append(item)
            print(f"  ✅ {item['produto']} | {item['preco']} | {item['categoria']}")
    with open(arquivo, "w", encoding="utf-8") as f:
        json.dump(itens, f, ensure_ascii=False, indent=2)
    print(f"Mais do tipo: {len(itens)} produto(s) novo(s) no lote.")


if __name__ == "__main__":
    main(sys.argv[1])
