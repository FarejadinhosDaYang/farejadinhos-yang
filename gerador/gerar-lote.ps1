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

# Modo "reorganizar": nenhum produto novo, só remistura a fila
$SoReorganizar = ($Itens.Count -gt 0) -and $Itens[0].PSObject.Properties["acao"] -and ([string]$Itens[0].acao -eq "reorganizar")
if ($SoReorganizar) { $Itens = @() }

if ($Itens.Count -eq 0 -and -not $SoReorganizar) {
    Write-Host "Lote vazio, nada a fazer."
    exit 0
}


# ==========================================
# MODO "ATUALIZAR PREÇOS" (vem do painel do lote)
#
# A planilha nova (ex.: exportação da Shopee) traz o preço de hoje de
# produtos que já estão no site: [{ "acao": "precos", "slug": "...",
# "preco": "...", "precoAntigo": "..." }]. Atualiza o ofertas.json e a
# página da oferta (preço, preço antigo e "preço conferido em").
# ==========================================

if ($Itens.Count -gt 0 -and $Itens[0].PSObject.Properties["acao"] -and [string]$Itens[0].acao -eq "precos") {

    $CulturaBR = [System.Globalization.CultureInfo]::GetCultureInfo("pt-BR")
    function FormatarBR([string]$V) {
        $V = ($V -replace 'R\$', '').Trim()
        if ($V -notmatch ',') { $V = $V -replace '\.', ',' }
        return ([decimal]::Parse($V, $CulturaBR)).ToString("C2", $CulturaBR)
    }
    function Enc([string]$T) { return [System.Net.WebUtility]::HtmlEncode($T) }

    $Catalogo = @((Get-Content -LiteralPath $OfertasJsonPath -Raw -Encoding UTF8) | ConvertFrom-Json)
    $PorSlug = @{}
    foreach ($O in $Catalogo) { if ($O -and $O.slug) { $PorSlug[[string]$O.slug] = $O } }
    $Hoje = (Get-Date).ToUniversalTime().AddHours(-3).ToString("dd/MM/yyyy")
    $Feitos = 0

    foreach ($It in $Itens) {
        $Slug = [string]$It.slug
        if (-not $PorSlug.ContainsKey($Slug)) { Write-Warning "Oferta nao encontrada: $Slug"; continue }
        try {
            $Novo = FormatarBR ([string]$It.preco)
            $Antigo = if ($It.precoAntigo -and ([string]$It.precoAntigo).Trim()) { FormatarBR ([string]$It.precoAntigo) } else { "" }
        } catch { Write-Warning "Preco invalido para ${Slug}: $($It.preco)"; continue }

        $O = $PorSlug[$Slug]
        $O.preco = $Novo
        if ($Antigo) {
            if ($O.PSObject.Properties["precoAntigo"]) { $O.precoAntigo = $Antigo } else { $O | Add-Member -NotePropertyName precoAntigo -NotePropertyValue $Antigo }
        }
        if ($O.PSObject.Properties["precoAVista"] -and $O.precoAVista) { $O.precoAVista = $Novo }
        $Conferido = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        $O | Add-Member -NotePropertyName precoConferido -NotePropertyValue $Conferido -Force

        $Pagina = Join-Path $Site (Join-Path "ofertas" (Join-Path $Slug "index.html"))
        if (Test-Path -LiteralPath $Pagina) {
            $Html = [System.IO.File]::ReadAllText($Pagina, [System.Text.Encoding]::UTF8)
            $Html = [regex]::Replace($Html, '(<div class="price">\s*)[^<]*?(\s*</div>)', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $m.Groups[1].Value + (Enc $Novo) + $m.Groups[2].Value }, 1)
            if ($Antigo) {
                $Html = [regex]::Replace($Html, '<div class="old">[^<]*</div>', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) '<div class="old">' + (Enc $Antigo) + '</div>' }, 1)
            }
            $Html = [regex]::Replace($Html, 'Pre(ç|&ccedil;)o conferido (em [0-9/]+|na publica(ç|&ccedil;)(ã|&atilde;)o da oferta)', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) "Pre&ccedil;o conferido em $Hoje" }, 1)
            [System.IO.File]::WriteAllText($Pagina, $Html, (New-Object System.Text.UTF8Encoding($false)))
        }
        $Feitos++
        Write-Host "Preco: $Slug -> $Novo"
    }

    $Json = $Catalogo | ConvertTo-Json -Depth 5 -AsArray
    [System.IO.File]::WriteAllText($OfertasJsonPath, $Json, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Precos atualizados em $Feitos oferta(s)."
    Remove-Item -LiteralPath $CaminhoAbs -Force -ErrorAction SilentlyContinue
    exit 0
}

