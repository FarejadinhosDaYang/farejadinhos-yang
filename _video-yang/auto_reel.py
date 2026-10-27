"""Monta um Reel da Yang SOZINHO, a partir de: vídeo do produto + voz do ElevenLabs + o texto que foi narrado.
Usado pela página do painel "🎬 Gerar reel" (workflow gerar-reel.yml), mas roda igual no computador.

Uso:
  python3 auto_reel.py pedido.json pasta-de-saida
pedido.json:
  {
    "id": "20261027-1350-ab12",
    "video": "caminho/fonte.mp4",        "voz": "caminho/voz.mp3",
    "texto": "Sabe aquela sujeira… Esse mini aspirador resolve! … comenta \"quero\" que eu te mando o link… ou entra no farejadinhos da Yang ponto com ponto bê érre, tá na bio!",
    "slug": "mini-aspirador-...",        (opcional — a oferta vai pra categoria Vídeos)
    "titulo": "A sujeira que|*ninguém alcança*",  (capa; opcional — sem ele usa a 1ª frase)
    "faixa": "🐾 ACHADINHO DA LIMPEZA",  "balao": "Olha isso! 😱",   (capa; opcionais)
    "de": 0, "ate": 22.8,                (opcional: só usa esse pedaço do vídeo — ex.: cortar preço escrito no fim)
    "capa_t": 13.0                       (opcional: segundo do vídeo usado na capa)
  }
Gera na pasta de saída: <id>-reel.mp4, <id>-capa.jpg, <id>-roteiro.json e <id>-log.txt.

Como decide sozinho:
- Frases: o texto é dividido nas reticências (…) e nos pontos/exclamações/interrogações.
- Tempo de cada frase: acha os trechos de fala no áudio (pelas pausas) e distribui as frases pelos trechos
  de forma que a velocidade da fala fique parecida em todas e os cortes caiam nas pausas mais longas.
- Fundo: se o vídeo for curto, passa em câmera lenta (e repete se precisar); se for comprido, mostra um
  pedaço do meio de CADA cena (todas aparecem) e acelera de leve. Sem o som original.
- Selo "💬 COMENTA QUERO" (com "ou entra no farejadinhosdayang.com.br" embaixo) entra junto da frase que tem "comenta";
  capa com a Yang inteira e selo publi.
- O site falado por extenso ("farejadinhos da Yang ponto com ponto bê érre") vira "farejadinhosdayang.com.br" na legenda.
"""
import json, math, os, re, subprocess, sys
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
FPS = 30
LOG = []
def log(*a):
    s = " ".join(str(x) for x in a); LOG.append(s); print(s, flush=True)

# ---------------------------------------------------------------- texto → frases
def dividir_frases(texto):
    t = re.sub(r"\s+", " ", texto.replace("...", "…")).strip()
    pedacos = re.split(r"(?<=…)\s+|(?<=[.!?])\s+", t)
    frases = []
    for p in pedacos:
        p = p.strip()
        if not p or re.fullmatch(r"[…\s.]+", p):   # "…" sozinho = só uma pausa
            continue
        p = re.sub(r"^…\s*", "", p).strip()
        p = re.sub(r'["“”]([^"“”]+)["“”]', lambda m: m.group(1).upper(), p)   # "quero" → QUERO
        frases.append(p.replace('"', "").replace("“", "").replace("”", ""))
    return frases

SITE = "farejadinhosdayang.com.br"
SITE_FALADO = re.compile(r"farejadinhos\s*da\s*yang\s*(?:ponto|\.)\s*com\s*(?:ponto|\.)\s*(?:b[eê]\s*[eé]rre|br)\b", re.I)

def site_escrito(t):
    """Na legenda o site aparece escrito do jeito certo, mesmo falado por extenso no ElevenLabs."""
    return SITE_FALADO.sub(SITE, t)

def silabas(t):
    t = re.sub(r"[^a-záéíóúâêôãõàüç ]", " ", t.lower())
    return max(1, len(re.findall(r"[aeiouáéíóúâêôãõàü]+", t)))

# ---------------------------------------------------------------- áudio → trechos de fala
def ler_audio(caminho, sr=16000):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", caminho, "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768, sr

