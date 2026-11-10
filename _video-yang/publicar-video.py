"""Põe o Reel na página da oferta (o vídeo aparece ao lado da foto).

Uso (na raiz do repositório ou em _video-yang/):
  python3 _video-yang/publicar-video.py <slug> <reel.mp4> [capa.jpg]

O que faz:
  1. Grava uma versão leve do vídeo em videos/<slug>.mp4 (540×960, ~1,5–3 MB,
     começa a tocar antes de baixar tudo) e a imagem de capa em videos/<slug>.jpg.
     Sem capa, usa um quadro do próprio vídeo.
  2. No ofertas.json, coloca "video" e "videoCapa" na oferta e a categoria "Vídeos"
     (não expira). Mexe só nessa oferta; o resto do arquivo fica igual.
Depois: git add videos/ ofertas.json + commit + push.
"""
import json, pathlib, subprocess, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ARQ = RAIZ / "ofertas.json"
PASTA = RAIZ / "videos"


def comprimir(entrada, saida):
    # 540x960 (se o reel vier em outro tamanho, encaixa sem esticar), som leve, "faststart" pra tocar já no carregamento
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", str(entrada),
                    "-vf", "scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2:color=0xFDF3E3,fps=30",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-profile:v", "main", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "96k", "-ac", "2", "-movflags", "+faststart", str(saida)], check=True)


def capa(entrada_capa, video, saida):
    if entrada_capa:
        cmd = ["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", str(entrada_capa)]
    else:
        cmd = ["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-ss", "1.5", "-i", str(video), "-frames:v", "1"]
    subprocess.run(cmd + ["-vf", "scale=540:960:force_original_aspect_ratio=decrease", "-q:v", "4", str(saida)], check=True)


def gravar_no_json(slug, video, foto):
    texto = ARQ.read_text(encoding="utf-8")
    ofertas = json.loads(texto)
    o = next((x for x in ofertas if x.get("slug") == slug), None)
    if not o:
        sys.exit(f"Nenhuma oferta com o slug '{slug}'.")
    o["video"], o["videoCapa"] = video, foto
    partes = [p.strip() for p in (o.get("categoria") or "").split(",") if p.strip()]
    if not any(p.lower() in ("vídeos", "videos") for p in partes):
        partes.append("Vídeos")
    o["categoria"] = ", ".join(partes)
    # troca só o bloco dessa oferta, mantendo o jeito que o arquivo está escrito
    i = texto.index(f'"slug": {json.dumps(slug, ensure_ascii=False)}')
    ini = texto.rindex("\n  {", 0, i) + 1
    fim = texto.index("\n  }", i) + 4
    bloco = json.dumps(o, ensure_ascii=False, indent=2)
    bloco = "\n".join("  " + l for l in bloco.splitlines())
    novo = texto[:ini] + bloco + texto[fim:]
    json.loads(novo)  # confere que continua válido
    ARQ.write_text(novo, encoding="utf-8")
    return o["categoria"]


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    slug, reel = sys.argv[1], pathlib.Path(sys.argv[2])
    capa_in = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else None
    if not reel.exists():
        sys.exit(f"Não achei o vídeo {reel}")
    PASTA.mkdir(exist_ok=True)
    mp4, jpg = PASTA / f"{slug}.mp4", PASTA / f"{slug}.jpg"
    comprimir(reel, mp4)
    capa(capa_in if capa_in and capa_in.exists() else None, mp4, jpg)
    cat = gravar_no_json(slug, f"videos/{slug}.mp4", f"videos/{slug}.jpg")
    print(f"OK: {slug} | {mp4.stat().st_size / 1e6:.1f} MB | {cat}")


if __name__ == "__main__":
    main()
