param(
    [Parameter(Mandatory=$true)]
    [string]$Produto,

    [Parameter(Mandatory=$true)]
    [string]$Preco,

    [string]$PrecoAntigo = "",

    [string]$Cupom = "",

    [Parameter(Mandatory=$true)]
    [string]$Link,

    [Parameter(Mandatory=$true)]
    [string]$Imagem,

    [Parameter(Mandatory=$true)]
    [string]$Slug,

    [string]$Categoria = "",

    [string]$Destaque = "false"
)

$ErrorActionPreference = "Stop"

[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8


# ==========================================
# EMOJIS
# ==========================================

$EmojiDog  = [char]::ConvertFromUtf32(0x1F436)
$EmojiFire = [char]::ConvertFromUtf32(0x1F525)
$EmojiTag  = [char]::ConvertFromUtf32(0x1F3F7)
$EmojiCart = [char]::ConvertFromUtf32(0x1F6D2)


# ==========================================
# FORMATAR PREÇO
# ==========================================

function FormatarPreco([string]$Valor) {

    $Valor = $Valor.Trim()

    # Remove R$
    $Valor = $Valor -replace 'R\$', ''

    # Remove espaços (inclusive espaços internos, tipo "6.499, 00")
    $Valor = $Valor -replace '\s', ''

    if ($Valor -match ',') {

        # Já tem vírgula: assume formato BR (ex: "6.499,00").
        # Remove os pontos, que aqui são separador de milhar.
        $Valor = $Valor -replace '\.', ''

    }
    elseif ($Valor -match '^\d+\.\d{2}$') {

        # Só tem ponto, com exatamente 2 casas no final (ex: "38.80"):
        # trata como separador decimal americano.
        $Valor = $Valor -replace '\.', ','

    }
    else {

        # Ponto com outra quantidade de casas (ex: "6.499") ou
        # nenhum separador: trata o ponto como separador de milhar.
        $Valor = $Valor -replace '\.', ''

    }

    try {

        $Numero = [decimal]::Parse(
            $Valor,
            [System.Globalization.CultureInfo]::GetCultureInfo("pt-BR")
        )

    }
    catch {

        throw "Preco invalido: $Valor"

    }

    return $Numero.ToString(
        "C2",
        [System.Globalization.CultureInfo]::GetCultureInfo("pt-BR")
    )
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

$Gerador =
    Split-Path -Parent $MyInvocation.MyCommand.Path

$Site = Split-Path -Parent $Gerador

$Assets =
    Join-Path $Site "assets"

$Ofertas =
    Join-Path $Site "ofertas"

$Out =
    Join-Path $Ofertas $Slug


New-Item `
    -ItemType Directory `
    -Force `
    -Path $Assets |
    Out-Null

New-Item `
    -ItemType Directory `
    -Force `
    -Path $Out |
    Out-Null


# ==========================================
# LOCALIZAR IMAGEM
# ==========================================

$ImagemAbs =
    $Imagem.Trim().Trim('"')


if (-not [System.IO.Path]::IsPathRooted($ImagemAbs)) {

    $ImagemAbs =
        Join-Path (Get-Location) $ImagemAbs

}


if (-not (Test-Path -LiteralPath $ImagemAbs)) {

    throw "Imagem nao encontrada: $ImagemAbs"

}


$ImagemNome =
    Split-Path -Leaf $ImagemAbs


# ==========================================
# COPIAR IMAGEM PARA ASSETS
# ==========================================

Copy-Item `
    -LiteralPath $ImagemAbs `
    -Destination (Join-Path $Assets $ImagemNome) `
    -Force


# ==========================================
# OTIMIZAR IMAGEM PARA PREVIEW (WhatsApp etc)
#
# O WhatsApp só mostra o preview GRANDE quando a imagem:
# - tem pelo menos ~300px de largura (o ideal é por volta de 1200px)
# - pesa menos de 600KB (o ideal é bem menos que isso)
# - não é SVG
# Como a imagem de origem varia muito (print de tela, foto de
# marketplace, foto da Amazon), a gente sempre redimensiona e
# recomprime aqui, garantindo que todo produto fique dentro do
# que o WhatsApp aceita para o preview grande.
# ==========================================

Add-Type -AssemblyName System.Drawing

$LarguraMaxima = 1200
$LarguraMinima = 600

$CaminhoImagemFinal = Join-Path $Assets $ImagemNome
$ImagemLargura = $null
$ImagemAltura = $null

try {

    $ImagemOriginal = [System.Drawing.Image]::FromFile($CaminhoImagemFinal)

    $LarguraOriginal = $ImagemOriginal.Width
    $AlturaOriginal = $ImagemOriginal.Height

    if ($LarguraOriginal -gt $LarguraMaxima) {
        # Imagem grande demais: encolhe
        $NovaLargura = $LarguraMaxima
        $NovaAltura = [int]([double]$AlturaOriginal * ($LarguraMaxima / $LarguraOriginal))
    }
    elseif ($LarguraOriginal -lt $LarguraMinima) {
        # Imagem pequena demais pro WhatsApp mostrar o preview grande:
        # amplia até a largura mínima segura (perde um pouco de nitidez,
        # mas é melhor que cair no preview minúsculo)
        $NovaLargura = $LarguraMinima
        $NovaAltura = [int]([double]$AlturaOriginal * ($LarguraMinima / $LarguraOriginal))
    }
    else {
        $NovaLargura = $LarguraOriginal
        $NovaAltura = $AlturaOriginal
    }

    $Bitmap = New-Object System.Drawing.Bitmap($NovaLargura, $NovaAltura)
    $Graficos = [System.Drawing.Graphics]::FromImage($Bitmap)
    $Graficos.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $Graficos.DrawImage($ImagemOriginal, 0, 0, $NovaLargura, $NovaAltura)

    $ImagemOriginal.Dispose()
    $Graficos.Dispose()

    # Sempre salva como JPG — formato mais confiável pro preview
    $NomeBase = [System.IO.Path]::GetFileNameWithoutExtension($ImagemNome)
    $NovoNomeArquivo = "$NomeBase.jpg"
    $NovoCaminho = Join-Path $Assets $NovoNomeArquivo

    $CodecJpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.MimeType -eq "image/jpeg" }

    # Compressão progressiva: o WhatsApp é bem mais rígido que o
    # Facebook quanto ao peso do arquivo (relatos apontam ~300KB,
    # bem menor que os 600KB documentados oficialmente). Começa em
    # qualidade 85 e vai reduzindo até caber num limite seguro.
    $LimiteBytes = 250KB
    $TentativasQualidade = @(85, 75, 65, 55, 45)

    foreach ($Qualidade in $TentativasQualidade) {

        $ParametrosCodec = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $ParametrosCodec.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
            [System.Drawing.Imaging.Encoder]::Quality, $Qualidade
        )

        $Bitmap.Save($NovoCaminho, $CodecJpeg, $ParametrosCodec)

        $TamanhoAtual = (Get-Item -LiteralPath $NovoCaminho).Length

        if ($TamanhoAtual -le $LimiteBytes) {
            break
        }
    }

    $Bitmap.Dispose()

    # Remove o arquivo original se o nome mudou (ex: era .png, virou .jpg)
    if ($NovoNomeArquivo -ne $ImagemNome -and (Test-Path -LiteralPath $CaminhoImagemFinal)) {
        Remove-Item -LiteralPath $CaminhoImagemFinal -Force
    }

    $ImagemNome = $NovoNomeArquivo
    $ImagemLargura = $NovaLargura
    $ImagemAltura = $NovaAltura

}
catch {

    Write-Host "Aviso: nao foi possivel otimizar a imagem, usando original. $($_.Exception.Message)" -ForegroundColor Yellow

    try {
        $ImagemDims = [System.Drawing.Image]::FromFile($CaminhoImagemFinal)
        $ImagemLargura = $ImagemDims.Width
        $ImagemAltura = $ImagemDims.Height
        $ImagemDims.Dispose()
    }
    catch {
        # Se nem isso funcionar, segue sem as dimensões — a imagem
        # original continua sendo usada normalmente, só sem os
        # meta tags de largura/altura.
    }

}


# ==========================================
# PREPARAR DADOS
# ==========================================

$ProdutoH =
    HtmlEncode $Produto

$PrecoFormatado =
    FormatarPreco $Preco

$PrecoH =
    HtmlEncode $PrecoFormatado

$LinkH =
    HtmlEncode $Link

$ImagemNomeH =
    HtmlEncode $ImagemNome


# ==========================================
# PREÇO ANTIGO
# ==========================================

$OldBlock = ""
$PrecoAntigoFormatado = ""


if ($PrecoAntigo.Trim() -ne "") {

    $PrecoAntigoFormatado =
        FormatarPreco $PrecoAntigo

    $OldBlock =
        '<div class="old">' +
        (HtmlEncode $PrecoAntigoFormatado) +
        '</div>'

}


# ==========================================
# CUPOM
# ==========================================

$CupomBlock = ""


if ($Cupom.Trim() -ne "") {

    $CupomBlock =
        '<div class="coupon"><b>' +
        $EmojiTag +
        ' CUPOM:</b> ' +
        (HtmlEncode $Cupom) +
        '</div>'

}


# ==========================================
# DIMENSÕES DA IMAGEM (og:image:width / height)
# ==========================================

$DimensoesBlock = ""

if ($ImagemLargura -and $ImagemAltura) {

    $DimensoesBlock =
        '<meta property="og:image:width" content="' + $ImagemLargura + '">' +
        "`n" +
        '<meta property="og:image:height" content="' + $ImagemAltura + '">'
}


# ==========================================
# URL DA OFERTA
# ==========================================

$BaseUrl =
    "https://farejadinhosdayang.github.io/farejadinhos-yang/ofertas/$Slug/"


# ==========================================
# IMAGEM DO PREVIEW (URL absoluta, sem ../../)
# ==========================================

$ImageUrl =
    "https://farejadinhosdayang.github.io/farejadinhos-yang/assets/$ImagemNome"


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


$DimensoesBlock


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


<meta name="twitter:image:alt"
      content="$ProdutoH">


<!-- =====================================
     ESTILO
     ===================================== -->

<style>

*{
    box-sizing:border-box
}

body{
    margin:0;
    background:#f4f4f4;
    font-family:Arial,sans-serif;
    color:#222
}

.wrap{
    max-width:560px;
    margin:auto;
    padding:22px 14px
}

.card{
    background:#fff;
    border-radius:24px;
    overflow:hidden;
    box-shadow:0 8px 35px rgba(0,0,0,.10)
}

.top{
    background:#e5232e;
    color:#fff;
    padding:13px 18px;
    text-align:center;
    font-weight:800;
    letter-spacing:.5px
}

.content{
    padding:20px
}

.brand{
    font-weight:800;
    margin-bottom:14px
}

.product{
    width:100%;
    border-radius:16px;
    background:#f7f7f7;
    display:block
}

h1{
    font-size:25px;
    line-height:1.2;
    margin:18px 0 8px
}

.old{
    text-decoration:line-through;
    color:#888;
    margin-top:8px
}

.price{
    font-size:34px;
    font-weight:900;
    margin-top:4px
}

.coupon{
    margin:18px 0;
    padding:13px;
    border:2px dashed #e5232e;
    border-radius:12px;
    background:#fff6f6
}

.btn{
    display:block;
    background:#e5232e;
    color:#fff;
    text-decoration:none;
    text-align:center;
    padding:16px;
    border-radius:13px;
    font-weight:900;
    margin-top:18px
}

.note{
    text-align:center;
    color:#777;
    font-size:12px;
    margin-top:15px
}

.voltar{
    display:block;
    text-align:center;
    color:#999;
    font-size:12px;
    text-decoration:none;
    margin-top:14px
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


<div class="brand">
$EmojiDog Farejadinhos da Yang
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
$EmojiCart PEGAR OFERTA
</a>


<div class="note">
Voc$([char]0xEA) ser$([char]0xE1) direcionado para a loja.
Alguns links podem gerar comiss$([char]0xE3)o.
</div>


<a class="voltar" href="../">Ver todas as ofertas</a>


</div>


</div>


</div>


</body>

</html>
"@


# ==========================================
# SALVAR HTML
# ==========================================

$Arquivo =
    Join-Path $Out "index.html"


$Utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)


[System.IO.File]::WriteAllText(
    $Arquivo,
    $Html,
    $Utf8NoBom
)


# ==========================================
# CATÁLOGO (ofertas.json)
#
# Guarda os dados de cada oferta num arquivo único,
# que alimenta a página de catálogo em /ofertas/
# ==========================================

$CatalogoPath =
    Join-Path $Site "ofertas.json"

if (Test-Path -LiteralPath $CatalogoPath) {

    $CatalogoTexto =
        Get-Content -LiteralPath $CatalogoPath -Raw -Encoding UTF8

    if ([string]::IsNullOrWhiteSpace($CatalogoTexto)) {
        $Catalogo = @()
    }
    else {
        $Catalogo = @($CatalogoTexto | ConvertFrom-Json)
    }

}
else {

    $Catalogo = @()

}

# Remove uma entrada anterior com o mesmo slug, se existir
# (permite rodar o gerador de novo pra atualizar uma oferta)
$Catalogo =
    @($Catalogo | Where-Object { $_.slug -ne $Slug })

$NovaEntrada = [PSCustomObject]@{
    produto     = $Produto
    preco       = $PrecoFormatado
    precoAntigo = $PrecoAntigoFormatado
    cupom       = $Cupom
    categoria   = $Categoria
    destaque    = ($Destaque -eq "true")
    imagem      = $ImagemNome
    link        = $Link
    url         = $BaseUrl
    slug        = $Slug
    data        = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

$Catalogo =
    @($Catalogo) + $NovaEntrada

$CatalogoJson =
    $Catalogo | ConvertTo-Json -Depth 5 -AsArray

[System.IO.File]::WriteAllText(
    $CatalogoPath,
    $CatalogoJson,
    $Utf8NoBom
)


# ==========================================
# RESULTADO
# ==========================================

Write-Host ""

Write-Host "==========================================" `
    -ForegroundColor Green

Write-Host " OFERTA CRIADA COM SUCESSO!" `
    -ForegroundColor Green

Write-Host "==========================================" `
    -ForegroundColor Green

Write-Host ""


Write-Host "Arquivo criado:"
Write-Host $Arquivo


Write-Host ""


Write-Host "Imagem copiada para:"
Write-Host (Join-Path $Assets $ImagemNome)


Write-Host ""


Write-Host "Catalogo atualizado:"
Write-Host $CatalogoPath


Write-Host ""


Write-Host "URL da oferta:"
Write-Host $BaseUrl `
    -ForegroundColor Cyan


Write-Host ""
