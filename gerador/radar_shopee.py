"""
RADAR DA YANG — produtos em alta na Shopee (roda sozinho pelo GitHub Actions)

Todo dia pesquisa na API oficial de afiliados da Shopee os MAIS VENDIDOS de cada
categoria do site (palavras em radar/config.json) e guarda quantas vendas cada
produto tinha. Comparando com os dias anteriores, calcula o RITMO (vendas por dia):
produto viral é o que está crescendo rápido, não só o que vende muito há anos.

Resultado em radar/radar.json, lido pela página painel/radar.html, onde o dono
escolhe o que sobe pro site (nada é publicado sozinho).

Segredos no GitHub: SHOPEE_APP_ID e SHOPEE_SECRET (os mesmos da conferência).

Uso:  python gerador/radar_shopee.py            (rodada normal)
      python gerador/radar_shopee.py --teste    (só mostra o que a API devolve, não grava)
"""
import hashlib
import json
import math
import os
import re
import sys
import time
import unicodedata
import urllib.request
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anuncios_comum import SITE, ler  # noqa: E402
from shopee_api import API_URL, chaves  # noqa: E402

PASTA = os.path.join(SITE, "radar")
CONFIG = os.path.join(PASTA, "config.json")
SAIDA = os.path.join(PASTA, "radar.json")
IDS_SITE = os.path.join(SITE, "precos", "shopee-ids.json")
TESTE = "--teste" in sys.argv
GUARDA_DIAS = 21          # some do radar quem não aparece há mais que isso
PONTOS_MAX = 30           # leituras de vendas guardadas por produto

CAMPOS = ["itemId", "shopId", "productName", "priceMin", "priceMax", "priceDiscountRate", "imageUrl",
          "offerLink", "productLink", "shopName", "commissionRate", "sales", "ratingStar"]


def agora():
    return datetime.now(timezone.utc)


def iso(d):
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