def trechos_de_fala(x, sr, passo=0.02, pausa_min=0.10):
    h = int(sr * passo)
    db = np.array([20 * np.log10(np.sqrt(np.mean(x[i:i + h] ** 2)) + 1e-6) for i in range(0, len(x), h)])
    limite = max(-38.0, db.max() - 42)
    fala = db > limite
    trechos, ini = [], None
    for i, f in enumerate(fala):
        if f and ini is None: ini = i
        if not f and ini is not None:
            trechos.append([ini * passo, i * passo]); ini = None
    if ini is not None: trechos.append([ini * passo, len(fala) * passo])
    # junta trechos separados por pausas curtas demais (respiração no meio da palavra)
    unidos = []
    for t in trechos:
        if unidos and t[0] - unidos[-1][1] < pausa_min: unidos[-1][1] = t[1]
        else: unidos.append(t)
    # descarta estalinhos (< 0,12 s) colando no vizinho
    k = 0
    while k < len(unidos) and len(unidos) > 1:
        a, b = unidos[k]
        if b - a < 0.12:
            if k > 0: unidos[k - 1][1] = max(unidos[k - 1][1], b)
            else: unidos[k + 1][0] = a
            del unidos[k]
        else: k += 1
    return unidos, db, passo

def dividir_trecho_mais_longo(trechos, db, passo):
    k = max(range(len(trechos)), key=lambda i: trechos[i][1] - trechos[i][0])
    a, b = trechos[k]
    i0, i1 = int((a + 0.2 * (b - a)) / passo), int((a + 0.8 * (b - a)) / passo)
    meio = i0 + int(np.argmin(db[i0:i1 + 1])) if i1 > i0 else int((a + b) / 2 / passo)
    corte = meio * passo
    trechos[k:k + 1] = [[a, corte], [corte + passo, b]]

def alinhar(trechos, frases, db, passo):
    """Distribui as frases pelos trechos (programação dinâmica): velocidade parecida + corte nas pausas longas."""
    m = len(frases)
    while len(trechos) < m: dividir_trecho_mais_longo(trechos, db, passo)
    n = len(trechos)
    syl = [silabas(f) for f in frases]
    falado = sum(b - a for a, b in trechos)
    ritmo = sum(syl) / max(falado, 0.1)           # sílabas por segundo desta voz
    pausa = [trechos[j + 1][0] - trechos[j][1] for j in range(n - 1)]
    INF = 1e18
    custo = [[INF] * (n + 1) for _ in range(m + 1)]
    volta = [[0] * (n + 1) for _ in range(m + 1)]
    custo[0][0] = 0
    for k in range(1, m + 1):
        esperado = syl[k - 1] / ritmo
        for j in range(k, n - (m - k) + 1):
            for i in range(k - 1, j):
                if custo[k - 1][i] >= INF: continue
                dur = trechos[j - 1][1] - trechos[i][0]
                c = math.log(max(dur, 0.05) / max(esperado, 0.05)) ** 2
                if j < n: c += 0.8 * max(0.0, 0.40 - pausa[j - 1]) / 0.40   # cortar em pausa curta custa
                if custo[k - 1][i] + c < custo[k][j]:
                    custo[k][j] = custo[k - 1][i] + c; volta[k][j] = i
    falas, j = [], n
    for k in range(m, 0, -1):
        i = volta[k][j]
        falas.append({"de": round(trechos[i][0], 2), "ate": round(trechos[j - 1][1], 2), "texto": frases[k - 1]})
        j = i
    return falas[::-1], ritmo

# ---------------------------------------------------------------- vídeo → fundo
def duracao(caminho):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", caminho]).decode().strip())

