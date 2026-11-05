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
            '<a href="' + base + 'index.html">🏠 Início e ofertas</a>' +
            '<details class="yang-nav-cats"><summary>🗂️ Categorias</summary><div class="yang-nav-cats-lista">Carregando…</div></details>' +
            '<a href="' + base + 'calculadora/">🧮 Vale a pena parcelar?</a>' +
            '<a href="https://www.instagram.com/farejadinhosdayang" target="_blank" rel="noopener">📸 Instagram</a>' +
            '<a href="#avisos" data-yang-push>🔔 Avisos de ofertas</a>' +
            '<a href="' + base + 'avisos/">📜 Avisos e privacidade</a>' +
            '<div class="yang-nav-cupons">' +
            '<span>Cupons das lojas</span>' +
            '<a class="yang-nav-cupom" href="' + base + 'index.html#cuponsSecao">🏷️ Cupons de hoje (copiar e usar)</a>' +
            '<a class="yang-nav-cupom" href="' + base + 'pedir/">🐶 Não achou? Pede pra Yang farejar</a>' +
            '<a class="yang-nav-cupom shopee" href="https://s.shopee.com.br/4VdOXKYQfW" target="_blank" rel="sponsored noopener">🏷️ Cupons Shopee</a>' +
            '<a class="yang-nav-cupom ml" href="https://www.mercadolivre.com.br/cupons?source_page=mperfil#nav-header" target="_blank" rel="sponsored noopener">🏷️ Cupons Mercado Livre</a>' +
            "</div>" +
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

        // Categorias (lista vem do topo.js: só as que têm oferta no ar)
        var detalhes = el.querySelector(".yang-nav-cats");
        var carregou = false;
        detalhes.addEventListener("toggle", function () {
            if (!detalhes.open || carregou) return;
            carregou = true;
            var lista = detalhes.querySelector(".yang-nav-cats-lista");
            if (!window.FarejadinhosCategoriasNoAr) { lista.textContent = ""; return; }
            window.FarejadinhosCategoriasNoAr().then(function (cats) {
                var esc = function (t) { var d = document.createElement("span"); d.textContent = t; return d.innerHTML.replace(/"/g, "&quot;"); };
                lista.innerHTML = cats.map(function (c) {
                    var link = '<a href="#" data-cat="' + esc(c.nome) + '">' +
                        '<span class="yang-nav-cat-ic" style="background:' + c.cor + '">' + c.icone + "</span>" +
                        esc(c.nome) + " <small>" + c.n + "</small></a>";
                    if (!c.subs || !c.subs.length) return link;
                    return '<div class="yang-nav-grupo"><div style="display:flex;align-items:center">' + link.replace("<a ", '<a style="flex:1" ') +
                        '<button type="button" class="yang-nav-seta" aria-expanded="false" aria-label="Subcategorias" style="order:-1;border:0;background:none;font-size:15px;padding:6px 4px 6px 0;cursor:pointer;color:inherit;transition:transform .18s">▸</button></div>' +
                        '<div class="yang-nav-subs" hidden style="margin-left:34px;border-left:2px solid rgba(0,0,0,.12);padding-left:8px">' +
                        c.subs.map(function (s) { return '<a href="#" data-cat="' + esc(s.valor) + '" style="font-size:.95em">' + esc(s.nome) + " <small>" + s.n + "</small></a>"; }).join("") +
                        "</div></div>";
                }).join("") || "Nenhuma categoria no ar.";
                lista.querySelectorAll(".yang-nav-seta").forEach(function (b) {
                    b.addEventListener("click", function (e) {
                        e.preventDefault(); e.stopPropagation();
                        var subs = b.closest(".yang-nav-grupo").querySelector(".yang-nav-subs");
                        var abrir = subs.hidden;
                        subs.hidden = !abrir;
                        b.setAttribute("aria-expanded", abrir ? "true" : "false");
                        b.style.transform = abrir ? "rotate(90deg)" : "";
                    });
                });
                lista.querySelectorAll("a").forEach(function (a) {
                    a.addEventListener("click", function (e) {
                        e.preventDefault();
                        fechar();
                        if (window.farejaAbrirCategoria) window.farejaAbrirCategoria(a.getAttribute("data-cat"));
                    });
                });
            });
        });

        var linkPush = el.querySelector("[data-yang-push]");
        if (linkPush) linkPush.addEventListener("click", function (e) {
            if (!window.farejaAbrirAvisos) return;   // sem o script, o #avisos abre a janela ao carregar
            e.preventDefault();
            fechar();
            window.farejaAbrirAvisos();
        });

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
