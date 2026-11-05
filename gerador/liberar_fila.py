"""Lote do painel: libera a fila (as ofertas agendadas entram no ar já).

Item: {"acao": "liberar-fila"}            -> todas as agendadas
      {"acao": "liberar-fila", "slugs": [...]} -> só essas
Uso: python gerador/liberar_fila.py entrada/lote-XXXX.json
"""
import json
import sys

from anuncios_comum import agora_iso, ler, salvar


def main(arquivo):
    with open(arquivo, encoding="utf-8-sig") as f:
        itens = json.load(f)
    itens = [i for i in (itens if isinstance(itens, list) else [itens]) if isinstance(i, dict) and i.get("acao") == "liberar-fila"]
    if not itens:
        return
    so = set()
    for i in itens:
        so.update(i.get("slugs") or [])
    agora = agora_iso()
    catalogo = ler()
    n = 0
    for o in catalogo:
        if isinstance(o, dict) and (o.get("liberacao") or "") > agora and (not so or o.get("slug") in so):
            o["liberacao"] = agora
            n += 1
    if n:
        salvar(catalogo)
    print(f"  fila liberada: {n} oferta(s) entraram no ar agora")


if __name__ == "__main__":
    main(sys.argv[1])
