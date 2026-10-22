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

# Preço de referência de cada link: o último preço posto POR VOCÊ (oferta nova,
# edição ou lote), guardado no histórico de preços. Serve pra barrar leitura
# absurda da loja (ex.: outra variação/kit: R$ 35 -> R$ 338) antes de ela mudar
# o preço do site — e nunca desfazer uma correção feita na mão.
$Referencia = @{}
$HistPath = Join-Path $Site "historico-precos.json"
if (Test-Path -LiteralPath $HistPath) {
    try {
        $Hist = (Get-Content -LiteralPath $HistPath -Raw -Encoding UTF8) | ConvertFrom-Json
        foreach ($Prop in $Hist.produtos.PSObject.Properties) {
            $R = $Prop.Value.referencia
            if (-not $R -or $R.Count -lt 2) { continue }
            foreach ($L in @($Prop.Value.links)) { $Referencia[[string]$L] = [decimal]$R[1] }
        }
    } catch { Write-Warning "Nao consegui ler o historico de precos: $($_.Exception.Message)" }
}
$Agora = [DateTimeOffset]::UtcNow

# Shopee: a página bloqueia robôs, então o preço vem da API oficial de
# afiliados (gerador/shopee_api.py, segredos SHOPEE_APP_ID/SHOPEE_SECRET).
# Lê tudo de uma vez antes do laço; no laço, link da Shopee usa esse
# resultado em vez do Worker. Com SHOPEE_TESTE=true só testa (relatório).
$Shopee = @{}
$ShopeeStatus = $null
if ($true) {
    $TmpShopee = Join-Path ([System.IO.Path]::GetTempPath()) "shopee-$([guid]::NewGuid()).json"
    $ArgsPy = @((Join-Path $Gerador "shopee_api.py"), "lote", $TmpShopee)
    if ($env:SHOPEE_TESTE -eq "true") { $ArgsPy += @("--teste", "--limite", "5") }
    try {
        & python @ArgsPy
        $J = (Get-Content -LiteralPath $TmpShopee -Raw -Encoding UTF8) | ConvertFrom-Json
        foreach ($PropS in $J.PSObject.Properties) {
            if ($PropS.Name -eq "_status") { $ShopeeStatus = $PropS.Value } else { $Shopee[$PropS.Name] = $PropS.Value }
        }
    } catch { Write-Warning "API da Shopee falhou: $($_.Exception.Message)" }
    if ($env:SHOPEE_TESTE -eq "true") { $ShopeeTeste = $Shopee; $Shopee = @{} }
}

