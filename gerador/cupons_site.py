"""Área "🏷️ Cupons de hoje" do site: grava o cupons.json.

Uso: python gerador/cupons_site.py entrada/lote-XXXX.json
Item do lote (vem do painel/cupons.html):
  {"acao": "cupons-site", "cupons": [ {codigo, loja, tipo, valor, minimo, teto,
    titulo, obs, link, ate}, ... ], "paginas": {"Shopee": "https://...", ...}}
A lista enviada SUBSTITUI a anterior (o painel já manda a lista completa).
Cupom sem "ate" vale 24h a partir de agora.
"""
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(SITE, "cupons.json")
LOJAS = {"Shopee", "Mercado Livre", "Amazon"}


def iso(d):
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


def num(v):
    try:
        return max(0.0, float(str(v).replace(",", ".")))
    except (TypeError, ValueError):
        return 0.0


def texto(v, n):
    return re.sub(r"\s+", " ", str(v or "")).strip()[:n]


def main(arquivo):
    with open(arquivo, encoding="utf-8-sig") as f:
        itens = json.load(f)
    if isinstance(itens, dict):
        itens = [itens]
    pedido = next((i for i in itens if isinstance(i, dict) and i.get("acao") == "cupons-site"), None)
    if not pedido:
        return
    agora = datetime.now(timezone.utc)
    cupons, vistos = [], set()
    for c in pedido.get("cupons") or []:
        if not isinstance(c, dict):
            continue
        codigo = re.sub(r"[^A-Za-z0-9_-]", "", str(c.get("codigo") or "")).upper()[:30]
        link = str(c.get("link") or "").strip()
        if not link.lower().startswith(("http://", "https://")):
            link = ""
        if not codigo and not link and not texto(c.get("titulo"), 40):
            continue  # cupom de resgatar precisa de título (o link pode vir da página da loja)
        chave = (codigo or link, c.get("loja"))
        if chave in vistos:
            continue
        vistos.add(chave)
        ate = str(c.get("ate") or "").strip() or iso(agora + timedelta(hours=24))
        try:
            if datetime.fromisoformat(ate.replace("Z", "+00:00")) <= agora:
                continue  # já venceu
        except ValueError:
            ate = iso(agora + timedelta(hours=24))
        tipo = c.get("tipo") if c.get("tipo") in ("%", "R$", "frete") else ""
        cupons.append({
            "codigo": codigo,
            "loja": c.get("loja") if c.get("loja") in LOJAS else "",
            "tipo": tipo,
            "valor": num(c.get("valor")),
            "minimo": num(c.get("minimo")),
            "teto": num(c.get("teto")),
            "titulo": texto(c.get("titulo"), 40),
            "obs": texto(c.get("obs"), 120),
            "link": link,
            "ate": ate,
        })
    paginas = {}
    for loja, url in (pedido.get("paginas") or {}).items():
        if loja in LOJAS and str(url or "").lower().startswith(("http://", "https://")):
            paginas[loja] = str(url).strip()
    saida = {"atualizado": iso(agora), "paginas": paginas, "cupons": cupons}
    with open(SAIDA, "w", encoding="utf-8", newline="\n") as f:
        json.dump(saida, f, ensure_ascii=False, indent=2)
    print(f"cupons.json: {len(cupons)} cupom(ns) no site.")


if __name__ == "__main__":
    main(sys.argv[1])
