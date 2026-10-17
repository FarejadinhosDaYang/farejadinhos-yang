"""Expressões da CABEÇA da Yang (imagem nova): boca fechada/meio/aberta + piscando.
Saída: cabeca/<expressao>.png (recortadas, fundo transparente)."""
import cv2, numpy as np, pathlib
from PIL import Image, ImageDraw, ImageFilter

D = pathlib.Path(__file__).parent  # esta pasta (cabeca/)
img = cv2.imread(str(D / "original.jpg"))
mask = cv2.imread(str(D / "mask.png"), 0)
TINTA = (24, 16, 40)  # BGR marrom-escuro das linhas do desenho

def inpaint(im, formas, raio=11):
    m = np.zeros(im.shape[:2], np.uint8)
    for f in formas: f(m)
    return cv2.inpaint(im, m, raio, cv2.INPAINT_TELEA)

def curva(im, pts, esp):
    pts = np.array(pts, np.float32)
    # curva suave (Catmull-Rom simples)
    t = np.linspace(0, 1, 60)
    xs = np.interp(t, np.linspace(0, 1, len(pts)), pts[:, 0]); ys = np.interp(t, np.linspace(0, 1, len(pts)), pts[:, 1])
    k = np.ones(9) / 9
    xs = np.convolve(np.pad(xs, 4, mode="edge"), k, "valid"); ys = np.convolve(np.pad(ys, 4, mode="edge"), k, "valid")
    p = np.stack([xs, ys], 1).astype(np.int32).reshape(-1, 1, 2)
    cv2.polylines(im, [p], False, TINTA, esp, cv2.LINE_AA)

# --- boca fechada: apaga a boca aberta e desenha um sorriso fechado
BOCA = ((541, 1062), (106, 58))
fechada = inpaint(img, [lambda m: cv2.ellipse(m, BOCA[0], BOCA[1], 0, 0, 360, 255, -1)])
curva(fechada, [(438, 1004), (470, 1026), (510, 1040), (541, 1043), (572, 1040), (612, 1026), (645, 1004)], 7)
cv2.line(fechada, (536, 1000), (540, 1040), TINTA, 6, cv2.LINE_AA)

# --- boca meio aberta: boca original achatada pra 55% da altura
x0, y0, x1, y1 = 432, 1000, 652, 1122
patch = img[y0:y1, x0:x1]
pm = np.zeros((y1 - y0, x1 - x0), np.uint8)
cv2.ellipse(pm, (BOCA[0][0] - x0, BOCA[0][1] - y0 - 4), (BOCA[1][0] + 4, BOCA[1][1] + 6), 0, 0, 360, 255, -1)
alt = int((y1 - y0) * 0.55)
p2 = cv2.resize(patch, (x1 - x0, alt)); m2 = cv2.GaussianBlur(cv2.resize(pm, (x1 - x0, alt)), (7, 7), 0)[..., None] / 255
meio = fechada.copy()
reg = meio[y0:y0 + alt, x0:x1].astype(float)
meio[y0:y0 + alt, x0:x1] = (p2 * m2 + reg * (1 - m2)).astype(np.uint8)

aberta = img.copy()

# --- piscando
OLHOS = [((417, 899), (50, 42)), ((668, 900), (52, 43))]
def piscar(im):
    p = inpaint(im, [lambda m, o=o: cv2.ellipse(m, o[0], o[1], 0, 0, 360, 255, -1) for o in OLHOS], 15)
    for (cx, cy), (rx, ry) in OLHOS:
        curva(p, [(cx - rx * .85, cy - 4), (cx - rx * .4, cy + 12), (cx, cy + 16), (cx + rx * .4, cy + 12), (cx + rx * .85, cy - 4)], 8)
    return p

variantes = {"fechada": fechada, "meio": meio, "aberta": aberta}
variantes.update({k + "-piscando": piscar(v) for k, v in list(variantes.items())})

ys, xs = np.where(mask > 0); Y0, Y1, X0, X1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
for nome, v in variantes.items():
    rgba = cv2.cvtColor(v, cv2.COLOR_BGR2BGRA); rgba[..., 3] = mask
    cv2.imwrite(str(D / f"{nome}.png"), rgba[Y0:Y1, X0:X1])

# folha de conferência
tiles = [cv2.resize(variantes[n][800:1160, 330:790], None, fx=.7, fy=.7) for n in ["fechada", "meio", "aberta", "fechada-piscando"]]
cv2.imwrite(str(D / "conferir.png"), np.hstack(tiles))
print("ok", X1 - X0, Y1 - Y0)
