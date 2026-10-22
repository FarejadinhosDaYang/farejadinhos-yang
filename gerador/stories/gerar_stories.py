"""
Gera os 3 stories do TOP 3 do dia (mesmo pódio da página inicial),
com animação da Yang + efeitos sonoros sintetizados (sem direito autoral).

uso: python3 gerador/stories/gerar_stories.py <pasta-do-site> <pasta-de-saida>
Gera podio-top3.mp4 (story único com os 3), podio1-3.mp4, top1-3.mp4 e stories.json (dados de cada um) na pasta de saída.
Roda sozinho todo dia pelo .github/workflows/stories-do-dia.yml.
"""
import json, os, re, shutil, subprocess, sys, wave
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
SITE, SAIDA = sys.argv[1], sys.argv[2]
os.makedirs(SAIDA, exist_ok=True)

FPS, DUR, SR = 30, 12.5, 44100

ICONES = {
    "Casa": ("🏠", "#F7941D"), "Café": ("☕", "#6B4226"), "Academia": ("🏋️", "#2E7D4F"),
    "Eletrônicos": ("🔌", "#2E5E8C"), "Eletrodomésticos": ("🧺", "#546E7A"), "Beleza": ("💄", "#C2185B"),
    "Moda": ("👕", "#6A4C93"), "Pet": ("🐾", "#8A5A44"), "Cozinha": ("🍳", "#D68910"),
    "Utilidades": ("🧰", "#00897B"), "Natal": ("🎄", "#1E7B3C"), "Skincare": ("🧴", "#D0688A"),
    "Piscina": ("🏊", "#1E88C7"),
}
FALAS = [
    ("Olha o que eu farejei!", "Preço de amiga! 🐾", "Corre que acaba! 🏃‍♀️", "🥇 TOP 1 DO DIA"),
    ("Achei mais um!", "Cabe no bolso! 💸", "Não deixa passar! 👀", "🥈 TOP 2 DO DIA"),
    ("Esse aqui é bom demais!", "Tá barato, hein! 😱", "Pega antes que suma! ✨", "🥉 TOP 3 DO DIA"),
]

# ---------------- nome curto ----------------
def nome_curto(nome, limite=38):
    nome = re.sub(r"\s+", " ", nome).strip()
    # corta no primeiro separador forte, se houver
    base = re.split(r"\s[-–|]\s|,\s", nome)[0]
    palavras, saida = base.split(" "), ""
    for p in palavras:
        if len((saida + " " + p).strip()) > limite: break
        saida = (saida + " " + p).strip()
    # não termina em "para", "de", "com"...
    PEQ = {"para","pra","de","do","da","dos","das","com","e","em","no","na","a","o","ao","por","sem"}
    ps = saida.split(" ")
    while len(ps) > 2 and (ps[-1].lower() in PEQ or ps[-1].isdigit()): ps.pop()   # nem em número solto ("Leds 8")
    saida = " ".join(ps)
    resto = nome[len(saida):].strip(" -–|,")
    det, d = "", resto.split(" ")
    for p in d:
        if len((det + " " + p).strip()) > 40: break
        det = (det + " " + p).strip()
    dps = det.split(" ")
    while dps and dps[-1].lower().strip(",.;:-") in PEQ: dps.pop()
    det = " ".join(dps).strip(" ,.;:-–|")
    return saida or nome[:limite], det

# ---------------- efeitos sonoros ----------------
def env(n, ataque=0.005, queda=6.0):
    t = np.arange(n) / SR
    a = np.minimum(1, t / max(ataque, 1e-4))
    return a * np.exp(-queda * t)

def pop(f0=420, f1=980, dur=0.11):
    n = int(SR * dur); t = np.arange(n) / SR
    f = np.linspace(f0, f1, n); fase = 2 * np.pi * np.cumsum(f) / SR
    return 0.7 * np.sin(fase) * env(n, 0.002, 38)

def whoosh(dur=0.45, sobe=True):
    n = int(SR * dur); ruido = np.random.default_rng(1).standard_normal(n)
    # passa-baixa móvel simples (média com janela variável)
    saida = np.zeros(n); acc = 0.0
    for i in range(n):
        k = (i / n) if sobe else (1 - i / n)
        alfa = 0.03 + 0.25 * k
        acc += alfa * (ruido[i] - acc); saida[i] = acc
    forma = np.sin(np.pi * np.arange(n) / n) ** 2
    return 0.9 * saida * forma / (np.abs(saida).max() + 1e-9)

