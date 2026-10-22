"""Confere o preço dos "outros anúncios" das ofertas (comparador).

Roda depois do conferir-precos.ps1. Regras (as mesmas do site, em
assets/vitrine.js):
- anúncio posto à mão há até 7 dias: não mexe;
- preço lido igual ao atual: marca como conferido agora;
- preço novo só vale depois de DUAS leituras iguais seguidas
  (a 1ª fica "pendente");
- leitura com menos da metade ou mais do dobro do preço principal é
  barrada (leitura errada da loja) e vai pro relatório.
Precisa do segredo PAINEL_SENHA (a mesma senha do painel).
"""
import json
import os
import urllib.parse
import urllib.request
from datetime import timedelta

from anuncios_comum import SITE, agora_iso, data, ler, numero, preco_br, salvar

WORKER_URL = "https://holy-pine-e7fc.bernard-shimizu.workers.dev"
DIAS_MANUAL = 7


def ler_preco(senha, link):
    corpo = urllib.parse.urlencode({"senha": senha, "link": link}).encode()
    req = urllib.request.Request(WORKER_URL + "/produto", data=corpo, method="POST", headers={
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        "Origin": "https://farejadinhosdayang.com.br",
        "Referer": "https://farejadinhosdayang.com.br/painel/lote.html",
        "User-Agent": "Mozilla/5.0 (farejadinhos conferencia)",
    })
    with urllib.request.urlopen(req, timeout=40) as r:
        return numero(json.loads(r.read().decode("utf-8")).get("preco"))


def main():
    senha = os.environ.get("PAINEL_SENHA", "")
    if not senha:
        print("Sem PAINEL_SENHA: anúncios extras não conferidos.")
        return
    catalogo = ler()
    agora = agora_iso()
    t_agora = data(agora)
    rel = {"conferidos": 0, "iguais": 0, "pendentes": [], "mudaram": [], "barrados": [], "semPreco": [], "erros": []}
    mudou = False
    for o in catalogo:
        if not isinstance(o, dict) or not o.get("anuncios"):
            continue
        principal = numero(o.get("preco"))
        for a in o["anuncios"]:
            m = data(a.get("manual"))
            if m and t_agora - m <= timedelta(days=DIAS_MANUAL):
                continue
            rel["conferidos"] += 1
            info = {"slug": o.get("slug"), "loja": a.get("loja"), "link": a.get("link")}
            try:
                v = ler_preco(senha, a.get("link"))
            except Exception as e:  # noqa: BLE001
                rel["erros"].append({**info, "erro": str(e)[:200]})
                continue
            atual = numero(a.get("preco"))
            if not v:
                rel["semPreco"].append(info)
                continue
            if principal and (v < principal / 2 or v > principal * 2):
                rel["barrados"].append({**info, "lido": preco_br(v), "principal": o.get("preco")})
                continue
            if atual and abs(v - atual) < 0.01:
                rel["iguais"] += 1
                ultima = data(a.get("conferido"))
                # só regrava a data de 12 em 12h (evita commit toda hora)
                if a.get("confirmado") and not a.get("pendente") and ultima and t_agora - ultima < timedelta(hours=12):
                    continue
                a["conferido"] = agora
                a["confirmado"] = True
                a.pop("pendente", None)
                a.pop("pendenteEm", None)
            elif numero(a.get("pendente")) and abs(v - numero(a.get("pendente"))) < 0.01:
                rel["mudaram"].append({**info, "de": a.get("preco"), "para": preco_br(v)})
                a.update({"preco": preco_br(v), "conferido": agora, "confirmado": True, "manual": ""})
                a.pop("pendente", None)
                a.pop("pendenteEm", None)
            else:
                a["pendente"] = preco_br(v)
                a["pendenteEm"] = agora
                rel["pendentes"].append({**info, "atual": a.get("preco"), "lido": preco_br(v)})
            mudou = True
    print(f"Anúncios extras: {rel['conferidos']} conferidos, {rel['iguais']} iguais, "
          f"{len(rel['mudaram'])} mudaram, {len(rel['pendentes'])} aguardando 2ª leitura, "
          f"{len(rel['barrados'])} barrados, {len(rel['semPreco'])} sem preço, {len(rel['erros'])} erros.")
    if mudou:
        salvar(catalogo)
    # junta no relatório do painel
    caminho = os.path.join(SITE, "precos", "ultima-conferencia.json")
    try:
        with open(caminho, encoding="utf-8-sig") as f:
            r = json.load(f)
        r["anuncios"] = rel
        with open(caminho, "w", encoding="utf-8", newline="\n") as f:
            json.dump(r, f, ensure_ascii=False, indent=2)
    except Exception:  # noqa: BLE001
        pass


if __name__ == "__main__":
    main()
