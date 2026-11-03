"""Black November: lista das ofertas com desconto de verdade.

Grava temporada/black.json = {"atualizado": ..., "ofertas": {slug: pct}}.
O site (assets/vitrine.js -> ehBlack) usa junto com o "preço de antes" da
própria oferta e com a marcação manual do painel.

De onde vem o desconto (o maior dos dois):
  - Radar da Shopee (radar/radar.json): o desconto que a própria Shopee
    mostra no anúncio (priceDiscountRate), casado pelo link de afiliado;
  - Histórico de preços (historico-precos.json): quanto o preço atual
    está abaixo do maior preço que o site já registrou pro produto.
Roda junto com o Radar (radar-shopee.yml) e na conferência de preços.
"""
import json
import os
from datetime import datetime, timezone

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIN_LOJA = 40      # desconto mostrado pela loja
MIN_QUEDA = 20     # queda em relação ao maior preço registrado


def ler(caminho, padrao):
    try:
        with open(os.path.join(SITE, caminho), encoding="utf-8-sig") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return padrao


def main():
    ofertas = ler("ofertas.json", [])
    radar = (ler("radar/radar.json", {}) or {}).get("produtos") or {}
    hist = (ler("historico-precos.json", {}) or {}).get("produtos") or {}
    por_link = {p.get("link"): p for p in radar.values() if isinstance(p, dict) and p.get("link")}
    hist_por_slug = {}
    for p in hist.values():
        if isinstance(p, dict) and p.get("slug"):
            hist_por_slug[p["slug"]] = p
    saida = {}
    for o in ofertas if isinstance(ofertas, list) else []:
        if not isinstance(o, dict) or not o.get("slug"):
            continue
        pct = 0
        r = por_link.get(o.get("link"))
        if r and (r.get("desconto") or 0) >= MIN_LOJA:
            pct = int(r["desconto"])
        h = hist_por_slug.get(o["slug"])
        if h:
            valores = [v for _, v in (h.get("pontos") or []) if isinstance(v, (int, float)) and v > 0]
            if len(valores) >= 2:
                queda = round((1 - valores[-1] / max(valores)) * 100)
                if queda >= MIN_QUEDA:
                    pct = max(pct, queda)
        if pct:
            saida[o["slug"]] = pct
    destino = os.path.join(SITE, "temporada", "black.json")
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    novo = {"ofertas": dict(sorted(saida.items()))}
    antigo = ler("temporada/black.json", {})
    if antigo.get("ofertas") == novo["ofertas"]:
        print(f"black.json sem mudança ({len(saida)} ofertas).")
        return
    novo = {"atualizado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), **novo}
    with open(destino, "w", encoding="utf-8", newline="\n") as f:
        json.dump(novo, f, ensure_ascii=False, indent=1)
    print(f"black.json: {len(saida)} ofertas Black.")


if __name__ == "__main__":
    main()