# ==========================================
# MODO "APLICAR CUPONS" (vem do painel do lote)
#
# Em vez de produtos novos, o lote pode trazer só cupons pra ofertas
# que já existem: [{ "acao": "cupons", "slug": "...", "cupom": "..." }].
# Atualiza o ofertas.json e o quadrinho de cupom da página da oferta,
# sem regerar nada nem mexer nos horários.
# ==========================================

if ($Itens.Count -gt 0 -and $Itens[0].PSObject.Properties["acao"] -and [string]$Itens[0].acao -eq "cupons") {

    $Catalogo = @((Get-Content -LiteralPath $OfertasJsonPath -Raw -Encoding UTF8) | ConvertFrom-Json)
    $PorSlug = @{}
    foreach ($O in $Catalogo) { if ($O -and $O.slug) { $PorSlug[[string]$O.slug] = $O } }

    $Tag = [char]::ConvertFromUtf32(0x1F3F7)
    $Feitos = 0

    foreach ($It in $Itens) {
        $Slug = [string]$It.slug
        if (-not $PorSlug.ContainsKey($Slug)) { Write-Warning "Oferta nao encontrada: $Slug"; continue }
        $Cupom = ([string]$It.cupom).Trim()
        if ($Cupom -notmatch '^[A-Za-z0-9_-]{0,30}$') { Write-Warning "Cupom invalido para $Slug"; continue }

        $O = $PorSlug[$Slug]
        if ($O.PSObject.Properties["cupom"]) { $O.cupom = $Cupom } else { $O | Add-Member -NotePropertyName cupom -NotePropertyValue $Cupom }

        $Pagina = Join-Path $Site (Join-Path "ofertas" (Join-Path $Slug "index.html"))
        if (Test-Path -LiteralPath $Pagina) {
            $Html = [System.IO.File]::ReadAllText($Pagina, [System.Text.Encoding]::UTF8)
            $Bloco = if ($Cupom) { '<div class="coupon"><b>' + $Tag + ' CUPOM:</b> ' + $Cupom + '</div>' } else { '' }
            if ($Html -match '<div class="coupon">.*?</div>') {
                $Html = [regex]::Replace($Html, '<div class="coupon">.*?</div>', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $Bloco }, 1)
            } elseif ($Bloco) {
                $Html = [regex]::Replace($Html, '(<div class="price">[\s\S]*?</div>)', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $m.Value + "`n`n" + $Bloco }, 1)
            }
            [System.IO.File]::WriteAllText($Pagina, $Html, (New-Object System.Text.UTF8Encoding($false)))
        }
        $Feitos++
        Write-Host "Cupom: $Slug -> '$Cupom'"
    }

    $Json = $Catalogo | ConvertTo-Json -Depth 5 -AsArray
    [System.IO.File]::WriteAllText($OfertasJsonPath, $Json, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Cupons aplicados em $Feitos oferta(s)."
    Remove-Item -LiteralPath $CaminhoAbs -Force -ErrorAction SilentlyContinue
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
$META_POR_CATEGORIA = 10  # categorias com menos que isso no ar passam na frente da fila
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
# (só pra teste local: FAREJA_AGORA="2026-10-13T12:00:00Z")
if ($env:FAREJA_AGORA) { $Agora = ParaDataUtc $env:FAREJA_AGORA }
$Total = $Itens.Count

# ------------------------------------------
# Agenda escolhida no painel (opcional, vem em cada item):
#   agendaInicio = "AAAA-MM-DD" -> primeiro dia de liberação
#   agendaPorDia = N            -> no máximo N ofertas por dia
# Sem nada disso, segue o jeito antigo (enche hoje e transborda).
# ------------------------------------------
$AgendaInicio = $null
$AgendaPorDia = 0
$PrimeiroItem = if ($Itens.Count -gt 0) { $Itens[0] } else { [pscustomobject]@{} }
if ($PrimeiroItem.PSObject.Properties["agendaInicio"] -and -not [string]::IsNullOrWhiteSpace([string]$PrimeiroItem.agendaInicio)) {
    try {
        $D = [DateTime]::ParseExact(([string]$PrimeiroItem.agendaInicio).Trim(), "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
        $AgendaInicio = [DateTimeOffset]::new($D.Year, $D.Month, $D.Day, $JANELA_INICIO, 0, 0, $FUSO_BRASILIA).ToUniversalTime()
    } catch {
        Write-Host "Data de inicio invalida no lote ('$($PrimeiroItem.agendaInicio)'), ignorando."
    }
}
if ($PrimeiroItem.PSObject.Properties["agendaPorDia"]) {
    $N = 0
    if ([int]::TryParse(([string]$PrimeiroItem.agendaPorDia).Trim(), [ref]$N) -and $N -gt 0) { $AgendaPorDia = $N }
}

$Horarios = @()

# Espalha $Qtd itens por igual entre $De e o fim da janela daquele dia
function EspalharNoDia([DateTimeOffset]$De, [int]$Qtd, [bool]$PularPrimeiro) {
    $Lista = @()
    if ($Qtd -le 0) { return ,$Lista }
    $Min = ((FimDaJanela $De) - $De).TotalMinutes
    $Div = if ($PularPrimeiro) { $Qtd + 1 } else { $Qtd }
    $Passo = [Math]::Max($INTERVALO_MINIMO_MIN, $Min / $Div)
    # nunca passar do fim da janela (aperta o intervalo se precisar)
    $UltimoPasso = if ($PularPrimeiro) { $Qtd } else { $Qtd - 1 }
    if ($UltimoPasso -gt 0 -and $Passo * $UltimoPasso -ge $Min) { $Passo = $Min / $Div }
    $T = $De
    if ($PularPrimeiro) { $T = $T.AddMinutes($Passo) }
    for ($k = 0; $k -lt $Qtd; $k++) { $Lista += $T; $T = $T.AddMinutes($Passo) }
    return ,$Lista
}

# Quantos cabem entre $De e o fim da janela, respeitando o intervalo mínimo
function CabemNoDia([DateTimeOffset]$De, [bool]$PularPrimeiro) {
    $Min = ((FimDaJanela $De) - $De).TotalMinutes
    $Q = [Math]::Floor($Min / $INTERVALO_MINIMO_MIN)
    if (-not $PularPrimeiro) { $Q += 1 }
    return [int][Math]::Max(0, $Q)
}

# Ofertas que já estão na fila (agendadas pra depois de agora), por dia.
# Entram na conta do limite diário, pra um lote novo não empilhar em cima
# de outro — a fila é uma só.
$PendentesPorDia = @{}
foreach ($O in @($CatalogoAtual)) {
    if (-not $O -or -not $O.slug) { continue }
    $L = ParaDataUtc $O.liberacao
    if ($L -and $L -gt $Agora) {
        $K = $L.ToOffset($FUSO_BRASILIA).ToString("yyyy-MM-dd")
        $PendentesPorDia[$K] = 1 + [int]$PendentesPorDia[$K]
    }
}
function PendentesNoDia([DateTimeOffset]$T) {
    return [int]$PendentesPorDia[$T.ToOffset($FUSO_BRASILIA).ToString("yyyy-MM-dd")]
}

$ModoAgenda = $true   # sem agenda escolhida = começa hoje, o máximo por dia
$ComecaHoje = ($AgendaInicio -eq $null) -or ($AgendaInicio -le (DentroDaJanela $Agora))
if ($AgendaInicio -ne $null) {
    $LocalHoje = $Agora.ToOffset($FUSO_BRASILIA).Date
    $LocalInicio = $AgendaInicio.ToOffset($FUSO_BRASILIA).Date
    $ComecaHoje = ($LocalInicio -le $LocalHoje)
}

if ($ModoAgenda) {

    # ===== agenda (escolhida no painel, ou padrão: hoje, o máximo por dia) =====
    $Falta = $Total
    $NoAr = ContarNoAr $CatalogoAtual $Agora
    $Imediatos = 0

    if ($ComecaHoje) {
        # Hoje: completa o mínimo da vitrine na hora (conta na cota do dia)
        $Imediatos = [Math]::Min($Falta, [Math]::Max(0, $MINIMO_VITRINE - $NoAr))
        if ($AgendaPorDia -gt 0) { $Imediatos = [Math]::Min($Imediatos, $AgendaPorDia) }
        for ($k = 0; $k -lt $Imediatos; $k++) { $Horarios += $Agora }
        $Falta -= $Imediatos

        $De = DentroDaJanela $Agora
        $MesmoDia = ($De.ToOffset($FUSO_BRASILIA).Date -eq $Agora.ToOffset($FUSO_BRASILIA).Date)
        if ($MesmoDia -and $Falta -gt 0) {
            $Pular = ($Imediatos -gt 0) -and ($De -eq $Agora)
            $JaNaFila = PendentesNoDia $De
            $Cota = if ($AgendaPorDia -gt 0) { $AgendaPorDia - $Imediatos - $JaNaFila } else { $Falta }
            $Qtd = [Math]::Max(0, [Math]::Min($Falta, [Math]::Min($Cota, (CabemNoDia $De $Pular) - $JaNaFila)))
            $Horarios += EspalharNoDia $De $Qtd $Pular
            $Falta -= $Qtd
        }
        $Dia = [DateTimeOffset]::new($Agora.ToOffset($FUSO_BRASILIA).Date.AddDays(1).AddHours($JANELA_INICIO), $FUSO_BRASILIA).ToUniversalTime()
    } else {
        $Dia = $AgendaInicio
    }

    $DiasUsados = 0
    while ($Falta -gt 0) {
        $JaNaFila = PendentesNoDia $Dia
        $Cota = if ($AgendaPorDia -gt 0) { $AgendaPorDia - $JaNaFila } else { $Falta }
        $Qtd = [Math]::Max(0, [Math]::Min($Falta, [Math]::Min($Cota, (CabemNoDia $Dia $false) - $JaNaFila)))
        $Horarios += EspalharNoDia $Dia $Qtd $false
        $Falta -= $Qtd
        $Dia = $Dia.AddDays(1)
        $DiasUsados++
        if ($DiasUsados -gt 400) { throw "Agenda longa demais" }
        if ($Qtd -eq 0) { continue }
    }

    if ($Horarios.Count -gt 0) {
    $Ultimo = ($Horarios | Sort-Object | Select-Object -Last 1).ToOffset($FUSO_BRASILIA)
    $TxtInicio = if ($ComecaHoje) { "hoje" } else { $AgendaInicio.ToOffset($FUSO_BRASILIA).ToString("dd/MM") }
    $TxtPorDia = if ($AgendaPorDia -gt 0) { "$AgendaPorDia por dia" } else { "o maximo por dia" }
    Write-Host "Agenda: comecando $TxtInicio, $TxtPorDia, $Imediatos na hora. Ultima sai em $($Ultimo.ToString('dd/MM HH:mm'))."
}
}

$Sucessos = 0
$Falhas = @()
$SlugsDoLote = @{}

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

        $SlugsDoLote[$Slug] = $true
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

# ==========================================
# MESCLAR A FILA (intercalar categorias)
#
# Junta tudo o que ainda vai ser liberado (deste lote e dos anteriores)
# e redistribui: as categorias vão se alternando de forma proporcional
# (ex.: 50 de Natal + 20 de Café -> ~2 de Natal pra cada 1 de Café),
# mantendo os mesmos dias e reespaçando os horários de cada dia por igual
# dentro da janela. O que já foi liberado não é mexido.
# ==========================================

function MesclarFila {
    $Texto = Get-Content -LiteralPath $OfertasJsonPath -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($Texto)) { return }
    $Cat = @($Texto | ConvertFrom-Json)

    # Lote com data de início escolhida: as ofertas dele nunca saem antes disso
    if ($AgendaInicio -ne $null -and -not $ComecaHoje) {
        $Marca = $AgendaInicio.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ssZ", [Globalization.CultureInfo]::InvariantCulture)
        foreach ($O in $Cat) {
            if ($O -and $O.slug -and $SlugsDoLote.ContainsKey([string]$O.slug)) {
                $O | Add-Member -NotePropertyName naoAntes -NotePropertyValue $Marca -Force
            }
        }
    }

    # Também entram as liberadas há pouco (30 min): assim, se uma planilha
    # encheu a vitrine na hora com uma categoria só e logo chega outra,
    # a vitrine também se mistura. Os horários delas continuam "já liberado".
    $Corte = $Agora.AddMinutes(-30)
    $Recentes = @($Cat | Where-Object {
        $_ -and $_.slug -and $_.liberacao -and ((ParaDataUtc $_.liberacao) -ge $Corte) -and ((ParaDataUtc $_.liberacao) -le $Agora)
    })
    $Futuras = @($Cat | Where-Object {
        $_ -and $_.slug -and $_.liberacao -and ((ParaDataUtc $_.liberacao) -gt $Agora)
    } | Sort-Object { (ParaDataUtc $_.liberacao).UtcTicks })
    $Fila = @($Recentes) + @($Futuras)
    if ($Futuras.Count -lt 1 -or $Fila.Count -lt 2) { return }
    $HorariosRecentes = @($Recentes | ForEach-Object { ParaDataUtc $_.liberacao } | Sort-Object { $_.UtcTicks })

    # Quantas por dia (os dias continuam os mesmos)
    $PorDia = [ordered]@{}
    foreach ($O in $Futuras) {
        $K = (ParaDataUtc $O.liberacao).ToOffset($FUSO_BRASILIA).ToString("yyyy-MM-dd")
        $PorDia[$K] = 1 + [int]$PorDia[$K]
    }

    # Ordem intercalada: cada item ganha uma "posição ideal" dentro da
    # própria categoria ((i+0.5)/total) e a fila é ordenada por ela.
    $Grupos = @{}
    foreach ($O in $Fila) {
        $C = if ($O.categoria) { [string]$O.categoria } else { "-" }
        if (-not $Grupos.ContainsKey($C)) { $Grupos[$C] = New-Object System.Collections.ArrayList }
        [void]$Grupos[$C].Add($O)
    }
    $Nomes = @($Grupos.Keys | Sort-Object)

    # 1) Categorias fracas no site passam na frente: quem tem menos de
    #    $META_POR_CATEGORIA ofertas no ar (liberadas nas últimas 24h, fora as
    #    que estão sendo remisturadas) recebe primeiro, alternando entre elas
    #    — sempre a que estiver com menos no ar — até chegar na meta ou
    #    acabar o que tem dela na fila.
    $NaFila = @{}; foreach ($O in $Fila) { $NaFila[[string]$O.slug] = $true }
    $NoArPorCat = @{}
    foreach ($O in $Cat) {
        if (-not $O -or -not $O.slug -or $NaFila.ContainsKey([string]$O.slug)) { continue }
        $Ini = ParaDataUtc $O.liberacao; if (-not $Ini) { $Ini = ParaDataUtc $O.data }
        if ($Ini -and $Ini -le $Agora -and ($Agora - $Ini).TotalHours -le $HORAS_FRESCA) {
            $C = if ($O.categoria) { [string]$O.categoria } else { "-" }
            $NoArPorCat[$C] = 1 + [int]$NoArPorCat[$C]
        }
    }
    $Frente = @()
    $Usados = @{}
    $Conta = @{}; foreach ($N in $Nomes) { $Conta[$N] = [int]$NoArPorCat[$N] }
    $Pos = @{}; foreach ($N in $Nomes) { $Pos[$N] = 0 }
    while ($true) {
        $Cands = @($Nomes | Where-Object { $Conta[$_] -lt $META_POR_CATEGORIA -and $Pos[$_] -lt $Grupos[$_].Count })
        if ($Cands.Count -eq 0) { break }
        $N = @($Cands | Sort-Object @{ e = { $Conta[$_] } }, @{ e = { -($Grupos[$_].Count - $Pos[$_]) } }, @{ e = { $_ } })[0]
        $O = $Grupos[$N][$Pos[$N]]
        $Frente += $O; $Usados[[string]$O.slug] = $true
        $Pos[$N]++; $Conta[$N]++
    }

    # 2) O resto: mistura proporcional (cada item ganha uma "posição ideal"
    #    dentro da própria categoria e a fila é ordenada por ela)
    $Resto = @()
    for ($g = 0; $g -lt $Nomes.Count; $g++) {
        $Lista = @($Grupos[$Nomes[$g]] | Where-Object { -not $Usados.ContainsKey([string]$_.slug) })
        for ($i = 0; $i -lt $Lista.Count; $i++) {
            $Resto += [pscustomobject]@{ O = $Lista[$i]; Pos = ($i + 0.5) / $Lista.Count; Desempate = $g }
        }
    }
    $Ordenados = @($Frente) + @($Resto | Sort-Object Pos, Desempate | ForEach-Object { $_.O })

    # Horários novos: as recentes mantêm "já liberado"; o resto se
    # espalha por igual na janela de cada dia
    $Novos = @($HorariosRecentes)
    foreach ($K in $PorDia.Keys) {
        $D = [DateTime]::ParseExact($K, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
        $Ini = [DateTimeOffset]::new($D.Year, $D.Month, $D.Day, $JANELA_INICIO, 0, 0, $FUSO_BRASILIA).ToUniversalTime()
        $Pular = $false
        if ($Ini -lt $Agora) { $Ini = $Agora; $Pular = $true }
        $Novos += EspalharNoDia $Ini ([int]$PorDia[$K]) $Pular
    }

    # Cada horário (em ordem) fica com o próximo item da ordem intercalada
    # que já pode sair nesse horário (respeita o "não antes de").
    $Novos = @($Novos | Sort-Object { $_.UtcTicks })
    $Restam = New-Object System.Collections.ArrayList
    foreach ($O in $Ordenados) { [void]$Restam.Add($O) }
    foreach ($H in $Novos) {
        $Escolhido = $null
        foreach ($O in $Restam) {
            $NA = if ($O.PSObject.Properties["naoAntes"]) { ParaDataUtc $O.naoAntes } else { $null }
            if (-not $NA -or $NA -le $H) { $Escolhido = $O; break }
        }
        if (-not $Escolhido) { $Escolhido = $Restam[0] }   # não deve acontecer: os dias vieram deles
        $Escolhido.liberacao = $H.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ssZ", [Globalization.CultureInfo]::InvariantCulture)
        [void]$Restam.Remove($Escolhido)
    }

    $Json = $Cat | ConvertTo-Json -Depth 5 -AsArray
    [System.IO.File]::WriteAllText($OfertasJsonPath, $Json, (New-Object System.Text.UTF8Encoding($false)))

    $Resumo = ($Grupos.Keys | ForEach-Object { "$_ ($($Grupos[$_].Count))" }) -join ", "
    Write-Host "Fila mesclada: $($Fila.Count) oferta(s) agendada(s), intercalando $Resumo."
}

if ($Sucessos -gt 0 -or $SoReorganizar) {
    try { MesclarFila } catch { Write-Warning "Nao consegui mesclar a fila: $($_.Exception.Message)" }
}

# Remove o arquivo de lote consumido (igual a imagem temporaria
# no fluxo de oferta unica).
Remove-Item -LiteralPath $CaminhoAbs -Force -ErrorAction SilentlyContinue
