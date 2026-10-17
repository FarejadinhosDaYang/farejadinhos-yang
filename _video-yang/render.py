"""Renderiza um modelo HTML da Yang em vídeo MP4 (1080x1920, 30fps).

Uso:
  python3 render.py reel.html saida.mp4 --sons          # reel de oferta com efeitos "boing"
  python3 render.py narradora.html saida.mp4            # Yang narradora (boca segue o texto)
  python3 render.py narradora.html saida.mp4 --audio voz.mp3   # boca segue a VOZ do ElevenLabs
  acrescente --previa para só gerar alguns quadros PNG de conferência
"""
import json, subprocess, sys, pathlib
import numpy as np
from playwright.sync_api import sync_playwright

AQUI = pathlib.Path(__file__).parent.resolve()
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = sys.argv[1:]
HTML = AQUI / (args[0] if args else "reel.html")
SAIDA = args[1] if len(args) > 1 else str(AQUI / (HTML.stem + ".mp4"))
PREVIA = "--previa" in flags
SONS = "--sons" in flags
AUDIO = flags[flags.index("--audio") + 1] if "--audio" in flags else None
FUNDO = flags[flags.index("--fundo") + 1] if "--fundo" in flags else None   # vídeo de review por baixo da Yang
ROT = flags[flags.index("--roteiro") + 1] if "--roteiro" in flags else None  # JSON com as falas e tempos
VERDE = "--verde" in flags   # sai com fundo verde (chroma key) pra usar no CapCut
if FUNDO: args = [a for a in args if a != FUNDO]
if AUDIO: args = [a for a in args if a != AUDIO]
if ROT: args = [a for a in args if a != ROT]
HTML = AQUI / (args[0] if args else "reel.html")
SAIDA = args[1] if len(args) > 1 else str(AQUI / (HTML.stem + ".mp4"))
FPS = 30


