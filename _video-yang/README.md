# Kit de vídeos da Yang 🐾

Tudo o que é preciso pra fazer os Reels com a **Yang narrando**: a cabeça dela espiando no canto, com a boca
sincronizada com a voz do ElevenLabs, legenda palavra por palavra e o selo "💬 COMENTA QUERO".

> A pasta começa com `_` de propósito: o GitHub Pages não publica pastas assim, então nada disto aparece no site.

## O que tem aqui

| Arquivo / pasta | Pra que serve |
|---|---|
| `cabeca-review.html` | **Modelo principal.** Cabeça da Yang no canto + legenda + selo, por cima de um vídeo de review |
| `narradora.html` | Yang de corpo inteiro (na caminha) narrando, fundo creme — bom pra vídeos de apresentação |
| `reel.html` | Reel automático de oferta a partir de uma foto (gancho → produto → preço → chamada) |
| `render.py` | Transforma qualquer modelo em MP4 1080×1920 30 fps (lip sync, fundo, fundo verde) |
| `auto_reel.py` | Monta o Reel sozinho (vídeo + voz + texto) — usado pela página do painel "Gerar reel" |
| `marcar-video.py` | Põe a oferta do Reel na categoria Vídeos (não sai mais do ar) |
| `capa.html` / `capa.py` | Capa do Reel (1080×1920) com gancho grande, Yang inteira e selo publi |
| `pausas.py` | Lê a voz do ElevenLabs + o texto e gera o `roteiro.json` com o tempo de cada frase |
| `cabeca/` | As 6 expressões da cabeça (boca fechada/meio/aberta × olhos abertos/piscando) + imagem original |
| `corpo/` | As 6 expressões da Yang de corpo inteiro |
| `fonts/` | Baloo 2, Work Sans, Caveat (fontes da marca, licença OFL) |
| `exemplos/` | Roteiros e scripts de edição dos Reels já feitos (chave com catraca, mini compressor, cortador) |

Precisa de: `python3`, `ffmpeg`, `numpy`, `playwright` com Chromium (já vêm no ambiente do Claude).
Pra regerar as expressões: `opencv-python-headless` e `Pillow`.

## Reel automático (painel → "🎞️ Gerar reel da Yang")

O usuário sobe o vídeo, o MP3 e o texto narrado em `painel/reels.html` → Worker `farejadinhos-reels`
(`cloudflare/reel-worker.js`) guarda na release `reels-entrada` e dispara `gerar-reel.yml` → `auto_reel.py` monta
(frases pelas reticências, tempos por programação dinâmica nas pausas, fundo com pedaço de cada cena, capa) →
release `reels-prontos` + `reels/lista.json` + oferta em Vídeos. Teste local:
`python3 auto_reel.py pedido.json saida/` (formato do pedido no topo do arquivo).
Os cortes escolhidos à mão (passo a passo abaixo) continuam valendo pros vídeos difíceis.

## Passo a passo de um Reel de review

1. **Usuário manda o vídeo do produto.** Tirar uma folha de quadros pra ver o que acontece em cada parte:
   ```bash
   ffprobe -v error -show_entries format=duration:stream=width,height -of compact fonte.mp4
   ffmpeg -i fonte.mp4 -vf "select='gt(scene,0.3)',showinfo" -an -f null - 2>&1 | grep -o "pts_time:[0-9.]*"   # cortes de cena
   ffmpeg -i fonte.mp4 -vf cropdetect=24:2:0 -t 4 -f null - 2>&1 | grep -o "crop=[0-9:]*" | sort | uniq -c   # faixas pretas?
   ```
   Conferir em `ofertas.json` (raiz do repositório) se o produto está no site e **quando entra no ar** (`liberacao`, em UTC).
2. **Escrever o roteiro** (regras abaixo): tabela cena → fala, o texto corrido pra colar no ElevenLabs e a legenda do post.
3. **Usuário gera a voz** e manda o MP3. (O horário no nome do arquivo do ElevenLabs costuma vir alguns minutos
   atrasado — não usar isso pra deduzir qual texto foi gravado.)
4. **Tempos das falas:** salvar o texto falado, uma frase por linha, quebrando onde há "…" / vírgula longa / ponto,
   e rodar:
   ```bash
   python3 pausas.py voz.mp3 falas.txt roteiro.json            # opcional: --selo "..." --lado direita
   ```
   Se o número de trechos não bater com as linhas, ele avisa — ajuste as quebras de linha. A coluna `síl/s`
   fora de 4–8 indica frase no trecho errado.
5. **Editar o vídeo de fundo na fala:** copiar `exemplos/cortador-legumes/editar.py`, e montar a lista
   `CLIPES = (início, fim, velocidade)` de forma que **cada trecho dure exatamente o tempo da frase** que fala
   dele (o início do clipe seguinte = o `de` da próxima fala). Câmera lenta (`velocidade` 0.5) estica um trecho
   curto. `DUR` = `duracao` do roteiro; o último quadro congela até o fim.
   Vídeo quadrado ou com faixa preta: recortar antes (`crop=...`) — o script preenche 1080×1920.
