"""Gera as expressões da Yang (boca fechada / meio aberta / aberta, olhos piscando)
a partir da ilustração original. Saída: pasta yang/ com PNGs transparentes 2x."""
import cv2, numpy as np, pathlib
from PIL import Image, ImageDraw, ImageFilter

AQUI = pathlib.Path(__file__).parent.parent  # pasta _video-yang (onde está yang.png)
S = 2  # trabalhar em 2x pra linhas mais suaves
orig = Image.open(AQUI / "yang.png").convert("RGBA")
W, H = orig.size
base = orig.resize((W * S, H * S), Image.LANCZOS)
OUT = pathlib.Path(__file__).parent  # salva aqui mesmo (corpo/)
TINTA = (40, 22, 14, 255)

def s(*v): return [int(x * S) for x in v]

def inpaint(img, mask_img, raio=7):
    rgba = np.array(img)
    bgr = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2BGR)
    m = np.array(mask_img.convert("L"))
    out = cv2.inpaint(bgr, m, raio, cv2.INPAINT_TELEA)
    rgba[:, :, :3] = cv2.cvtColor(out, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgba)

def clonar(img, alvo, dx, dy, pena=4):
    """cobre a elipse 'alvo' com pelo copiado de (dx,dy) pixels ao lado, com borda suave"""
    mg = 3 * pena * S  # margem pra borda suave não "cortar" no retângulo
    m = Image.new("L", img.size, 0); ImageDraw.Draw(m).ellipse(alvo, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(pena * S))
    a, b, c, e = alvo[0] - mg, alvo[1] - mg, alvo[2] + mg, alvo[3] + mg
    src = img.crop((a + dx, b + dy, c + dx, e + dy))
    camada = Image.new("RGBA", img.size, (0, 0, 0, 0)); camada.paste(src, (a, b))
    out = img.copy(); out.paste(camada, (0, 0), Image.composite(m, Image.new("L", img.size, 0), camada.split()[3]))
    return out

def mascara(formas):
    m = Image.new("L", base.size, 0); d = ImageDraw.Draw(m)
    for f in formas: d.ellipse(f, fill=255)
    return m

# ---------- regiões (em coordenadas da imagem original 532x640) ----------
BOCA = s(191, 183, 253, 233)
OLHO_E = s(174, 116, 218, 152)
OLHO_D = s(259, 141, 309, 183)

# ---------- boca fechada ----------
m_boca = mascara([BOCA])
fechada = clonar(base, s(189, 181, 255, 236), 66 * S, 2 * S)
# leve textura: mistura um pouco de ruído pra não ficar "borrado liso"
d = ImageDraw.Draw(fechada)
cx, cy = 224 * S, 186 * S  # ponto logo abaixo do nariz
d.line([cx, cy, cx, cy + 9 * S], fill=TINTA, width=3 * S)  # risquinho do nariz à boca
d.arc([cx - 24 * S, cy - 4 * S, cx, cy + 16 * S], 10, 150, fill=TINTA, width=3 * S)   # sorriso esquerdo
d.arc([cx, cy - 4 * S, cx + 24 * S, cy + 16 * S], 30, 170, fill=TINTA, width=3 * S)   # sorriso direito
fechada.save(OUT / "boca-fechada.png")

# ---------- boca meio aberta: boca original "achatada" sobre a fechada ----------
x0, y0, x1, y1 = BOCA
patch = base.crop(BOCA)
alt = int((y1 - y0) * 0.55)
patch_m = m_boca.crop(BOCA)
meio = fechada.copy()
p2 = patch.resize((x1 - x0, alt), Image.LANCZOS)
m2 = patch_m.resize((x1 - x0, alt), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.5))
meio.paste(p2, (x0, y0 + 4 * S), m2)
meio.save(OUT / "boca-meio.png")

base.save(OUT / "boca-aberta.png")

# ---------- piscando (feito sobre cada boca) ----------
m_olhos = mascara([OLHO_E, OLHO_D])
def piscar(img):
    p = clonar(img, OLHO_E, 0, -30 * S, 3)
    p = clonar(p, OLHO_D, 6 * S, 40 * S, 3)
    d = ImageDraw.Draw(p)
    for (a, b, c, e) in [OLHO_E, OLHO_D]:
        mx, my = (a + c) / 2, (b + e) / 2
        w = (c - a) * 0.42
        # olho fechado feliz "‿" com cílios
        d.arc([mx - w, my - w * 0.55, mx + w, my + w * 0.55], 15, 165, fill=TINTA, width=4 * S)
    return p
for nome in ["boca-fechada", "boca-meio", "boca-aberta"]:
    piscar(Image.open(OUT / f"{nome}.png")).save(OUT / f"{nome}-piscando.png")

# folha de contato pra conferir
nomes = ["boca-fechada", "boca-meio", "boca-aberta", "boca-fechada-piscando"]
tiles = [Image.open(OUT / f"{n}.png").crop(s(150, 90, 340, 250)) for n in nomes]
tw, th = tiles[0].size
folha = Image.new("RGBA", (tw * len(tiles), th), "white")
for i, t in enumerate(tiles): folha.alpha_composite(t, (tw * i, 0))
folha.save(OUT / "conferir.png")
print("ok")
