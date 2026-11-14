"""Diagnóstico: por que algumas buscas da Shopee dão 10000 (System Error)?
Tenta a mesma palavra com variações de limite, ordem e campos."""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from radar_shopee import gql, CAMPOS

def tenta(rotulo, q):
    try:
        d = gql(q); n = len(((d.get("productOfferV2") or {}).get("nodes")) or [])
        print(f"OK   {rotulo}: {n} produtos")
    except Exception as e:
        print(f"ERRO {rotulo}: {str(e)[:90]}")
    time.sleep(2)

for palavra in ["organizador casa", "air fryer", "pisca pisca", "panela"]:
    k = json.dumps(palavra, ensure_ascii=False)
    todos = " ".join(CAMPOS)
    basicos = "itemId shopId productName priceMin offerLink"
    for sort in (2, 1, 5):
        for lim in (30, 10):
            tenta(f"{palavra} sort={sort} limit={lim} todos", '{productOfferV2(keyword:%s,sortType:%d,page:1,limit:%d){nodes{%s}}}' % (k, sort, lim, todos))
    tenta(f"{palavra} sort=2 limit=30 basicos", '{productOfferV2(keyword:%s,sortType:2,page:1,limit:30){nodes{%s}}}' % (k, basicos))
    for c in ["sales", "ratingStar", "commissionRate", "shopName", "productLink", "priceDiscountRate"]:
        tenta(f"{palavra} sort=2 limit=30 basicos+{c}", '{productOfferV2(keyword:%s,sortType:2,page:1,limit:30){nodes{%s %s}}}' % (k, basicos, c))