def de_iso(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def norm(t):
    t = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def gql(query):
    app_id, secret = chaves()
    corpo = json.dumps({"query": query}, separators=(",", ":"))
    ts = str(int(time.time()))
    assinatura = hashlib.sha256((app_id + ts + corpo + secret).encode("utf-8")).hexdigest()
    req = urllib.request.Request(API_URL, data=corpo.encode("utf-8"), method="POST", headers={
        "Content-Type": "application/json",
        "Authorization": f"SHA256 Credential={app_id}, Timestamp={ts}, Signature={assinatura}",
    })
    with urllib.request.urlopen(req, timeout=40) as r:
        j = json.loads(r.read().decode("utf-8"))
    if j.get("errors"):
        e = j["errors"][0]
        cod = (e.get("extensions") or {}).get("code", "")
        raise RuntimeError(f"API Shopee {cod}: {(e.get('extensions') or {}).get('message') or e.get('message')}")
    return j.get("data") or {}


def buscar(palavra, limite, campos):
    q = ('{productOfferV2(keyword:%s,sortType:2,page:1,limit:%d){nodes{%s}}}'
         % (json.dumps(palavra, ensure_ascii=False), int(limite), " ".join(campos)))
    return ((gql(q).get("productOfferV2") or {}).get("nodes")) or []


def numero(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def bloqueado(nome, palavras):
    n = " " + norm(nome)
    return any(re.search(r"\b" + re.escape(norm(p)), n) for p in palavras if p.strip())


def ritmo(vendas):
    """vendas por dia, comparando a leitura mais nova com uma de ~1 dia antes (ou a mais antiga)."""
    if len(vendas) < 2:
        return None, None
    t1, v1 = de_iso(vendas[-1][0]), vendas[-1][1]
    ref = None
    for t, v in reversed(vendas[:-1]):
        if (t1 - de_iso(t)).total_seconds() >= 20 * 3600:
            ref = (de_iso(t), v)
            break
    if ref is None:
        ref = (de_iso(vendas[0][0]), vendas[0][1])
    dias = max((t1 - ref[0]).total_seconds() / 86400, 0.25)
    por_dia = max(0.0, (v1 - ref[1]) / dias)
    # ritmo da semana (se tiver leitura de ~7 dias atrás)
    sem = None
    for t, v in vendas:
        d = (t1 - de_iso(t)).total_seconds() / 86400
        if 5.5 <= d <= 9:
            sem = max(0.0, (v1 - v) / d)
            break
    return round(por_dia, 1), (round(sem, 1) if sem is not None else None)


def main():
    app_id, secret = chaves()
    if not app_id or not secret:
        print("Segredos SHOPEE_APP_ID / SHOPEE_SECRET não configurados. Nada a fazer.")
        return 0
    with open(CONFIG, encoding="utf-8") as f:
        cfg = json.load(f)

    # o que já está no site (pra não sugerir de novo)
    no_site_ids, no_site_nomes = set(), set()
    try:
        with open(IDS_SITE, encoding="utf-8") as f:
            no_site_ids = set(v for v in json.load(f).values() if v)
    except Exception:  # noqa: BLE001
        pass
    for o in ler():
        if isinstance(o, dict):
            no_site_nomes.add(norm(o.get("produtoOriginal") or o.get("produto")))

    campos = list(CAMPOS)
    if TESTE:
        palavra = next(iter(cfg["categorias"].values()))[0]
        try:
            nodes = buscar(palavra, 3, campos)
        except RuntimeError as e:
            print("Com todos os campos deu erro:", e)
            campos = [c for c in campos if c not in ("sales", "ratingStar", "shopName")]
            nodes = buscar(palavra, 3, campos)
        print(f"Teste '{palavra}': {len(nodes)} produto(s)")
        for n in nodes:
            print(json.dumps(n, ensure_ascii=False)[:600])
        return 0

    hist = {"produtos": {}}
    if os.path.exists(SAIDA):
        with open(SAIDA, encoding="utf-8") as f:
            hist = json.load(f)
    P = hist.setdefault("produtos", {})
    t = iso(agora())
    vistos, erros, pesquisas = set(), [], 0

    for categoria, palavras in cfg["categorias"].items():
        for palavra in palavras:
            try:
                nodes = buscar(palavra, cfg.get("porBusca", 30), campos)
                pesquisas += 1
            except Exception as e:  # noqa: BLE001
                msg = str(e)
                if "Cannot query field" in msg or "Unknown" in msg:
                    campos = [c for c in campos if c not in ("sales", "ratingStar", "shopName")]
                    try:
                        nodes = buscar(palavra, cfg.get("porBusca", 30), campos)
                        pesquisas += 1
                    except Exception as e2:  # noqa: BLE001
                        erros.append(f"{palavra}: {str(e2)[:160]}")
                        continue
                else:
                    erros.append(f"{palavra}: {msg[:160]}")
                    if "10020" in msg or "10035" in msg:   # chave errada / sem acesso
                        print(msg)
                        return 1
                    continue
            time.sleep(0.6)
            for n in nodes:
                pid = f"{n.get('shopId')}.{n.get('itemId')}"
                nome = n.get("productName") or ""
                preco = numero(n.get("priceMin"))
                nota = numero(n.get("ratingStar"))
                if not nome or preco <= 0:
                    continue
                if bloqueado(nome, cfg.get("bloquear", [])):
                    continue
                if preco < cfg.get("precoMinimo", 0) or preco > cfg.get("precoMaximo", 1e9):
                    continue
                if "ratingStar" in campos and nota and nota < cfg.get("notaMinima", 0):
                    continue
                p = P.setdefault(pid, {"primeiro": t, "vendas": [], "categorias": []})
                p.update({
                    "nome": nome,
                    "preco": round(preco, 2),
                    "precoMax": round(numero(n.get("priceMax")), 2),
                    "desconto": int(numero(n.get("priceDiscountRate"))),
                    "imagem": n.get("imageUrl") or "",
                    "link": n.get("offerLink") or "",
                    "linkProduto": n.get("productLink") or "",
                    "loja": n.get("shopName") or "",
                    "comissao": round(numero(n.get("commissionRate")) * 100, 1),
                    "nota": round(nota, 1) if nota else None,
                    "visto": t,
                })
                if categoria not in p["categorias"]:
                    p["categorias"].append(categoria)
                if palavra not in p.setdefault("palavras", []):
                    p["palavras"] = (p["palavras"] + [palavra])[-5:]
                if pid not in vistos and "sales" in campos:
                    vendas = int(numero(n.get("sales")))
                    if not p["vendas"] or p["vendas"][-1][0][:13] != t[:13]:
                        p["vendas"].append([t, vendas])
                    else:
                        p["vendas"][-1] = [t, vendas]
                    p["vendas"] = p["vendas"][-PONTOS_MAX:]
                vistos.add(pid)

    # limpeza + números prontos pro painel
    limite = agora() - timedelta(days=GUARDA_DIAS)
    for pid in list(P):
        p = P[pid]
        if de_iso(p.get("visto", p.get("primeiro", t))) < limite:
            del P[pid]
            continue
        p["noSite"] = pid in no_site_ids or norm(p.get("nome")) in no_site_nomes
        p["vendasTotal"] = p["vendas"][-1][1] if p.get("vendas") else None
        p["porDia"], p["porDiaSemana"] = ritmo(p.get("vendas") or [])
        p["novo"] = de_iso(p["primeiro"]) > agora() - timedelta(hours=30)
        # pontuação do "em alta": ritmo de vendas (escala log), nota e desconto ajudam um pouco
        base = p["porDia"] if p["porDia"] is not None else (p["vendasTotal"] or 0) / 365
        p["pontos"] = round(math.log10(1 + base) * 10 + (p.get("nota") or 0) + p.get("desconto", 0) / 20, 2)

    hist["atualizado"] = t
    hist["rodadas"] = (hist.get("rodadas") or [])[-29:] + [t]
    hist["pesquisas"] = pesquisas
    hist["erros"] = erros
    hist["campos"] = campos
    hist["produtos"] = dict(sorted(P.items(), key=lambda kv: -kv[1].get("pontos", 0)))
    os.makedirs(PASTA, exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8", newline="\n") as f:
        json.dump(hist, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"{pesquisas} pesquisa(s), {len(vistos)} produto(s) vistos hoje, {len(P)} no radar, {len(erros)} erro(s).")
    for e in erros[:10]:
        print("  erro:", e)
    return 0


if __name__ == "__main__":
    sys.exit(main())
