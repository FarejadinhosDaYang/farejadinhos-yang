"""Põe a oferta do Reel na categoria "Vídeos" (fica no ar pra sempre, não expira em 3 dias).

Uso (na raiz do repositório ou em _video-yang/):
  python3 _video-yang/marcar-video.py <slug ou pedaço do nome>
  ex.: python3 _video-yang/marcar-video.py extratora
Mexe só na linha "categoria" da oferta em ofertas.json (o resto do arquivo fica igual).
Depois: git commit + push.
"""
import json, pathlib, sys, unicodedata

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ARQ = RAIZ / "ofertas.json"
busca = " ".join(sys.argv[1:]).strip()
if not busca:
    sys.exit(__doc__)

def norm(t):
    return unicodedata.normalize("NFD", t or "").encode("ascii", "ignore").decode().lower()

texto = ARQ.read_text(encoding="utf-8")
ofertas = json.loads(texto)
achadas = [o for o in ofertas if o.get("slug") == busca] or \
          [o for o in ofertas if norm(busca) in norm(o.get("produto", "")) or norm(busca) in norm(o.get("slug", ""))]
if not achadas:
    sys.exit(f"Nenhuma oferta com '{busca}'.")
if len(achadas) > 1:
    print("Mais de uma oferta encontrada — use o slug exato:")
    for o in achadas:
        print(" ", o["slug"], "|", o.get("categoria"), "|", o.get("produto"))
    sys.exit(1)

o = achadas[0]
cat = o.get("categoria") or ""
if "videos" in [norm(p.strip()) for p in cat.split(",")]:
    print("Já está em Vídeos:", o["slug"], "|", cat)
    sys.exit(0)
nova = f"{cat}, Vídeos" if cat else "Vídeos"
i = texto.index(f'"slug": "{o["slug"]}"')
ini, fim = texto.rindex("{", 0, i), texto.index("}", i)
bloco = texto[ini:fim]
antes = f'"categoria": {json.dumps(cat, ensure_ascii=False)}'
if antes not in bloco:
    sys.exit("Não achei a linha da categoria dessa oferta.")
texto = texto[:ini] + bloco.replace(antes, f'"categoria": {json.dumps(nova, ensure_ascii=False)}', 1) + texto[fim:]
json.loads(texto)  # confere que o JSON continua válido
ARQ.write_text(texto, encoding="utf-8")
print("OK:", o["slug"], "|", cat, "→", nova)