def amplitude_por_quadro(arquivo):
    """Lê a voz e devolve a abertura da boca por quadro (0 fechada, 0.5 meio, 0.9 aberta).
    - filtra só a faixa da voz (200–3500 Hz) pra boca reagir à fala, não a ruídos
    - normaliza pelo volume típico da própria voz
    - usa histerese e tempo mínimo em cada posição pra boca não 'tremer'"""
    sr = 16000
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", arquivo, "-af", "highpass=f=200,lowpass=f=3500",
                          "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    hop = sr // FPS; win = hop * 2
    nq = int(np.ceil(len(x) / hop))
    xp = np.pad(x, (hop // 2, win))
    rms = np.array([np.sqrt(np.mean(xp[i * hop:i * hop + win] ** 2)) for i in range(nq)])
    db = 20 * np.log10(rms + 1e-6)
    fala = db[db > db.max() - 30]
    alto, baixo = np.percentile(fala, 85), db.max() - 30
    v = np.clip((db - baixo) / (alto - baixo + 1e-6), 0, 1.2)
    v = np.convolve(v, [0.25, 0.5, 0.25], "same")              # suaviza
    niveis, atual, seguro = [], 0, 0
    for a in v:
        alvo = 0 if a < 0.38 else (1 if a < 0.78 else 2)
        if atual == 0 and alvo > 0 and a < 0.45: alvo = 0          # histerese pra abrir
        if alvo != atual and seguro >= 2:                          # segura cada posição >= 2 quadros
            atual, seguro = alvo, 0
        seguro += 1
        niveis.append(atual)
    # vogal longa: boca não fica "congelada" aberta — dá uma fechadinha a cada ~5 quadros (ritmo de sílaba)
    corrida = 0
    for i, n in enumerate(niveis):
        corrida = corrida + 1 if (i and n == niveis[i - 1] and n > 0) else 0
        if corrida >= 5 and corrida % 5 == 0:
            niveis[i] = n - 1
            if i + 1 < len(niveis) and niveis[i + 1] == n: niveis[i + 1] = n - 1
    return [[0, 0.5, 0.9][n] for n in niveis], len(x) / sr


with sync_playwright() as p:
    nav = p.chromium.launch(args=["--allow-file-access-from-files"])
    pg = nav.new_page(viewport={"width": 1080, "height": 1920})
    init = ""
    if AUDIO:
        amp, dur_audio = amplitude_por_quadro(AUDIO)
        init = f"window.AMP = {json.dumps(amp)};"
    if ROT:
        init += f"window.ROTEIRO = {open(ROT, encoding='utf-8').read()};"
    if init:
        pg.add_init_script(init)
    pg.goto(HTML.as_uri())
    pg.evaluate("document.fonts.ready")
    pg.wait_for_function("[...document.images].every(i => i.complete && i.naturalWidth > 0)")
    if AUDIO:
        pg.evaluate(f"window.DURACAO = Math.max(window.DURACAO, {dur_audio + 0.6})")
    dur = pg.evaluate("window.DURACAO")
    total = int(dur * FPS)

    if PREVIA:
        for i, s in enumerate(np.linspace(0.6, dur - 0.5, 8)):
            pg.evaluate(f"renderFrame({int(s * FPS)})")
            pg.screenshot(path=str(AQUI / f"previa_{i}.png"))
        sys.exit()

    video_mudo = AQUI / "_mudo.mp4"
    camada = FUNDO or VERDE
    enc = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", str(video_mudo)]
    if FUNDO:   # vídeo de review (preenche 1080x1920, repete se for curto) + Yang por cima
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-stream_loop", "-1", "-i", FUNDO,
               "-f", "image2pipe", "-framerate", str(FPS), "-i", "-", "-filter_complex",
               f"[0:v]fps={FPS},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];"
               "[bg][1:v]overlay=0:0:shortest=1[v]", "-map", "[v]", "-t", str(dur)] + enc
    elif VERDE:
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"color=c=0x00B140:s=1080x1920:r={FPS}",
               "-f", "image2pipe", "-framerate", str(FPS), "-i", "-", "-filter_complex",
               "[0:v][1:v]overlay=0:0:shortest=1[v]", "-map", "[v]", "-t", str(dur)] + enc
    else:
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-i", "-"] + enc
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(total):
        pg.evaluate(f"renderFrame({f})")
        ff.stdin.write(pg.screenshot(type="png", omit_background=True) if camada else pg.screenshot(type="jpeg", quality=95))
    ff.stdin.close(); ff.wait()
    nav.close()

if AUDIO:
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video_mudo), "-i", AUDIO, "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-af", f"apad,atrim=0:{dur}", SAIDA], check=True)
elif SONS:
    def boing(t0):
        return f"aevalsrc='0.5*sin(2*PI*(380+900*t)*t)*exp(-11*t)':d=0.35:s=44100,adelay={int(t0*1000)}|{int(t0*1000)}"
    def tum(t0):
        return f"aevalsrc='0.9*sin(2*PI*(140-60*t)*t)*exp(-9*t)':d=0.45:s=44100,adelay={int(t0*1000)}|{int(t0*1000)}"
    sons = [boing(0.35), boing(2.75), boing(3.5), tum(7.55), boing(10.15), boing(11.3)]
    filt = ";".join(f"{s}[a{i}]" for i, s in enumerate(sons))
    filt += ";" + "".join(f"[a{i}]" for i in range(len(sons))) + f"amix=inputs={len(sons)}:normalize=0,apad,atrim=0:{dur}[aud]"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video_mudo), "-filter_complex", filt,
                    "-map", "0:v", "-map", "[aud]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", SAIDA], check=True)
elif FUNDO and subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
                                 "-of", "csv=p=0", FUNDO], capture_output=True, text=True).stdout.strip():
    # mantém o som original do vídeo de review
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video_mudo), "-stream_loop", "-1", "-i", FUNDO,
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-shortest", SAIDA], check=True)
else:
    video_mudo.replace(SAIDA)
video_mudo.unlink(missing_ok=True)
print("OK", SAIDA)
