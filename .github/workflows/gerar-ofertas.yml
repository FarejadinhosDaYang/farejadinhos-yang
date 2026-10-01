# ==========================================
# GERAR LOTE DE OFERTAS
#
# Recebe um arquivo JSON (uma lista de produtos, vindo da planilha
# que o usuário sobe no painel) e gera uma oferta pra cada item,
# reaproveitando o mesmo gerador de sempre (gerar-oferta.ps1).
#
# Cada item do JSON tem este formato:
# {
#   "produto": "...", "preco": "...", "precoAntigo": "...",
#   "cupom": "...", "categoria": "...", "destaque": true/false,
#   "link": "...", "imagemUrl": "https://..."
# }
#
# Diferente do fluxo de oferta única, aqui a imagem vem de um LINK
# (não de um arquivo enviado), e as ofertas não aparecem todas de
# uma vez: a liberação é espalhada ao longo das próximas horas, pra
# não lançar tudo de uma hora só. Quem cuida de esconder/mostrar de
# acordo com o horário é o próprio index.html (campo "liberacao").
#
# Se um item falhar (link de imagem quebrado, preço inválido, etc.),
# o lote não para: esse item é pulado e os outros continuam normais.
# ==========================================

param(
    [Parameter(Mandatory=$true)]
    [string]$ArquivoLote
)

$ErrorActionPreference = "Stop"

[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Gerador = Split-Path -Parent $MyInvocation.MyCommand.Path
$Site = Split-Path -Parent $Gerador
$OfertasJsonPath = Join-Path $Site "ofertas.json"
$ScriptGerarOferta = Join-Path $Gerador "gerar-oferta.ps1"

# Pasta temporária pra baixar as imagens do lote. Usa o TEMP do
# runner quando existir (GitHub Actions), ou o TEMP padrão do SO
# como alternativa (pra permitir testar isso fora do Actions também).
$PastaTemp = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [System.IO.Path]::GetTempPath() }


# ==========================================
# LER O LOTE
# ==========================================

$CaminhoAbs = $ArquivoLote.Trim().Trim('"')

if (-not [System.IO.Path]::IsPathRooted($CaminhoAbs)) {
    $CaminhoAbs = Join-Path (Get-Location) $CaminhoAbs
}

if (-not (Test-Path -LiteralPath $CaminhoAbs)) {
    throw "Arquivo de lote nao encontrado: $CaminhoAbs"
}

$TextoLote = Get-Content -LiteralPath $CaminhoAbs -Raw -Encoding UTF8
$Itens = @($TextoLote | ConvertFrom-Json)

if ($Itens.Count -eq 0) {
    Write-Host "Lote vazio, nada a fazer."
    exit 0
}


# ==========================================
# SLUGS JÁ EXISTENTES (evitar colisao)
# ==========================================

$SlugsUsados = @{}

if (Test-Path -LiteralPath $OfertasJsonPath) {
    $CatalogoTexto = Get-Content -LiteralPath $OfertasJsonPath -Raw -Encoding UTF8
    if (-not [string]::IsNullOrWhiteSpace($CatalogoTexto)) {
        $CatalogoAtual = @($CatalogoTexto | ConvertFrom-Json)
        foreach ($C in $CatalogoAtual) {
            if ($C -and $C.slug) {
                $SlugsUsados[[string]$C.slug] = $true
            }
        }
    }
}

