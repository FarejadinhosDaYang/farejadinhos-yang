"""Reel do cortador: cada corte encaixado na fala da Yang (sem o som original)."""
import subprocess
V = "fonte.mp4"   # vídeo de origem (não fica no repositório)
CLIPES = [  # (início, fim, velocidade)  -> fala
    (1.00, 2.81, 1),    # 0.00  "Olha como esse cortador"
    (2.81, 5.02, 1),    # 1.81  "pica tudo numa apertada só!"
    (7.90, 10.32, 1),   # 4.02  "Pepino, maçã…"
    (10.32, 12.35, 1),  # 6.44  "sai tudo em cubinho igualzinho"
    (12.47, 14.16, 0.55),  # 8.47 "E já cai direto no potinho, sem sujar a pia"
    (15.00, 17.03, 1),  # 11.55 "Aí é só trocar a lâmina…"
    (19.50, 20.30, 1),  # 13.58 "pra fazer rodelinha…"
    (25.00, 25.67, 1),  #        (rodelas vistas de cima)
    (29.50, 31.60, 1),  # 15.05 "ou até batata ondulada,"
    (35.90, 37.20, 1),  #        "igual de restaurante!"
    (32.60, 35.80, 1),  # 18.45 "Tá baratinho lá no site… comenta QUERO…"
]
DUR = 22.9
FILL = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1"
partes, filt = [], []
for i, (a, b, vel) in enumerate(CLIPES):
    partes += ["-ss", str(a), "-t", str(b - a), "-i", V]
    filt.append(f"[{i}:v]{FILL},setpts=(PTS-STARTPTS)/{vel},fps=30[v{i}]")
filt.append("".join(f"[v{i}]" for i in range(len(CLIPES))) + f"concat=n={len(CLIPES)}:v=1:a=0,tpad=stop_mode=clone:stop_duration=3[out]")
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *partes, "-filter_complex", ";".join(filt), "-map", "[out]",
                "-t", str(DUR), "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "fundo.mp4"], check=True)
t = 0
for a, b, vel in CLIPES: print(f"{t:6.2f}", end=" "); t += (b - a) / vel
print("\nfim", round(t, 2))
