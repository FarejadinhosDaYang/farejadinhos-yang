"""Encaixa o texto da narração nas falas do áudio do ElevenLabs e gera o roteiro.json.

Uso:
  python3 pausas.py voz.mp3 falas.txt [roteiro.json] [--selo "💬 COMENTA QUERO"] [--lado esquerda|direita]

falas.txt: uma frase por linha, exatamente como a Yang fala (pode ter emoji no fim, vai pra legenda).
- Detecta os trechos de fala separados por pausas no áudio.
- Se houver mais trechos que frases, junta os trechos separados pelas pausas mais curtas.
- Mostra a tabela (tempo, duração, sílabas estimadas x sílabas da frase) pra conferir.
- O selo aparece junto da última frase (normalmente o "comenta QUERO").
"""
import json, re, subprocess, sys
import numpy as np  # noqa

args = [a for a in sys.argv[1:]]
def flag(nome, padrao=None):
    if nome in args:
        i = args.index(nome); v = args[i + 1]; del args[i:i + 2]; return v
    return padrao
selo = flag("--selo", "💬 COMENTA QUERO")
lado = flag("--lado", "esquerda")
voz, falas_txt = args[0], args[1]
saida = args[2] if len(args) > 2 else "roteiro.json"
falas = [l.strip() for l in open(falas_txt, encoding="utf-8") if l.strip()]

# pausas detectadas pelo ffmpeg (silêncio abaixo de -35 dB por 0,15 s ou mais)
log = subprocess.run(["ffmpeg", "-i", voz, "-af", "silencedetect=noise=-35dB:d=0.15", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
dur = float(re.search(r"Duration: (\d+):(\d+):([\d.]+)", log).groups()[2]) + \
      60 * float(re.search(r"Duration: (\d+):(\d+)", log).groups()[1])
ini = [float(v) for v in re.findall(r"silence_start: ([\d.]+)", log)]
fim = [float(v) for v in re.findall(r"silence_end: ([\d.]+)", log)]
trechos, t = [], 0.0
for a_, b_ in zip(ini, fim + [dur] * (len(ini) - len(fim))):
    if a_ - t > 0.01: trechos.append([t, a_])
    t = b_
if dur - t > 0.05: trechos.append([t, dur])
# início real da fala (pula o silêncio inicial curto)
if trechos and trechos[0][0] == 0: trechos[0][0] = 0.05
# trechos minúsculos (< 0,15 s) são respiração/ruído: junta com o vizinho mais próximo
k = 0
while k < len(trechos):
    a_, b_ = trechos[k]
    if b_ - a_ < 0.15 and len(trechos) > 1:
        if k > 0: trechos[k - 1][1] = b_
        else: trechos[k + 1][0] = a_
        del trechos[k]
    else: k += 1

def silabas(t):
    t = re.sub(r"[^a-záéíóúâêôãõàüç ]", " ", t.lower())
    return len(re.findall(r"[aeiouáéíóúâêôãõàü]+", t))

while len(trechos) > len(falas) and len(trechos) > 1:   # junta pelas menores pausas
    gaps = [trechos[k + 1][0] - trechos[k][1] for k in range(len(trechos) - 1)]
    k = int(np.argmin(gaps)); trechos[k][1] = trechos[k + 1][1]; del trechos[k + 1]

if len(trechos) != len(falas):
    print(f"ATENÇÃO: o áudio tem {len(trechos)} trechos e o texto tem {len(falas)} frases.")
    print("Divida o texto em mais linhas (onde a voz faz pausa) ou junte linhas, e rode de novo.")
    for a, b in trechos: print(f"  {a:6.2f} – {b:6.2f}  ({b - a:.2f}s)")
    sys.exit(1)

print(f"{'início':>7} {'fim':>7} {'dur':>5} {'síl/s':>6}  frase")
for (a, b), f in zip(trechos, falas):
    print(f"{a:7.2f} {b:7.2f} {b - a:5.2f} {silabas(f) / max(b - a, .1):6.1f}  {f}")
print("(síl/s muito fora de 4–8 indica frase no trecho errado)")

rot = {"lado": lado, "duracao": round(dur + 0.7, 2),
       "falas": [{"de": round(a, 2), "ate": round(b, 2), "texto": f} for (a, b), f in zip(trechos, falas)]}
if selo: rot["selo"] = {"de": rot["falas"][-1]["de"], "texto": selo}
json.dump(rot, open(saida, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("salvo:", saida)