function GerarSlugBase([string]$Produto) {

    $Normalizado = $Produto.ToLowerInvariant().Normalize([System.Text.NormalizationForm]::FormD)

    $SemAcentos = -join ($Normalizado.ToCharArray() | Where-Object {
        [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne
            [Globalization.UnicodeCategory]::NonSpacingMark
    })

    $S = $SemAcentos -replace '[^a-z0-9]+', '-'
    $S = $S.Trim('-')

    if ($S.Length -gt 60) {
        $S = $S.Substring(0, 60) -replace '-+[^-]*$', ''
        $S = $S.Trim('-')
    }

    if ([string]::IsNullOrWhiteSpace($S)) {
        $S = "oferta"
    }

    return $S
}

function SlugUnico([string]$Base) {

    $Candidato = $Base
    $N = 2

    while ($SlugsUsados.ContainsKey($Candidato)) {
        $Candidato = "$Base-$N"
        $N++
    }

    $SlugsUsados[$Candidato] = $true
    return $Candidato
}


# ==========================================
# DISTRIBUIR HORARIOS DE LIBERACAO
#
# A primeira oferta do lote libera na hora (assim que o workflow
# termina). As demais vao sendo espalhadas nas proximas
# $JanelaHoras horas, em intervalos iguais. Nao precisa ser um
# agendamento exato — so precisa evitar que tudo apareca de uma
# vez so.
# ==========================================

$JanelaHoras = 10
$Agora = (Get-Date).ToUniversalTime()
$Total = $Itens.Count

$Sucessos = 0
$Falhas = @()

for ($i = 0; $i -lt $Total; $i++) {

    $Item = $Itens[$i]
    $NomeParaLog = if ($Item.produto) { $Item.produto } else { "(sem nome)" }

    try {

        if (-not $Item.produto -or [string]::IsNullOrWhiteSpace([string]$Item.produto)) {
            throw "produto ausente"
        }
        if (-not $Item.preco -or [string]::IsNullOrWhiteSpace([string]$Item.preco)) {
            throw "preco ausente"
        }
        if (-not $Item.link -or [string]::IsNullOrWhiteSpace([string]$Item.link)) {
            throw "link ausente"
        }
        if (-not $Item.imagemUrl -or [string]::IsNullOrWhiteSpace([string]$Item.imagemUrl)) {
            throw "imagemUrl ausente"
        }

        $SlugBase = GerarSlugBase ([string]$Item.produto)
        $Slug = SlugUnico $SlugBase

        # ---- baixar a imagem a partir do link ----

        $ImagemUrl = [string]$Item.imagemUrl
        $Extensao = ".jpg"

        if ($ImagemUrl -match '\.(png|jpe?g|webp|gif)(\?|#|$)') {
            $Extensao = "." + $Matches[1].ToLower()
            if ($Extensao -eq ".jpeg") { $Extensao = ".jpg" }
        }

        $ImagemTemp = Join-Path $PastaTemp "$([guid]::NewGuid().ToString())$Extensao"

        Invoke-WebRequest `
            -Uri $ImagemUrl `
            -OutFile $ImagemTemp `
            -UserAgent "Mozilla/5.0 (compatible; FarejadinhosBot/1.0)" `
            -TimeoutSec 30 `
            -MaximumRedirection 5

        if (-not (Test-Path -LiteralPath $ImagemTemp) -or (Get-Item -LiteralPath $ImagemTemp).Length -eq 0) {
            throw "download da imagem resultou em arquivo vazio"
        }

        # ---- horario de liberacao deste item ----

        if ($Total -gt 1) {
            $OffsetHoras = ($JanelaHoras / [double]($Total - 1)) * $i
        } else {
            $OffsetHoras = 0
        }

        $Liberacao = $Agora.AddHours($OffsetHoras).ToString("yyyy-MM-ddTHH:mm:ssZ")

        $Params = @{
            Produto     = [string]$Item.produto
            Preco       = [string]$Item.preco
            PrecoAntigo = if ($Item.precoAntigo) { [string]$Item.precoAntigo } else { "" }
            Cupom       = if ($Item.cupom) { [string]$Item.cupom } else { "" }
            Categoria   = if ($Item.categoria) { [string]$Item.categoria } else { "" }
            Destaque    = if ($Item.destaque -eq $true) { "true" } else { "false" }
            Link        = [string]$Item.link
            Imagem      = $ImagemTemp
            Slug        = $Slug
            Liberacao   = $Liberacao
        }

        & $ScriptGerarOferta @Params

        Remove-Item -LiteralPath $ImagemTemp -Force -ErrorAction SilentlyContinue

        Write-Host "OK: $NomeParaLog -> slug '$Slug', libera em $Liberacao"
        $Sucessos++
    }
    catch {
        $Falhas += "'$NomeParaLog': $($_.Exception.Message)"
        Write-Warning "Falhou '$NomeParaLog': $($_.Exception.Message)"

        if ($ImagemTemp -and (Test-Path -LiteralPath $ImagemTemp)) {
            Remove-Item -LiteralPath $ImagemTemp -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host ""
Write-Host "=========================================="
Write-Host " LOTE PROCESSADO: $Sucessos de $Total oferta(s) criada(s)"
Write-Host "=========================================="

if ($Falhas.Count -gt 0) {
    Write-Host ""
    Write-Warning "Itens que falharam:"
    foreach ($F in $Falhas) {
        Write-Warning " - $F"
    }
}

# Remove o arquivo de lote consumido (igual a imagem temporaria
# no fluxo de oferta unica).
Remove-Item -LiteralPath $CaminhoAbs -Force -ErrorAction SilentlyContinue
