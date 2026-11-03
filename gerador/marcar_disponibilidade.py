"""Ofertas sem prazo: fica no site enquanto a loja mostrar o preço.

Roda depois da conferência de preços (conferir-precos.yml). Lê o
relatório precos/ultima-conferencia.json e, no ofertas.json:
  - oferta cujo preço foi lido agora: apaga "semPrecoDesde";
  - oferta que ficou sem preço (produto saiu da loja, link morto...):
    grava "semPrecoDesde" (a 1ª vez que falhou).
Falha passageira (limite de pedidos da API, erro de rede) não conta.
O site esconde a oferta com 72h sem preço (assets/vitrine.js) e a
limpeza (limpar-ofertas.ps1) tira do catálogo — o link continua no
histórico de preços (dá pra juntar de novo em painel/parecidos.html).
"""
import json
import os
import sys
from datetime import datetime, timezone

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASSAGEIRO = ("10030", "Rate limit", "timed out", "tempo limite", "429", "502", "503", "504", "Connection")


def main():
    try:
        with open(os.path.join(SITE, "precos", "ultima-conferencia.json"), encoding="utf-8-sig") as f:
            rel = json.load(f)
    except Exception:  # noqa: BLE001
        print("Sem relatório da conferência.")
        return
    lidos = set(rel.get("lidos") or [])
    sem = {x.get("slug") for x in (rel.get("semPreco") or [])
           if x.get("slug") and not any(p.lower() in str(x.get("motivo") or "").lower() for p in PASSAGEIRO)}
    if not lidos and not sem:
        print("Conferência sem resultados (nada marcado).")
        return
    caminho = os.path.join(SITE, "ofertas.json")
    with open(caminho, encoding="utf-8-sig") as f:
        texto = f.read()
    catalogo = json.loads(texto)
    agora = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    novos = voltou = 0
    for o in catalogo:
        if not isinstance(o, dict):
            continue
        if o.get("slug") in lidos and o.get("semPrecoDesde"):
            o.pop("semPrecoDesde", None)
            voltou += 1
        elif o.get("slug") in sem and not o.get("semPrecoDesde"):
            o["semPrecoDesde"] = agora
            novos += 1
    if not novos and not voltou:
        print("Disponibilidade sem mudança.")
        return
    with open(caminho, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(catalogo, ensure_ascii=False, indent=2))
    print(f"Disponibilidade: {novos} ficaram sem preço, {voltou} voltaram.")


if __name__ == "__main__":
    main()
    sys.exit(0)
