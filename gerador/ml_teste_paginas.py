"""Teste: o GitHub Actions consegue abrir as páginas públicas de "Mais vendidos" do Mercado Livre?
Grava radar/ml-teste/ com o status de cada tentativa e um pedaço do HTML (pra ver como a página vem).
Arquivo temporário — sai do repositório depois do teste.
"""
import gzip, json, os, re, sys, urllib.request

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASTA = os.path.join(SITE, "radar", "ml-teste")
os.makedirs(PASTA, exist_ok=True)

URLS = [
    "https://www.mercadolivre.com.br/mais-vendidos",
    "https://www.mercadolivre.com.br/mais-vendidos/MLB1574",
    "https://www.mercadolivre.com.br/mais-vendidos/MLB5726",
    "https://lista.mercadolivre.com.br/_CustId_0_BestSellers_YES",
]
UAS = {
    "chrome": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "facebook": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "bot": "FarejadinhosBot/1.0",
}

resumo = []
for i, url in enumerate(URLS):
    for nome, ua in UAS.items():
        r = {"url": url, "ua": nome}
        try:
            req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept-Language": "pt-BR,pt;q=0.9",
                                                       "Accept": "text/html,application/xhtml+xml", "Accept-Encoding": "gzip"})
            with urllib.request.urlopen(req, timeout=25) as resp:
                b = resp.read()
                if resp.headers.get("Content-Encoding") == "gzip": b = gzip.decompress(b)
                html = b.decode("utf-8", "replace")
                r.update(status=resp.status, final=resp.geturl(), tamanho=len(html))
        except Exception as e:
            r.update(erro=str(e)[:200]); html = ""
        if html:
            r["titulo"] = (re.search(r"<title>(.*?)</title>", html, re.S) or [None, ""])[1][:120]
            for k in ["poly-card", "polycard", "ui-search-layout__item", "andes-money-amount", "__PRELOADED_STATE__",
                      "_n.ctx.r", "MLB", "mais-vendidos", "ui-recommendations", "dynamic-carousel", "captcha", "account-verification",
                      "Mais vendido", "vendidos"]:
                r["tem_" + k] = html.count(k)
            if nome == "chrome":
                open(os.path.join(PASTA, f"pagina{i}.html"), "w", encoding="utf-8").write(html[:1500000])
        resumo.append(r)
        print(json.dumps(r, ensure_ascii=False))

json.dump(resumo, open(os.path.join(PASTA, "resumo.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
