"""Funções comuns do comparador de anúncios (gerador/anuncios.py e
gerador/conferir-anuncios.py)."""
import json
import os
import re
from datetime import datetime, timezone

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOGO = os.path.join(SITE, "ofertas.json")


def agora_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def data(iso):
    try:
        return datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except Exception:
        return None


def numero(p):
    s = re.sub(r"[^\d.,]", "", str(p or ""))
    if not s:
        return 0.0
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    elif s.count(".") > 1 or re.search(r"\.\d{3}$", s):
        s = s.replace(".", "")
    try:
        n = float(s)
    except ValueError:
        return 0.0
    return n if n > 0 else 0.0


def preco_br(n):
    inteiro, cent = f"{n:.2f}".split(".")
    inteiro = f"{int(inteiro):,}".replace(",", ".")
    return f"R$ {inteiro},{cent}"


def loja_de(link):
    l = str(link or "")
    for padrao, nome in ((r"shopee|shp\.ee", "Shopee"), (r"mercadoli[vb]re|meli\.la", "Mercado Livre"),
                         (r"amazon\.|amzn\.", "Amazon"), (r"magazineluiza|magalu", "Magalu"),
                         (r"aliexpress", "AliExpress")):
        if re.search(padrao, l, re.I):
            return nome
    return "Outra loja"


def ler():
    with open(CATALOGO, encoding="utf-8-sig") as f:
        d = json.load(f)
    return d if isinstance(d, list) else [d]


def salvar(catalogo):
    texto = json.dumps(catalogo, ensure_ascii=False, indent=2)
    with open(CATALOGO, "w", encoding="utf-8", newline="\n") as f:
        f.write(texto)
