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

// Ícone e cor de cada categoria (usado pela home, pela lateral e pelo menu)
window.FAREJA_ICONES_CAT = {
    "Casa": { icone: "🏠", cor: "#F7941D" },
    "Café": { icone: "☕", cor: "#6B4226" },
    "Academia": { icone: "🏋️", cor: "#2E7D4F" },
    "Eletrônicos": { icone: "🔌", cor: "#2E5E8C" },
    "Eletrodomésticos": { icone: "🧺", cor: "#546E7A" },
    "Beleza": { icone: "💄", cor: "#C2185B" },
    "Moda": { icone: "👕", cor: "#6A4C93" },
    "Pet": { icone: "🐾", cor: "#8A5A44" },
    "Cozinha": { icone: "🍳", cor: "#D68910" },
    "Utilidades": { icone: "🧰", cor: "#00897B" },
    "Natal": { icone: "🎄", cor: "#1E7B3C" },
    "Skincare": { icone: "🧴", cor: "#D0688A" },
    "Piscina": { icone: "🏊", cor: "#1E88C7" },
    "Vídeos": { icone: "🎬", cor: "#7B3FA0" },
    "Celulares": { icone: "📱", cor: "#3949AB" }
};

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
        '<a href="' + ancora + '#cuponsSecao">🏷️ Cupons de hoje</a>' +
        '<a href="' + base + 'calculadora/">🧮 Vale a pena parcelar?</a>' +
        '<a href="https://s.shopee.com.br/4VdOXKYQfW" target="_blank" rel="sponsored noopener">🏷️ Cupons Shopee</a>' +
        '<a href="https://www.mercadolivre.com.br/cupons?source_page=mperfil#nav-header" target="_blank" rel="sponsored noopener">🏷️ Cupons Mercado Livre</a>' +
        "</nav>" +
        "</div>" +
        "</header>";

    script.insertAdjacentHTML("beforebegin", html);

    // ======================================================
    // CATEGORIAS NO AR (lateral no computador + menu no celular)
    // ======================================================
    var promessa = null;

    function carregarScript(src) {
        return new Promise(function (ok) {
            var s = document.createElement("script");
            s.src = src; s.onload = ok; s.onerror = ok;
            document.head.appendChild(s);
        });
    }

    // [{ nome, icone, cor, n }] das categorias que têm oferta no ar
    window.FarejadinhosCategoriasNoAr = function () {
        if (promessa) return promessa;
        promessa = (window.FarejadinhosVitrine ? Promise.resolve() : carregarScript(base + "assets/vitrine.js"))
            .then(function () { return fetch(base + "ofertas.json?t=" + Math.floor(Date.now() / 60000), { cache: "no-store" }); })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var todas = Array.isArray(d) ? d : [d];
                var visiveis = window.FarejadinhosVitrine ? window.FarejadinhosVitrine.selecionar(todas, new Date()).visiveis : todas;
                var cont = {};
                visiveis.forEach(function (o) {
                    var cats = window.FarejadinhosVitrine && window.FarejadinhosVitrine.categoriasDe ? window.FarejadinhosVitrine.categoriasDe(o) : [(o && o.categoria || "").trim()];
                    cats.forEach(function (c) { if (c) cont[c] = (cont[c] || 0) + 1; });
                });
                return Object.keys(cont).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); }).map(function (c) {
                    var ic = window.FAREJA_ICONES_CAT[c] || { icone: "🐾", cor: "#8A7563" };
                    return { nome: c, icone: ic.icone, cor: ic.cor, n: cont[c], total: visiveis.length };
                });
            })
            .catch(function () { return []; });
        return promessa;
    };

    function esc(t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }

    // Abre uma categoria: na home filtra na hora; nas outras páginas vai pra home já filtrada
    window.farejaAbrirCategoria = function (cat) {
        if (home && window.farejaFiltrarCategoria) { window.farejaFiltrarCategoria(cat); return; }
        location.href = inicio + (cat ? "?categoria=" + encodeURIComponent(cat) : "") + "#tituloGrid";
    };

    function categoriaDaUrl() {
        try { return new URL(location.href).searchParams.get("categoria") || ""; } catch (e) { return ""; }
    }

    function montarLateral() {
        var wrap = document.querySelector("body > .wrap");
        if (!wrap || document.querySelector(".yt-layout")) return;

        var layout = document.createElement("div");
        layout.className = "yt-layout";
        var lateral = document.createElement("aside");
        lateral.className = "yt-lateral";
        lateral.setAttribute("aria-label", "Categorias");
        lateral.innerHTML = '<div class="yt-lat-titulo">🗂️ Categorias</div><div class="yt-lat-lista">…</div>';
        var main = document.createElement("div");
        main.className = "yt-main";

        wrap.parentNode.insertBefore(layout, wrap);
        layout.appendChild(lateral);
        layout.appendChild(main);
        main.appendChild(wrap);

        var ativa = home ? categoriaDaUrl() : "__nenhuma__";

        window.FarejadinhosCategoriasNoAr().then(function (cats) {
            var lista = lateral.querySelector(".yt-lat-lista");
            if (!cats.length) { lateral.remove(); layout.classList.add("sem-lateral"); return; }
            var total = cats.length ? cats[0].total : 0;
            lista.innerHTML =
                '<a href="' + inicio + '#tituloGrid" data-cat="">' +
                '<span class="yt-lat-ic" style="background:#E5232E">🔥</span><span class="yt-lat-nome">Todas as ofertas</span><small>' + total + "</small></a>" +
                cats.map(function (c) {
                    return '<a href="' + inicio + "?categoria=" + encodeURIComponent(c.nome) + '#tituloGrid" data-cat="' + esc(c.nome) + '">' +
                        '<span class="yt-lat-ic" style="background:' + c.cor + '">' + c.icone + "</span>" +
                        '<span class="yt-lat-nome">' + esc(c.nome) + "</span><small>" + c.n + "</small></a>";
                }).join("");
            marcar(ativa);
            lista.querySelectorAll("a").forEach(function (a) {
                a.addEventListener("click", function (e) {
                    if (!home) return;
                    e.preventDefault();
                    window.farejaAbrirCategoria(a.getAttribute("data-cat"));
                });
            });
        });

        function marcar(cat) {
            lateral.querySelectorAll("a").forEach(function (a) {
                a.classList.toggle("ativo", a.getAttribute("data-cat") === cat);
            });
        }
        document.addEventListener("fareja:filtro", function (e) { marcar(e.detail || ""); });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montarLateral);
    else montarLateral();
})();

