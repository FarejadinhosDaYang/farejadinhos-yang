"""Deixa as fotos de produto leves (carregam rápido no celular).

Cada foto em assets/ (jpg, jpeg, png, webp) fica com no máximo 1000px no
lado maior; JPG/WebP em qualidade 82 (progressivo), PNG otimizado. Mantém o
MESMO nome de arquivo (nada muda nas páginas). Só regrava se ficar pelo
menos 15% menor.

Uso: python gerador/fotos_leves.py              (todas as fotos de assets/)
     python gerador/fotos_leves.py arq1 arq2 ... (só essas)
"""
import io
import os
import re
import sys

from PIL import Image, ImageOps

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASTA = os.path.join(RAIZ, "assets")
LADO = 1000
QUALIDADE = 82
EXT = (".jpg", ".jpeg", ".png", ".webp")
# só fotos de produto (nome = código aleatório); logo, favicons e Yang ficam como estão
FOTO_PRODUTO = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|webp)$", re.I)


def aliviar(caminho):
    nome = os.path.basename(caminho)
    if not FOTO_PRODUTO.match(nome):
        return 0, 0
    antes = os.path.getsize(caminho)
    try:
        im = Image.open(caminho)
        im = ImageOps.exif_transpose(im)
    except Exception:  # noqa: BLE001
        return antes, antes
    if max(im.size) > LADO:
        im.thumbnail((LADO, LADO), Image.LANCZOS)
    buf = io.BytesIO()
    ext = nome.lower().rsplit(".", 1)[-1]
    if ext in ("jpg", "jpeg"):
        if im.mode in ("RGBA", "LA", "P"):
            fundo = Image.new("RGB", im.size, (255, 255, 255))
            fundo.paste(im.convert("RGBA"), mask=im.convert("RGBA").split()[-1])
            im = fundo
        elif im.mode != "RGB":
            im = im.convert("RGB")
        im.save(buf, "JPEG", quality=QUALIDADE, optimize=True, progressive=True)
    elif ext == "webp":
        im.save(buf, "WEBP", quality=QUALIDADE, method=6)
    else:
        im.save(buf, "PNG", optimize=True)
    depois = buf.tell()
    if depois < antes * 0.85:
        with open(caminho, "wb") as f:
            f.write(buf.getvalue())
        return antes, depois
    return antes, antes


def main(arquivos):
    if not arquivos:
        arquivos = [os.path.join(PASTA, n) for n in sorted(os.listdir(PASTA))]
    total_a = total_d = n = 0
    for a in arquivos:
        if not os.path.isfile(a):
            continue
        antes, depois = aliviar(a)
        total_a += antes
        total_d += depois
        if depois < antes:
            n += 1
    print(f"Fotos leves: {n} foto(s) aliviada(s), {total_a / 1048576:.1f} MB -> {total_d / 1048576:.1f} MB")


if __name__ == "__main__":
    main(sys.argv[1:])