def carimbo():
    n = int(SR * 0.32); t = np.arange(n) / SR
    grave = np.sin(2 * np.pi * (70 + 60 * np.exp(-30 * t)) * t) * np.exp(-12 * t)
    clique = np.random.default_rng(2).standard_normal(n) * np.exp(-90 * t) * 0.6
    return 0.95 * (grave + clique)

def brilho():
    out = np.zeros(int(SR * 0.8))
    for i, f in enumerate([1760, 2349, 2637, 3136, 3520]):
        n = int(SR * 0.35); t = np.arange(n) / SR
        tom = np.sin(2 * np.pi * f * t) * np.exp(-14 * t) * 0.28
        ini = int(SR * 0.07 * i); out[ini:ini + n] += tom[:len(out) - ini]
    return out

def plim():
    n = int(SR * 1.2); t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * f * t) for f, a in [(880, .5), (1320, .3), (1760, .15), (2640, .08)])
    return 0.7 * s * np.exp(-3.2 * t)

def tique():
    n = int(SR * 0.04); t = np.arange(n) / SR
    return 0.35 * np.sin(2 * np.pi * 1500 * t) * np.exp(-120 * t)

def trilha(tem_off, tem_cupom):
    faixa = np.zeros(int(SR * (DUR + 1)))
    def pos(t, som, vol=1.0):
        i = int(SR * t); faixa[i:i + len(som)] += vol * som[:len(faixa) - i]
    pos(0.10, whoosh(0.4, False), .35)       # selo da marca desce
    pos(0.30, whoosh(0.5, True), .55)        # Yang sobe
    pos(0.78, pop(300, 700, .12), .8)        # Yang aterrissa
    pos(0.95, pop(), .9)                     # balão 1
    pos(2.90, whoosh(0.5, False), .5)        # Yang vai pro canto
    pos(3.00, whoosh(0.6, True), .65)        # produto entra
    pos(3.15, pop(500, 1100), .7)            # faixa TOP
    for t in (3.7, 3.95, 4.4): pos(t, tique(), .9)
    if tem_off: pos(5.30, carimbo(), .7)
    pos(5.62, carimbo(), 1.0)                # preço carimbado
    pos(5.75, brilho(), .9)
    pos(6.95, pop(), .9)                     # balão 2
    if tem_cupom: pos(7.62, pop(600, 1300), .8)
    pos(9.20, whoosh(0.5, True), .55)        # chamada sobe
    pos(9.55, plim(), .75)
    faixa = faixa[: int(SR * DUR)]
    faixa = np.tanh(faixa * 1.2) * 0.8      # limita picos
    return faixa

DUR_PODIO = 6.0

def trilha_podio(tem_off, tem_cupom, posicao):
    faixa = np.zeros(int(SR * (DUR_PODIO + 1)))
    def pos(t, som, vol=1.0):
        i = int(SR * t); faixa[i:i + len(som)] += vol * som[:len(faixa) - i]
    pos(0.10, whoosh(0.4, False), .45)                  # medalha desce
    pos(0.70, pop(500, 1200), .8)                       # medalha encaixa
    pos(0.45, whoosh(0.45, True), .45)                  # degrau sobe
    pos(0.60, pop(), .6)                                # faixa
    pos(0.80, whoosh(0.5, False), .5)                   # produto cai
    pos(1.42, carimbo(), .55)                           # produto pousa no degrau
    if tem_off: pos(1.62, pop(600, 1300), .7)
    pos(1.55, tique(), .8)
    pos(2.02, carimbo(), .9); pos(2.12, brilho(), .8)   # preço
    if tem_cupom: pos(2.42, pop(600, 1300), .7)
    pos(2.65, plim(), .5 if posicao > 1 else .7)
    faixa = faixa[: int(SR * DUR_PODIO)]
    return np.tanh(faixa * 1.2) * 0.8

DUR_TOP3 = 8.0