/* ===== CONTADOR DE VISITAS =====
 * Avisa o Worker "farejadinhos-contador" a cada página aberta.
 * Nada pessoal: só uma marquinha anônima neste aparelho pra saber se é
 * a primeira vez (pessoa nova), a primeira hoje e uma visita nova
 * (sessão nova = a pessoa fechou e voltou). Não conta você: quem tem a
 * senha do painel salva no navegador, ou está no /painel, fica de fora.
 * Código do Worker: cloudflare/contador-worker.js
 */
(function () {
    var CONTADOR_URL = "https://farejadinhos-contador.bernard-shimizu.workers.dev";
    try {
        if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
        if (/\/painel\//.test(location.pathname) || /[?&]admin\b/.test(location.search)) return;
        if (localStorage.getItem("farejadinhos_admin_senha")) return;
        if (navigator.webdriver) return;
    } catch (e) { return; }

    var d = { pagina: location.pathname };
    var hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    try {
        if (!localStorage.getItem("fareja_visitante")) { localStorage.setItem("fareja_visitante", "1"); d.novaPessoa = 1; }
        if (localStorage.getItem("fareja_ultimo_dia") !== hoje) { localStorage.setItem("fareja_ultimo_dia", hoje); d.novaHoje = 1; }
        if (!sessionStorage.getItem("fareja_sessao")) { sessionStorage.setItem("fareja_sessao", "1"); d.novaVisita = 1; }
    } catch (e) { d.novaVisita = 1; }

    try {
        // text/plain: não precisa de "pré-consulta" do navegador
        fetch(CONTADOR_URL + "/visita", {
            method: "POST", body: JSON.stringify(d), keepalive: true,
            headers: { "Content-Type": "text/plain" }
        }).catch(function () {});
    } catch (e) {}
})();

/* ===== AVISOS (notificações) — assets/avisos-push.js ===== */
(function () {
    // "cartão de app" (manifest): no iPhone, é o que faz o site virar app
    // na tela de início — e só assim ele pode receber avisos
    if (!document.querySelector("link[rel=manifest]")) {
        var head = document.head;
        var l = document.createElement("link"); l.rel = "manifest"; l.href = "/manifest.webmanifest"; head.appendChild(l);
        [["apple-mobile-web-app-capable", "yes"], ["mobile-web-app-capable", "yes"], ["apple-mobile-web-app-title", "Farejadinhos"], ["theme-color", "#E5232E"]].forEach(function (m) {
            if (document.querySelector("meta[name='" + m[0] + "']")) return;
            var e = document.createElement("meta"); e.name = m[0]; e.content = m[1]; head.appendChild(e);
        });
        if (!document.querySelector("link[rel=apple-touch-icon]")) {
            var i = document.createElement("link"); i.rel = "apple-touch-icon"; i.href = "/assets/favicon-180.png"; head.appendChild(i);
        }
    }
    var atual = document.currentScript;
    var tags = document.querySelectorAll("script[src*='assets/topo.js']");
    var eu = atual || tags[tags.length - 1];
    var base = (eu && eu.getAttribute("data-base")) || "";
    if (/\/painel\//.test(location.pathname)) return;
    var s = document.createElement("script");
    s.src = base + "assets/avisos-push.js";
    s.defer = true;
    document.head.appendChild(s);
})();
