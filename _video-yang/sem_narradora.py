"""Reel SEM a Yang narrando: o vídeo do produto + frases escritas na tela + tela final com a Yang.
Chamado pelo auto_reel.py quando o pedido tem "sem_narradora": true (a voz é ignorada).

Texto (o mesmo formato de marcações do modo narrado):
  [0-2.5] Isso tira gordura *sem esfregar* 😳 [2.5-5] É só borrifar… [5-8] e passar o pano!
Cada marcação = um trecho do vídeo + a frase que aparece escrita enquanto ele passa.
- O trecho toca na velocidade normal; se a frase precisar de mais tempo pra ser lida, ele fica mais lento
  (até metade da velocidade) ou repete. Trecho comprido demais é acelerado de leve.
- *palavra* sai em amarelo. Emoji funciona. A 1ª frase (o gancho) sai maior.
- No fim: tela da Yang com "COMENTA QUERO" + "ou entra no farejadinhosdayang.com.br" (2,8 s).
- Sem som (pra pôr o áudio em alta no Instagram) — ou com música da pasta musicas/ se o pedido pedir.
- "som_original": true → mantém o som do próprio vídeo (bom pra vídeo ASMR), cortado junto com as cenas;
  nesse modo o trecho quase não fica lento (no máximo 0,8×), pra o som não ficar arrastado: repete em vez disso.
"""
import os, re, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
VERM, AMAR, CREME, MARROM = (229, 35, 46), (255, 210, 63), (253, 243, 227), (43, 27, 18)
FONTE = os.path.join(AQUI, "fonts", "Baloo2.ttf")
EMOJI_FONTES = ["/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf", "/usr/share/fonts/noto/NotoColorEmoji.ttf"]
SITE = "farejadinhosdayang.com.br"
FIM = 2.8
EMOJI_RE = re.compile("([\U0001F000-\U0001FAFF☀-➿⬀-⯿️‍]+)")


def fonte(sz):
    f = ImageFont.truetype(FONTE, sz)
    try: f.set_variation_by_name("ExtraBold")
    except Exception: pass
    return f


_emoji = None
def fonte_emoji():
    global _emoji
    if _emoji is None:
        _emoji = False
        for p in EMOJI_FONTES:
            if os.path.exists(p):
                try: _emoji = ImageFont.truetype(p, 109); break
                except Exception: pass
    return _emoji


def pedacos(texto):
    """'Isso tira *sem esfregar* 😳' → [(texto, amarelo?, emoji?)] palavra por palavra (pra quebrar linha)."""
    out, amarelo = [], False
    for parte in re.split(r"(\*)", texto):
        if parte == "*": amarelo = not amarelo; continue
        for pal in parte.split(" "):
            if not pal: continue
            out.append((pal, amarelo))
    return out


def medir(pal, f):
    w = 0
    for s in EMOJI_RE.split(pal):
        if not s: continue
        if EMOJI_RE.fullmatch(s):
            w += int(f.size * 1.1) * len([c for c in s if c not in "️‍"]) if fonte_emoji() else 0
        else:
            b = f.getbbox(s); w += b[2] - b[0]
    return w


