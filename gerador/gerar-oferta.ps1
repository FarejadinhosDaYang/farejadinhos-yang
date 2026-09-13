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
    [string]$Slug
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

    # Remove espaços
    $Valor = $Valor.Trim()

    # Aceita ponto ou vírgula
    $Valor = $Valor -replace '\.', ','

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

$Site =
    "C:\Users\berna\OneDrive\Documentos\GitHub\farejadinhos-yang"

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
# URL DA OFERTA
# ==========================================

$BaseUrl =
    "https://farejadinhosdayang.github.io/farejadinhos-yang/ofertas/$Slug/"


# ==========================================
# IMAGEM DO PREVIEW
#
# AGORA USA A IMAGEM ORIGINAL
# ==========================================

$ImageUrl =
    $BaseUrl + "../../assets/" + $ImagemNome


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


Write-Host "URL da oferta:"
Write-Host $BaseUrl `
    -ForegroundColor Cyan


Write-Host ""

