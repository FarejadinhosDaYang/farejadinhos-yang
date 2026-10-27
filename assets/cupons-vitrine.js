/**
 * Farejadinhos da Yang — "🏷️ Cupons de hoje" (área de cupons do site)
 *
 * Lê cupons.json (publicado pelo painel: painel/cupons.html) e mostra:
 *   - na página inicial: faixa de cupons em <section id="cuponsSecao">;
 *   - na página da oferta: os cupons da loja daquele produto, pra testar.
 * Cupom vencido (campo "ate") some sozinho.
 *
 * Uso: <script src="assets/cupons-vitrine.js" data-base=""></script>
 *   (data-base = caminho até a raiz do site)
 * FarejadinhosCuponsVitrine.naOferta(oferta, elementoDepois) — usado pelo relacionados.js
 */
(function () {
    var script = document.currentScript;
    var base = (script && script.getAttribute("data-base")) || "";

    var LOJAS = {
        "Shopee": { id: "shopee", cor: "#EE4D2D", texto: "#fff" },
        "Mercado Livre": { id: "ml", cor: "#FFE600", texto: "#2D3277" },
        "Amazon": { id: "amazon", cor: "#232F3E", texto: "#fff" }
    };

    var css = document.createElement("style");
    css.textContent =
        ".cup-secao{margin-top:24px;scroll-margin-top:150px}" +
        ".cup-secao .secao-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}" +
        ".cup-abas{display:flex;gap:6px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:none}" +
        ".cup-abas::-webkit-scrollbar{display:none}" +
        ".cup-aba{flex:0 0 auto;border:1.5px solid #F0DFC4;background:#fff;border-radius:999px;padding:6px 12px;font:700 13px 'Work Sans',Arial,sans-serif;color:#2B1B12;cursor:pointer}" +
        ".cup-aba.ativa{background:#E5232E;border-color:#E5232E;color:#fff}" +
        ".cup-faixa{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 2px 12px;scrollbar-width:thin}" +
        ".cup-card{flex:0 0 232px;scroll-snap-align:start;position:relative;background:#fff;border:1.5px solid #F0DFC4;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 6px 18px rgba(43,27,18,.07);font-family:'Work Sans',Arial,sans-serif;color:#2B1B12}" +
        ".cup-topo{display:flex;align-items:center;justify-content:space-between;padding:7px 12px;font:800 12.5px 'Work Sans',Arial,sans-serif}" +
        ".cup-topo small{font-weight:600;opacity:.85}" +
        ".cup-corpo{padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px;flex:1;border-top:2px dashed #F0DFC4;position:relative}" +
        ".cup-corpo:before,.cup-corpo:after{content:'';position:absolute;top:-9px;width:16px;height:16px;border-radius:50%;background:var(--cream,#FDF3E3)}" +
        ".cup-corpo:before{left:-9px}.cup-corpo:after{right:-9px}" +
        ".cup-valor{font:800 24px 'Baloo 2',Arial,sans-serif;line-height:1;color:#C21A24}" +
        ".cup-regra{font-size:12.5px;color:#5C4636;line-height:1.35}" +
        ".cup-obs{font-size:11.5px;color:#8A7563}" +
        ".cup-codigo{display:flex;flex-direction:column;align-items:stretch;gap:6px;margin-top:auto}" +
        ".cup-codigo code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;background:#FFF6E9;border:1.5px dashed #F7941D;border-radius:9px;padding:7px 8px;font:800 15px ui-monospace,Menlo,monospace;letter-spacing:.5px;text-align:center;flex:none}" +
        ".cup-copiar{border:0;border-radius:9px;padding:8px 10px;background:#E5232E;color:#fff;font:800 13px 'Work Sans',Arial,sans-serif;cursor:pointer;white-space:nowrap}" +
        ".cup-ir{display:block;text-align:center;font-size:12.5px;font-weight:700;color:#C21A24;text-decoration:none;padding:2px 0 0}" +
        ".cup-resgatar{margin-top:auto;display:block;text-align:center;border-radius:9px;padding:9px;font:800 13.5px 'Work Sans',Arial,sans-serif;text-decoration:none}" +
        ".cup-vazio{font-size:13.5px;color:#8A7563;padding:6px 2px 12px}" +
        ".cup-quando{font-size:12px;color:#8A7563}" +
        // na página da oferta
        ".cup-oferta{margin:14px 0 4px;text-align:left}" +
        ".cup-oferta h3{font:800 16px 'Baloo 2',Arial,sans-serif;margin:0 0 2px;color:#2B1B12}" +
        ".cup-oferta .cup-sub{font-size:12px;color:#8A7563;margin-bottom:8px}" +
        ".cup-oferta .cup-faixa{padding-bottom:6px}" +
        ".cup-oferta .cup-card{flex-basis:210px}" +
        ".cup-card.serve{border-color:#2E9E5B}" +
        ".cup-serve{position:absolute;top:34px;right:8px;background:#E6F6EC;color:#1F7A44;font-size:11px;font-weight:800;border-radius:999px;padding:2px 8px}";
    document.head.appendChild(css);

    function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }
    function dinheiro(n) { return "R$ " + Number(n).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".").replace(/,00$/, ""); }
    function numeroBR(t) {
        var s = String(t == null ? "" : t).replace(/[^\d.,]/g, "");
        if (!s) return 0;
        if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
        else if (/\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
        var n = parseFloat(s); return isFinite(n) ? n : 0;
    }

    var dados = null;
    function carregar() {
        if (dados) return dados;
        dados = fetch(base + "cupons.json?t=" + Math.floor(Date.now() / 60000), { cache: "no-store" })
            .then(function (r) { return r.ok ? r.json() : {}; })
            .catch(function () { return {}; })
            .then(function (d) {
                var agora = Date.now();
                d = d || {};
                d.cupons = (d.cupons || []).filter(function (c) {
                    var ate = Date.parse(c.ate || "");
                    return c && (c.codigo || c.link || c.titulo) && (!isFinite(ate) || ate > agora);
                });
                return d;
            });
        return dados;
    }

    function valorTxt(c) {
        if (c.titulo) return c.titulo;
        if (c.tipo === "%") return c.valor + "% OFF";
        if (c.tipo === "R$") return dinheiro(c.valor) + " OFF";
        if (c.tipo === "frete") return "Frete grátis";
        return c.codigo ? "Cupom de desconto" : "Cupons pra resgatar";
    }
    function regraTxt(c) {
        var p = [];
        if (c.tipo === "%" && c.teto) p.push("até " + dinheiro(c.teto) + " de desconto");
        if (c.minimo > 1) p.push("compras a partir de " + dinheiro(c.minimo));
        if (!p.length && !c.obs) p.push(c.codigo ? "Teste no carrinho antes de fechar" : "Resgate na página da loja");
        return p.join(" · ");
    }
    function quandoSome(c) {
        var ate = Date.parse(c.ate || "");
        if (!isFinite(ate)) return "";
        var h = (ate - Date.now()) / 3600000;
        if (h < 1) return "acaba em menos de 1h";
        if (h < 24) return "vale por mais " + Math.round(h) + "h";
        return "vale até " + new Date(ate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    }

    function copiar(texto, botao) {
        var ok = function () { var t = botao.textContent; botao.textContent = "✅ Copiado!"; setTimeout(function () { botao.textContent = t; }, 1600); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texto).then(ok, function () { prompt("Copie o cupom:", texto); });
        else prompt("Copie o cupom:", texto);
    }

    function cartao(c, paginas, serve) {
        var lj = LOJAS[c.loja] || { id: "outra", cor: "#8A7563", texto: "#fff" };
        var link = c.link || (paginas && paginas[c.loja]) || "";
        return '<div class="cup-card' + (serve ? " serve" : "") + '" data-loja="' + esc(c.loja || "") + '">' +
            '<div class="cup-topo" style="background:' + lj.cor + ";color:" + lj.texto + '"><span>' + esc(c.loja || "Cupom") + "</span><small>" + esc(quandoSome(c)) + "</small></div>" +
            (serve ? '<span class="cup-serve">✓ serve neste</span>' : "") +
            '<div class="cup-corpo">' +
            '<div class="cup-valor">' + esc(valorTxt(c)) + "</div>" +
            '<div class="cup-regra">' + esc(regraTxt(c)) + "</div>" +
            (c.obs ? '<div class="cup-obs">' + esc(c.obs) + "</div>" : "") +
            (c.codigo
                ? '<div class="cup-codigo"><code>' + esc(c.codigo) + '</code><button type="button" class="cup-copiar" data-codigo="' + esc(c.codigo) + '">📋 Copiar</button></div>' +
                  (link ? '<a class="cup-ir" href="' + esc(link) + '" target="_blank" rel="sponsored noopener">Ir pra ' + esc(c.loja || "loja") + " ↗</a>" : "")
                : (link ? '<a class="cup-resgatar" style="background:' + lj.cor + ";color:" + lj.texto + '" href="' + esc(link) + '" target="_blank" rel="sponsored noopener">🎟️ Resgatar na ' + esc(c.loja || "loja") + "</a>" : "")) +
            "</div></div>";
    }

    function ligarCopiar(raiz) {
        raiz.querySelectorAll(".cup-copiar").forEach(function (b) {
            b.onclick = function () { copiar(b.getAttribute("data-codigo"), b); };
        });
    }

    // ---------- página inicial ----------
    function naHome(secao) {
        carregar().then(function (d) {
            var cupons = d.cupons || [];
            if (!cupons.length) { secao.hidden = true; return; }
            var lojas = [];
            cupons.forEach(function (c) { if (c.loja && lojas.indexOf(c.loja) < 0) lojas.push(c.loja); });
            secao.hidden = false;
            secao.className = "cup-secao";
            secao.innerHTML =
                '<div class="secao-head"><h2>🏷️ Cupons de hoje</h2><span class="contagem cup-quando">' + cupons.length + " cupom" + (cupons.length > 1 ? "s" : "") + " pra testar · copie e use no carrinho</span></div>" +
                (lojas.length > 1 ? '<div class="cup-abas"><button type="button" class="cup-aba ativa" data-l="">Todos</button>' +
                    lojas.map(function (l) { return '<button type="button" class="cup-aba" data-l="' + esc(l) + '">' + esc(l) + "</button>"; }).join("") + "</div>" : "") +
                '<div class="cup-faixa">' + cupons.map(function (c) { return cartao(c, d.paginas); }).join("") + "</div>";
            ligarCopiar(secao);
            secao.querySelectorAll(".cup-aba").forEach(function (a) {
                a.onclick = function () {
                    secao.querySelectorAll(".cup-aba").forEach(function (x) { x.classList.toggle("ativa", x === a); });
                    var l = a.getAttribute("data-l");
                    secao.querySelectorAll(".cup-card").forEach(function (c) { c.style.display = !l || c.getAttribute("data-loja") === l ? "" : "none"; });
                    secao.querySelector(".cup-faixa").scrollLeft = 0;
                };
            });
        });
    }

    // ---------- página da oferta: cupons da mesma loja ----------
    function lojaDoLink(link) {
        var l = String(link || "").toLowerCase();
        if (/shopee|shp\.ee/.test(l)) return "Shopee";
        if (/mercadoli[bv]re|meli\.la/.test(l)) return "Mercado Livre";
        if (/amazon\.|amzn\.|a\.co\//.test(l)) return "Amazon";
        return "";
    }
    function naOferta(oferta, depois) {
        if (!oferta || !depois || !depois.parentNode) return;
        if (/celular/i.test(String(oferta.categoria || "").normalize("NFD").replace(/[̀-ͯ]/g, ""))) return;
        var loja = lojaDoLink(oferta.link);
        if (!loja) return;
        carregar().then(function (d) {
            var preco = numeroBR(oferta.preco);
            var da = (d.cupons || []).filter(function (c) { return c.loja === loja; });
            if (!da.length) return;
            // os que cabem no preço primeiro (pelas regras escritas; o carrinho é quem decide)
            var serve = function (c) { return (c.tipo === "%" || c.tipo === "R$") && (!c.minimo || preco >= c.minimo); };
            da.sort(function (a, b) { return serve(b) - serve(a); });
            var box = document.createElement("div");
            box.className = "cup-oferta";
            box.innerHTML = "<h3>🏷️ Cupons da " + esc(loja) + " pra testar</h3>" +
                '<div class="cup-sub">Copie e teste no carrinho — às vezes funciona mesmo quando a regra parece não bater.</div>' +
                '<div class="cup-faixa">' + da.map(function (c) { return cartao(c, d.paginas, serve(c)); }).join("") + "</div>";
            depois.parentNode.insertBefore(box, depois.nextSibling);
            ligarCopiar(box);
        });
    }

    window.FarejadinhosCuponsVitrine = { carregar: carregar, naOferta: naOferta, cartao: cartao, ligarCopiar: ligarCopiar };

    // Botões/links "🏷️ Cupons de hoje" (menu de cima e menu lateral):
    // a faixa só aparece depois que os cupons carregam e some quando a
    // vitrine está filtrada — então o clique é tratado aqui.
    function irParaCupons(e) {
        if (e) e.preventDefault();
        var fechar = document.querySelector(".yang-nav-close");
        if (fechar && document.querySelector(".yang-nav-open")) fechar.click();
        var secao = document.getElementById("cuponsSecao");
        var filtrada = /[?&](q|categoria|loja)=/.test(location.search);
        if (!secao || filtrada) { location.href = base + "index.html#cuponsSecao"; return; }
        carregar().then(function (d) {
            if (!(d.cupons || []).length) { avisoSemCupons(); return; }
            setTimeout(function () {
                if (secao.offsetParent === null) { location.href = base + "index.html#cuponsSecao"; return; }
                secao.scrollIntoView({ behavior: "smooth", block: "start" });
                if (history.replaceState) history.replaceState(null, "", location.pathname + location.search + "#cuponsSecao");
            }, 60);
        });
    }
    function avisoSemCupons() {
        var a = document.createElement("div");
        a.textContent = "🏷️ Ainda não tem cupons hoje — volte mais tarde!";
        a.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#2B1B12;color:#fff;padding:12px 16px;border-radius:12px;font:600 14px 'Work Sans',Arial,sans-serif;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:90vw;text-align:center";
        document.body.appendChild(a);
        setTimeout(function () { a.remove(); }, 3500);
    }
    document.addEventListener("click", function (e) {
        var a = e.target.closest && e.target.closest('a[href$="#cuponsSecao"]');
        if (a) irParaCupons(e);
    });

    function iniciar() {
        var secao = document.getElementById("cuponsSecao");
        if (secao) {
            naHome(secao);
            // chegou de outra página pelo link "Cupons de hoje": rola quando a faixa aparecer
            if (location.hash === "#cuponsSecao") {
                carregar().then(function (d) {
                    if (!(d.cupons || []).length) { avisoSemCupons(); return; }
                    setTimeout(function () { secao.scrollIntoView({ behavior: "smooth", block: "start" }); }, 150);
                });
            }
        }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();