def cortes_de_cena(video, de, ate):
    out = subprocess.run(["ffmpeg", "-ss", str(de), "-t", str(ate - de), "-i", video, "-vf",
                          "select='gt(scene,0.3)',showinfo", "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
    ts = sorted({round(de + float(v), 2) for v in re.findall(r"pts_time:([\d.]+)", out)})
    ts = [t for t in ts if de + 0.5 < t < ate - 0.5]
    limpos = []
    for t in ts:                                   # cortes muito colados viram um só
        if not limpos or t - limpos[-1] > 0.6: limpos.append(t)
    return limpos

def montar_fundo(video, de, ate, dur, saida):
    L = ate - de
    pedacos = []
    if L / dur <= 1.6:
        voltas = max(1, math.ceil(dur * 0.5 / L)) if L / dur < 0.5 else 1
        vel = voltas * L / dur
        pedacos = [(de, ate, vel)] * voltas
        log(f"fundo: vídeo de {L:.1f}s para {dur:.1f}s de voz → velocidade {vel:.2f}" + (f", {voltas} voltas" if voltas > 1 else ""))
    else:
        cenas = [de] + cortes_de_cena(video, de, ate) + [ate]
        alvo = 1.25 * dur
        f = alvo / L
        for a, b in zip(cenas, cenas[1:]):
            tam = max(min(b - a, 0.7), (b - a) * f)
            meio = (a + b) / 2
            pedacos.append((max(a, meio - tam / 2), min(b, meio + tam / 2), 1.0))
        total = sum(b - a for a, b, _ in pedacos)
        vel = total / dur
        pedacos = [(a, b, vel) for a, b, _ in pedacos]
        log(f"fundo: vídeo de {L:.1f}s ({len(pedacos)} cenas) → um pedaço de cada cena, {total:.1f}s em velocidade {vel:.2f}")
    FILL = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1"
    entradas, filt = [], []
    for i, (a, b, v) in enumerate(pedacos):
        entradas += ["-ss", f"{a:.3f}", "-t", f"{b - a:.3f}", "-i", video]
        filt.append(f"[{i}:v]{FILL},setpts=(PTS-STARTPTS)/{v:.4f},fps={FPS}[v{i}]")
    filt.append("".join(f"[v{i}]" for i in range(len(pedacos))) +
                f"concat=n={len(pedacos)}:v=1:a=0,tpad=stop_mode=clone:stop_duration=3[out]")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *entradas, "-filter_complex", ";".join(filt), "-map", "[out]",
                    "-t", f"{dur:.2f}", "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", saida], check=True)

# ---------------------------------------------------------------- legenda do post (Instagram)
EMOJI_CAT = {"cozinha": "🍳", "casa": "🏠", "utilidades": "🧰", "eletrodomesticos": "⚡", "beleza": "💄", "skincare": "🧴",
             "pet": "🐾", "academia": "💪", "cafe": "☕", "moda": "👗", "eletronicos": "🔌", "natal": "🎄", "piscina": "🏊"}
TAGS_CAT = {"cozinha": "#cozinhapratica #utilidadesdecozinha", "casa": "#casaorganizada #organizacao",
            "utilidades": "#utilidadesdomesticas #casapratica", "eletrodomesticos": "#eletrodomesticos #casapratica",
            "beleza": "#beleza #makeup", "skincare": "#skincare #cuidadoscomapele", "pet": "#achadinhospet #pets",
            "academia": "#academia #treino", "cafe": "#cafe #amocafe", "moda": "#moda #lookdodia",
            "eletronicos": "#tecnologia #gadgets", "natal": "#natal #decoracaodenatal", "piscina": "#piscina #verao"}

def _chave(t):
    import unicodedata
    return unicodedata.normalize("NFD", t or "").encode("ascii", "ignore").decode().lower().strip()

def legenda_post(frases, oferta):
    """Monta a legenda do post a partir das próprias frases da Yang (sem preço, com a identificação de publi)."""
    cats = [_chave(c) for c in (oferta.get("categoria") or "").split(",") if _chave(c) not in ("", "videos")]
    cat = cats[0] if cats else ""
    limpa = lambda t: re.sub(r"\s*…\s*$", "", t).strip()
    gancho = limpa(frases[0])
    if not re.search(r"[!?]$", gancho): gancho = gancho.rstrip(".") 
    fim_re = re.compile(r"pre[cç]o|no site|coment|link", re.I)
    meio = [f for f in frases[1:] if not fim_re.search(f)]
    corpo = " ".join(meio)
    corpo = re.sub(r"…\s+(?=[a-záéíóúâêôãõç])", ", ", corpo)      # "…" seguido de minúscula vira vírgula
    corpo = re.sub(r"…\s*", ". ", corpo).strip()
    corpo = re.sub(r"\s+([,.!?])", r"\1", corpo)
    corpo = re.sub(r", (e|ou) ", r" \1 ", corpo)                    # "…, e" fica só "… e"
    if corpo and corpo[-1] not in ".!?": corpo += "."
    corpo = corpo[:1].upper() + corpo[1:]
    tem_comenta = any(re.search(r"coment", f, re.I) for f in frases)
    loja = "#achadinhosmercadolivre" if re.search(r"meli\.la|mercadolivre", oferta.get("link") or "") else "#achadinhosshopee"
    linhas = [f"{gancho} {EMOJI_CAT.get(cat, '🐾')} (publi)", ""]
    if corpo: linhas += [corpo, ""]
    linhas += (["💬 Comenta QUERO que a Yang te manda o link", f"🌐 ou entra no {SITE} (link na bio)"] if tem_comenta
               else [f"🌐 Entra no {SITE} (link na bio)!"])
    linhas += ["", "📢 publi · este post tem link de afiliado: você paga o mesmo preço e a Yang ganha uma pequena comissão.", "",
               f"{loja} {TAGS_CAT.get(cat, '#utilidades')} #achadinhos #farejadinhosdayang"]
    return "\n".join(linhas)

