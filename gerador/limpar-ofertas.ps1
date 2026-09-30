# ==========================================
# LIMPAR OFERTAS EXPIRADAS
#
# O site já esconde do visitante qualquer oferta com mais de
# HORAS_EXPIRACAO horas (24h) — isso acontece via JavaScript, direto
# no navegador, olhando o campo "data" de cada oferta em ofertas.json.
#
# Só que esconder não é remover: o arquivo ofertas.json nunca perdia
# uma entrada sozinho, então ele só cresce pra sempre, oferta após
# oferta, mesmo as que já sumiram do site há meses.
#
# Este script roda periodicamente (via GitHub Actions agendado) e
# remove do ofertas.json qualquer entrada que já passou do prazo de
# exibição — exatamente as mesmas que o site já esconde, só que agora
# elas somem de vez do arquivo também.
#
# Importante: isso NÃO apaga a página da oferta (ofertas/<slug>/) nem
# a imagem em assets/ — só tira a entrada da lista, igual o botão
# "Remover" do painel já faz manualmente. Um link antigo compartilhado
# continua funcionando, só não aparece mais na vitrine.
# ==========================================

$ErrorActionPreference = "Stop"

$HORAS_EXPIRACAO = 24

$Gerador = Split-Path -Parent $MyInvocation.MyCommand.Path
$Site = Split-Path -Parent $Gerador
$OfertasJsonPath = Join-Path $Site "ofertas.json"

if (-not (Test-Path -LiteralPath $OfertasJsonPath)) {
    Write-Host "ofertas.json nao encontrado, nada para limpar."
    exit 0
}

$Texto = Get-Content -LiteralPath $OfertasJsonPath -Raw -Encoding UTF8

if ([string]::IsNullOrWhiteSpace($Texto)) {
    Write-Host "ofertas.json vazio, nada para limpar."
    exit 0
}

$Ofertas = @($Texto | ConvertFrom-Json)
$Agora = [DateTimeOffset]::UtcNow

$Mantidas = @()
$Removidas = @()

foreach ($Oferta in $Ofertas) {

    if (-not $Oferta -or -not $Oferta.slug) {
        # lixo/objeto vazio no arquivo — não mantém
        continue
    }

    if (-not $Oferta.data) {
        # sem data pra comparar, mantém por segurança
        $Mantidas += $Oferta
        continue
    }

    try {
        $DataOferta = [DateTimeOffset]::Parse($Oferta.data)
    }
    catch {
        # data em formato inesperado, mantém por segurança em vez de arriscar apagar
        $Mantidas += $Oferta
        continue
    }

    $Horas = ($Agora - $DataOferta).TotalHours

    if ($Horas -le $HORAS_EXPIRACAO) {
        $Mantidas += $Oferta
    }
    else {
        $Removidas += $Oferta
    }
}

if ($Removidas.Count -eq 0) {
    Write-Host "Nenhuma oferta expirada para remover ($($Mantidas.Count) no catalogo)."
    exit 0
}

$NovoJson = $Mantidas | ConvertTo-Json -Depth 5 -AsArray

[System.IO.File]::WriteAllText(
    $OfertasJsonPath,
    $NovoJson,
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host "Removidas $($Removidas.Count) oferta(s) expirada(s):"
foreach ($R in $Removidas) {
    Write-Host " - $($R.produto) ($($R.slug))"
}
Write-Host "Catalogo ficou com $($Mantidas.Count) oferta(s)."
