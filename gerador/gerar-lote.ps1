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
# uma vez: o que falta pra vitrine ter 15 ofertas entra na hora, e o
# resto é espalhado entre 8h e 22h (veja "DISTRIBUIR HORARIOS"). Quem cuida de esconder/mostrar de
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
# 1. Enche a vitrine na hora: se o site tem menos de
#    $MINIMO_VITRINE ofertas no ar, as que faltam pra completar
#    entram imediatamente.
# 2. O resto vai sendo liberado aos poucos, SÓ dentro da janela
#    das 8h às 22h (horário de Brasília), em intervalos iguais que
#    ocupam o que sobra da janela de hoje. Se não couber (intervalo
#    mínimo de 30 min), continua no dia seguinte a partir das 8h.
#
# "No ar" segue a mesma regra do site (assets/vitrine.js): liberada
# há até 24h, ou até 72h se precisar completar o mínimo.
# ==========================================

$MINIMO_VITRINE = 15
$HORAS_FRESCA = 24
$HORAS_MAXIMA = 72
$FUSO_BRASILIA = [TimeSpan]::FromHours(-3)   # o Brasil não tem mais horário de verão
$JANELA_INICIO = 8
$JANELA_FIM = 22
$INTERVALO_MINIMO_MIN = 30

function ParaDataUtc($Valor) {
    if ($null -eq $Valor -or [string]::IsNullOrWhiteSpace([string]$Valor)) { return $null }
    if ($Valor -is [DateTimeOffset]) { return $Valor.ToUniversalTime() }
    if ($Valor -is [DateTime]) { return [DateTimeOffset]::new($Valor.ToUniversalTime()) }
    try {
        return [DateTimeOffset]::Parse([string]$Valor, [Globalization.CultureInfo]::InvariantCulture).ToUniversalTime()
    }
    catch {
        return $null
    }
}

function ContarNoAr($Catalogo, [DateTimeOffset]$Momento) {
    $Frescas = 0
    $Reserva = 0
    foreach ($O in @($Catalogo)) {
        if (-not $O -or -not $O.slug) { continue }
        $Inicio = ParaDataUtc $O.liberacao
        if (-not $Inicio) { $Inicio = ParaDataUtc $O.data }
        $Idade = if ($Inicio) { ($Momento - $Inicio).TotalHours } else { 0 }
        if ($Idade -lt 0) { continue }
        if ($Idade -le $HORAS_FRESCA) { $Frescas++ }
        elseif ($Idade -le $HORAS_MAXIMA) { $Reserva++ }
    }
    return $Frescas + [Math]::Min($Reserva, [Math]::Max(0, $MINIMO_VITRINE - $Frescas))
}

# Se $T estiver fora da janela, empurra pro próximo início de janela
function DentroDaJanela([DateTimeOffset]$T) {
    $Local = $T.ToOffset($FUSO_BRASILIA)
    $Inicio = [DateTimeOffset]::new($Local.Year, $Local.Month, $Local.Day, $JANELA_INICIO, 0, 0, $FUSO_BRASILIA)
    $Fim = [DateTimeOffset]::new($Local.Year, $Local.Month, $Local.Day, $JANELA_FIM, 0, 0, $FUSO_BRASILIA)
    if ($Local -lt $Inicio) { return $Inicio.ToUniversalTime() }
    if ($Local -ge $Fim) { return $Inicio.AddDays(1).ToUniversalTime() }
    return $T.ToUniversalTime()
}

function FimDaJanela([DateTimeOffset]$T) {
    $Local = $T.ToOffset($FUSO_BRASILIA)
    return [DateTimeOffset]::new($Local.Year, $Local.Month, $Local.Day, $JANELA_FIM, 0, 0, $FUSO_BRASILIA).ToUniversalTime()
}

$Agora = [DateTimeOffset]::UtcNow
$Total = $Itens.Count

$NoAr = ContarNoAr $CatalogoAtual $Agora
$Imediatos = [Math]::Min($Total, [Math]::Max(0, $MINIMO_VITRINE - $NoAr))
$Restantes = $Total - $Imediatos

$Horarios = @()

for ($k = 0; $k -lt $Imediatos; $k++) {
    $Horarios += $Agora
}

if ($Restantes -gt 0) {

    $T = DentroDaJanela $Agora
    $MinutosNaJanela = ((FimDaJanela $T) - $T).TotalMinutes

    # Se já liberou alguma agora (e estamos dentro da janela), a
    # próxima não sai junto: começa um intervalo depois. Se a janela
    # de hoje já fechou, a primeira sai logo na abertura da próxima.
    $EspacarDoImediato = ($Imediatos -gt 0) -and ($T -eq $Agora)
    $Divisor = if ($EspacarDoImediato) { $Restantes + 1 } else { $Restantes }
    $IntervaloMin = [Math]::Max($INTERVALO_MINIMO_MIN, $MinutosNaJanela / $Divisor)

    if ($EspacarDoImediato) { $T = $T.AddMinutes($IntervaloMin) }

    for ($k = 0; $k -lt $Restantes; $k++) {
        $T = DentroDaJanela $T
        $Horarios += $T
        $T = $T.AddMinutes($IntervaloMin)
    }
}

Write-Host "No ar agora: $NoAr oferta(s). Liberando $Imediatos na hora e $Restantes ao longo da janela das ${JANELA_INICIO}h as ${JANELA_FIM}h."

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

        $Liberacao = $Horarios[$i].UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ssZ", [Globalization.CultureInfo]::InvariantCulture)

        $Params = @{
            Produto     = [string]$Item.produto
            Preco       = [string]$Item.preco
            PrecoAntigo = if ($Item.precoAntigo) { [string]$Item.precoAntigo } else { "" }
            Cupom       = if ($Item.cupom) { [string]$Item.cupom } else { "" }
            Categoria   = if ($Item.categoria) { [string]$Item.categoria } else { "" }
            Destaque    = if ($Item.destaque -eq $true) { "true" } else { "false" }
            PrecoAVista = if ($Item.precoAVista) { [string]$Item.precoAVista } else { "" }
            PrecoAPrazo = if ($Item.precoAPrazo) { [string]$Item.precoAPrazo } else { "" }
            Parcelas    = if ($Item.parcelas) { [string]$Item.parcelas } else { "" }
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
