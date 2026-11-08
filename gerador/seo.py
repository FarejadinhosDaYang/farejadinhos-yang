"""Google: dados de produto nas páginas + sitemap.xml + robots.txt.

- Em cada página de oferta que está no catálogo, grava um bloco JSON-LD
  (schema.org Product) entre <!-- seo:produto --> e <!-- /seo:produto -->,
  logo antes do </head>: nome, foto, preço (o menor entre os anúncios
  conferidos), faixa de preço quando tem vários anúncios, disponibilidade e
  link canônico. É isso que o Google lê pra mostrar preço na busca e no
  Google Shopping (aba "Produtos").
- sitemap.xml com a home, as páginas fixas e todas as ofertas no ar.
- robots.txt liberando o site e escondendo painel/entrada.

Só regrava o que mudou (não gera commit à toa).
Uso: python gerador/seo.py
"""
import html
import json
import os
import re
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anuncios_comum import SITE, ler, numero  # noqa: E402

DOMINIO = "https://farejadinhosdayang.com.br"
INI, FIM = "<!-- seo:produto -->", "<!-- /seo:produto -->"
LOJAS = [(r"mercadolivre|meli\.la|mlb", "Mercado Livre"), (r"shopee|shp\.ee", "Shopee"),
         (r"amazon\.|amzn\.|link\.amazon", "Amazon"), (r"magazineluiza|magalu", "Magazine Luiza"),
         (r"aliexpress", "AliExpress")]
# texto que denuncia oferta encerrada na página
ENCERRADA = re.compile(r"oferta (encerrada|expirada)", re.I)


def loja(link):
    for padrao, nome in LOJAS:
        if re.search(padrao, str(link or ""), re.I):
            return nome
    return "Loja parceira"


def precos_de(o):
    """[(valor, link)] do principal + anúncios juntados conferidos (sem preço estranho)."""
    p0 = numero(o.get("preco"))
    lista = [(p0, o.get("link"))] if p0 > 0 else []
    for a in o.get("anuncios") or []:
        if not isinstance(a, dict) or not (a.get("confirmado") or a.get("manual")):
            continue
        v = numero(a.get("preco"))
        if v > 0 and (not p0 or v >= p0 / 2):
            lista.append((v, a.get("link")))
    return sorted(lista)


def disponivel(o):
    return not o.get("semPrecoDesde")


def jsonld(o):
    url = f"{DOMINIO}/ofertas/{o['slug']}/"
    precos = precos_de(o)
    if not precos:
        return ""
    foto = f"{DOMINIO}/assets/{o['imagem']}" if o.get("imagem") else ""
    fotos = [foto] + [a["imagem"] for a in (o.get("anuncios") or []) if isinstance(a, dict) and str(a.get("imagem", "")).startswith("http")]
    fotos = [f for i, f in enumerate(fotos) if f and f not in fotos[:i]][:6]
    nome = str(o.get("produto") or "").strip()
    estoque = "https://schema.org/InStock" if disponivel(o) else "https://schema.org/OutOfStock"
    marca = ""
    m = re.match(r"(?:celular |smartphone |tablet )?(apple|samsung|xiaomi|motorola|mondial|britania|britânia|philco|electrolux|arno|oster|wap|amazon|lg|sony|jbl|multilaser|positivo|lenovo)\b", nome, re.I)
    if m:
        marca = m.group(1).title().replace("Britania", "Britânia")
    if len(precos) > 1:
        oferta = {"@type": "AggregateOffer", "priceCurrency": "BRL", "lowPrice": f"{precos[0][0]:.2f}",
                  "highPrice": f"{precos[-1][0]:.2f}", "offerCount": len(precos), "availability": estoque, "url": url}
    else:
        oferta = {"@type": "Offer", "priceCurrency": "BRL", "price": f"{precos[0][0]:.2f}", "availability": estoque,
                  "url": url, "seller": {"@type": "Organization", "name": loja(o.get("link"))}}
    antigo = numero(o.get("precoAntigo"))
    desc = f"{nome} por R$ {precos[0][0]:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if antigo > precos[0][0]:
        desc += f" (antes R$ {antigo:,.2f})".replace(",", "X").replace(".", ",").replace("X", ".")
    desc += " — oferta conferida pela Yang no " + loja(o.get("link")) + "."
    dados = {"@context": "https://schema.org", "@type": "Product", "name": nome, "image": fotos,
             "description": desc, "url": url, "offers": oferta}
    if marca:
        dados["brand"] = {"@type": "Brand", "name": marca}
    if o.get("categoria"):
        dados["category"] = str(o["categoria"]).split(",")[0].strip()
    corpo = json.dumps(dados, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return (f'{INI}\n<link rel="canonical" href="{html.escape(url)}">\n'
            f'<script type="application/ld+json">{corpo}</script>\n{FIM}')


def gravar(caminho, texto):
    try:
        with open(caminho, encoding="utf-8") as f:
            if f.read() == texto:
                return False
    except FileNotFoundError:
        pass
    with open(caminho, "w", encoding="utf-8", newline="\n") as f:
        f.write(texto)
    return True


def main():
    catalogo = [o for o in ler() if isinstance(o, dict) and o.get("slug")]
    agora = datetime.now(timezone.utc)
    mudou = 0
    no_ar = []
    for o in catalogo:
        pagina = os.path.join(SITE, "ofertas", o["slug"], "index.html")
        if not os.path.exists(pagina):
            continue
        with open(pagina, encoding="utf-8") as f:
            txt = f.read()
        bloco = jsonld(o)
        sem = re.sub(re.escape(INI) + r".*?" + re.escape(FIM) + r"\n?", "", txt, flags=re.S)
        novo = sem.replace("</head>", bloco + "\n</head>", 1) if bloco else sem
        if novo != txt and gravar(pagina, novo):
            mudou += 1
        lib = str(o.get("liberacao") or o.get("data") or "")
        if bloco and disponivel(o) and lib[:19] <= agora.strftime("%Y-%m-%dT%H:%M:%S"):
            no_ar.append((o, (o.get("precoConferido") or o.get("data") or "")[:10]))

    urls = [(f"{DOMINIO}/", agora.strftime("%Y-%m-%d"), "1.0"), (f"{DOMINIO}/pedir/", "", "0.4")]
    urls += [(f"{DOMINIO}/ofertas/{o['slug']}/", quando, "0.8") for o, quando in no_ar]
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u, quando, prio in urls:
        xml.append(f"  <url><loc>{html.escape(u)}</loc>" + (f"<lastmod>{quando}</lastmod>" if re.match(r"\d{4}-\d\d-\d\d$", quando or "") else "") + f"<priority>{prio}</priority></url>")
    xml.append("</urlset>")
    s1 = gravar(os.path.join(SITE, "sitemap.xml"), "\n".join(xml) + "\n")
    s2 = gravar(os.path.join(SITE, "robots.txt"),
                "User-agent: *\nAllow: /\nDisallow: /painel/\nDisallow: /entrada/\nDisallow: /gerador/\n\n"
                f"Sitemap: {DOMINIO}/sitemap.xml\n")
    print(f"SEO: {mudou} página(s) atualizada(s); sitemap com {len(urls)} endereço(s){' (novo)' if s1 else ''}{'; robots.txt novo' if s2 else ''}")


if __name__ == "__main__":
    main()