def trilha_top3():
    """Story único do TOP 3: degraus sobem, 3º → 2º → 1º caem no pódio, coroa e confete."""
    faixa = np.zeros(int(SR * (DUR_TOP3 + 1)))
    def pos(t, som, vol=1.0):
        i = int(SR * t); faixa[i:i + len(som)] += vol * som[:len(faixa) - i]
    pos(0.10, whoosh(0.45, False), .45)                 # título desce
    pos(0.35, whoosh(0.5, True), .5)                    # degraus sobem
    pos(0.55, pop(300, 700, .12), .6)                   # Yang
    for t0, v in ((1.0, .7), (1.9, .8), (2.9, .95)):    # 3º, 2º, 1º caem
        pos(t0 - 0.05, whoosh(0.4, False), .45)
        pos(t0 + 0.42, carimbo(), v)
        pos(t0 + 0.35 + 0.05, tique(), .8)
    pos(1.40, brilho(), .45); pos(2.30, brilho(), .55); pos(3.30, brilho(), .8)   # preços
    pos(3.55, pop(500, 1200), .8)                       # coroa
    pos(3.65, plim(), .75)
    pos(4.20, whoosh(0.4, True), .35)                   # chamada
    faixa = faixa[: int(SR * DUR_TOP3)]
    return np.tanh(faixa * 1.2) * 0.8

def salvar_wav(sinal, caminho):
    dados = (np.clip(sinal, -1, 1) * 32767).astype(np.int16)
    with wave.open(caminho, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(dados.tobytes())

# ---------------- render ----------------
def render(html, pasta_frames, dur=None):
    dur = dur or DUR
    from playwright.sync_api import sync_playwright
    os.makedirs(pasta_frames, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1080, "height": 1920})
        pg.goto("file://" + html); pg.wait_for_load_state("networkidle")
        pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(300)
        pg.evaluate("document.getAnimations().forEach(a=>a.pause())")
        for i in range(int(FPS * dur)):
            pg.evaluate(f"document.getAnimations().forEach(a=>a.currentTime={i * 1000 / FPS})")
            pg.screenshot(path=f"{pasta_frames}/f{i:04d}.jpg", type="jpeg", quality=92)
        b.close()

top = json.loads(subprocess.check_output(["node", os.path.join(AQUI, "top3.js"), SITE]))
modelo = open(os.path.join(AQUI, "modelo.html"), encoding="utf-8").read()
modelo_podio = open(os.path.join(AQUI, "podio.html"), encoding="utf-8").read()
SO_PODIO = os.environ.get("FAREJA_SO_PODIO") == "1"   # teste rápido: só as imagens de pódio
manifesto = []