# Confere o que está no ar ou na fila (até 7 dias pra trás — as que
# seguram categoria sem fila também entram; o resto já saiu do site)
$Alvo = @($Catalogo | Where-Object {
    $_ -and $_.slug -and $_.link -and ([string]$_.link -match '^https?://') -and (
        (([string]$_.categoria).Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', '').ToLowerInvariant() -match 'videos|celulares' -or
        -not (ParaDataUtc ($(if ($_.liberacao) { $_.liberacao } else { $_.data }))) -or
        ($Agora - (ParaDataUtc ($(if ($_.liberacao) { $_.liberacao } else { $_.data })))).TotalDays -le 7
    )
})

Write-Host "Conferindo o preco de $($Alvo.Count) oferta(s)..."

$Mudancas = @()
$Relatorio = [ordered]@{ mudaram = @(); semPreco = @(); erros = @(); suspeitos = @() }
$SemPreco = 0
$Iguais = 0
$Erros = 0

foreach ($O in $Alvo) {
    try {
        $Form = @{ senha = $Senha; link = [string]$O.link }
        # Mesmo "endereço de origem" que o painel manda (o Worker confere)
        $Cab = @{ Origin = "https://farejadinhosdayang.com.br"; Referer = "https://farejadinhosdayang.com.br/painel/lote.html" }
        if ($Shopee.ContainsKey([string]$O.link)) {
            $RespS = $Shopee[[string]$O.link]
            $Resp = [pscustomobject]@{
                preco = if ($RespS.preco) { [string]$RespS.preco } else { "" }
                precoAntigo = ""
                tentativas = @("API Shopee: " + $(if ($RespS.erro) { [string]$RespS.erro } else { "ok" }))
            }
        } else {
        $Resp = Invoke-RestMethod -Uri "$WORKER_URL/produto" -Method Post -Body $Form -ContentType "application/x-www-form-urlencoded; charset=utf-8" -Headers $Cab -TimeoutSec 40
        }
        $Novo = if ($Resp.preco) { [string]$Resp.preco } else { "" }
        $NNovo = NumeroBR $Novo
        $NAtual = NumeroBR ([string]$O.preco)

        if (-not $NNovo -or $NNovo -le 0) {
            $SemPreco++
            $Motivo = if ($Resp.tentativas) { ($Resp.tentativas -join " | ") } else { "" }
            Write-Host "  sem preco: $($O.slug) $Motivo"
            $Relatorio.semPreco += [ordered]@{ slug = [string]$O.slug; produto = [string]$O.produto; link = [string]$O.link; motivo = $Motivo }
        }
        elseif ($NAtual -and [Math]::Abs($NNovo - $NAtual) -lt 0.01) {
            $Iguais++
        }
        elseif (($O.PSObject.Properties["precoTravado"] -and $O.precoTravado -eq $true) -or
                ($O.PSObject.Properties["precoManual"] -and (ParaDataUtc $O.precoManual) -and
                ($Agora - (ParaDataUtc $O.precoManual)).TotalDays -le 7)) {
            # Preco travado (a leitura automatica erra nesse anuncio) ou posto a mao
            # ha menos de 7 dias: NAO muda o site, so avisa no painel
            # Preco posto a mao ha menos de 7 dias: NAO muda o site, so avisa no painel
            Write-Host "  MANUAL (nao aplicado): $($O.slug): site $($O.preco), loja $Novo"
            $Relatorio.suspeitos += [ordered]@{
                slug = [string]$O.slug; produto = [string]$O.produto; link = [string]$O.link
                atual = [string]$O.preco; lido = $Novo
                referencia = "preco posto a mao em " + (ParaDataUtc $O.precoManual).ToOffset([TimeSpan]::FromHours(-3)).ToString("dd/MM HH:mm")
            }
        }
        elseif (($Ref = $(if ($Referencia.ContainsKey([string]$O.link)) { $Referencia[[string]$O.link] } else { $NAtual })) -and
                ($NNovo -gt 2 * $Ref -or $NNovo -lt $Ref / 2)) {
            # Muito fora do normal (mais que o dobro ou menos da metade): NÃO muda o site,
            # só avisa no painel pra conferir na mão.
            Write-Host "  SUSPEITO (nao aplicado): $($O.slug): site $($O.preco), loja $Novo, referencia $Ref"
            $Relatorio.suspeitos += [ordered]@{
                slug = [string]$O.slug; produto = [string]$O.produto; link = [string]$O.link
                atual = [string]$O.preco; lido = $Novo
                referencia = ("R$ " + $Ref.ToString("N2", $CulturaBR))
            }
        }
        else {
            Write-Host "  MUDOU: $($O.slug): $($O.preco) -> $Novo"
            $Relatorio.mudaram += [ordered]@{ slug = [string]$O.slug; produto = [string]$O.produto; de = [string]$O.preco; para = $Novo }
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
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $Det = [string]$_.ErrorDetails.Message
            $Msg = "$Msg :: " + $Det.Substring(0, [Math]::Min(300, $Det.Length))
        }
        if ($Msg -match '401') {
            Write-Warning "Senha recusada pelo Worker: confira o segredo PAINEL_SENHA no GitHub."
            exit 1
        }
        Write-Host "  erro: $($O.slug): $Msg"
        $Relatorio.erros += [ordered]@{ slug = [string]$O.slug; produto = [string]$O.produto; link = [string]$O.link; motivo = $Msg }
    }
    Start-Sleep -Milliseconds 400   # sem pressa, pra loja não bloquear
}

Write-Host ""
Write-Host "Resumo: $($Mudancas.Count) mudaram, $Iguais iguais, $SemPreco sem preco, $($Relatorio.suspeitos.Count) suspeito(s) barrado(s), $Erros erro(s)."

# Relatório pro painel (precos/ultima-conferencia.json)
$PastaRel = Join-Path $Site "precos"
New-Item -ItemType Directory -Force -Path $PastaRel | Out-Null
$Rel = [ordered]@{
    quando   = $Agora.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ssZ", [Globalization.CultureInfo]::InvariantCulture)
    origem   = if ($env:GITHUB_EVENT_NAME) { $env:GITHUB_EVENT_NAME } else { "local" }
    total    = $Alvo.Count
    iguais   = $Iguais
    mudaram  = @($Relatorio.mudaram)
    semPreco = @($Relatorio.semPreco)
    erros    = @($Relatorio.erros)
    suspeitos = @($Relatorio.suspeitos)
}
if ($ShopeeStatus) {
    $Rel.shopee = [ordered]@{ status = $ShopeeStatus }
    if ($ShopeeTeste) {
        $Rel.shopee.amostra = @($ShopeeTeste.GetEnumerator() | ForEach-Object { [ordered]@{ link = $_.Key; resultado = $_.Value } })
    }
}
[System.IO.File]::WriteAllText((Join-Path $PastaRel "ultima-conferencia.json"), ($Rel | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))

# Lista de preços barrados (sem data, pra só mudar quando a lista mudar —
# assim o GitHub só salva quando aparece ou some um suspeito)
$Susp = @($Relatorio.suspeitos | Sort-Object { $_.slug })
[System.IO.File]::WriteAllText((Join-Path $PastaRel "suspeitos.json"), (ConvertTo-Json -InputObject $Susp -Depth 3), (New-Object System.Text.UTF8Encoding($false)))

if ($Mudancas.Count -eq 0) { exit 0 }

$Temp = Join-Path ([System.IO.Path]::GetTempPath()) "precos-$([guid]::NewGuid()).json"
[System.IO.File]::WriteAllText($Temp, ($Mudancas | ConvertTo-Json -Depth 3 -AsArray), (New-Object System.Text.UTF8Encoding($false)))
& (Join-Path $Gerador "gerar-lote.ps1") -ArquivoLote $Temp
