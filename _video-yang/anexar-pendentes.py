"""Vídeos que esperam o produto entrar no site.

Quando um Reel fica pronto antes de a oferta existir (feito no chat ou no painel sem escolher o produto),
ele vai pra videos/pendentes/ com algumas palavras do nome do produto. Assim que entrar no site uma oferta
cujo nome tem TODAS essas palavras (sem acento, maiúscula/minúscula tanto faz), o vídeo é posto nela
sozinho (mesmo efeito do publicar-video.py) e sai da fila. Roda no workflow anexar-videos.yml.

Uso:
  python3 _video-yang/anexar-pendentes.py guardar <reel.mp4> <capa.jpg> "palavra1 palavra2 ..."   (põe na fila)
  python3 _video-yang/anexar-pendentes.py                                                       (confere a fila)
"""
import datetime, importlib.util, json, os, pathlib, re, shutil, sys, unicodedata

AQUI = pathlib.Path(__file__).resolve().parent
RAIZ = AQUI.parent
FILA = RAIZ / "videos" / "pendentes"
LISTA = FILA / "lista.json"
VALIDADE_DIAS = 30

spec = importlib.util.spec_from_file_location("publicar", AQUI / "publicar-video.py")
publicar = importlib.util.module_from_spec(spec); spec.loader.exec_module(publicar)


def norm(t):
    t = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def ler():
    try: return json.loads(LISTA.read_text(encoding="utf-8"))
    except Exception: return []


def gravar(lista):
    FILA.mkdir(parents=True, exist_ok=True)
    LISTA.write_text(json.dumps(lista, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def guardar(reel, capa, palavras, pid=None):
    palavras = [p for p in norm(palavras).split() if len(p) > 1]
    if not palavras:
        sys.exit("Faltam as palavras do nome do produto.")
    pid = pid or ("-".join(palavras)[:40] + "-" + datetime.datetime.now().strftime("%Y%m%d%H%M"))
    FILA.mkdir(parents=True, exist_ok=True)
    publicar.comprimir(pathlib.Path(reel), FILA / f"{pid}.mp4")
    capa = pathlib.Path(capa) if capa and pathlib.Path(capa).exists() else None
    publicar.capa(capa, FILA / f"{pid}.mp4", FILA / f"{pid}.jpg")
    lista = [x for x in ler() if x["id"] != pid]
    lista.append({"id": pid, "palavras": palavras,
                  "quando": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")})
    gravar(lista)
    print(f"Na fila: {pid} (espera uma oferta com: {' '.join(palavras)})")
    conferir()


def conferir():
    lista = ler()
    if not lista:
        return
    ofertas = json.loads(publicar.ARQ.read_text(encoding="utf-8"))
    agora = datetime.datetime.now(datetime.timezone.utc)
    resta = []
    for p in lista:
        mp4, jpg = FILA / f"{p['id']}.mp4", FILA / f"{p['id']}.jpg"
        # a oferta mais nova que bate com as palavras e ainda não tem vídeo
        alvo = [o for o in ofertas if not o.get("video")
                and set(p["palavras"]) <= set(norm(o.get("produto")).split()) | set(norm(o.get("slug")).split())]
        alvo.sort(key=lambda o: o.get("liberacao") or "", reverse=True)
        if alvo and mp4.exists():
            slug = alvo[0]["slug"]
            publicar.PASTA.mkdir(exist_ok=True)
            shutil.move(mp4, publicar.PASTA / f"{slug}.mp4")
            if jpg.exists(): shutil.move(jpg, publicar.PASTA / f"{slug}.jpg")
            cat = publicar.gravar_no_json(slug, f"videos/{slug}.mp4", f"videos/{slug}.jpg")
            ofertas = json.loads(publicar.ARQ.read_text(encoding="utf-8"))
            print(f"Vídeo {p['id']} → {slug} ({cat})")
            continue
        quando = datetime.datetime.strptime(p["quando"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=datetime.timezone.utc)
        if (agora - quando).days > VALIDADE_DIAS or not mp4.exists():
            for f in (mp4, jpg): f.unlink(missing_ok=True)
            print(f"Saiu da fila (venceu): {p['id']}")
            continue
        resta.append(p)
    gravar(resta)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "guardar":
        if len(sys.argv) < 5: sys.exit(__doc__)
        guardar(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        conferir()
