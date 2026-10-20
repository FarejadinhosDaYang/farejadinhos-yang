"""Gera a CAPA do Reel (1080x1920 JPG) pra subir no Instagram em "Editar capa → Adicionar da galeria".

Uso:
  python3 capa.py capa.jpg --video fonte.mp4 --t 15.4 --titulo "Seu cheiro-verde|*nunca mais* murcha" \
      --faixa "🐾 ACHADINHO DA COZINHA" --balao "Olha isso! 😱"
  python3 capa.py capa.jpg --foto produto.jpg --titulo "..."          # foto em vez de quadro do vídeo
  --sem-publi   tira o selo (só pra post que não tem link de afiliado)

Regras da capa: gancho curto (até ~6 palavras, 2 linhas), 1–2 palavras em *amarelo*, produto aparecendo
bem no quadro escolhido, Yang inteira. Tudo que importa fica no miolo (y 420–1500), que é o pedaço que
aparece na grade do perfil.
"""
import json, os, subprocess, sys, pathlib, tempfile
from playwright.sync_api import sync_playwright

AQUI = pathlib.Path(__file__).parent.resolve()
a = sys.argv[1:]
def opt(n, d=None): return a[a.index(n) + 1] if n in a else d
saida = os.path.abspath(a[0])
foto = opt("--foto")
if opt("--video"):
    foto = os.path.join(tempfile.mkdtemp(), "quadro.jpg")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", opt("--t", "1"), "-i", opt("--video"), "-frames:v", "1",
                    "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", "-q:v", "2", foto], check=True)
cfg = {"foto": pathlib.Path(os.path.abspath(foto)).as_uri(), "titulo": opt("--titulo", "Olha o que|a Yang *farejou*"),
       "faixa": opt("--faixa", "🐾 A YANG FAREJOU"), "balao": opt("--balao", ""), "publi": "--sem-publi" not in a}
with sync_playwright() as p:
    nav = p.chromium.launch(args=["--allow-file-access-from-files"])
    pg = nav.new_page(viewport={"width": 1080, "height": 1920})
    pg.add_init_script(f"window.CAPA = {json.dumps(cfg, ensure_ascii=False)};")
    pg.goto((AQUI / "capa.html").as_uri())
    pg.evaluate("document.fonts.ready")
    pg.wait_for_function("[...document.images].every(i => i.complete && i.naturalWidth > 0)")
    pg.screenshot(path=saida, type="jpeg", quality=92)
    nav.close()
print("OK", saida)
