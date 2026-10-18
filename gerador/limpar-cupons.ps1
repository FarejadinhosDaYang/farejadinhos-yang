# ==========================================
# LIMPAR CUPONS (roda sozinho todo dia, logo depois da meia-noite)
#
# Os cupons sao do dia: virou o dia, todo cupom que estava nas ofertas
# (no ar ou na fila) sai - do ofertas.json e do quadrinho de cupom da
# pagina de cada oferta. Os cupons novos entram de novo pelo painel do
# lote ("cupons do dia") ou na edicao da oferta.
#
# Reaproveita o modo "cupons" do gerar-lote.ps1 com cupom vazio.
# ==========================================

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Gerador = Split-Path -Parent $MyInvocation.MyCommand.Path
$Site = Split-Path -Parent $Gerador
$OfertasJsonPath = Join-Path $Site "ofertas.json"

$Catalogo = @((Get-Content -LiteralPath $OfertasJsonPath -Raw -Encoding UTF8) | ConvertFrom-Json)

$Itens = @()
foreach ($O in $Catalogo) {
    if (-not $O -or -not $O.slug) { continue }
    if (-not $O.PSObject.Properties["cupom"]) { continue }
    if ([string]::IsNullOrWhiteSpace([string]$O.cupom)) { continue }
    $Itens += [ordered]@{ acao = "cupons"; slug = [string]$O.slug; cupom = "" }
}

Write-Host "Ofertas com cupom antigo: $($Itens.Count)"

# Paginas de ofertas que ja sairam do catalogo (o link continua abrindo):
# tira o quadrinho de cupom delas tambem
$NoCatalogo = @{}
foreach ($It in $Itens) { $NoCatalogo[$It.slug] = $true }
$Pastas = Join-Path $Site "ofertas"
foreach ($Pagina in @(Get-ChildItem -LiteralPath $Pastas -Filter "index.html" -Recurse -File)) {
    $SlugPag = Split-Path -Leaf (Split-Path -Parent $Pagina.FullName)
    if ($NoCatalogo.ContainsKey($SlugPag)) { continue }
    $Html = [System.IO.File]::ReadAllText($Pagina.FullName, [System.Text.Encoding]::UTF8)
    if ($Html -match '<div class="coupon">') {
        $Html = [regex]::Replace($Html, '<div class="coupon">.*?</div>', '', 1)
        [System.IO.File]::WriteAllText($Pagina.FullName, $Html, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "Cupom tirado da pagina antiga: $SlugPag"
    }
}

if ($Itens.Count -eq 0) { exit 0 }

$Temp = Join-Path ([System.IO.Path]::GetTempPath()) "cupons-$([guid]::NewGuid()).json"
[System.IO.File]::WriteAllText($Temp, ($Itens | ConvertTo-Json -Depth 3 -AsArray), (New-Object System.Text.UTF8Encoding($false)))
& (Join-Path $Gerador "gerar-lote.ps1") -ArquivoLote $Temp