# ---------------------------------------------------------------- principal
def main():
    pedido = json.load(open(sys.argv[1], encoding="utf-8"))
    pasta = os.path.abspath(sys.argv[2]); os.makedirs(pasta, exist_ok=True)
    base = os.path.dirname(os.path.abspath(sys.argv[1]))
    caminho = lambda p: p if os.path.isabs(p) else os.path.join(base, p)
    pid = pedido.get("id") or "reel"
    video, voz = caminho(pedido["video"]), caminho(pedido["voz"])

    frases = dividir_frases(pedido["texto"])
    if not frases: raise SystemExit("O texto da narração está vazio.")
    x, sr = ler_audio(voz)
    dur_voz = len(x) / sr
    trechos, db, passo = trechos_de_fala(x, sr)
    falas, ritmo = alinhar(trechos, frases, db, passo)
    log(f"voz: {dur_voz:.1f}s, {len(trechos)} trechos de fala, {len(frases)} frases, ritmo {ritmo:.1f} sílabas/s")
    for f in falas:
        sps = silabas(f["texto"]) / max(f["ate"] - f["de"], .1)
        log(f"  {f['de']:6.2f}–{f['ate']:6.2f}  {sps:4.1f} síl/s  {f['texto']}" + ("   ⚠️ conferir" if not 2.5 <= sps <= 9 else ""))

    for f in falas: f["texto"] = site_escrito(f["texto"])

    dur = round(dur_voz + 0.6, 2)
    total = duracao(video)
    de = max(0.0, float(pedido.get("de") or 0))
    ate = min(total, float(pedido.get("ate") or total))
    if ate - de < 1: raise SystemExit("O trecho do vídeo escolhido é curto demais.")
    fundo = os.path.join(pasta, f"{pid}-fundo.mp4")
    montar_fundo(video, de, ate, dur, fundo)

    rot = {"lado": "esquerda", "duracao": dur, "falas": falas}
    chamada = next((f for f in falas if re.search(r"coment", f["texto"], re.I)), None)
    if chamada: rot["selo"] = {"de": chamada["de"], "texto": "💬 COMENTA QUERO", "sub": f"ou entra no {SITE}"}
    rot_path = os.path.join(pasta, f"{pid}-roteiro.json")
    json.dump(rot, open(rot_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    reel = os.path.join(pasta, f"{pid}-reel.mp4")
    subprocess.run([sys.executable, os.path.join(AQUI, "render.py"), "cabeca-review.html", reel,
                    "--fundo", fundo, "--audio", voz, "--roteiro", rot_path], check=True, cwd=AQUI)
    os.remove(fundo)

    titulo = pedido.get("titulo") or falas[0]["texto"]
    capa_t = pedido.get("capa_t")
    capa_t = float(capa_t) if capa_t not in (None, "") else de + 0.6 * (ate - de)
    capa = os.path.join(pasta, f"{pid}-capa.jpg")
    args = [sys.executable, os.path.join(AQUI, "capa.py"), capa, "--video", video, "--t", f"{capa_t:.2f}",
            "--titulo", titulo, "--faixa", pedido.get("faixa") or "🐾 A YANG FAREJOU"]
    if pedido.get("balao"): args += ["--balao", pedido["balao"]]
    subprocess.run(args, check=True, cwd=AQUI)
    oferta = {}
    try:
        slug = (pedido.get("slug") or "").strip()
        if slug:
            ofertas = json.load(open(os.path.join(AQUI, "..", "ofertas.json"), encoding="utf-8"))
            oferta = next((o for o in ofertas if o.get("slug") == slug), {})
    except Exception:
        pass
    open(os.path.join(pasta, f"{pid}-legenda.txt"), "w", encoding="utf-8").write(legenda_post(frases, oferta))
    log(f"pronto: {os.path.basename(reel)} ({dur:.1f}s) e {os.path.basename(capa)}")
    open(os.path.join(pasta, f"{pid}-log.txt"), "w", encoding="utf-8").write("\n".join(LOG) + "\n")

if __name__ == "__main__":
    main()
