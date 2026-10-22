"""Lote do painel: adiciona/remove "outros anúncios" de uma oferta.

Uso: python gerador/anuncios.py entrada/lote-XXXX.json
Itens do lote: {"acao": "anuncios", "op": "adicionar"|"remover"|"editar",
                "slug": "...", "link": "https://...", "loja": "...", "preco": "...",
                "variacao": "Azul", "cor": "#hex", "imagem": "https://foto..."}
"editar" muda variação/cor/foto de um anúncio; com o link principal da
oferta, muda a variação do anúncio principal (campos variacao/cor da oferta).
Anúncio posto à mão vale direto (o Alexandre conferiu o preço) por 7 dias;
depois disso a conferência automática (conferir-anuncios.py) assume.
"""
import json
import sys

from anuncios_comum import agora_iso, ler, loja_de, numero, preco_br, salvar


def main(arquivo):
    with open(arquivo, encoding="utf-8-sig") as f:
        itens = json.load(f)
    if isinstance(itens, dict):
        itens = [itens]
    itens = [i for i in itens if isinstance(i, dict) and i.get("acao") == "anuncios"]
    if not itens:
        return
    catalogo = ler()
    por_slug = {o.get("slug"): o for o in catalogo if isinstance(o, dict)}
    mudou = False
    for it in itens:
        o = por_slug.get(it.get("slug"))
        link = str(it.get("link") or "").strip()
        if not o or not link.lower().startswith(("http://", "https://")):
            print(f"  ignorado (oferta ou link inválido): {it.get('slug')} {link}")
            continue
        lista = [a for a in (o.get("anuncios") or []) if isinstance(a, dict)]
        sem_este = [a for a in lista if a.get("link") != link]
        extras = {k: str(it.get(k) or "").strip() for k in ("variacao", "cor", "imagem") if k in it}
        if extras.get("imagem") and not extras["imagem"].lower().startswith(("http://", "https://")):
            extras["imagem"] = ""
        if it.get("op") == "editar":
            alvo = o if link == o.get("link") else next((a for a in lista if a.get("link") == link), None)
            if alvo is None:
                print(f"  ignorado (anúncio não encontrado): {o['slug']} {link}")
                continue
            for k, v in extras.items():
                if alvo is o and k == "imagem":
                    continue  # foto do principal é a da própria oferta
                if v:
                    alvo[k] = v
                else:
                    alvo.pop(k, None)
            print(f"  editado em {o['slug']}: {link} {extras}")
            mudou = True
        elif it.get("op") == "remover":
            if len(sem_este) != len(lista):
                print(f"  removido de {o['slug']}: {link}")
                mudou = True
            lista = sem_este
        else:
            if link == o.get("link"):
                print(f"  ignorado: é o link principal de {o['slug']}")
                continue
            n = numero(it.get("preco"))
            agora = agora_iso()
            novo = {"link": link, "loja": str(it.get("loja") or "").strip() or loja_de(link),
                    "preco": preco_br(n) if n else "", "conferido": agora,
                    "manual": agora if n else "", "confirmado": bool(n)}
            novo.update({k: v for k, v in extras.items() if v})
            lista = sem_este + [novo]
            print(f"  adicionado em {o['slug']}: {novo['loja']} {novo['preco']}")
            mudou = True
        if lista:
            o["anuncios"] = lista
        else:
            o.pop("anuncios", None)
    if mudou:
        salvar(catalogo)


if __name__ == "__main__":
    main(sys.argv[1])
