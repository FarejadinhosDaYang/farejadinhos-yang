/**
 * Farejadinhos da Yang — "voltar pra onde eu estava"
 *
 * Carregado pelo topo.js em todas as páginas.
 *
 * Na página inicial: quando a pessoa clica numa oferta, guarda onde ela estava
 * (filtro, busca e o card clicado). Ao voltar, a home rola de novo até esse card,
 * mesmo com a lista montada depois de carregar as ofertas.
 *
 * Nas outras páginas (oferta, pedir, calculadora...): põe um botão "← Voltar"
 * no alto. Se a pessoa veio de dentro do site, volta pro lugar exato; se chegou
 * de fora (Instagram, Google), leva pra página inicial.
 */
(function () {
    var script = document.currentScript;
    var base = (script && script.getAttribute("data-base")) || "";
    var home = script && script.getAttribute("data-home") === "1";
    var CHAVE = "fareja_volta";
    var FLAG = "fareja_restaurar";

    function ler(k) { try { return JSON.parse(sessionStorage.getItem(k) || "null"); } catch (e) { return null; } }
    function gravar(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function apagar(k) { try { sessionStorage.removeItem(k); } catch (e) {} }

    // "/", "/index.html" e "/?categoria=Casa" -> mesma chave sem o "index.html" e sem o "#"
    function lugarAtual() { return location.pathname.replace(/index\.html$/, "") + location.search; }

    if (home) paginaInicial(); else outrasPaginas();

    // ======================================================
    // PÁGINA INICIAL
    // ======================================================
    function paginaInicial() {
        // guarda o card clicado (qualquer link que vá pra uma oferta)
        document.addEventListener("click", function (e) {
            var a = e.target.closest && e.target.closest("a[href]");
            if (!a) return;
            var href = a.getAttribute("href");
            if (!/(^|\/)ofertas\//.test(href) || a.target === "_blank") return;
            var iguais = Array.prototype.slice.call(document.querySelectorAll("a[href]"))
                .filter(function (x) { return x.getAttribute("href") === href; });
            gravar(CHAVE, {
                lugar: lugarAtual(),
                href: href,
                n: Math.max(0, iguais.indexOf(a)),
                topo: Math.round(a.getBoundingClientRect().top),
                y: Math.round(window.scrollY)
            });
        }, true);

        // saiu por outro caminho (busca do topo, menu...): guarda pelo menos a altura
        window.addEventListener("pagehide", function () {
            var s = ler(CHAVE);
            if (s && s.lugar === lugarAtual()) { s.y = Math.round(window.scrollY); gravar(CHAVE, s); }
        });

        var salvo = ler(CHAVE);
        var nav = (performance.getEntriesByType && performance.getEntriesByType("navigation")[0]) || {};
        var voltando = nav.type === "back_forward" || ler(FLAG);
        apagar(FLAG);
        if (!salvo || !voltando || salvo.lugar !== lugarAtual()) return;

        if ("scrollRestoration" in history) history.scrollRestoration = "manual";

        var parou = false;
        function pessoaMexeu() { parou = true; }
        ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (ev) {
            window.addEventListener(ev, pessoaMexeu, { once: true, passive: true });
        });

        function rolar() {
            if (parou) return;
            var alvo = Array.prototype.slice.call(document.querySelectorAll("a[href]"))
                .filter(function (x) { return x.getAttribute("href") === salvo.href; })[salvo.n];
            if (alvo && alvo.offsetParent !== null) {
                window.scrollTo(0, alvo.getBoundingClientRect().top + window.scrollY - salvo.topo);
            } else {
                window.scrollTo(0, salvo.y);
            }
        }

        // as ofertas chegam depois (ofertas.json) e as seções de cima crescem aos poucos:
        // rola quando a lista aparece e de novo algumas vezes, até a página assentar
        var feito = false;
        function quandoPronto() {
            if (feito) return;
            feito = true;
            [0, 120, 400, 900, 1600].forEach(function (ms) { setTimeout(rolar, ms); });
            setTimeout(function () { if ("scrollRestoration" in history) history.scrollRestoration = "auto"; }, 2000);
        }
        if (window.farejaUltimaLista) quandoPronto();
        else document.addEventListener("fareja:lista", quandoPronto, { once: true });
    }

    // ======================================================
    // OUTRAS PÁGINAS: botão "← Voltar"
    // ======================================================
    function outrasPaginas() {
        if (/\/painel\//.test(location.pathname)) return;

        var doSite = false;
        try { doSite = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) {}
        var podeVoltar = doSite && history.length > 1;
        var salvo = ler(CHAVE);

        function voltar(e) {
            if (e) e.preventDefault();
            if (podeVoltar) { history.back(); return; }
            // sem histórico (ex.: navegador do Instagram): reabre a home no mesmo filtro e posição
            if (salvo && salvo.lugar) {
                gravar(FLAG, 1);
                location.href = base + "index.html" + salvo.lugar.replace(/^[^?]*/, "");
                return;
            }
            location.href = base + "index.html";
        }

        var css = document.createElement("style");
        css.textContent =
            ".yt-voltar{display:inline-flex;align-items:center;gap:6px;margin:12px 0 4px;padding:8px 16px 8px 12px;" +
            "border:2px solid #2B1B12;border-radius:999px;background:#fff;color:#2B1B12;font:700 15px/1.1 'Work Sans',system-ui,sans-serif;" +
            "cursor:pointer;box-shadow:0 2px 0 #2B1B12;-webkit-tap-highlight-color:transparent}" +
            ".yt-voltar:hover{background:#FFF4E5}.yt-voltar:active{transform:translateY(2px);box-shadow:none}" +
            ".yt-voltar svg{width:18px;height:18px;flex:none}";
        document.head.appendChild(css);

        function colocar() {
            if (document.querySelector(".yt-voltar")) return;
            var alvo = document.querySelector("body > .wrap, .yt-layout main, main, .wrap");
            if (!alvo) return;
            var b = document.createElement("button");
            b.type = "button";
            b.className = "yt-voltar";
            b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>' +
                (podeVoltar || salvo ? "Voltar" : "Ver mais ofertas");
            b.setAttribute("aria-label", podeVoltar || salvo ? "Voltar pra página anterior" : "Ver mais ofertas na página inicial");
            b.addEventListener("click", voltar);
            alvo.insertBefore(b, alvo.firstChild);

            // o "← voltar pro início" do pé da oferta também volta pro lugar certo
            var pe = document.querySelector("a.back");
            if (pe && (podeVoltar || salvo)) {
                pe.innerHTML = "&larr; voltar pra onde eu estava";
                pe.addEventListener("click", voltar);
            }
        }
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", colocar);
        else colocar();
    }
})();
