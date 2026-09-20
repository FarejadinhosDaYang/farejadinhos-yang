/**
 * Farejadinhos da Yang — menu "três tracinhos"
 *
 * Uso: <div data-yang-nav data-base="../"></div>
 * data-base = caminho relativo até a raiz do site (ex.: "" na home,
 * "../" numa página de 1 nível, "../../" numa de 2 níveis).
 */

(function () {

    function montarNav(el) {
        var base = el.getAttribute("data-base") || "";

        el.innerHTML =
            '<button type="button" class="yang-nav-toggle" aria-label="Abrir menu">' +
            '<span></span><span></span><span></span>' +
            "</button>" +

            '<div class="yang-nav-backdrop"></div>' +

            '<nav class="yang-nav-drawer">' +
            '<div class="yang-nav-drawer-head">' +
            '<div class="yang-nav-drawer-head-brand">' +
            '<img src="' + base + 'assets/yang-badge.png" alt="Yang">' +
            "<b>Farejadinhos da Yang</b>" +
            "</div>" +
            '<button type="button" class="yang-nav-close" aria-label="Fechar menu">✕</button>' +
            "</div>" +
            '<a href="' + base + 'index.html">🏠 Início</a>' +
            '<a href="' + base + 'ofertas/">🔥 Todas as ofertas</a>' +
            '<a href="' + base + 'calculadora/">🧮 Vale a pena parcelar?</a>' +
            '<a href="https://www.instagram.com/farejadinhosdayang" target="_blank" rel="noopener">📸 Instagram</a>' +
            "</nav>";

        var toggle = el.querySelector(".yang-nav-toggle");
        var closeBtn = el.querySelector(".yang-nav-close");
        var backdrop = el.querySelector(".yang-nav-backdrop");

        function abrir() {
            el.classList.add("yang-nav-open");
        }
        function fechar() {
            el.classList.remove("yang-nav-open");
        }

        toggle.addEventListener("click", function () {
            el.classList.contains("yang-nav-open") ? fechar() : abrir();
        });
        closeBtn.addEventListener("click", fechar);
        backdrop.addEventListener("click", fechar);
    }

    document.addEventListener("DOMContentLoaded", function () {
        var navs = document.querySelectorAll("[data-yang-nav]");
        for (var i = 0; i < navs.length; i++) {
            montarNav(navs[i]);
        }
    });

})();
