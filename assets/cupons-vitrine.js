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
        ".cup-secao .secao-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px}" +
        ".cup-secao .secao-head h2{margin:0}" +
        ".cup-abas{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}" +
        ".cup-abas::-webkit-scrollbar{display:none}" +
        ".cup-aba{flex:0 0 auto;border:1.5px solid #F0DFC4;background:#fff;border-radius:999px;padding:5px 12px;font:700 12.5px 'Work Sans',Arial,sans-serif;color:#5C4636;cursor:pointer}" +
        ".cup-aba.ativa{background:#2B1B12;border-color:#2B1B12;color:#fff}" +
        ".cup-faixa{display:flex;align-items:flex-start;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 10px;scrollbar-width:thin}" +
        // cartão = um "ticket" enxuto: loja + validade, código, (desconto)
        ".cup-card{flex:0 0 228px;scroll-snap-align:start;position:relative;background:#fff;border:1.5px solid #F0DFC4;border-radius:14px;padding:10px 12px 11px 16px;display:flex;flex-direction:column;gap:8px;font-family:'Work Sans',Arial,sans-serif;color:#2B1B12;box-shadow:0 3px 10px rgba(43,27,18,.05);overflow:hidden}" +
        ".cup-card:before{content:'';position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--cor)}" +
        ".cup-linha1{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:11.5px}" +
        ".cup-loja{font-weight:800;color:#2B1B12;text-decoration:none;display:inline-flex;align-items:center;gap:5px}" +
        ".cup-loja i{width:8px;height:8px;border-radius:50%;background:var(--cor);box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}" +
        ".cup-tempo{color:#8A7563;font-weight:600;white-space:nowrap}" +
        ".cup-cod{display:flex;align-items:stretch;border:1.5px dashed #E2CFAE;border-radius:10px;background:#FFFAF1;overflow:hidden}" +
        ".cup-cod code{flex:1;min-width:0;padding:8px 4px 8px 9px;font:800 14px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
        ".cup-copiar{border:0;border-left:1.5px dashed #E2CFAE;background:transparent;padding:0 9px;font:800 12.5px 'Work Sans',Arial,sans-serif;color:#C21A24;cursor:pointer;white-space:nowrap}" +
        ".cup-copiar:hover{background:#FFF1DE}" +
        ".cup-cod code.longo{font-size:12px}" +
        ".cup-copiar.ok{color:#1F7A44}" +
        ".cup-info{font-size:12px;color:#5C4636;line-height:1.3;min-height:16px}" +
        ".cup-info b{font:800 14px 'Baloo 2',Arial,sans-serif;color:#C21A24;margin-right:4px}" +
        ".cup-resgatar{display:block;text-align:center;border-radius:10px;padding:9px;font:800 13px 'Work Sans',Arial,sans-serif;text-decoration:none;background:var(--cor);color:var(--txt)}" +
        // na página da oferta
        ".cup-oferta{margin:14px 0 4px;text-align:left}" +
        ".cup-oferta h3{font:800 15px 'Baloo 2',Arial,sans-serif;margin:0 0 6px;color:#2B1B12}" +
        ".cup-oferta .cup-faixa{padding-bottom:6px}" +
        ".cup-card.serve{border-color:#9ED3B1}" +
        ".cup-serve{color:#1F7A44;font-weight:800}";
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

    // desconto em poucas palavras — só o que a mensagem informou de verdade
    function infoTxt(c) {
        var destaque = c.titulo || (c.tipo === "%" && c.valor ? c.valor + "% OFF" : c.tipo === "R$" && c.valor ? dinheiro(c.valor) + " OFF" : c.tipo === "frete" ? "Frete grátis" : "");
        var regras = [];
        if (c.tipo === "%" && c.teto) regras.push("até " + dinheiro(c.teto));
        if (c.minimo > 1) regras.push("mín. " + dinheiro(c.minimo));
        var obs = /^cupom do produto/i.test(c.obs || "") ? "" : (c.obs || "");
        if (obs) regras.push(obs);
        return (destaque ? "<b>" + esc(destaque) + "</b>" : "") + esc(regras.join(" · "));
    }
    function quandoSome(c) {
        var ate = Date.parse(c.ate || "");
        if (!isFinite(ate)) return "";
        var h = (ate - Date.now()) / 3600000;
        if (h < 1) return "⏳ últimos minutos";
        if (h < 24) return "⏳ " + Math.round(h) + "h";
        return "até " + new Date(ate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    }

    function copiar(texto, botao) {
        var ok = function () { var t = botao.textContent; botao.textContent = "Copiado ✓"; botao.classList.add("ok"); setTimeout(function () { botao.textContent = t; botao.classList.remove("ok"); }, 1600); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texto).then(ok, function () { prompt("Copie o cupom:", texto); });
        else prompt("Copie o cupom:", texto);
    }

    function cartao(c, paginas, serve) {
        var lj = LOJAS[c.loja] || { id: "outra", cor: "#8A7563", texto: "#fff" };
        var link = c.link || (paginas && paginas[c.loja]) || "";
        var info = infoTxt(c);
        var nomeLoja = esc(c.loja || "Cupom");
        return '<div class="cup-card' + (serve ? " serve" : "") + '" data-loja="' + esc(c.loja || "") + '" style="--cor:' + lj.cor + ";--txt:" + lj.texto + '">' +
            '<div class="cup-linha1">' +
            (link ? '<a class="cup-loja" href="' + esc(link) + '" target="_blank" rel="sponsored noopener"><i></i>' + nomeLoja + " ↗</a>" : '<span class="cup-loja"><i></i>' + nomeLoja + "</span>") +
            '<span class="cup-tempo">' + (serve ? '<span class="cup-serve">✓ serve aqui</span>' : esc(quandoSome(c))) + "</span></div>" +
            (c.codigo
                ? '<div class="cup-cod"><code' + (c.codigo.length > 13 ? ' class="longo"' : "") + ' title="' + esc(c.codigo) + '">' + esc(c.codigo) + '</code><button type="button" class="cup-copiar" data-codigo="' + esc(c.codigo) + '">Copiar</button></div>'
                : (link ? '<a class="cup-resgatar" href="' + esc(link) + '" target="_blank" rel="sponsored noopener">🎟️ Resgatar cupons</a>' : "")) +
            (info ? '<div class="cup-info">' + info + "</div>" : "") +
            "</div>";
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
                '<div class="secao-head"><h2>🏷️ Cupons de hoje</h2>' +
                (lojas.length > 1 ? '<div class="cup-abas"><button type="button" class="cup-aba ativa" data-l="">Todos</button>' +
                    lojas.map(function (l) { return '<button type="button" class="cup-aba" data-l="' + esc(l) + '">' + esc(l) + "</button>"; }).join("") + "</div>" : "") +
                "</div>" +
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
            box.innerHTML = "<h3>🏷️ Cupons da " + esc(loja) + " pra testar no carrinho</h3>" +
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