6. **Renderizar:**
   ```bash
   python3 render.py cabeca-review.html reel-produto.mp4 --fundo fundo.mp4 --audio voz.mp3 --roteiro roteiro.json
   ```
   Conferir uns quadros (`ffmpeg -ss T -i reel-produto.mp4 -frames:v 1 q.jpg`) antes de entregar.
7. **Capa** (o Instagram escolhe um quadro qualquer, quase sempre com a Yang cortada). Gerar a capa própria:
   ```bash
   python3 capa.py capa.jpg --video fonte.mp4 --t 7.2 --titulo "Seu cheiro-verde|*nunca mais* murcha" \
       --faixa "🐾 ACHADINHO DA COZINHA" --balao "Olha isso! 😱"
   ```
   Gancho de até ~6 palavras em 2 linhas (`|` quebra linha, `*palavra*` fica amarela); escolher um quadro em que
   o produto aparece inteiro e reconhecível (não close de detalhe). Tudo fica no miolo que aparece na grade do perfil.
   No Instagram: **Editar capa → Adicionar da galeria** e escolher a imagem.
8. **Oferta vira permanente:** todo produto que ganha Reel vai pra categoria **Vídeos** (não expira em 3 dias,
   já que o post fica no perfil pra sempre). Fazer isso assim que o reel ficar pronto:
   ```bash
   python3 _video-yang/marcar-video.py <slug ou pedaço do nome>   # depois commit + push
   ```
9. Entregar o MP4 + a capa + a legenda do post.

Outras opções do `render.py`: `--verde` (Yang em fundo verde pra chroma key no CapCut), `--sons` (efeitos "boing"
do `reel.html`), `--previa` (só 8 quadros PNG pra conferir). Sem `--audio`, a boca segue o texto (ritmo simulado).

## Regras de conteúdo (decididas com o dono da página)

- **Sempre identificar como publicidade** (Conar, desde 01/06/2026: post com link de afiliado é publicidade).
  Os modelos `cabeca-review.html` e `reel.html` já colocam o selo fixo **"publi · link de afiliado"** no alto do
  vídeo — não tirar. Na legenda do post, a 1ª linha termina com **"(publi)"** e no fim vai
  **"📢 publi · este post tem link de afiliado: você paga o mesmo preço e a Yang ganha uma pequena comissão."**

- **Nunca falar preço** no vídeo nem na legenda — o post fica pra sempre e o preço muda. Usar: "o preço tá
  baixinho lá no site", "corre no site que tá com desconto", "a Yang farejou o menor preço".
- **Chamada:** "comenta QUERO que eu te mando o link!" (gera alcance; a DM leva direto à página da oferta) +
  "ou pega no link da bio" na legenda do post. Oferta dura 3 dias no site; se vencer, mandar oferta parecida.
- **Postar só depois que a oferta estiver no ar** no site (ver `liberacao`).
- **Tom do dia a dia**, nada de cara de propaganda de TV/rádio. Frases curtas, com "…" pra pausas.
- **No texto pro ElevenLabs, números por extenso** ("nove pontas"); na legenda, em algarismo.
- Voz usada: ElevenLabs **"Cherry Twinkle – Bubbly and Sweet"**.
- **Sem o som original** do vídeo (a música é colocada no Instagram), a não ser que peçam.
- Yang no **canto esquerdo** (o lado direito do Reels tem os botões de curtir/comentar).
- Movimento **calmo**: só a boca acompanha a fala; a cabeça balança devagar (o usuário não gostou de "pulos").
- Vídeos baixados do Pinterest costumam ser de terceiros — preferir o vídeo da própria página do produto na Shopee.
- Legenda do post: 1ª linha gancho + emoji, 1 parágrafo do que o produto faz, "💬 comenta QUERO que a Yang te manda
  o link / 🐾 ou pega no link da bio", 4–5 hashtags específicas (#achadinhosshopee …).

## Como o lip sync funciona

`render.py` filtra a voz na faixa 200–3500 Hz, mede o volume de cada quadro e converte em 3 posições de boca
(fechada / meio / aberta), com histerese, tempo mínimo de 2 quadros por posição e uma "fechadinha" a cada
5 quadros em vogais longas. A Yang pisca em momentos fixos. Não há transcrição automática (o ambiente não baixa
modelos de reconhecimento de fala), por isso a legenda vem do texto do roteiro, encaixado pelas pausas.

## Regerar as expressões

- `python3 cabeca/gerar_expressoes.py` — usa `cabeca/original.jpg` (ilustração enviada pelo usuário) e
  `cabeca/mask.png` (recorte da cabeça). Gera `cabeca/*.png` e `cabeca/conferir.png`.
- `python3 corpo/gerar_expressoes.py` — usa `yang.png` (a ilustração na caminha, igual a `assets/yang-ilustrada.png`).

Se surgirem versões oficiais das expressões (geradas na mesma ferramenta da arte original: boca fechada,
olhos fechados, surpresa, desconfiada…), basta salvar com os mesmos nomes em `cabeca/`.
