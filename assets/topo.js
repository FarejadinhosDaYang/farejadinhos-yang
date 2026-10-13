/**
 * Farejadinhos da Yang — cabeçalho de loja (barra vermelha + busca + atalhos)
 *
 * Uso (logo no começo do <body>):
 *   <script src="../assets/topo.js" data-base="../"></script>
 * data-base = caminho até a raiz do site ("" na home, "../", "../../"...).
 * data-home="1" só na página inicial: lá a busca filtra na própria página.
 *
 * Pra trocar o logo/nome do site inteiro, é só mexer aqui.
 */

(function () {
    var script = document.currentScript;
    var base = script.getAttribute("data-base") || "";
    var home = script.getAttribute("data-home") === "1";
    var inicio = base + "index.html";
    var ancora = home ? "" : inicio;

    var html =
        '<header class="yang-topo">' +
        '<div class="topo-linha">' +
        '<a href="' + inicio + '" class="yt-marca">' +
        '<img class="yt-logo" src="' + base + 'assets/yang-badge.png" alt="Yang, a mascote farejadora">' +
        '<div class="yt-nome">Farejadinhos<span>da Yang</span></div>' +
        "</a>" +
        '<form class="yt-busca" id="formBusca" role="search" action="' + inicio + '" method="get">' +
        '<input type="search" id="busca" name="q" placeholder="O que você procura? A Yang fareja 🐾" aria-label="Buscar ofertas">' +
        '<button type="submit" aria-label="Buscar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.6-4.6"/></svg></button>' +
        "</form>" +
        '<div data-yang-nav data-base="' + base + '"></div>' +
        "</div>" +
        '<div class="topo-atalhos">' +
        '<nav aria-label="Atalhos">' +
        '<a class="destaque" href="' + ancora + '#tituloGrid">🔥 Ofertas do dia</a>' +
        '<a href="' + ancora + '#podioSecao">🏆 Maiores descontos</a>' +
        '<a href="' + base + 'calculadora/">🧮 Vale a pena parcelar?</a>' +
        '<a href="https://s.shopee.com.br/4VdOXKYQfW" target="_blank" rel="sponsored noopener">🏷️ Cupons Shopee</a>' +
        '<a href="https://www.mercadolivre.com.br/cupons?source_page=mperfil#nav-header" target="_blank" rel="sponsored noopener">🏷️ Cupons Mercado Livre</a>' +
        "</nav>" +
        "</div>" +
        "</header>";

    script.insertAdjacentHTML("beforebegin", html);
})();