def desenhar_palavra(im, d, x, y, pal, f, cor, contorno):
    for s in EMOJI_RE.split(pal):
        if not s: continue
        if EMOJI_RE.fullmatch(s):
            fe = fonte_emoji()
            if not fe: continue
            lado = int(f.size * 1.1)
            for c in [c for c in s if c not in "️‍"]:
                t = Image.new("RGBA", (140, 140), (0, 0, 0, 0))
                ImageDraw.Draw(t).text((6, 6), c, font=fe, embedded_color=True)
                bb = t.getbbox()
                if bb: t = t.crop(bb)
                t = t.resize((lado, int(lado * t.height / max(t.width, 1))), Image.LANCZOS)
                im.alpha_composite(t, (int(x), int(y + f.size * 0.18)))
                x += lado
        else:
            b = f.getbbox(s)
            d.text((x - b[0], y), s, font=f, fill=cor, stroke_width=max(6, f.size // 11), stroke_fill=contorno)
            x += b[2] - b[0]
    return x


def legenda_png(texto, gancho, topo, saida):
    """Frase grande, centralizada, branca com contorno escuro (amarelo nas *palavras*), quebrando linha sozinha."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    tam = 104 if gancho else 86
    while True:
        f = fonte(tam); esp = medir(" ", f) or tam // 4
        linhas, atual, larg = [], [], 0
        for pal, am in pedacos(texto):
            w = medir(pal, f)
            if atual and larg + esp + w > 920:
                linhas.append((atual, larg)); atual, larg = [], 0
            larg += (esp if atual else 0) + w; atual.append((pal, am, w))
        if atual: linhas.append((atual, larg))
        if len(linhas) <= 4 or tam <= 60: break
        tam -= 8
    alt = int(tam * 1.18)
    y = topo
    if gancho:   # faixa escura suave atrás do gancho, pra ler em cima de qualquer vídeo
        sombra = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sombra).rounded_rectangle([40, y - 30, W - 40, y + alt * len(linhas) + 40], 50, fill=(0, 0, 0, 90))
        im.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(18)))
    for linha, larg in linhas:
        x = (W - larg) / 2
        for pal, am, w in linha:
            desenhar_palavra(im, d, x, y, pal, f, AMAR if am else "white", MARROM)
            x += w + esp
        y += alt
    selo(im)
    im.save(saida)


def selo(im):
    d = ImageDraw.Draw(im)
    f = fonte(34); t = "publi · link de afiliado"
    b = d.textbbox((0, 0), t, font=f); w = b[2] - b[0]
    d.rounded_rectangle([W / 2 - w / 2 - 24, 60, W / 2 + w / 2 + 24, 122], 31, fill=(43, 27, 18, 170))
    d.text((W / 2 - w / 2 - b[0], 91 - (b[1] + b[3]) / 2), t, font=f, fill="white")


def centro(d, texto, y, f, cor, fundo=None, pad=(40, 16), raio=40):
    b = d.textbbox((0, 0), texto, font=f); w, h = b[2] - b[0], b[3] - b[1]
    if fundo: d.rounded_rectangle([W / 2 - w / 2 - pad[0], y, W / 2 + w / 2 + pad[0], y + h + 2 * pad[1]], raio, fill=fundo)
    d.text((W / 2 - w / 2 - b[0], y + pad[1] - b[1]), texto, font=f, fill=cor)
    return y + h + 2 * pad[1]


def tela_final(saida, comenta=True):
    im = Image.new("RGBA", (W, H), CREME + (255,))
    selo(im)
    d = ImageDraw.Draw(im)
    y = 330
    if comenta:
        y = centro(d, "COMENTA QUERO", y, fonte(110), "white", VERM, pad=(50, 22), raio=56) + 34
        y = centro(d, "que a Yang te manda o link", y, fonte(58), MARROM) + 40
        y = centro(d, "ou entra no", y, fonte(56), MARROM, pad=(0, 0)) + 14
    else:
        y = centro(d, "Entra no", y, fonte(80), MARROM, pad=(0, 0)) + 20
    y = centro(d, SITE, y, fonte(70), MARROM, AMAR, pad=(34, 14), raio=36) + 22
    centro(d, "link na bio", y, fonte(52), MARROM, pad=(0, 0))
    yang = Image.open(os.path.join(AQUI, "yang.png")).convert("RGBA")
    yang = yang.resize((int(yang.width * 1.4), int(yang.height * 1.4)), Image.LANCZOS)
    im.alpha_composite(yang, ((W - yang.width) // 2, H - yang.height - 50))
    im.convert("RGB").save(saida)


def tempo_leitura(texto):
    palavras = len(re.sub(r"[*|]", " ", EMOJI_RE.sub(" ", texto)).split())
    return max(1.3, 0.45 + palavras * 0.3)


def tem_audio(video):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", video],
                       capture_output=True, text=True)
    return bool(r.stdout.strip())


def audio_original(video, pedacos, corpo, dur, saida):
    """Som do próprio vídeo, nos mesmos trechos e velocidades da imagem; some suave na tela final."""
    ent, filt = [], []
    for i, (a, b, v) in enumerate(pedacos):
        ent += ["-ss", f"{a:.3f}", "-t", f"{b - a:.3f}", "-i", video]
        d = (b - a) / v
        filt.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,atempo={v:.4f},"
                    f"apad,atrim=0:{d:.4f},asetpts=N/SR/TB[a{i}]")
    filt.append("".join(f"[a{i}]" for i in range(len(pedacos))) + f"concat=n={len(pedacos)}:v=0:a=1,"
                f"loudnorm=I=-16:TP=-2:LRA=11,apad,atrim=0:{dur:.3f},afade=t=out:st={max(0, corpo - 0.4):.2f}:d=1.2[s]")
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", *ent, "-filter_complex", ";".join(filt),
                    "-map", "[s]", "-c:a", "pcm_s16le", saida], check=True)


def montar(pedido, pasta, pid, video, grupos, juntar_pedacos, duracao, log, escolher_musica=None):
    """grupos = [(texto, (de, ate))] — uma frase escrita por marcação. Devolve (reel, duracao)."""
    total = duracao(video)
    som = bool(pedido.get("som_original")) and tem_audio(video)
    if pedido.get("som_original") and not som: log("som original pedido, mas o vídeo não tem som — sai sem som")
    lento = 0.8 if som else 0.5      # com o som do vídeo, não deixa arrastado
    topo = float(pedido.get("legenda_top")) if pedido.get("legenda_top") not in (None, "") else 300
    pedacos_v, linha_tempo, t = [], [], 0.0
    for i, (texto, (a, b)) in enumerate(grupos):
        a, b = max(0.0, min(a, total - 0.2)), min(total, b)
        if b - a < 0.2: b = min(total, a + 0.5)
        tam = b - a
        ler = tempo_leitura(texto) + (0.3 if i == 0 else 0)
        if tam >= ler:
            v = min(1.5, tam / ler) if tam > 4.5 else 1.0      # trecho comprido: acelera de leve
            v = max(v, 1.0)
            if tam / v > max(ler * 1.8, 4.5):                  # ainda comprido: usa o meio
                meio, novo = (a + b) / 2, max(ler * 1.8, 4.5) * v
                a, b = meio - novo / 2, meio + novo / 2
            pedacos_v.append((a, b, v)); d = (b - a) / v
        else:
            v = max(lento, tam / ler); voltas = 1
            while tam * voltas / v < ler - 0.01 and voltas < 4: voltas += 1
            pedacos_v += [(a, b, v)] * voltas; d = tam * voltas / v
        linha_tempo.append((t, t + d, texto))
        log(f"  {t:5.2f}–{t + d:5.2f}s  vídeo {a:5.1f}–{b:5.1f}s (vel {v:.2f})  {texto}")
        t += d
    corpo = round(t, 2)
    dur = round(corpo + FIM, 2)

    fundo = os.path.join(pasta, f"{pid}-fundo.mp4")
    juntar_pedacos(video, pedacos_v, corpo, fundo)

    pngs = []
    for i, (ini, fim, texto) in enumerate(linha_tempo):
        p = os.path.join(pasta, f"{pid}-txt{i:02d}.png")
        legenda_png(texto.replace("|", " "), i == 0, topo, p)
        pngs.append((ini, fim, p))
    final = os.path.join(pasta, f"{pid}-final.png")
    tela_final(final, comenta=pedido.get("comenta", True) is not False)

    entradas = ["-i", fundo]
    filt, ult = [], "0:v"
    for k, (ini, fim, p) in enumerate(pngs, start=1):
        entradas += ["-loop", "1", "-t", f"{fim - ini:.3f}", "-i", p]
        filt.append(f"[{k}:v]format=rgba,fade=t=in:st=0:d=0.18:alpha=1,setpts=PTS+{ini:.3f}/TB[t{k}]")
        filt.append(f"[{ult}][t{k}]overlay=0:0:eof_action=pass:enable='between(t,{ini:.3f},{fim:.3f})'[c{k}]")
        ult = f"c{k}"
    n = len(pngs) + 1
    entradas += ["-loop", "1", "-t", f"{FIM}", "-i", final]
    filt.append(f"[{ult}]fps={FPS},format=yuv420p,setsar=1[corpo]")
    filt.append(f"[{n}:v]scale={W}:{H},fps={FPS},format=yuv420p,setsar=1,fade=t=in:st=0:d=0.25[fim]")
    filt.append("[corpo][fim]concat=n=2:v=1:a=0[v]")
    reel = os.path.join(pasta, f"{pid}-reel.mp4")
    musica = None if som else (escolher_musica(pedido, pid) if (escolher_musica and str(pedido.get("musica") or "").strip()) else None)
    if som:
        wav = os.path.join(pasta, f"{pid}-som.wav")
        audio_original(video, pedacos_v, corpo, dur, wav)
        entradas += ["-i", wav]
        filt.append(f"[{n + 1}:a]anull[a]")
        log("som original do vídeo")
    elif musica:
        entradas += ["-stream_loop", "-1", "-i", musica]
        filt.append(f"[{n + 1}:a]aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-2:LRA=11,"
                    f"atrim=0:{dur},asetpts=N/SR/TB,afade=t=in:d=0.4,afade=t=out:st={max(0, dur - 1.5):.2f}:d=1.5[a]")
        log(f"música: {os.path.basename(musica)}")
    else:
        entradas += ["-f", "lavfi", "-t", f"{dur}", "-i", "anullsrc=r=48000:cl=stereo"]
        filt.append(f"[{n + 1}:a]anull[a]")
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", *entradas, "-filter_complex", ";".join(filt),
                    "-map", "[v]", "-map", "[a]", "-t", f"{dur}", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", reel], check=True)
    for _, _, p in pngs: os.remove(p)
    if som: os.remove(wav)
    os.remove(final); os.remove(fundo)
    return reel, dur
