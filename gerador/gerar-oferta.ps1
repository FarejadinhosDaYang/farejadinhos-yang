param(
    [Parameter(Mandatory=$true)]
    [string]$Produto,

    [Parameter(Mandatory=$true)]
    [string]$Preco,

    [string]$PrecoAntigo = "",

    [string]$Cupom = "",

    [string]$Categoria = "",

    [string]$Destaque = "false",

    [string]$PrecoAVista = "",

    [string]$PrecoAPrazo = "",

    [Parameter(Mandatory=$true)]
    [string]$Link,

    [Parameter(Mandatory=$true)]
    [string]$Imagem,

    [Parameter(Mandatory=$true)]
    [string]$Slug
)

$ErrorActionPreference = "Stop"

[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$CulturaBR = [System.Globalization.CultureInfo]::GetCultureInfo("pt-BR")


# ==========================================
# EMOJIS
# ==========================================

$EmojiFire = [char]::ConvertFromUtf32(0x1F525)
$EmojiTag  = [char]::ConvertFromUtf32(0x1F3F7)
$EmojiPaw  = [char]::ConvertFromUtf32(0x1F43E)


# ==========================================
# FORMATAR PREÇO
# ==========================================

# Interpreta um preço digitado em qualquer um desses formatos:
#   "129,52"      -> já em formato brasileiro (vírgula decimal)
#   "2.199,00"    -> formato brasileiro com ponto de milhar
#   "129.52"      -> formato americano (ponto decimal, sem milhar)
# Importante: só troca "." por "," quando o valor NÃO tem vírgula —
# se já tem vírgula, o ponto (se houver) é separador de milhar de
# verdade e não pode ser mexido, senão "2.199,00" vira "2,199,00"
# (inválido) em vez de continuar sendo dois mil e cento e noventa e nove reais.
function ParseValorBR([string]$Valor) {

    $Valor = $Valor.Trim()
    $Valor = $Valor -replace 'R\$', ''
    $Valor = $Valor.Trim()

    if ($Valor -notmatch ',') {
        $Valor = $Valor -replace '\.', ','
    }

    try {
        return [decimal]::Parse($Valor, $CulturaBR)
    }
    catch {
        throw "Preco invalido: $Valor"
    }
}

function FormatarPreco([string]$Valor) {
    $Numero = ParseValorBR $Valor
    return $Numero.ToString("C2", $CulturaBR)
}

# Versão só com o número (sem "R$"), formato "1234,56",
# usada no ofertas.json e na calculadora.
function NumeroPreco([string]$Valor) {
    $Numero = ParseValorBR $Valor
    return $Numero.ToString("0.00", $CulturaBR)
}


# ==========================================
# HTML ENCODE
# ==========================================

function HtmlEncode([string]$Texto) {
    return [System.Net.WebUtility]::HtmlEncode($Texto)
}


# ==========================================
# CAMINHOS
# ==========================================

# Segunda camada de proteção: um slug longo demais quebra a
# criação/commit da pagina no runner do Windows (limite de caminho).
# O painel já corta em 60 caracteres antes de enviar, mas garante
# aqui também, caso o slug chegue grande por outro caminho.
$Slug = $Slug.Trim().Trim('-')
if ($Slug.Length -gt 60) {
    $Slug = $Slug.Substring(0, 60) -replace '-+[^-]*$', ''
    $Slug = $Slug.Trim('-')
}

$Gerador = Split-Path -Parent $MyInvocation.MyCommand.Path
$Site = Split-Path -Parent $Gerador

$Assets  = Join-Path $Site "assets"
$Ofertas = Join-Path $Site "ofertas"
$Out     = Join-Path $Ofertas $Slug
$OfertasJsonPath = Join-Path $Site "ofertas.json"

New-Item -ItemType Directory -Force -Path $Assets | Out-Null
New-Item -ItemType Directory -Force -Path $Out | Out-Null


# ==========================================
# LOCALIZAR IMAGEM
# ==========================================

$ImagemAbs = $Imagem.Trim().Trim('"')

if (-not [System.IO.Path]::IsPathRooted($ImagemAbs)) {
    $ImagemAbs = Join-Path (Get-Location) $ImagemAbs
}

if (-not (Test-Path -LiteralPath $ImagemAbs)) {
    throw "Imagem nao encontrada: $ImagemAbs"
}

$ImagemNome = Split-Path -Leaf $ImagemAbs


# ==========================================
# COPIAR IMAGEM PARA ASSETS
# ==========================================

Copy-Item -LiteralPath $ImagemAbs -Destination (Join-Path $Assets $ImagemNome) -Force


# ==========================================
# PREPARAR DADOS
# ==========================================

$ProdutoH = HtmlEncode $Produto
$PrecoFormatado = FormatarPreco $Preco
$PrecoH = HtmlEncode $PrecoFormatado
$LinkH = HtmlEncode $Link
$ImagemNomeH = HtmlEncode $ImagemNome

$DestaqueBool = $Destaque.Trim().ToLower() -eq "true"


# ==========================================
# PREÇO ANTIGO
# ==========================================

$OldBlock = ""
$PrecoAntigoFormatado = ""

if ($PrecoAntigo.Trim() -ne "") {
    $PrecoAntigoFormatado = FormatarPreco $PrecoAntigo
    $OldBlock = '<div class="old">' + (HtmlEncode $PrecoAntigoFormatado) + '</div>'
}


# ==========================================
# CUPOM
# ==========================================

$CupomBlock = ""

if ($Cupom.Trim() -ne "") {
    $CupomBlock =
        '<div class="coupon"><b>' + $EmojiTag + ' CUPOM:</b> ' +
        (HtmlEncode $Cupom) + '</div>'
}


# ==========================================
# CALCULADORA "VALE A PENA PARCELAR?"
#
# Só aparece na página se os dois precos
# (a vista e a prazo) forem informados.
# ==========================================

$CalcBlock = ""
$CalcScript = ""
$PrecoAVistaJs = ""
$PrecoAPrazoJs = ""

if ($PrecoAVista.Trim() -ne "" -and $PrecoAPrazo.Trim() -ne "") {

    $PrecoAVistaJs = NumeroPreco $PrecoAVista
    $PrecoAPrazoJs = NumeroPreco $PrecoAPrazo

    $CalcBlock = @"
<div class="calc-section">
<h2>🧮 Vale a pena parcelar?</h2>
<p class="sub">Preenche as parcelas e o quanto seu dinheiro rende que a Yang calcula.</p>
<div id="calculadora"></div>
</div>
"@

    $CalcScript =
        "FarejadinhosCalculadora.render(document.getElementById('calculadora'), { precoAVista: '" +
        $PrecoAVistaJs + "', precoAPrazo: '" + $PrecoAPrazoJs + "', compact: true });"
}


# ==========================================
# URL DA OFERTA
# ==========================================

$BaseUrl = "https://farejadinhosdayang.github.io/farejadinhos-yang/ofertas/$Slug/"
$ImageUrl = $BaseUrl + "../../assets/" + $ImagemNome


# ==========================================
# ATUALIZAR O CATALOGO (ofertas.json)
# ==========================================

$Catalogo = @()

if (Test-Path -LiteralPath $OfertasJsonPath) {

    $CatalogoTexto = Get-Content -LiteralPath $OfertasJsonPath -Raw -Encoding UTF8

    if (-not [string]::IsNullOrWhiteSpace($CatalogoTexto)) {
        $Catalogo = @($CatalogoTexto | ConvertFrom-Json)
    }
}

# Remove uma entrada antiga com o mesmo slug (regeneracao) e
# qualquer lixo/objeto vazio que tenha sobrado no arquivo.
$Catalogo = @($Catalogo | Where-Object {
    $_ -and $_.slug -and ($_.slug -ne $Slug)
})

$NovaEntrada = [ordered]@{
    produto       = $Produto
    preco         = $PrecoFormatado
    precoAntigo   = $PrecoAntigoFormatado
    cupom         = $Cupom
    categoria     = $Categoria
    destaque      = $DestaqueBool
    imagem        = $ImagemNome
    link          = $Link
    url           = $BaseUrl
    slug          = $Slug
    data          = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    precoAVista   = $PrecoAVistaJs
    precoAPrazo   = $PrecoAPrazoJs
}

$Catalogo = @($Catalogo) + $NovaEntrada

$CatalogoJson = $Catalogo | ConvertTo-Json -Depth 5 -AsArray

[System.IO.File]::WriteAllText(
    $OfertasJsonPath,
    $CatalogoJson,
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host "Catalogo atualizado: $OfertasJsonPath"


# ==========================================
# HTML
# ==========================================

$Html = @"
<!doctype html>

<html lang="pt-BR">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width,initial-scale=1">


<title>
$EmojiFire $ProdutoH | Farejadinhos da Yang
</title>


<!-- =====================================
     OPEN GRAPH
     ===================================== -->

<meta property="og:type"
      content="website">


<meta property="og:site_name"
      content="Farejadinhos da Yang">


<meta property="og:title"
      content="$EmojiFire $ProdutoH | Farejadinhos da Yang">


<meta property="og:description"
      content="Confira este achadinho selecionado pela Yang.">


<meta property="og:image"
      content="$ImageUrl">


<meta property="og:image:secure_url"
      content="$ImageUrl">


<meta property="og:image:alt"
      content="$ProdutoH">


<meta property="og:url"
      content="$BaseUrl">


<!-- =====================================
     TWITTER / OUTROS PREVIEWS
     ===================================== -->

<meta name="twitter:card"
      content="summary_large_image">


<meta name="twitter:title"
      content="$EmojiFire $ProdutoH | Farejadinhos da Yang">


<meta name="twitter:description"
      content="Confira este achadinho selecionado pela Yang.">


<meta name="twitter:image"
      content="$ImageUrl">


<link rel="icon" type="image/png" sizes="32x32" href="../../assets/favicon-32.png">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

<link rel="stylesheet" href="../../assets/nav.css">
<link rel="stylesheet" href="../../assets/calculadora.css">


<!-- =====================================
     ESTILO
     ===================================== -->

<style>

:root{
    --red:#E5232E;
    --red-dark:#C21A24;
    --orange:#F7941D;
    --cream:#FDF3E3;
    --cream-2:#FFFAF1;
    --ink:#2B1B12;
    --muted:#8A7563;
    --line:#F0DFC4;
}

*{
    box-sizing:border-box
}

body{
    margin:0;
    background:var(--cream);
    font-family:'Work Sans',Arial,sans-serif;
    color:var(--ink)
}

.wrap{
    max-width:560px;
    margin:auto;
    padding:24px 14px 40px
}

.card{
    background:var(--cream-2);
    border-radius:26px;
    overflow:hidden;
    box-shadow:0 14px 40px rgba(43,27,18,.12);
    border:1.5px solid var(--line)
}

.top{
    background:linear-gradient(120deg,var(--red) 0%,#f0462f 60%,var(--orange) 140%);
    color:#fff;
    padding:14px 18px;
    text-align:center;
    font-weight:800;
    font-family:'Baloo 2',sans-serif;
    letter-spacing:.3px;
    font-size:15px
}

.content{
    padding:22px
}

.brand{
    display:flex;
    align-items:center;
    gap:10px;
    font-family:'Baloo 2',sans-serif;
    font-weight:700;
    margin-bottom:16px;
    color:var(--red-dark);
    font-size:15px
}

.brand img{
    width:32px;
    height:32px;
    border-radius:50%;
    flex:none
}

.product{
    width:100%;
    border-radius:18px;
    background:#f7f1e6;
    display:block;
    border:1px solid var(--line)
}

h1{
    font-family:'Baloo 2',sans-serif;
    font-size:24px;
    line-height:1.25;
    margin:18px 0 8px;
    color:var(--ink)
}

.old{
    text-decoration:line-through;
    color:var(--muted);
    margin-top:6px;
    font-size:15px
}

.price{
    font-size:36px;
    font-weight:800;
    margin-top:2px;
    font-family:'Baloo 2',sans-serif;
    color:var(--red-dark)
}

.coupon{
    margin:18px 0;
    padding:13px 14px;
    border:2px dashed var(--orange);
    border-radius:14px;
    background:#fff6e9;
    font-size:14.5px
}

.coupon b{
    color:var(--red-dark)
}

.btn{
    display:block;
    background:linear-gradient(135deg,var(--red),var(--red-dark));
    color:#fff;
    text-decoration:none;
    text-align:center;
    padding:17px;
    border-radius:15px;
    font-weight:800;
    font-family:'Baloo 2',sans-serif;
    font-size:16px;
    margin-top:18px;
    box-shadow:0 10px 22px rgba(229,35,46,.28)
}

.note{
    text-align:center;
    color:var(--muted);
    font-size:12px;
    margin-top:16px;
    line-height:1.5
}

.back{
    display:block;
    text-align:center;
    margin-top:16px;
    font-size:13px;
    color:var(--muted);
    text-decoration:none
}

.header-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    margin-bottom:14px
}

.calc-section{
    margin-top:20px;
    padding-top:20px;
    border-top:1.5px dashed var(--line)
}

.calc-section h2{
    font-family:'Baloo 2',sans-serif;
    font-size:16px;
    margin:0 0 4px;
    color:var(--red-dark)
}

.calc-section .sub{
    font-size:12.5px;
    color:var(--muted);
    margin:0 0 14px
}

</style>

</head>


<body>


<div class="wrap">


<div class="card">


<div class="top">
$EmojiFire ACHADINHO DO DIA
</div>


<div class="content">


<div class="header-row">
<div class="brand" style="margin-bottom:0">
<img src="../../assets/yang-badge.png" alt="Yang">
Farejadinhos da Yang
</div>
<div data-yang-nav data-base="../../"></div>
</div>


<img
    class="product"
    src="../../assets/$ImagemNomeH"
    alt="$ProdutoH"
>


<h1>
$ProdutoH
</h1>


$OldBlock


<div class="price">
$PrecoH
</div>


$CupomBlock


<a
    class="btn"
    href="$LinkH"
    rel="nofollow sponsored"
>
$EmojiPaw PEGAR OFERTA
</a>


<div class="note">
Voc$([char]0xEA) ser$([char]0xE1) direcionado para a loja.
Alguns links podem gerar comiss$([char]0xE3)o.
</div>

$CalcBlock

<a class="back" href="../../">&larr; voltar pro in$([char]0xED)cio</a>

</div>


</div>


</div>

<script src="../../assets/nav.js"></script>
<script src="../../assets/calculadora.js"></script>
<script>
$CalcScript
</script>

</body>

</html>
"@


# ==========================================
# SALVAR HTML
# ==========================================

$Arquivo = Join-Path $Out "index.html"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText($Arquivo, $Html, $Utf8NoBom)


# ==========================================
# RESULTADO
# ==========================================

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " OFERTA CRIADA COM SUCESSO!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Arquivo criado:"
Write-Host $Arquivo
Write-Host ""
Write-Host "Imagem copiada para:"
Write-Host (Join-Path $Assets $ImagemNome)
Write-Host ""
Write-Host "URL da oferta:"
Write-Host $BaseUrl -ForegroundColor Cyan
Write-Host ""
