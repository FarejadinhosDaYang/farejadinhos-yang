"""Categorias e subcategorias do site (botão ➕ do modo admin).

Uso: python gerador/categorias_config.py entrada/lote-XXXX.json
Itens do lote: {"acao": "categorias", "op": ..., ...}
  add-sub  {"categoria", "nome", "palavras": [...]}   cria subcategoria
  edit-sub {"categoria", "nome", "novoNome", "palavras"} muda nome/palavras
  del-sub  {"categoria", "nome"}                       apaga subcategoria
  add-cat  {"nome", "icone", "palavras": [...]}        cria categoria nova
Grava assets/categorias-config.js (window.FarejadinhosConfigCategorias = {...};)
"""
import json
import os
import re
import sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARQ = os.path.join(SITE, "assets", "categorias-config.js")
CABECALHO = (
    "/* Farejadinhos da Yang — subcategorias e categorias criadas pelo modo admin.\n"
    " * Gerado por gerador/categorias_config.py (botão ➕ no modo admin). Não edite à mão\n"
    " * sem manter o formato: window.FarejadinhosConfigCategorias = { ... };\n"
    " * subcategorias: por categoria, em ordem; a oferta cai na 1ª cuja palavra aparece\n"
    " * no nome (\"^palavra\" = só no começo). Sem nenhuma: \"Outros\".\n */\n"
)


def ler():
    with open(ARQ, encoding="utf-8") as f:
        t = f.read()
    # a última atribuição (o cabeçalho também cita o nome)
    t = t[t.rfind("window.FarejadinhosConfigCategorias"):]
    m = re.search(r"window\.FarejadinhosConfigCategorias\s*=\s*(\{.*\})\s*;?\s*$", t, re.S)
    cfg = json.loads(m.group(1)) if m else {}
    cfg.setdefault("subcategorias", {})
    cfg.setdefault("categoriasExtras", [])
    return cfg


def salvar(cfg):
    with open(ARQ, "w", encoding="utf-8", newline="\n") as f:
        f.write(CABECALHO + "window.FarejadinhosConfigCategorias = " + json.dumps(cfg, ensure_ascii=False, indent=1) + ";\n")


def limpa(t, n=40):
    return re.sub(r"\s+", " ", str(t or "")).strip()[:n]


def palavras(lista):
    if isinstance(lista, str):
        lista = lista.split(",")
    saida = []
    for p in lista or []:
        p = limpa(p, 40).lower()
        if p and p not in saida:
            saida.append(p)
    return saida[:40]


def main(arquivo):
    with open(arquivo, encoding="utf-8-sig") as f:
        itens = json.load(f)
    if isinstance(itens, dict):
        itens = [itens]
    itens = [i for i in itens if isinstance(i, dict) and i.get("acao") == "categorias"]
    if not itens:
        return
    cfg = ler()
    subs = cfg["subcategorias"]
    for it in itens:
        op, cat, nome = it.get("op"), limpa(it.get("categoria")), limpa(it.get("nome"))
        if op == "add-cat" and nome:
            if not any(x.get("nome") == nome for x in cfg["categoriasExtras"]):
                cfg["categoriasExtras"].append({"nome": nome, "icone": limpa(it.get("icone"), 4) or "🏷️", "palavras": palavras(it.get("palavras"))})
                print(f"  categoria criada: {nome}")
        elif op == "add-sub" and cat and nome:
            lista = subs.setdefault(cat, [])
            if not any(s.get("nome") == nome for s in lista):
                lista.append({"nome": nome, "palavras": palavras(it.get("palavras")) or [nome.lower()]})
                print(f"  subcategoria criada: {cat} > {nome}")
        elif op == "edit-sub" and cat and nome:
            for s in subs.get(cat, []):
                if s.get("nome") == nome:
                    if limpa(it.get("novoNome")):
                        s["nome"] = limpa(it.get("novoNome"))
                    if it.get("palavras") is not None:
                        s["palavras"] = palavras(it.get("palavras")) or s.get("palavras", [])
                    print(f"  subcategoria editada: {cat} > {s['nome']}")
        elif op == "del-sub" and cat and nome:
            antes = len(subs.get(cat, []))
            subs[cat] = [s for s in subs.get(cat, []) if s.get("nome") != nome]
            if not subs[cat]:
                subs.pop(cat)
            if antes:
                print(f"  subcategoria apagada: {cat} > {nome}")
    salvar(cfg)


if __name__ == "__main__":
    main(sys.argv[1])