for i, o in enumerate(top):
    nome, det = nome_curto(o["produto"])
    ic, cor = ICONES.get(o.get("categoria") or "", ("🐾", "#8A7563"))
    b1, b2, t1, faixa = FALAS[i]
    dados = {
        "imagem": "img-%d%s" % (i + 1, os.path.splitext(o["imagem"])[1]),
        "faixa": faixa, "categoria": f"{ic} {o.get('categoria') or 'Achadinho'}", "corCategoria": cor,
        "nome": nome, "detalhe": det, "preco": o["preco"],
        "de": o.get("precoAntigo") or "", "off": o.get("desconto") or 0,
        "cupom": o.get("cupom") or "", "b1": b1, "b2": b2, "t1": t1,
    }
    # corta bordas brancas/lisas que vêm na foto da loja
    from PIL import Image, ImageChops
    im = Image.open(os.path.join(SITE, "assets", o["imagem"])).convert("RGB")
    fundo = Image.new("RGB", im.size, im.getpixel((0, 0)))
    caixa = ImageChops.difference(im, fundo).convert("L").point(lambda v: 255 if v > 18 else 0).getbbox()
    if caixa and (caixa[2] - caixa[0]) * (caixa[3] - caixa[1]) < 0.92 * im.size[0] * im.size[1]:
        im = im.crop(caixa)
    dados["imagem"] = "img-%d.jpg" % (i + 1)
    im.save(os.path.join(AQUI, dados["imagem"]), quality=92)
    html = os.path.join(AQUI, f"story-{i + 1}.html")
    open(html, "w", encoding="utf-8").write(
        modelo.replace("</head>", "<script>window.DADOS=" + json.dumps(dados, ensure_ascii=False) + ";</script></head>", 1))
    frames = os.path.join(AQUI, f"frames-{i + 1}")
    shutil.rmtree(frames, ignore_errors=True)

    # ---- imagem animada de pódio (6 s) ----
    dados_p = {"posicao": i + 1, "imagem": dados["imagem"], "nome": nome, "preco": o["preco"],
               "de": dados["de"], "off": dados["off"], "cupom": dados["cupom"],
               "categoria": dados["categoria"], "corCategoria": cor}
    html_p = os.path.join(AQUI, f"podio-{i + 1}.html")
    open(html_p, "w", encoding="utf-8").write(
        modelo_podio.replace("</head>", "<script>window.DADOS=" + json.dumps(dados_p, ensure_ascii=False) + ";</script></head>", 1))
    frames_p = frames + "-podio"
    shutil.rmtree(frames_p, ignore_errors=True)
    render(html_p, frames_p, DUR_PODIO)
    wav_p = os.path.join(AQUI, f"som-podio-{i + 1}.wav")
    salvar_wav(trilha_podio(bool(dados["off"]), bool(dados["cupom"]), i + 1), wav_p)
    saida_p = os.path.join(SAIDA, f"podio{i + 1}.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", f"{frames_p}/f%04d.jpg",
                    "-i", wav_p, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium",
                    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", saida_p], check=True)
    shutil.rmtree(frames_p, ignore_errors=True)
    print("OK:", saida_p)

    item = {"arquivo": f"top{i + 1}.mp4", "podio": f"podio{i + 1}.mp4", "posicao": i + 1, "produto": o["produto"],
            "nome": nome, "preco": o["preco"], "cupom": o.get("cupom") or "",
            "slug": o["slug"], "pagina": o.get("url") or "", "link": o.get("link") or ""}
    if SO_PODIO:
        item["arquivo"] = ""
        manifesto.append(item)
        continue

    render(html, frames)
    wav = os.path.join(AQUI, f"som-{i + 1}.wav")
    salvar_wav(trilha(bool(dados["off"]), bool(dados["cupom"])), wav)
    saida = os.path.join(SAIDA, f"top{i + 1}.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", f"{frames}/f%04d.jpg",
                    "-i", wav, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium",
                    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", saida], check=True)
    print("OK:", saida, "|", nome, "|", det)
    manifesto.append(item)
    # limpa os quadros (ocupam espaço)
    shutil.rmtree(frames, ignore_errors=True)

# ---- story único com o TOP 3 no pódio (8 s) ----
import datetime
podio_top3 = ""
if len(manifesto) == 3:
    agora_br = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=3)
    DIAS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
    dados3 = {"data": f"{DIAS[agora_br.weekday()]}, {agora_br:%d/%m} · farejados pela Yang",
              "itens": [{"posicao": i + 1, "imagem": "img-%d.jpg" % (i + 1), "nome": nome_curto(top[i]["produto"], 24)[0],
                         "preco": manifesto[i]["preco"], "off": top[i].get("desconto") or 0} for i in range(3)]}
    modelo3 = open(os.path.join(AQUI, "top3-unico.html"), encoding="utf-8").read()
    html3 = os.path.join(AQUI, "top3-unico-gerado.html")
    open(html3, "w", encoding="utf-8").write(
        modelo3.replace("</head>", "<script>window.DADOS=" + json.dumps(dados3, ensure_ascii=False) + ";</script></head>", 1))
    frames3 = os.path.join(AQUI, "frames-top3")
    shutil.rmtree(frames3, ignore_errors=True)
    render(html3, frames3, DUR_TOP3)
    wav3 = os.path.join(AQUI, "som-top3.wav")
    salvar_wav(trilha_top3(), wav3)
    podio_top3 = "podio-top3.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", f"{frames3}/f%04d.jpg",
                    "-i", wav3, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium",
                    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", os.path.join(SAIDA, podio_top3)], check=True)
    shutil.rmtree(frames3, ignore_errors=True)
    print("OK:", podio_top3)

json.dump({"gerado": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "podioTop3": podio_top3, "itens": manifesto},
          open(os.path.join(SAIDA, "stories.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
