# ==========================================
# CONFERIR PREÇOS (roda sozinho de hora em hora)
#
# Pra cada oferta que está no ar ou na fila, pede pro Worker o preço
# atual da loja — a MESMA busca do botão "Buscar dados automaticamente"
# do painel (rota /produto) — e, se o preço mudou, atualiza a oferta
# (catálogo + página) reaproveitando o modo "precos" do gerar-lote.ps1.
#
# Precisa do segredo PAINEL_SENHA no GitHub (a mesma senha do painel).
# Oferta em que o Worker não acha preço fica como está.
# ==========================================

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$WORKER_URL = "https://holy-pine-e7fc.bernard-shimizu.workers.dev"
$Senha = $env:PAINEL_SENHA
if ([string]::IsNullOrWhiteSpace($Senha)) {
    Write-Warning "Segredo PAINEL_SENHA nao configurado no GitHub. Nada a fazer."
    exit 0
}

$Gerador = Split-Path -Parent $MyInvocation.MyCommand.Path
$Site = Split-Path -Parent $Gerador
$OfertasJsonPath = Join-Path $Site "ofertas.json"
$CulturaBR = [System.Globalization.CultureInfo]::GetCultureInfo("pt-BR")

function ParaDataUtc($Valor) {
    if ($null -eq $Valor -or [string]::IsNullOrWhiteSpace([string]$Valor)) { return $null }
    if ($Valor -is [DateTimeOffset]) { return $Valor.ToUniversalTime() }
    if ($Valor -is [DateTime]) { return [DateTimeOffset]::new($Valor.ToUniversalTime()) }
    try { return [DateTimeOffset]::Parse([string]$Valor, [Globalization.CultureInfo]::InvariantCulture).ToUniversalTime() } catch { return $null }
}

function NumeroBR([string]$V) {
    $V = ($V -replace 'R\$', '' -replace '\s', '').Trim()
    if (-not $V) { return $null }
    if ($V -notmatch ',') { $V = $V -replace '\.', ',' }
    try { return [decimal]::Parse($V, $CulturaBR) } catch { return $null }
}

$Catalogo = @((Get-Content -LiteralPath $OfertasJsonPath -Raw -Encoding UTF8) | ConvertFrom-Json)
$Agora = [DateTimeOffset]::UtcNow

# Confere o que está no ar ou na fila (até 7 dias pra trás — as que
# seguram categoria sem fila também entram; o resto já saiu do site)
$Alvo = @($Catalogo | Where-Object {
    $_ -and $_.slug -and $_.link -and ([string]$_.link -match '^https?://') -and (
        -not (ParaDataUtc ($(if ($_.liberacao) { $_.liberacao } else { $_.data }))) -or
        ($Agora - (ParaDataUtc ($(if ($_.liberacao) { $_.liberacao } else { $_.data })))).TotalDays -le 7
    )
})

Write-Host "Conferindo o preco de $($Alvo.Count) oferta(s)..."

$Mudancas = @()
$SemPreco = 0
$Iguais = 0
$Erros = 0

foreach ($O in $Alvo) {
    try {
        $Form = @{ senha = $Senha; link = [string]$O.link }
        $Resp = Invoke-RestMethod -Uri "$WORKER_URL/produto" -Method Post -Form $Form -TimeoutSec 40
        $Novo = if ($Resp.preco) { [string]$Resp.preco } else { "" }
        $NNovo = NumeroBR $Novo
        $NAtual = NumeroBR ([string]$O.preco)

        if (-not $NNovo -or $NNovo -le 0) {
            $SemPreco++
            $Motivo = if ($Resp.tentativas) { ($Resp.tentativas -join " | ") } else { "" }
            Write-Host "  sem preco: $($O.slug) $Motivo"
        }
        elseif ($NAtual -and [Math]::Abs($NNovo - $NAtual) -lt 0.01) {
            $Iguais++
        }
        else {
            Write-Host "  MUDOU: $($O.slug): $($O.preco) -> $Novo"
            $Mudancas += [ordered]@{
                acao        = "precos"
                slug        = [string]$O.slug
                preco       = $Novo
                precoAntigo = if ($Resp.precoAntigo) { [string]$Resp.precoAntigo } else { "" }
            }
        }
    }
    catch {
        $Erros++
        $Msg = $_.Exception.Message
        if ($Msg -match '401') {
            Write-Warning "Senha recusada pelo Worker: confira o segredo PAINEL_SENHA no GitHub."
            exit 1
        }
        Write-Host "  erro: $($O.slug): $Msg"
    }
    Start-Sleep -Milliseconds 400   # sem pressa, pra loja não bloquear
}

Write-Host ""
Write-Host "Resumo: $($Mudancas.Count) mudaram, $Iguais iguais, $SemPreco sem preco, $Erros erro(s)."

if ($Mudancas.Count -eq 0) { exit 0 }

$Temp = Join-Path ([System.IO.Path]::GetTempPath()) "precos-$([guid]::NewGuid()).json"
[System.IO.File]::WriteAllText($Temp, ($Mudancas | ConvertTo-Json -Depth 3 -AsArray), (New-Object System.Text.UTF8Encoding($false)))
& (Join-Path $Gerador "gerar-lote.ps1") -ArquivoLote $Temp
