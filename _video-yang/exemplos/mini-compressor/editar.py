"""Fundo do Reel do compressor, com cada corte encaixado na fala da Yang."""
import subprocess
R2 = "fonte2.mp4"; R3 = "fonte1.mp4"   # vídeos de origem (não ficam no repositório)
# (arquivo, início, fim, velocidade)  -> encaixe na fala
CLIPES = [
    (R3, 0.00, 1.10, 1),   # 0.00  "Olha o que cabe..."      produto na mão
    (R3, 2.00, 3.21, 1),   # 1.10  "...no seu carro!"         no console do carro
    (R3, 3.50, 4.30, 1),   # 2.31  "É só encaixar..."         carregando
    (R3, 4.40, 5.89, 1),   # 3.11  "...no bico do pneu"       encaixando na roda
    (R2, 5.15, 7.10, 1),   # 4.60  "escolher a pressão no visor"
    (R2, 7.10, 8.25, 1),   # 6.55  "e pronto,"                visor chegando na pressão
    (R2, 9.95, 12.24, 1),  # 7.70  "ele enche sozinho em poucos minutos"  carro e bike com o tempo
    (R3, 6.50, 7.11, 1),   # 9.99  "Serve pra carro,"
    (R3, 8.40, 9.40, 1),   # 10.60 "moto,"
    (R3, 15.40, 16.66, 1), # 11.60 "bola…"
    (R3, 19.00, 20.22, 1), # 12.86 "e até bicicleta!"
    (R3, 24.40, 26.03, 1), # 14.08 "E ainda tem lanterna!"
    (R2, 12.25, 13.35, 1), # 15.71 "O preço tá baixinho lá no site…"
    (R3, 0.00, 1.55, 0.5), # 16.81 "comenta QUERO..."  produto na mão em câmera lenta
]
DUR = 21.0
FILL = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1"
partes, filt = [], []
for i, (arq, a, b, vel) in enumerate(CLIPES):
    pre = "crop=720:960:0:160," if arq == R3 else ""
    partes += ["-ss", str(a), "-t", str(b - a), "-i", arq]
    filt.append(f"[{i}:v]{pre}{FILL},setpts=(PTS-STARTPTS)/{vel},fps=30[v{i}]")
filt.append("".join(f"[v{i}]" for i in range(len(CLIPES))) + f"concat=n={len(CLIPES)}:v=1:a=0,tpad=stop_mode=clone:stop_duration=3[out]")
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *partes, "-filter_complex", ";".join(filt), "-map", "[out]",
                "-t", str(DUR), "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "fundo.mp4"], check=True)
t = 0
for arq, a, b, vel in CLIPES: print(f"{t:6.2f}", end=" "); t += (b - a) / vel
print("\nfim", round(t, 2))
